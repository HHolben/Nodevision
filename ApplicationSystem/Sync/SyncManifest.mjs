// Nodevision/ApplicationSystem/Sync/SyncManifest.mjs
// This module builds and compares SyncTest-only manifests and verifies signed manifest requests so trusted peers can safely exchange hash inventories without scanning outside Notebook/SyncTest.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureDeviceIdentity, signMessage, verifyMessage } from "./DeviceIdentity.mjs";
import { findTrustedPeer } from "./TrustedPeers.mjs";
import { buildScopeManifest, compareScopeManifests } from "./SyncScopes.mjs";

const MANIFEST_REQUEST_TYPE = "nodevision.peer.manifestRequest";
const MANIFEST_REQUEST_VERSION = 1;
const MANIFEST_SCOPE = "SyncTest";

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.prototype.toString.call(value) === "[object Object]";
}

function normalizeNonEmptyString(value, fieldName) {
  const normalized = String(value ?? "").trim();
  if (!normalized) throw new Error(`${fieldName} must be a nonempty string`);
  return normalized;
}

function requireNonBlankString(value, fieldName) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${fieldName} must be a nonempty string`);
  return value;
}

function normalizeTimestamp(value) {
  const timestamp = normalizeNonEmptyString(value, "timestamp");
  if (!/^\d{4}-\d{2}-\d{2}T/.test(timestamp) || Number.isNaN(Date.parse(timestamp))) {
    throw new Error("timestamp must be a valid ISO date string");
  }
  return timestamp;
}

function resolveRuntimeRoot(options = {}) {
  if (options.runtimeRoot) return path.resolve(String(options.runtimeRoot));
  if (process.env.NODEVISION_ROOT) return path.resolve(process.env.NODEVISION_ROOT);
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(moduleDir, "..", "..");
}

function resolveNotebookDir(options = {}) {
  if (options.notebookDir) return path.resolve(String(options.notebookDir));
  return path.resolve(resolveRuntimeRoot(options), "Notebook");
}

export async function buildSyncTestManifest(options = {}) {
  return buildScopeManifest({
    notebookDir: resolveNotebookDir(options),
    scope: MANIFEST_SCOPE,
  });
}

export function validateManifestRequestMessage(message) {
  if (!isPlainObject(message)) throw new Error("Manifest request message must be a plain object");
  if (message.type !== MANIFEST_REQUEST_TYPE) throw new Error(`Manifest request type must be \"${MANIFEST_REQUEST_TYPE}\"`);
  if (message.version !== MANIFEST_REQUEST_VERSION) throw new Error("Manifest request version must be 1");
  const scope = normalizeNonEmptyString(message.scope, "scope");
  if (scope !== MANIFEST_SCOPE) throw new Error(`scope must be \"${MANIFEST_SCOPE}\"`);

  return {
    type: MANIFEST_REQUEST_TYPE,
    version: MANIFEST_REQUEST_VERSION,
    deviceId: normalizeNonEmptyString(message.deviceId, "deviceId"),
    deviceName: normalizeNonEmptyString(message.deviceName, "deviceName"),
    timestamp: normalizeTimestamp(message.timestamp),
    scope,
  };
}

export async function createSignedManifestRequest(options = {}) {
  const identity = await ensureDeviceIdentity(options);
  const message = validateManifestRequestMessage({
    type: MANIFEST_REQUEST_TYPE,
    version: MANIFEST_REQUEST_VERSION,
    deviceId: identity.deviceId,
    deviceName: identity.deviceName,
    timestamp: options.timestamp ?? new Date().toISOString(),
    scope: MANIFEST_SCOPE,
  });
  const { payload, signatureBase64 } = await signMessage(message, options);
  return { payload, signatureBase64, deviceId: message.deviceId };
}

export async function verifySignedManifestRequest({ payload, signatureBase64 }, options = {}) {
  const payloadText = requireNonBlankString(payload, "payload");
  const signatureText = normalizeNonEmptyString(signatureBase64, "signatureBase64");

  let parsedMessage;
  try {
    parsedMessage = JSON.parse(payloadText);
  } catch {
    throw new Error("Signed manifest request payload must be valid JSON");
  }

  const message = validateManifestRequestMessage(parsedMessage);
  const peer = await findTrustedPeer(message.deviceId, options);
  if (!peer) throw new Error("Unknown peer deviceId");
  const verified = await verifyMessage(payloadText, signatureText, peer.publicKey);
  if (!verified) throw new Error("Peer manifest request signature verification failed");
  return { ok: true, peer: { deviceId: peer.deviceId, deviceName: peer.deviceName }, message };
}

export async function compareManifests(localManifest, remoteManifest) {
  return compareScopeManifests(localManifest, remoteManifest);
}
