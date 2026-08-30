// Nodevision/ApplicationSystem/server/routes/speechRecognitionRoutes.mjs
// This module exposes authenticated local speech-recognition routes for offline providers such as whisper.cpp.

import fs from "node:fs/promises";
import path from "node:path";
import {
  defaultWhisperModelPath,
  loadSpeechRecognitionSettings,
  saveSpeechRecognitionSettings,
} from "../speech/WhisperCppConfig.mjs";
import { createWhisperCppProvider } from "../speech/WhisperCppProvider.mjs";

const MAX_AUDIO_BYTES = 50 * 1024 * 1024;

function authenticated(req, res) {
  if (req.identity) return true;
  res.status(401).json({ ok: false, error: "Authentication required" });
  return false;
}

function routeError(res, err, status = 400) {
  return res.status(status).json({ ok: false, error: err?.message || String(err) });
}

function providerList(ctx, options = {}) {
  if (Array.isArray(options.providers)) return options.providers;
  if (options.provider) return [options.provider];
  return [createWhisperCppProvider({ ctx })];
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

function decodeAudioBase64(value = "") {
  const clean = String(value || "").trim().replace(/^data:[^,]+,/, "");
  if (!clean) throw new Error("Recognition audio is required.");
  if (!/^[A-Za-z0-9+/=\s]+$/.test(clean)) throw new Error("Recognition audio must be base64 encoded.");
  const audioBuffer = Buffer.from(clean.replace(/\s+/g, ""), "base64");
  if (!audioBuffer.length) throw new Error("Recognition audio is empty.");
  if (audioBuffer.length > MAX_AUDIO_BYTES) throw new Error("Recognition audio is too large.");
  if (audioBuffer.subarray(0, 4).toString("ascii") !== "RIFF" || audioBuffer.subarray(8, 12).toString("ascii") !== "WAVE") {
    throw new Error("Recognition audio must be WAV/PCM data.");
  }
  return audioBuffer;
}

async function settingsPayload(ctx) {
  const settings = await loadSpeechRecognitionSettings(ctx);
  const defaultModelPath = defaultWhisperModelPath(ctx);
  await fs.mkdir(path.dirname(defaultModelPath), { recursive: true }).catch(() => {});
  return {
    ok: true,
    settings,
    defaults: {
      whisperModelPath: defaultModelPath,
      whisperModelDirectory: path.dirname(defaultModelPath),
    },
  };
}

export function registerSpeechRecognitionRoutes(app, ctx, options = {}) {
  const providers = providerList(ctx, options);

  app.get("/api/speech/recognition/providers", async (req, res) => {
    if (!authenticated(req, res)) return;
    return res.json({ ok: true, providers: await Promise.all(providers.map(statusPayload)) });
  });

  app.get("/api/speech/recognition/settings", async (req, res) => {
    if (!authenticated(req, res)) return;
    try {
      return res.json(await settingsPayload(ctx));
    } catch (err) {
      return routeError(res, err, 500);
    }
  });

  app.post("/api/speech/recognition/settings", async (req, res) => {
    if (!authenticated(req, res)) return;
    try {
      const existing = await loadSpeechRecognitionSettings(ctx);
      await saveSpeechRecognitionSettings(ctx, { ...existing, ...(req.body || {}) });
      return res.json(await settingsPayload(ctx));
    } catch (err) {
      return routeError(res, err, 500);
    }
  });

  app.post("/api/speech/recognition/start", async (req, res) => {
    if (!authenticated(req, res)) return;
    try {
      const provider = providerById(providers, req.body?.providerId) || await firstAvailable(providers);
      if (!provider) throw new Error("No usable offline speech-recognition provider is available.");
      const result = await provider.start({
        audioBuffer: decodeAudioBase64(req.body?.audioBase64),
        utteranceId: String(req.body?.utteranceId || ""),
        language: req.body?.language,
      });
      return res.json({ ok: true, providerId: provider.id, ...result });
    } catch (err) {
      return routeError(res, err, /available|installed|model/i.test(err?.message || "") ? 503 : 400);
    }
  });

  app.post("/api/speech/recognition/stop", (req, res) => {
    if (!authenticated(req, res)) return;
    try {
      const provider = providerById(providers, req.body?.providerId) || providers[0];
      return res.json(provider.stop({ utteranceId: String(req.body?.utteranceId || ""), reason: "command" }));
    } catch (err) {
      return routeError(res, err);
    }
  });

  app.get("/api/speech/recognition/status", (req, res) => {
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
