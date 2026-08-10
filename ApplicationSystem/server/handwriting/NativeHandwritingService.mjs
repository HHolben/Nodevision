// Nodevision/ApplicationSystem/server/handwriting/NativeHandwritingService.mjs
// This module coordinates the server-side boundary to the experimental C++ handwriting executable while delegating configuration, process execution, and protocol validation to focused modules.

import path from "node:path";
import {
  canExecute,
  clampInt,
  defaultAllowedExecutableRoots,
  defaultExecutableCandidates,
  NATIVE_HANDWRITING_LIMITS,
  NATIVE_HANDWRITING_PROTOCOL_VERSION,
  resolveNativeHandwritingConfig,
  isWithin,
} from "./NativeHandwritingConfig.mjs";
import { responseError, validateNativeResponse, validateStrokePayload } from "./NativeHandwritingProtocol.mjs";
import { runNativeJson } from "./NativeHandwritingProcess.mjs";

export {
  NATIVE_HANDWRITING_LIMITS,
  NATIVE_HANDWRITING_PROTOCOL_VERSION,
  resolveNativeHandwritingConfig,
};

export function createNativeHandwritingService(ctx, options = {}) {
  const allowedRoots = options.allowedExecutableRoots || defaultAllowedExecutableRoots(ctx);
  let cachedStatus = null;
  let cachedAt = 0;

  async function resolveExecutable(settings) {
    const configured = String(settings.executablePath || "").trim();
    const candidates = configured
      ? [path.isAbsolute(configured) ? configured : path.join(ctx.runtimeRoot, configured)]
      : defaultExecutableCandidates(ctx);
    for (const candidate of candidates) {
      const resolved = path.resolve(candidate);
      if (!allowedRoots.some((root) => isWithin(root, resolved))) continue;
      if (await canExecute(resolved)) return resolved;
    }
    return "";
  }

  async function status({ force = false } = {}) {
    if (!force && cachedStatus && Date.now() - cachedAt < 2000) return cachedStatus;
    const settings = await resolveNativeHandwritingConfig(ctx, options);
    if (!settings.enabled) {
      cachedStatus = { available: false, enabled: false, protocolVersion: NATIVE_HANDWRITING_PROTOCOL_VERSION, engineVersion: "", reason: "disabled" };
      cachedAt = Date.now();
      return cachedStatus;
    }
    const executablePath = await resolveExecutable(settings);
    if (!executablePath) {
      cachedStatus = { available: false, enabled: true, protocolVersion: NATIVE_HANDWRITING_PROTOCOL_VERSION, engineVersion: "", reason: "missing" };
      cachedAt = Date.now();
      return cachedStatus;
    }
    const result = await runNativeJson(executablePath, ["--capabilities"], "", Math.min(settings.timeoutMs, 1000));
    if (!result.ok) {
      cachedStatus = { available: false, enabled: true, protocolVersion: NATIVE_HANDWRITING_PROTOCOL_VERSION, engineVersion: "", reason: result.error?.code || "unavailable" };
      cachedAt = Date.now();
      return cachedStatus;
    }
    try {
      const capabilities = JSON.parse(String(result.stdout || "").trim());
      cachedStatus = {
        available: capabilities?.protocolVersion === NATIVE_HANDWRITING_PROTOCOL_VERSION,
        enabled: true,
        protocolVersion: NATIVE_HANDWRITING_PROTOCOL_VERSION,
        engineVersion: String(capabilities?.version || "").slice(0, 32),
      };
    } catch {
      cachedStatus = { available: false, enabled: true, protocolVersion: NATIVE_HANDWRITING_PROTOCOL_VERSION, engineVersion: "", reason: "invalid-capabilities" };
    }
    cachedAt = Date.now();
    return cachedStatus;
  }

  async function recognize(payload = {}) {
    const settings = await resolveNativeHandwritingConfig(ctx, options);
    if (!settings.enabled) return responseError("NATIVE_UNAVAILABLE", "The experimental C++ handwriting engine is disabled.");
    const executablePath = await resolveExecutable(settings);
    if (!executablePath) return responseError("NATIVE_UNAVAILABLE", "The experimental C++ handwriting engine is not available.");

    const request = {
      protocolVersion: NATIVE_HANDWRITING_PROTOCOL_VERSION,
      requestId: String(payload.requestId || `hw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`).slice(0, 128),
      operation: "recognize",
      mode: "single-character",
      canvas: {
        width: Number(payload?.canvas?.width),
        height: Number(payload?.canvas?.height),
      },
      strokes: Array.isArray(payload.strokes) ? payload.strokes : [],
      options: {
        candidateLimit: clampInt(payload?.options?.candidateLimit, settings.candidateLimit, 1, 20),
        characterSet: String(payload?.options?.characterSet || "latin-alphanumeric").slice(0, 64),
        preserveStrokeOrder: payload?.options?.preserveStrokeOrder !== false,
        usePressure: payload?.options?.usePressure === true,
      },
    };
    const validation = validateStrokePayload(request);
    if (!validation.ok) return responseError(validation.error.code, validation.error.message);
    const stdinText = `${JSON.stringify(request)}\n`;
    if (Buffer.byteLength(stdinText, "utf8") > NATIVE_HANDWRITING_LIMITS.maxRequestBytes) {
      return responseError("REQUEST_TOO_LARGE", "The handwriting recognition request is too large.");
    }

    const processResult = await runNativeJson(executablePath, ["--recognize"], stdinText, settings.timeoutMs);
    if (!processResult.ok) return processResult;
    let parsed;
    try {
      parsed = JSON.parse(String(processResult.stdout || "").trim());
    } catch {
      return responseError("INVALID_NATIVE_RESPONSE", "The native handwriting engine returned malformed JSON.");
    }
    return validateNativeResponse(parsed, request.requestId);
  }

  return Object.freeze({ status, recognize, resolveExecutable });
}

export const nativeHandwritingServiceInternals = Object.freeze({
  validateStrokePayload,
  validateNativeResponse,
  resolveNativeHandwritingConfig,
  defaultExecutableCandidates,
  defaultAllowedExecutableRoots,
  isWithin,
});
