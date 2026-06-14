// Nodevision/ApplicationSystem/Sync/ScopePeerSync.mjs
// This module defines signed trusted-peer scoped manifest and file transfer messages with strict scope/path validation, trusted-peer signature verification, timestamp age checks, and payload-size safety limits.

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
  fileStreamPush: "nodevision.peer.scopeFileStreamPush",
};

const VERSION = 1;
const SHA256_HEX_RE = /^[a-f0-9]{64}$/;

function asNonEmpty(value, fieldName) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`${fieldName} must be nonempty`);
  return text;
}

function asRawNonEmptyString(value, fieldName) {
  if (typeof value !== "string") throw new Error(`${fieldName} must be a nonempty string`);
  if (value.length === 0) throw new Error(`${fieldName} must be a nonempty string`);
  return value;
}

function normalizeTimestamp(value, fieldName = "timestamp") {
  const timestamp = asNonEmpty(value, fieldName);
  const ms = Date.parse(timestamp);
  if (Number.isNaN(ms)) throw new Error(`${fieldName} must be a valid ISO date string`);
  return new Date(ms).toISOString();
}

function parsePayload(payloadText) {
  try {
    return JSON.parse(payloadText);
  } catch {
    throw new Error("payload must be valid JSON");
  }
}

function normalizeSha256Hex(value, fieldName) {
  const sha256 = asNonEmpty(value, fieldName).toLowerCase();
  if (!SHA256_HEX_RE.test(sha256)) throw new Error(`${fieldName} must be a lowercase 64-char sha256 hex string`);
  return sha256;
}

function normalizeNonNegativeSize(value, fieldName = "size") {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || !Number.isSafeInteger(parsed)) {
    throw new Error(` must be a nonnegative safe integer`);
  }
  return parsed;
}

function normalizeOptionalMtimeMs(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || !Number.isSafeInteger(Math.trunc(parsed))) {
    throw new Error("mtimeMs must be a nonnegative number");
  }
  return Math.trunc(parsed);
}

function decodeBase64Strict(contentBase64, { fieldName = "contentBase64", allowEmpty = false, maxBytes = MAX_FILE_PUSH_BYTES } = {}) {
  if (typeof contentBase64 !== "string") throw new Error(`${fieldName} must be a string`);
  if (contentBase64 !== contentBase64.trim()) throw new Error(`${fieldName} must not include leading or trailing whitespace`);
  if (contentBase64.length === 0) {
    if (!allowEmpty) throw new Error(`${fieldName} must be nonempty`);
    return { encoded: contentBase64, decodedLength: 0 };
  }
  if (contentBase64.length % 4 !== 0) throw new Error(`${fieldName} must be valid base64`);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(contentBase64)) throw new Error(`${fieldName} must be valid base64`);

  const decoded = Buffer.from(contentBase64, "base64");
  if (decoded.toString("base64") !== contentBase64) throw new Error(`${fieldName} must be valid base64`);
  if (decoded.length > maxBytes) throw new Error(`${fieldName} exceeds ${maxBytes} bytes`);
  return { encoded: contentBase64, decodedLength: decoded.length };
}

function createScopedPeerVerificationError(code, message, safeDetails = {}) {
  const err = new Error(String(message || "Scoped peer verification failed"));
  err.name = "ScopedPeerVerificationError";
  err.code = String(code || "unknown");
  err.safeDetails = {
    deviceId: safeDetails.deviceId ?? null,
    scope: safeDetails.scope ?? null,
    relativePath: safeDetails.relativePath ?? null,
    timestamp: safeDetails.timestamp ?? null,
    timestampAgeMs: Number.isFinite(Number(safeDetails.timestampAgeMs)) ? Math.trunc(Number(safeDetails.timestampAgeMs)) : null,
    trustedPeerFound: Boolean(safeDetails.trustedPeerFound),
    signatureVerified: Boolean(safeDetails.signatureVerified),
  };
  return err;
}

export function isScopedPeerVerificationError(err) {
  return Boolean(err && err.name === "ScopedPeerVerificationError");
}

function decodeSignatureBase64Strict(signatureBase64) {
  decodeBase64Strict(signatureBase64, { fieldName: "signatureBase64", allowEmpty: false, maxBytes: Number.MAX_SAFE_INTEGER });
}

function resolveNowMs(options = {}) {
  const now = options?.now;
  if (typeof now === "number" && Number.isFinite(now)) return now;
  if (typeof now === "string") {
    const parsed = Date.parse(now);
    if (!Number.isNaN(parsed)) return parsed;
  }
  if (now instanceof Date) {
    const parsed = now.getTime();
    if (!Number.isNaN(parsed)) return parsed;
  }
  return Date.now();
}

function resolveOptionalNonNegativeInteger(value) {
  if (value === undefined || value === null) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || !Number.isSafeInteger(parsed)) {
    throw new Error("maxMessageAgeMs must be a nonnegative safe integer");
  }
  return parsed;
}

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
    timestamp: normalizeTimestamp(message.timestamp, "timestamp"),
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
  const decoded = decodeBase64Strict(message.contentBase64, {
    fieldName: "contentBase64",
    allowEmpty: true,
    maxBytes: MAX_FILE_PUSH_BYTES,
  });
  return {
    ...base,
    relativePath: validateScopedRelativePath(message.relativePath, base.scope),
    contentBase64: decoded.encoded,
    contentType: String(message.contentType || "application/octet-stream"),
    mtimeMs: normalizeOptionalMtimeMs(message.mtimeMs),
  };
}

export function validateScopeFileStreamPushMessage(message) {
  const base = validateBaseMessage(message, TYPES.fileStreamPush);
  return {
    ...base,
    relativePath: validateScopedRelativePath(message.relativePath, base.scope),
    size: normalizeNonNegativeSize(message.size, "size"),
    sha256: normalizeSha256Hex(message.sha256, "sha256"),
    mtimeMs: normalizeOptionalMtimeMs(message.mtimeMs),
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
  const message = validateScopeManifestRequestMessage({
    type: TYPES.manifest,
    version: VERSION,
    deviceId: identity.deviceId,
    deviceName: identity.deviceName,
    timestamp: options.timestamp ?? new Date().toISOString(),
    scope,
  });
  return signScopedMessage(message, options);
}

export async function createSignedScopeFileRequest({ scope, relativePath }, options = {}) {
  const identity = await ensureDeviceIdentity(options);
  const message = validateScopeFileRequestMessage({
    type: TYPES.fileGet,
    version: VERSION,
    deviceId: identity.deviceId,
    deviceName: identity.deviceName,
    timestamp: options.timestamp ?? new Date().toISOString(),
    scope,
    relativePath,
  });
  return signScopedMessage(message, options);
}

export async function createSignedScopeFilePush({ scope, relativePath, contentBase64, contentType, mtimeMs }, options = {}) {
  const identity = await ensureDeviceIdentity(options);
  const message = validateScopeFilePushMessage({
    type: TYPES.filePush,
    version: VERSION,
    deviceId: identity.deviceId,
    deviceName: identity.deviceName,
    timestamp: options.timestamp ?? new Date().toISOString(),
    scope,
    relativePath,
    contentBase64,
    contentType,
    mtimeMs,
  });
  return signScopedMessage(message, options);
}

export async function createSignedScopeFileStreamPush({ scope, relativePath, size, sha256, mtimeMs }, options = {}) {
  const identity = await ensureDeviceIdentity(options);
  const message = validateScopeFileStreamPushMessage({
    type: TYPES.fileStreamPush,
    version: VERSION,
    deviceId: identity.deviceId,
    deviceName: identity.deviceName,
    timestamp: options.timestamp ?? new Date().toISOString(),
    scope,
    relativePath,
    size,
    sha256,
    mtimeMs,
  });
  return signScopedMessage(message, options);
}

function withFallbackScopedDetails(target, message = null) {
  if (!message || typeof message !== "object") return target;
  if (!target.deviceId && typeof message.deviceId === "string") target.deviceId = message.deviceId.trim() || null;
  if (!target.scope && typeof message.scope === "string") target.scope = message.scope.trim() || null;
  if (!target.relativePath && typeof message.relativePath === "string") target.relativePath = message.relativePath.trim() || null;
  if (!target.timestamp && typeof message.timestamp === "string") target.timestamp = message.timestamp.trim() || null;
  return target;
}

async function verifySignedScopedMessage({ payload, signatureBase64 }, validator, options = {}) {
  const safeDetails = {
    deviceId: null,
    scope: null,
    relativePath: null,
    timestamp: null,
    timestampAgeMs: null,
    trustedPeerFound: false,
    signatureVerified: false,
  };

  let payloadText;
  let signatureText;
  try {
    payloadText = asRawNonEmptyString(payload, "payload");
    signatureText = asRawNonEmptyString(signatureBase64, "signatureBase64");
  } catch (err) {
    throw createScopedPeerVerificationError("malformed_request", err?.message || "Malformed signed request", safeDetails);
  }

  let parsedPayload;
  try {
    parsedPayload = parsePayload(payloadText);
    withFallbackScopedDetails(safeDetails, parsedPayload);
  } catch (err) {
    throw createScopedPeerVerificationError("malformed_payload", "Malformed payload", safeDetails);
  }

  let message;
  try {
    message = validator(parsedPayload);
    withFallbackScopedDetails(safeDetails, message);
  } catch (err) {
    throw createScopedPeerVerificationError("invalid_payload", err?.message || "Invalid payload", safeDetails);
  }

  const nowMs = resolveNowMs(options);
  const timestampMs = Date.parse(message.timestamp);
  if (!Number.isNaN(timestampMs)) {
    safeDetails.timestampAgeMs = Math.trunc(nowMs - timestampMs);
  }

  const maxMessageAgeMs = resolveOptionalNonNegativeInteger(options.maxMessageAgeMs);
  const maxFutureSkewMs = resolveOptionalNonNegativeInteger(options.maxFutureSkewMs) ?? 5 * 60 * 1000;
  if (maxMessageAgeMs !== null) {
    if (safeDetails.timestampAgeMs === null) {
      throw createScopedPeerVerificationError("invalid_timestamp", "Invalid timestamp", safeDetails);
    }
    if (safeDetails.timestampAgeMs > maxMessageAgeMs) {
      throw createScopedPeerVerificationError("expired_request", "Expired request", safeDetails);
    }
    if (safeDetails.timestampAgeMs < -maxFutureSkewMs) {
      throw createScopedPeerVerificationError("invalid_timestamp", "Request timestamp is too far in the future", safeDetails);
    }
  }

  try {
    await ensureScopeEnabled(message.scope, options);
  } catch (err) {
    if (String(err?.message || "").startsWith("Scope is not enabled:")) {
      throw createScopedPeerVerificationError("scope_not_enabled", err.message, safeDetails);
    }
    throw err;
  }

  const peer = await findTrustedPeer(message.deviceId, options);
  safeDetails.trustedPeerFound = Boolean(peer);
  if (!peer) {
    throw createScopedPeerVerificationError("unknown_peer", "Unknown peer", safeDetails);
  }

  try {
    decodeSignatureBase64Strict(signatureText);
  } catch {
    throw createScopedPeerVerificationError("malformed_signature", "Malformed signature", safeDetails);
  }

  const verified = await verifyMessage(payloadText, signatureText, peer.publicKey);
  safeDetails.signatureVerified = Boolean(verified);
  if (!verified) {
    throw createScopedPeerVerificationError("invalid_signature", "Invalid signature", safeDetails);
  }

  return {
    ok: true,
    peer: {
      deviceId: peer.deviceId,
      deviceName: peer.deviceName,
    },
    message,
    safeDetails,
  };
}

export const verifySignedScopeManifestRequest = (signed, options = {}) => verifySignedScopedMessage(signed, validateScopeManifestRequestMessage, options);
export const verifySignedScopeFileRequest = (signed, options = {}) => verifySignedScopedMessage(signed, validateScopeFileRequestMessage, options);
export const verifySignedScopeFilePush = (signed, options = {}) => verifySignedScopedMessage(signed, validateScopeFilePushMessage, options);
export const verifySignedScopeFileStreamPush = (signed, options = {}) => verifySignedScopedMessage(signed, validateScopeFileStreamPushMessage, options);
