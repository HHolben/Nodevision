import fs from "node:fs";
import path from "node:path";
import { createServerContext } from "../shared/serverContext.mjs";

export const RUNTIME_DEFAULTS = {
  port: 3000,
  host: "127.0.0.1",
  dev: false,
  portFallback: true,
  portFallbackMaxAttempts: 25,
  phpEnabled: true,
  phpHost: "127.0.0.1",
  phpPort: 8080,
  phpPortFallbackMaxAttempts: 25,
};

function normalizeHost(value) {
  if (value == null) return null;
  const host = String(value).trim();
  return host.length > 0 ? host : null;
}

function normalizePort(value) {
  if (value == null || value === "") return null;
  const port = Number(value);
  if (!Number.isFinite(port)) return null;
  const normalized = Math.floor(port);
  if (normalized < 1 || normalized > 65535) return null;
  return normalized;
}

export function normalizeRuntimeHost(value, fallback = RUNTIME_DEFAULTS.host) {
  return normalizeHost(value) ?? fallback;
}

export function normalizeRuntimePort(value, fallback = RUNTIME_DEFAULTS.port) {
  return normalizePort(value) ?? fallback;
}

export function readRuntimeConfigFile(runtimeRoot) {
  const ctx = createServerContext(runtimeRoot ? { runtimeRoot } : {});
  const configPath = path.join(ctx.applicationSystemRoot, "config.json");
  try {
    const raw = fs.readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return { path: configPath, values: parsed, loaded: true };
    }
  } catch {}
  return { path: configPath, values: {}, loaded: false };
}

export function resolveRuntimeNetworkConfig({
  env = process.env,
  runtimeConfig = {},
  config = {},
  defaults = RUNTIME_DEFAULTS,
} = {}) {
  const host =
    normalizeHost(env?.HOST) ??
    normalizeHost(runtimeConfig?.host) ??
    normalizeHost(config?.host) ??
    defaults.host;

  const port =
    normalizePort(env?.PORT) ??
    normalizePort(runtimeConfig?.port) ??
    normalizePort(config?.nodePort) ??
    normalizePort(config?.port) ??
    defaults.port;

  const phpHost =
    normalizeHost(runtimeConfig?.phpHost) ??
    normalizeHost(env?.NODEVISION_PHP_HOST) ??
    normalizeHost(config?.phpHost) ??
    defaults.phpHost;

  const phpPort =
    normalizePort(runtimeConfig?.phpPort) ??
    normalizePort(env?.NODEVISION_PHP_PORT) ??
    normalizePort(config?.phpPort) ??
    defaults.phpPort;

  return { host, port, phpHost, phpPort };
}
