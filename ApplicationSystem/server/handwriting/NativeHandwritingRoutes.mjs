// Nodevision/ApplicationSystem/server/handwriting/NativeHandwritingRoutes.mjs
// This module registers authenticated local API routes for checking and invoking the experimental C++ handwriting recognition service.

import { createNativeHandwritingService, NATIVE_HANDWRITING_LIMITS } from "./NativeHandwritingService.mjs";

function requireIdentity(req, res, next) {
  if (req.identity) return next();
  return res.status(401).json({ error: "Authentication required" });
}

function bodySize(req) {
  try {
    return Buffer.byteLength(JSON.stringify(req.body || {}), "utf8");
  } catch {
    return NATIVE_HANDWRITING_LIMITS.maxRequestBytes + 1;
  }
}

export function registerNativeHandwritingRoutes(app, ctx, options = {}) {
  const service = options.service || createNativeHandwritingService(ctx, options);

  app.get("/api/handwriting/native/status", requireIdentity, async (req, res) => {
    try {
      const status = await service.status();
      res.json({
        available: Boolean(status.available),
        enabled: Boolean(status.enabled),
        protocolVersion: status.protocolVersion,
        engineVersion: status.engineVersion || "",
      });
    } catch {
      res.json({ available: false, enabled: false, protocolVersion: 1, engineVersion: "" });
    }
  });

  app.post("/api/handwriting/native/recognize", requireIdentity, async (req, res) => {
    if (bodySize(req) > NATIVE_HANDWRITING_LIMITS.maxRequestBytes) {
      return res.status(413).json({
        ok: false,
        fallbackAllowed: true,
        error: { code: "REQUEST_TOO_LARGE", message: "The handwriting recognition request is too large." },
      });
    }
    try {
      const result = await service.recognize(req.body || {});
      const status = result.ok ? 200 : (result.error?.code === "REQUEST_TOO_LARGE" ? 413 : 200);
      return res.status(status).json(result);
    } catch {
      return res.json({
        ok: false,
        fallbackAllowed: true,
        error: { code: "RECOGNITION_FAILED", message: "The native handwriting recognizer failed safely." },
      });
    }
  });
}
