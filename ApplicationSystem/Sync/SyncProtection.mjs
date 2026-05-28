// Nodevision/ApplicationSystem/Sync/SyncProtection.mjs
// This module persists local sync write-protection settings so one installation can reject sync writes from peers.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

function resolveRuntimeRoot(options = {}) {
  if (options.runtimeRoot) return path.resolve(String(options.runtimeRoot));
  if (process.env.NODEVISION_ROOT) return path.resolve(process.env.NODEVISION_ROOT);
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(moduleDir, "..", "..");
}

export function resolveSyncProtectionPath(options = {}) {
  return path.resolve(resolveRuntimeRoot(options), "ServerSettings", "Sync", "sync-protection.json");
}

function normalizeSyncProtection(raw = {}) {
  return {
    protectedFromPeerWrites: raw?.protectedFromPeerWrites === true,
    updatedAt: typeof raw?.updatedAt === "string" ? raw.updatedAt : null,
  };
}

export async function loadSyncProtection(options = {}) {
  const settingsPath = resolveSyncProtectionPath(options);
  try {
    const raw = JSON.parse(await fs.readFile(settingsPath, "utf8"));
    return normalizeSyncProtection(raw);
  } catch (err) {
    if (err?.code === "ENOENT") return normalizeSyncProtection();
    throw err;
  }
}

export async function saveSyncProtection(settings = {}, options = {}) {
  const settingsPath = resolveSyncProtectionPath(options);
  const normalized = normalizeSyncProtection({
    ...settings,
    updatedAt: new Date().toISOString(),
  });
  await fs.mkdir(path.dirname(settingsPath), { recursive: true, mode: 0o700 });
  await fs.writeFile(settingsPath, `${JSON.stringify(normalized, null, 2)}\n`, { mode: 0o600 });
  return normalized;
}

export async function isProtectedFromPeerWrites(options = {}) {
  const settings = await loadSyncProtection(options);
  return settings.protectedFromPeerWrites === true;
}
