// Nodevision/ApplicationSystem/public/HandwritingRecognition/NativeCppRecognizer.mjs
// This module adapts the experimental native C++ handwriting API to the browser panel's shared recognition result shape while preserving safe fallback behavior.

import { HandwritingRecognizer, makeUnavailableRecognitionResult } from "./HandwritingRecognizer.mjs";

const PROTOCOL_VERSION = 1;
let requestCounter = 0;

function safeText(value, maxLength = 160) {
  return String(value ?? "").replace(/\u0000/g, "").slice(0, maxLength);
}

function clamp01(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : 0;
}

function nextRequestId() {
  requestCounter += 1;
  return `hw-${Date.now()}-${String(requestCounter).padStart(3, "0")}`;
}

function normalizePoint(point = {}) {
  return {
    x: Number(point.x),
    y: Number(point.y),
    time: Number.isFinite(Number(point.time)) ? Number(point.time) : Number(point.t || 0),
    pressure: clamp01(point.pressure ?? 0.5),
  };
}

function makeNativeRequest(glyph = {}, options = {}) {
  return {
    protocolVersion: PROTOCOL_VERSION,
    requestId: safeText(options.requestId || nextRequestId(), 128),
    operation: "recognize",
    mode: "single-character",
    canvas: {
      width: Number(glyph?.canvas?.width),
      height: Number(glyph?.canvas?.height),
    },
    strokes: (Array.isArray(glyph.strokes) ? glyph.strokes : []).map((stroke) => ({
      pointerType: safeText(stroke?.pointerType || glyph.pointerType || "unknown", 32),
      points: (Array.isArray(stroke?.points) ? stroke.points : []).map(normalizePoint),
    })),
    options: {
      candidateLimit: Math.max(1, Math.min(20, Math.floor(Number(options.candidateLimit || 5)))),
      characterSet: safeText(options.characterSet || "latin-alphanumeric", 64),
      preserveStrokeOrder: options.preserveStrokeOrder !== false,
      usePressure: options.usePressure === true,
    },
  };
}

export function normalizeNativeCppApiResponse(response, engineId = "native-cpp") {
  if (!response || typeof response !== "object") {
    return makeUnavailableRecognitionResult(engineId, "INVALID_NATIVE_RESPONSE", "The native recognizer returned an invalid response.");
  }
  if (response.ok !== true) {
    return makeUnavailableRecognitionResult(
      engineId,
      safeText(response?.error?.code || "NATIVE_UNAVAILABLE", 64),
      safeText(response?.error?.message || "The native recognizer is unavailable.")
    );
  }
  const candidates = (Array.isArray(response?.result?.candidates) ? response.result.candidates : [])
    .slice(0, 10)
    .map((candidate) => ({
      text: safeText(candidate?.text || "", 8),
      confidence: clamp01(candidate?.confidence),
      score: clamp01(candidate?.confidence),
      templateId: safeText(candidate?.templateId || "", 96),
      engine: engineId,
      evidence: { source: "native-cpp" },
    }))
    .filter((candidate) => candidate.text);
  const best = candidates[0] || null;
  return {
    ok: true,
    engineId,
    engine: {
      name: safeText(response?.engine?.name || "nodevision-cpp-handwriting", 80),
      version: safeText(response?.engine?.version || "", 32),
    },
    text: safeText(response?.result?.text || best?.text || "", 8),
    confidence: clamp01(response?.result?.confidence ?? best?.confidence),
    candidates,
    normalizedBounds: response?.result?.normalizedBounds || null,
    warnings: Array.isArray(response.warnings) ? response.warnings.map((warning) => safeText(warning, 160)) : [],
    fallbackAllowed: false,
  };
}

export function nativeCppResultToStrokeResult(result, lowConfidenceThreshold = 0.46) {
  if (!result?.ok) {
    return {
      recognizerVersion: "native-cpp/unavailable",
      status: "unavailable",
      candidates: [],
      diagnostics: {
        recognitionDurationMs: 0,
        templateErrors: [{ error: result?.error?.message || "Native recognizer unavailable", code: result?.error?.code || "NATIVE_UNAVAILABLE" }],
      },
    };
  }
  const candidates = result.candidates.map((candidate) => ({
    character: candidate.text,
    text: candidate.text,
    score: candidate.score,
    confidence: candidate.confidence,
    templateId: candidate.templateId,
    diagnostics: {
      components: { nativeConfidence: candidate.confidence },
      engine: result.engineId,
    },
  }));
  const best = candidates[0] || null;
  return {
    recognizerVersion: `${result.engine?.name || "nodevision-cpp-handwriting"}/${result.engine?.version || ""}`,
    status: best ? (best.score < lowConfidenceThreshold ? "low-confidence" : "success") : "empty",
    candidates,
    diagnostics: {
      recognitionDurationMs: 0,
      rawStrokeCount: 0,
      filteredPointCount: 0,
      normalizedBounds: result.normalizedBounds || null,
      selectedTemplateId: best?.templateId || "",
      templateErrors: [],
      duplicateTemplateIds: [],
      nativeWarnings: result.warnings || [],
      engine: result.engine || null,
    },
  };
}

export class NativeCppRecognizer extends HandwritingRecognizer {
  constructor({ statusUrl = "/api/handwriting/native/status", recognizeUrl = "/api/handwriting/native/recognize" } = {}) {
    super();
    this.statusUrl = statusUrl;
    this.recognizeUrl = recognizeUrl;
  }

  get id() {
    return "native-cpp";
  }

  async isAvailable({ signal } = {}) {
    try {
      const res = await fetch(this.statusUrl, { cache: "no-store", credentials: "include", signal });
      if (!res.ok) return false;
      const status = await res.json();
      return Boolean(status?.enabled && status?.available && status?.protocolVersion === PROTOCOL_VERSION);
    } catch {
      return false;
    }
  }

  async recognize(glyph, options = {}) {
    const request = makeNativeRequest(glyph, options);
    try {
      const res = await fetch(this.recognizeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        signal: options.signal,
        body: JSON.stringify(request),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok && !data) {
        return makeUnavailableRecognitionResult(this.id, "NATIVE_UNAVAILABLE", "The native recognizer is unavailable.");
      }
      return normalizeNativeCppApiResponse(data, this.id);
    } catch (err) {
      if (err?.name === "AbortError") throw err;
      return makeUnavailableRecognitionResult(this.id, "NATIVE_UNAVAILABLE", "The native recognizer could not be reached.");
    }
  }
}

export const nativeCppRecognizerInternals = Object.freeze({
  makeNativeRequest,
  normalizeNativeCppApiResponse,
  nativeCppResultToStrokeResult,
});
