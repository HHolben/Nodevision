// Nodevision/ApplicationSystem/server/handwriting/NativeHandwritingConfig.mjs
// This module resolves the experimental native handwriting recognizer settings and executable discovery locations without exposing private filesystem details to browser callers.

import fs from "node:fs/promises";
import path from "node:path";

export const NATIVE_HANDWRITING_PROTOCOL_VERSION = 1;
export const NATIVE_HANDWRITING_LIMITS = Object.freeze({
  maxRequestBytes: 2 * 1024 * 1024,
  maxResponseBytes: 512 * 1024,
  maxStderrBytes: 64 * 1024,
  maxStrokes: 128,
  maxPointsPerStroke: 4096,
  maxTotalPoints: 32768,
});

export const DEFAULT_NATIVE_HANDWRITING_CONFIG = Object.freeze({
  enabled: false,
  executablePath: "",
  timeoutMs: 1500,
  candidateLimit: 5,
});

export function clampInt(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(number)));
}

function boolFromEnv(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return null;
  if (["1", "true", "yes", "on"].includes(raw)) return true;
  if (["0", "false", "no", "off"].includes(raw)) return false;
  return null;
}

async function readApplicationConfig(ctx) {
  const configPath = path.join(ctx.applicationSystemRoot, "config.json");
  try {
    const parsed = JSON.parse(await fs.readFile(configPath, "utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function nativeSettingsFromConfig(config = {}) {
  const settings = config?.handwriting?.nativeCpp;
  return settings && typeof settings === "object" && !Array.isArray(settings) ? settings : {};
}

function mergeSettings(...items) {
  return items.reduce((acc, item) => ({ ...acc, ...(item && typeof item === "object" ? item : {}) }), {});
}

function executableNames() {
  return process.platform === "win32" ? ["nodevision-handwriting.exe", "nodevision-handwriting"] : ["nodevision-handwriting"];
}

export function defaultExecutableCandidates(ctx) {
  const repoRoot = path.resolve(ctx.applicationSystemRoot, "..");
  const dirs = [
    path.join(repoRoot, "NativeComponents", "HandwritingRecognizer", "build"),
    path.join(ctx.runtimeRoot, "NativeComponents", "HandwritingRecognizer", "build"),
    path.join(repoRoot, "bin"),
    path.join(ctx.runtimeRoot, "bin"),
    path.join(ctx.applicationSystemRoot, "bin"),
  ];
  const names = executableNames();
  return dirs.flatMap((dir) => names.map((name) => path.join(dir, name)));
}

export function defaultAllowedExecutableRoots(ctx) {
  const repoRoot = path.resolve(ctx.applicationSystemRoot, "..");
  return [
    path.join(repoRoot, "NativeComponents", "HandwritingRecognizer", "build"),
    path.join(ctx.runtimeRoot, "NativeComponents", "HandwritingRecognizer", "build"),
    path.join(repoRoot, "bin"),
    path.join(ctx.runtimeRoot, "bin"),
    path.join(ctx.applicationSystemRoot, "bin"),
  ].map((dir) => path.resolve(dir));
}

export function isWithin(root, candidate) {
  const rel = path.relative(path.resolve(root), path.resolve(candidate));
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

export async function canExecute(filePath) {
  try {
    await fs.access(filePath);
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

function sanitizeSettings(settings = {}) {
  return {
    enabled: settings.enabled === true,
    executablePath: String(settings.executablePath || ""),
    timeoutMs: clampInt(settings.timeoutMs, DEFAULT_NATIVE_HANDWRITING_CONFIG.timeoutMs, 100, 10000),
    candidateLimit: clampInt(settings.candidateLimit, DEFAULT_NATIVE_HANDWRITING_CONFIG.candidateLimit, 1, 20),
  };
}

export async function resolveNativeHandwritingConfig(ctx, overrides = {}) {
  const fileConfig = await readApplicationConfig(ctx);
  const envEnabled = boolFromEnv(process.env.NODEVISION_NATIVE_HANDWRITING_ENABLED);
  const envPatch = {
    ...(envEnabled === null ? {} : { enabled: envEnabled }),
    ...(process.env.NODEVISION_NATIVE_HANDWRITING_EXECUTABLE ? { executablePath: process.env.NODEVISION_NATIVE_HANDWRITING_EXECUTABLE } : {}),
  };
  return sanitizeSettings(mergeSettings(
    DEFAULT_NATIVE_HANDWRITING_CONFIG,
    nativeSettingsFromConfig(fileConfig),
    ctx?.handwriting?.nativeCpp,
    envPatch,
    overrides.settings,
  ));
}
