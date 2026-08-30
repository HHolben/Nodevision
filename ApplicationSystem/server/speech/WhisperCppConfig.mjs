// Nodevision/ApplicationSystem/server/speech/WhisperCppConfig.mjs
// This module loads and sanitizes local whisper.cpp speech-recognition settings from UserSettings while keeping model files in UserData by default.

import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";

export const DEFAULT_WHISPER_CPP_SETTINGS = Object.freeze({
  providerId: "whisper-cpp",
  whisperExecutable: "",
  whisperModelPath: "",
  language: "en",
  threads: 4,
  timeoutMs: 120000,
  allowBrowserRecognition: false,
});

export function defaultWhisperModelPath(ctx = {}) {
  return path.join(ctx.userDataDir || path.resolve(process.cwd(), "UserData"), "Speech", "Models", "ggml-base.en.bin");
}

export function speechRecognitionSettingsPath(ctx = {}) {
  return path.join(ctx.userSettingsDir || path.resolve(process.cwd(), "UserSettings"), "SpeechRecognitionSettings.json");
}

function clampInt(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(number)));
}

function safeString(value, limit = 4096) {
  return String(value || "").trim().slice(0, limit);
}

export function sanitizeSpeechRecognitionSettings(raw = {}) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const merged = { ...DEFAULT_WHISPER_CPP_SETTINGS, ...source };
  return {
    providerId: safeString(merged.providerId, 64) || "whisper-cpp",
    whisperExecutable: safeString(merged.whisperExecutable),
    whisperModelPath: safeString(merged.whisperModelPath),
    language: safeString(merged.language, 32) || "en",
    threads: clampInt(merged.threads, DEFAULT_WHISPER_CPP_SETTINGS.threads, 1, 32),
    timeoutMs: clampInt(merged.timeoutMs, DEFAULT_WHISPER_CPP_SETTINGS.timeoutMs, 5000, 600000),
    allowBrowserRecognition: merged.allowBrowserRecognition === true,
  };
}

export async function loadSpeechRecognitionSettings(ctx = {}) {
  try {
    const raw = await fs.readFile(speechRecognitionSettingsPath(ctx), "utf8");
    return sanitizeSpeechRecognitionSettings(JSON.parse(raw));
  } catch (err) {
    if (err?.code === "ENOENT" || err instanceof SyntaxError) return sanitizeSpeechRecognitionSettings();
    throw err;
  }
}

export async function saveSpeechRecognitionSettings(ctx = {}, settings = {}) {
  const filePath = speechRecognitionSettingsPath(ctx);
  const next = sanitizeSpeechRecognitionSettings(settings);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tempPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  await fs.rename(tempPath, filePath);
  return next;
}

function executableInPath(name, envPath = process.env.PATH || "") {
  for (const dir of envPath.split(path.delimiter).filter(Boolean)) {
    const candidate = path.join(dir, name);
    try {
      fsSync.accessSync(candidate, fsSync.constants.X_OK);
      return candidate;
    } catch {
      // Continue scanning PATH entries.
    }
  }
  return null;
}

export function discoverWhisperCppExecutable(envPath = process.env.PATH || "") {
  for (const name of ["whisper-cli", "whisper", "main"]) {
    const found = executableInPath(name, envPath);
    if (found) return found;
  }
  return null;
}

export function resolveWhisperExecutable(settings = {}, envPath = process.env.PATH || "") {
  const configured = safeString(settings.whisperExecutable);
  if (configured) {
    if (!configured.includes("/") && !configured.includes("\\")) return executableInPath(configured, envPath) || configured;
    return configured;
  }
  return discoverWhisperCppExecutable(envPath);
}

export function resolveWhisperModelPath(ctx = {}, settings = {}) {
  return safeString(settings.whisperModelPath) || defaultWhisperModelPath(ctx);
}
