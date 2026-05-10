// Nodevision/ApplicationSystem/Sync/ScopePeerSync.mjs
// This module defines signed trusted-peer scoped manifest and file transfer messages with strict scope/path validation, trusted-peer signature verification, and 64KB payload safety limits.

import path from "node:path";
import { Buffer } from "node:buffer";
import { ensureDeviceIdentity, signMessage, verifyMessage } from "./DeviceIdentity.mjs";
import { findTrustedPeer } from "./TrustedPeers.mjs";
import { MAX_FILE_PUSH_BYTES } from "./PeerFileTransfer.mjs";
import { isPathInsideScope, loadSyncScopes, validateSyncScope } from "./SyncScopes.mjs";

const TYPES = {
  manifest: "nodevision.peer.scopeManifestRequest",
  fileGet: "nodevision.peer.scopeFileRequest",
  filePush: "nodevision.peer.scopeFilePush",
};

const VERSION = 1;

const asNonEmpty = (v, n) => { const s = String(v ?? "").trim(); if (!s) throw new Error(`${n} must be nonempty`); return s; };
const parsePayload = (payload) => { try { return JSON.parse(String(payload)); } catch { throw new Error("payload must be valid JSON"); } };

export function validateScopedRelativePath(relativePath, scope) {
  const rp = asNonEmpty(relativePath, "relativePath");
  if (rp.includes("\\") || rp.includes("\0")) throw new Error("invalid relativePath");
  if (path.posix.isAbsolute(rp) || path.win32.isAbsolute(rp)) throw new Error("relativePath must be relative");
  if (rp.includes("..")) throw new Error("relativePath traversal forbidden");
  const normalized = path.posix.normalize(rp);
  if (normalized !== rp || normalized.endsWith("/")) throw new Error("relativePath must be normalized file path");
  const validatedScope = validateSyncScope(scope);
  if (!isPathInsideScope({ relativePath: normalized, scope: validatedScope })) throw new Error("relativePath must remain inside scope");
  return normalized;
}

function validateBaseMessage(message, type) {
  if (!message || typeof message !== "object" || Array.isArray(message)) throw new Error("message must be object");
  if (message.type !== type) throw new Error("invalid message type");
  if (message.version !== VERSION) throw new Error("invalid message version");
  const scope = validateSyncScope(message.scope);
  return {
    type,
    version: VERSION,
    deviceId: asNonEmpty(message.deviceId, "deviceId"),
    deviceName: asNonEmpty(message.deviceName, "deviceName"),
    timestamp: asNonEmpty(message.timestamp, "timestamp"),
    scope,
  };
}

export function validateScopeManifestRequestMessage(message) {
  return validateBaseMessage(message, TYPES.manifest);
}

export function validateScopeFileRequestMessage(message) {
  const base = validateBaseMessage(message, TYPES.fileGet);
  return { ...base, relativePath: validateScopedRelativePath(message.relativePath, base.scope) };
}

export function validateScopeFilePushMessage(message) {
  const base = validateBaseMessage(message, TYPES.filePush);
  const contentBase64 = asNonEmpty(message.contentBase64, "contentBase64");
  const decoded = Buffer.from(contentBase64, "base64");
  if (decoded.toString("base64") !== contentBase64) throw new Error("invalid base64");
  if (decoded.length > MAX_FILE_PUSH_BYTES) throw new Error("content too large");
  return {
    ...base,
    relativePath: validateScopedRelativePath(message.relativePath, base.scope),
    contentBase64,
    contentType: String(message.contentType || "application/octet-stream"),
  };
}

async function ensureScopeEnabled(scope, options = {}) {
  const loaded = await loadSyncScopes(options);
  if (!loaded.syncScopes.includes(scope)) throw new Error(`Scope is not enabled: ${scope}`);
}

async function signScopedMessage(message, options = {}) {
  await ensureScopeEnabled(message.scope, options);
  const { payload, signatureBase64 } = await signMessage(message, options);
  return { payload, signatureBase64, deviceId: message.deviceId };
}

export async function createSignedScopeManifestRequest({ scope }, options = {}) {
  const identity = await ensureDeviceIdentity(options);
  const message = validateScopeManifestRequestMessage({ type: TYPES.manifest, version: VERSION, deviceId: identity.deviceId, deviceName: identity.deviceName, timestamp: new Date().toISOString(), scope });
  return signScopedMessage(message, options);
}

export async function createSignedScopeFileRequest({ scope, relativePath }, options = {}) {
  const identity = await ensureDeviceIdentity(options);
  const message = validateScopeFileRequestMessage({ type: TYPES.fileGet, version: VERSION, deviceId: identity.deviceId, deviceName: identity.deviceName, timestamp: new Date().toISOString(), scope, relativePath });
  return signScopedMessage(message, options);
}

export async function createSignedScopeFilePush({ scope, relativePath, contentBase64, contentType }, options = {}) {
  const identity = await ensureDeviceIdentity(options);
  const message = validateScopeFilePushMessage({ type: TYPES.filePush, version: VERSION, deviceId: identity.deviceId, deviceName: identity.deviceName, timestamp: new Date().toISOString(), scope, relativePath, contentBase64, contentType });
  return signScopedMessage(message, options);
}

async function verifySignedScopedMessage({ payload, signatureBase64 }, validator, options = {}) {
  const payloadText = asNonEmpty(payload, "payload");
  const signature = asNonEmpty(signatureBase64, "signatureBase64");
  const message = validator(parsePayload(payloadText));
  await ensureScopeEnabled(message.scope, options);
  const peer = await findTrustedPeer(message.deviceId, options);
  if (!peer) throw new Error("Unknown peer");
  const ok = await verifyMessage(payloadText, signature, peer.publicKey);
  if (!ok) throw new Error("Invalid signature");
  return { ok: true, peer: { deviceId: peer.deviceId, deviceName: peer.deviceName }, message };
}

export const verifySignedScopeManifestRequest = (signed, options = {}) => verifySignedScopedMessage(signed, validateScopeManifestRequestMessage, options);
export const verifySignedScopeFileRequest = (signed, options = {}) => verifySignedScopedMessage(signed, validateScopeFileRequestMessage, options);
export const verifySignedScopeFilePush = (signed, options = {}) => verifySignedScopedMessage(signed, validateScopeFilePushMessage, options);
