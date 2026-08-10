// Nodevision/ApplicationSystem/server/handwriting/NativeHandwritingProtocol.mjs
// This module validates browser requests and native recognizer responses at the JSON protocol boundary before any result can influence the handwriting panel.

import {
  NATIVE_HANDWRITING_LIMITS,
  NATIVE_HANDWRITING_PROTOCOL_VERSION,
} from "./NativeHandwritingConfig.mjs";

function safeError(code, message) {
  return { ok: false, error: { code, message } };
}

export function responseError(code, message, extra = {}) {
  return { ok: false, fallbackAllowed: true, error: { code, message }, ...extra };
}

export function validateStrokePayload(payload) {
  const strokes = Array.isArray(payload?.strokes) ? payload.strokes : [];
  if (!strokes.length) return safeError("INVALID_STROKES", "No stroke data was provided.");
  if (strokes.length > NATIVE_HANDWRITING_LIMITS.maxStrokes) return safeError("TOO_MANY_STROKES", "Too many strokes were provided.");
  let totalPoints = 0;
  for (const stroke of strokes) {
    const points = Array.isArray(stroke?.points) ? stroke.points : [];
    if (!points.length) return safeError("INVALID_STROKES", "Each stroke must contain points.");
    if (points.length > NATIVE_HANDWRITING_LIMITS.maxPointsPerStroke) return safeError("TOO_MANY_POINTS", "A stroke contains too many points.");
    totalPoints += points.length;
    if (totalPoints > NATIVE_HANDWRITING_LIMITS.maxTotalPoints) return safeError("TOO_MANY_POINTS", "The request contains too many points.");
    for (const point of points) {
      const x = Number(point?.x);
      const y = Number(point?.y);
      const time = Number(point?.time ?? point?.t ?? 0);
      const pressure = Number(point?.pressure ?? 0.5);
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(time) || time < 0 || !Number.isFinite(pressure) || pressure < 0 || pressure > 1) {
        return safeError("INVALID_STROKES", "Stroke points must contain finite coordinates, timestamps, and pressure values.");
      }
    }
  }
  const width = Number(payload?.canvas?.width);
  const height = Number(payload?.canvas?.height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return safeError("INVALID_STROKES", "Canvas dimensions must be positive numbers.");
  }
  return { ok: true };
}

export function validateNativeResponse(parsed, requestId) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return responseError("INVALID_NATIVE_RESPONSE", "The native engine returned an invalid response.");
  if (parsed.protocolVersion !== NATIVE_HANDWRITING_PROTOCOL_VERSION) return responseError("INVALID_NATIVE_RESPONSE", "The native engine returned an unsupported protocol version.");
  if (String(parsed.requestId || "") !== String(requestId || "")) return responseError("INVALID_NATIVE_RESPONSE", "The native engine returned a mismatched request identifier.");
  if (parsed.ok !== true) {
    const code = String(parsed?.error?.code || "RECOGNITION_FAILED").slice(0, 64);
    const message = String(parsed?.error?.message || "The native handwriting engine could not recognize this input.").slice(0, 240);
    return responseError(code, message);
  }
  const result = parsed.result && typeof parsed.result === "object" ? parsed.result : null;
  const candidates = Array.isArray(result?.candidates) ? result.candidates : [];
  const cleanCandidates = candidates.slice(0, 20).map((candidate) => ({
    text: String(candidate?.text || "").slice(0, 8),
    confidence: Math.max(0, Math.min(1, Number(candidate?.confidence) || 0)),
    templateId: String(candidate?.templateId || "").slice(0, 96),
  })).filter((candidate) => candidate.text);
  const confidence = Math.max(0, Math.min(1, Number(result?.confidence) || cleanCandidates[0]?.confidence || 0));
  return {
    ok: true,
    protocolVersion: NATIVE_HANDWRITING_PROTOCOL_VERSION,
    engine: {
      name: String(parsed?.engine?.name || "nodevision-cpp-handwriting").slice(0, 80),
      version: String(parsed?.engine?.version || "").slice(0, 32),
    },
    result: {
      text: String(result?.text || cleanCandidates[0]?.text || "").slice(0, 8),
      confidence,
      candidates: cleanCandidates,
      normalizedBounds: {
        x: Math.max(0, Math.min(1, Number(result?.normalizedBounds?.x) || 0)),
        y: Math.max(0, Math.min(1, Number(result?.normalizedBounds?.y) || 0)),
        width: Math.max(0, Math.min(1, Number(result?.normalizedBounds?.width) || 0)),
        height: Math.max(0, Math.min(1, Number(result?.normalizedBounds?.height) || 0)),
      },
    },
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings.slice(0, 10).map((item) => String(item).slice(0, 160)) : [],
    fallbackAllowed: false,
  };
}
