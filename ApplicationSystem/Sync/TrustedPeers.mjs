// Nodevision/ApplicationSystem/Sync/TrustedPeers.mjs
// This module maintains the local trusted-peer registry in ServerSettings so peer public identities can be added, updated, and queried without ever storing private key material.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SERVER_SETTINGS_MODE = 0o700;
const TRUST_DIR_MODE = 0o700;
const TRUST_FILE_MODE = 0o600;

function resolveRuntimeRoot(options = {}) {
  if (options.runtimeRoot) return path.resolve(String(options.runtimeRoot));
  if (process.env.NODEVISION_ROOT) return path.resolve(process.env.NODEVISION_ROOT);

  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(moduleDir, "..", "..");
}

function resolveTrustPaths(options = {}) {
  const runtimeRoot = resolveRuntimeRoot(options);
  const serverSettingsDir = path.join(runtimeRoot, "ServerSettings");
  const trustDir = path.join(serverSettingsDir, "Trust");
  const trustedPeersPath = path.join(trustDir, "TrustedPeers.json");

  return {
    runtimeRoot,
    serverSettingsDir,
    trustDir,
    trustedPeersPath,
  };
}

async function fileExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function applyMode(targetPath, mode) {
  if (process.platform === "win32") return;

  try {
    await fs.chmod(targetPath, mode);
  } catch (err) {
    const code = err?.code;
    if (code === "EPERM" || code === "EINVAL" || code === "ENOENT") return;
    throw err;
  }
}

function normalizeTrustedStore(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { trustedPeers: [] };
  }
  if (!Array.isArray(raw.trustedPeers)) {
    return { trustedPeers: [] };
  }
  return { trustedPeers: raw.trustedPeers };
}

function validatePeer(peer) {
  if (!peer || typeof peer !== "object" || Array.isArray(peer)) {
    throw new Error("Trusted peer must be a plain object.");
  }

  const forbiddenPrivateKeyFields = Object.keys(peer).filter((key) => /private/i.test(key));
  if (forbiddenPrivateKeyFields.length > 0) {
    throw new Error(`Peer contains forbidden private key fields: ${forbiddenPrivateKeyFields.join(", ")}`);
  }

  const deviceId = String(peer.deviceId || "").trim();
  const deviceName = String(peer.deviceName || "").trim();
  const publicKey = String(peer.publicKey || "").trim();

  if (!deviceId || !deviceName || !publicKey) {
    throw new Error("Trusted peer must include deviceId, deviceName, and publicKey.");
  }
  if (publicKey.includes("PRIVATE KEY")) {
    throw new Error("Trusted peer publicKey must not contain private key material.");
  }

  return { deviceId, deviceName, publicKey };
}

async function writeTrustedStore(trustedPeersPath, data) {
  await fs.writeFile(trustedPeersPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await applyMode(trustedPeersPath, TRUST_FILE_MODE);
}

export async function ensureTrustedPeersStore(options = {}) {
  const paths = resolveTrustPaths(options);

  await fs.mkdir(paths.serverSettingsDir, { recursive: true, mode: SERVER_SETTINGS_MODE });
  await fs.mkdir(paths.trustDir, { recursive: true, mode: TRUST_DIR_MODE });

  await applyMode(paths.serverSettingsDir, SERVER_SETTINGS_MODE);
  await applyMode(paths.trustDir, TRUST_DIR_MODE);

  const exists = await fileExists(paths.trustedPeersPath);
  if (!exists) {
    await writeTrustedStore(paths.trustedPeersPath, { trustedPeers: [] });
    return { trustedPeers: [] };
  }

  const current = await loadTrustedPeers(options);
  if (!Array.isArray(current.trustedPeers)) {
    await writeTrustedStore(paths.trustedPeersPath, { trustedPeers: [] });
    return { trustedPeers: [] };
  }

  await applyMode(paths.trustedPeersPath, TRUST_FILE_MODE);
  return current;
}

export async function loadTrustedPeers(options = {}) {
  const paths = resolveTrustPaths(options);
  const exists = await fileExists(paths.trustedPeersPath);

  if (!exists) {
    return ensureTrustedPeersStore(options);
  }

  const raw = JSON.parse(await fs.readFile(paths.trustedPeersPath, "utf8"));
  return normalizeTrustedStore(raw);
}

export async function addTrustedPeer(peer, options = {}) {
  const cleanPeer = validatePeer(peer);
  const paths = resolveTrustPaths(options);
  const store = await ensureTrustedPeersStore(options);

  const pairedAt = new Date().toISOString();
  const record = {
    deviceId: cleanPeer.deviceId,
    deviceName: cleanPeer.deviceName,
    publicKey: cleanPeer.publicKey,
    pairedAt,
  };

  const index = store.trustedPeers.findIndex((entry) => entry?.deviceId === cleanPeer.deviceId);
  if (index >= 0) {
    store.trustedPeers[index] = { ...store.trustedPeers[index], ...record };
  } else {
    store.trustedPeers.push(record);
  }

  await writeTrustedStore(paths.trustedPeersPath, store);
  return record;
}

export async function findTrustedPeer(deviceId, options = {}) {
  const needle = String(deviceId || "").trim();
  if (!needle) return null;

  const store = await loadTrustedPeers(options);
  return store.trustedPeers.find((peer) => peer?.deviceId === needle) || null;
}
