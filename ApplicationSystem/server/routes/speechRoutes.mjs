// Nodevision/ApplicationSystem/server/routes/speechRoutes.mjs
// This module exposes a narrow authenticated speech backend for trusted offline Linux TTS providers without exposing generic process execution.

import { createEspeakCliProvider } from "../speech/EspeakCliProvider.mjs";
import { createEspeakNativeBridgeProvider } from "../speech/EspeakNativeBridgeProvider.mjs";

function authenticated(req, res) {
  if (req.identity) return true;
  res.status(401).json({ ok: false, error: "Authentication required" });
  return false;
}

function routeError(res, err, status = 400) {
  return res.status(status).json({ ok: false, error: err?.message || String(err) });
}

function safeText(value) {
  const text = String(value ?? "");
  if (!text.trim()) throw new Error("Speech text is required.");
  if (text.length > 100000) throw new Error("Speech text is too long for one utterance.");
  return text;
}

function providerList(ctx, options = {}) {
  if (Array.isArray(options.providers)) return options.providers;
  if (options.provider) return [options.provider];
  return [createEspeakNativeBridgeProvider(ctx), createEspeakCliProvider()];
}

function providerById(providers, providerId = "") {
  return providers.find((provider) => provider.id === String(providerId || "")) || null;
}

async function firstAvailable(providers) {
  for (const provider of providers) {
    const status = await provider.isAvailable();
    if (status.available) return provider;
  }
  return null;
}

async function statusPayload(provider) {
  const status = await provider.isAvailable();
  return {
    id: provider.id,
    label: provider.label,
    available: Boolean(status.available),
    reason: status.reason || "",
    capabilities: provider.capabilities,
  };
}

export function registerSpeechRoutes(app, ctx, options = {}) {
  const providers = providerList(ctx, options);

  app.get("/api/speech/providers", async (req, res) => {
    if (!authenticated(req, res)) return;
    return res.json({ ok: true, providers: await Promise.all(providers.map(statusPayload)) });
  });

  app.post("/api/speech/speak", async (req, res) => {
    if (!authenticated(req, res)) return;
    try {
      const requested = providerById(providers, req.body?.providerId);
      const provider = requested || await firstAvailable(providers);
      if (!provider) throw new Error("No usable offline speech provider is available.");
      const result = provider.speak({
        text: safeText(req.body?.text),
        rate: req.body?.rate,
        voice: req.body?.voice,
        utteranceId: String(req.body?.utteranceId || ""),
      });
      return res.json({ providerId: provider.id, ...result });
    } catch (err) {
      return routeError(res, err, /available|built|installed/i.test(err?.message || "") ? 503 : 400);
    }
  });

  app.post("/api/speech/stop", (req, res) => {
    if (!authenticated(req, res)) return;
    try {
      const provider = providerById(providers, req.body?.providerId) || providers[0];
      return res.json(provider.stop({ utteranceId: String(req.body?.utteranceId || ""), reason: "command" }));
    } catch (err) {
      return routeError(res, err);
    }
  });

  app.get("/api/speech/status", (req, res) => {
    if (!authenticated(req, res)) return;
    try {
      const provider = providerById(providers, req.query?.providerId) || providers[0];
      return res.json({ ok: true, providerId: provider.id, ...provider.status(String(req.query?.utteranceId || ""), req.query?.cursor) });
    } catch (err) {
      return routeError(res, err);
    }
  });

  return providers;
}
