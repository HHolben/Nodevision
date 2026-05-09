// Nodevision/ApplicationSystem/Sync/TrustedPeers.mjs
// This module maintains the local trusted-peer registry in ServerSettings so peer public identities can be added, updated, and queried without ever storing private key material.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureDeviceIdentity } from "./DeviceIdentity.mjs";

const SERVER_SETTINGS_MODE = 0o700;
const TRUST_DIR_MODE = 0o700;
const TRUST_FILE_MODE = 0o600;
const PEER_STALE_MS = 5 * 60 * 1000;
const ALLOWED_PEER_STATUSES = new Set(["online", "offline", "unknown"]);

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
  const trustedPeers = normalizeTrustedPeerList(raw?.trustedPeers);
  return { trustedPeers };
}

function normalizeTrustedPeerList(rawTrustedPeers) {
  if (!Array.isArray(rawTrustedPeers)) {
    return [];
  }

  return rawTrustedPeers
    .filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry))
    .map((entry) => ({ ...entry }));
}

function resolveNowMs(options = {}) {
  const value = options?.now;
  if (value === undefined || value === null) return Date.now();
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isNaN(ms) ? Date.now() : ms;
  }
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const ms = Date.parse(value);
    if (!Number.isNaN(ms)) return ms;
  }
  return Date.now();
}

function normalizeTimestamp(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (!text) return null;
  const ms = Date.parse(text);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toISOString();
}

function normalizeRequiredTimestamp(value, fieldName) {
  if (value === null) return null;
  const text = String(value ?? "").trim();
  if (!text) return null;
  const ms = Date.parse(text);
  if (Number.isNaN(ms)) {
    throw new Error(`${fieldName} must be a valid ISO date string`);
  }
  return new Date(ms).toISOString();
}

function normalizeStatus(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return ALLOWED_PEER_STATUSES.has(normalized) ? normalized : "unknown";
}

function derivePeerStatus(status, lastSeenIso, nowMs) {
  if (status !== "online") return status;
  if (!lastSeenIso) return status;
  const lastSeenMs = Date.parse(lastSeenIso);
  if (Number.isNaN(lastSeenMs)) return status;
  if (nowMs - lastSeenMs > PEER_STALE_MS) return "offline";
  return status;
}

function normalizeTrustedPeer(peer, options = {}) {
  const raw = peer && typeof peer === "object" && !Array.isArray(peer) ? peer : {};
  const nowMs = resolveNowMs(options);
  const lastSeen = normalizeTimestamp(raw.lastSeen);
  const lastHelloSuccess = normalizeTimestamp(raw.lastHelloSuccess);
  const status = derivePeerStatus(normalizeStatus(raw.status), lastSeen, nowMs);

  return {
    ...raw,
    deviceId: String(raw.deviceId ?? "").trim(),
    deviceName: String(raw.deviceName ?? "").trim(),
    publicKey: String(raw.publicKey ?? "").trim(),
    pairedAt: String(raw.pairedAt ?? "").trim(),
    lastSeen,
    lastHelloSuccess,
    status,
  };
}

function toPeerStatusObject(peer) {
  return {
    deviceId: peer.deviceId,
    deviceName: peer.deviceName,
    status: peer.status,
    lastSeen: peer.lastSeen,
    lastHelloSuccess: peer.lastHelloSuccess,
  };
}

function normalizePeerStatusUpdates(updates) {
  if (!updates || typeof updates !== "object" || Array.isArray(updates)) {
    throw new Error("updates must be a plain object");
  }

  const patch = {};
  if (Object.prototype.hasOwnProperty.call(updates, "lastSeen")) {
    patch.lastSeen = normalizeRequiredTimestamp(updates.lastSeen, "lastSeen");
  }
  if (Object.prototype.hasOwnProperty.call(updates, "lastHelloSuccess")) {
    patch.lastHelloSuccess = normalizeRequiredTimestamp(updates.lastHelloSuccess, "lastHelloSuccess");
  }
  if (Object.prototype.hasOwnProperty.call(updates, "status")) {
    const status = String(updates.status ?? "").trim().toLowerCase();
    if (!ALLOWED_PEER_STATUSES.has(status)) {
      throw new Error("status must be one of: online, offline, unknown");
    }
    patch.status = status;
  }
  if (Object.prototype.hasOwnProperty.call(updates, "deviceName")) {
    const deviceName = String(updates.deviceName ?? "").trim();
    if (!deviceName) {
      throw new Error("deviceName must be a nonempty string");
    }
    patch.deviceName = deviceName;
  }

  return patch;
}

function mapTrustedStoreWithStatus(store, options = {}) {
  const nowMs = resolveNowMs(options);
  return {
    trustedPeers: normalizeTrustedPeerList(store?.trustedPeers).map((peer) => normalizeTrustedPeer(peer, { now: nowMs })),
  };
}

async function readTrustedStoreFromDisk(trustedPeersPath) {
  const raw = JSON.parse(await fs.readFile(trustedPeersPath, "utf8"));
  return normalizeTrustedStore(raw);
}

async function loadOrCreateTrustedStore(options = {}) {
  const paths = resolveTrustPaths(options);
  const exists = await fileExists(paths.trustedPeersPath);
  if (!exists) {
    return ensureTrustedPeersStore(options);
  }

  return readTrustedStoreFromDisk(paths.trustedPeersPath);
}

async function loadTrustedPeerByDeviceId(deviceId, options = {}) {
  const needle = String(deviceId || "").trim();
  if (!needle) return null;
  const store = await loadTrustedPeers(options);
  return store.trustedPeers.find((peer) => peer?.deviceId === needle) || null;
}

async function writeTrustedStore(trustedPeersPath, data) {
  const tempPath = `${trustedPeersPath}.${process.pid}.${Date.now()}.tmp`;
  const payload = `${JSON.stringify(data, null, 2)}\n`;

  try {
    await fs.writeFile(tempPath, payload, "utf8");
    await applyMode(tempPath, TRUST_FILE_MODE);
    await fs.rename(tempPath, trustedPeersPath);
    await applyMode(trustedPeersPath, TRUST_FILE_MODE);
  } catch (err) {
    try {
      await fs.unlink(tempPath);
    } catch {
      // no-op
    }
    throw err;
  }
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

  const current = await readTrustedStoreFromDisk(paths.trustedPeersPath);
  await applyMode(paths.trustedPeersPath, TRUST_FILE_MODE);
  return current;
}

export async function loadTrustedPeers(options = {}) {
  const rawStore = await loadOrCreateTrustedStore(options);
  return mapTrustedStoreWithStatus(rawStore, options);
}

export async function addTrustedPeer(peer, options = {}) {
  const cleanPeer = validatePeer(peer);
  const paths = resolveTrustPaths(options);
  const store = await loadOrCreateTrustedStore(options);

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
  return normalizeTrustedPeer(record, options);
}

export async function findTrustedPeer(deviceId, options = {}) {
  return loadTrustedPeerByDeviceId(deviceId, options);
}

export async function updatePeerStatus(deviceId, updates, options = {}) {
  const needle = String(deviceId || "").trim();
  if (!needle) {
    throw new Error("deviceId must be a nonempty string");
  }

  const patch = normalizePeerStatusUpdates(updates);
  if (Object.keys(patch).length === 0) {
    const existing = await findTrustedPeer(needle, options);
    if (!existing) throw new Error("Trusted peer not found");
    return existing;
  }

  const paths = resolveTrustPaths(options);
  const store = await loadOrCreateTrustedStore(options);
  const index = store.trustedPeers.findIndex((entry) => String(entry?.deviceId || "").trim() === needle);
  if (index < 0) {
    throw new Error("Trusted peer not found");
  }

  store.trustedPeers[index] = {
    ...store.trustedPeers[index],
    ...patch,
  };

  await writeTrustedStore(paths.trustedPeersPath, store);
  return normalizeTrustedPeer(store.trustedPeers[index], options);
}

export async function getTrustedPeerStatus(deviceId, options = {}) {
  const peer = await loadTrustedPeerByDeviceId(deviceId, options);
  if (!peer) return null;
  return toPeerStatusObject(peer);
}

export async function getLocalPeerInfo(options = {}) {
  const localIdentity = await ensureDeviceIdentity(options);
  return {
    deviceId: localIdentity.deviceId,
    deviceName: localIdentity.deviceName,
  };
}
