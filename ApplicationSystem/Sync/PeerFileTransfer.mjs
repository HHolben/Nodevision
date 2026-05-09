// Nodevision/ApplicationSystem/Sync/PeerFileTransfer.mjs
// This module creates and verifies signed trusted-peer file-push and file-request messages with strict SyncTest path constraints and a 64KB payload cap for benchmark transfers.

import path from "node:path";
import { Buffer } from "node:buffer";

import { ensureDeviceIdentity, signMessage, verifyMessage } from "./DeviceIdentity.mjs";
import { findTrustedPeer } from "./TrustedPeers.mjs";

const FILE_PUSH_TYPE = "nodevision.peer.filePush";
const FILE_PUSH_VERSION = 1;
const FILE_REQUEST_TYPE = "nodevision.peer.fileRequest";
const FILE_REQUEST_VERSION = 1;
const DEFAULT_CONTENT_TYPE = "text/plain";
export const FILE_PUSH_ALLOWED_PREFIX = "SyncTest/";
export const MAX_FILE_PUSH_BYTES = 64 * 1024;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.prototype.toString.call(value) === "[object Object]";
}

function normalizeNonEmptyString(value, fieldName) {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    throw new Error(`${fieldName} must be a nonempty string`);
  }
  return normalized;
}

function requireNonBlankString(value, fieldName) {
  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a nonempty string`);
  }
  if (!value.trim()) {
    throw new Error(`${fieldName} must be a nonempty string`);
  }
  return value;
}

function normalizeTimestamp(value) {
  const timestamp = normalizeNonEmptyString(value, "timestamp");
  if (!/^\d{4}-\d{2}-\d{2}T/.test(timestamp) || Number.isNaN(Date.parse(timestamp))) {
    throw new Error("timestamp must be a valid ISO date string");
  }
  return timestamp;
}

export function validateSyncTestRelativePath(value) {
  const relativePath = normalizeNonEmptyString(value, "relativePath");

  if (relativePath.includes("\0")) {
    throw new Error("relativePath must not contain null bytes");
  }
  if (relativePath.includes("\\")) {
    throw new Error("relativePath must not contain backslashes");
  }
  if (path.posix.isAbsolute(relativePath) || path.win32.isAbsolute(relativePath)) {
    throw new Error("relativePath must be relative");
  }
  if (relativePath.includes("..")) {
    throw new Error("relativePath must not contain \"..\"");
  }

  const normalized = path.posix.normalize(relativePath);
  if (normalized !== relativePath) {
    throw new Error("relativePath must be normalized and traversal-safe");
  }
  if (!normalized.startsWith(FILE_PUSH_ALLOWED_PREFIX)) {
    throw new Error(`relativePath must start with ${FILE_PUSH_ALLOWED_PREFIX}`);
  }
  if (normalized === FILE_PUSH_ALLOWED_PREFIX || normalized.endsWith("/")) {
    throw new Error("relativePath must include a file name under SyncTest/");
  }

  return normalized;
}

function normalizeContentType(value) {
  if (value === undefined || value === null) return DEFAULT_CONTENT_TYPE;
  const normalized = String(value).trim();
  return normalized || DEFAULT_CONTENT_TYPE;
}

function decodeBase64Strict(contentBase64) {
  const value = requireNonBlankString(contentBase64, "contentBase64");
  if (value !== value.trim()) {
    throw new Error("contentBase64 must not include leading or trailing whitespace");
  }
  if (value.length % 4 !== 0) {
    throw new Error("contentBase64 must be valid base64");
  }
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    throw new Error("contentBase64 must be valid base64");
  }

  const decoded = Buffer.from(value, "base64");
  if (decoded.toString("base64") !== value) {
    throw new Error("contentBase64 must be valid base64");
  }
  if (decoded.length > MAX_FILE_PUSH_BYTES) {
    throw new Error(`content exceeds ${MAX_FILE_PUSH_BYTES} bytes`);
  }

  return value;
}

export function validateFilePushMessage(message) {
  if (!isPlainObject(message)) {
    throw new Error("File push message must be a plain object");
  }
  if (message.type !== FILE_PUSH_TYPE) {
    throw new Error(`File push message type must be \"${FILE_PUSH_TYPE}\"`);
  }
  if (message.version !== FILE_PUSH_VERSION) {
    throw new Error("File push message version must be 1");
  }

  return {
    type: FILE_PUSH_TYPE,
    version: FILE_PUSH_VERSION,
    deviceId: normalizeNonEmptyString(message.deviceId, "deviceId"),
    deviceName: normalizeNonEmptyString(message.deviceName, "deviceName"),
    timestamp: normalizeTimestamp(message.timestamp),
    relativePath: validateSyncTestRelativePath(message.relativePath),
    contentBase64: decodeBase64Strict(message.contentBase64),
    contentType: normalizeContentType(message.contentType),
  };
}

export function validateFileRequestMessage(message) {
  if (!isPlainObject(message)) {
    throw new Error("File request message must be a plain object");
  }
  if (message.type !== FILE_REQUEST_TYPE) {
    throw new Error(`File request message type must be \"${FILE_REQUEST_TYPE}\"`);
  }
  if (message.version !== FILE_REQUEST_VERSION) {
    throw new Error("File request message version must be 1");
  }

  return {
    type: FILE_REQUEST_TYPE,
    version: FILE_REQUEST_VERSION,
    deviceId: normalizeNonEmptyString(message.deviceId, "deviceId"),
    deviceName: normalizeNonEmptyString(message.deviceName, "deviceName"),
    timestamp: normalizeTimestamp(message.timestamp),
    relativePath: validateSyncTestRelativePath(message.relativePath),
  };
}

export async function createSignedFilePush({ relativePath, contentBase64, contentType }, options = {}) {
  const identity = await ensureDeviceIdentity(options);
  const message = validateFilePushMessage({
    type: FILE_PUSH_TYPE,
    version: FILE_PUSH_VERSION,
    deviceId: identity.deviceId,
    deviceName: identity.deviceName,
    timestamp: options.timestamp ?? new Date().toISOString(),
    relativePath,
    contentBase64,
    contentType,
  });

  const { payload, signatureBase64 } = await signMessage(message, options);
  return {
    payload,
    signatureBase64,
    deviceId: message.deviceId,
  };
}

export async function verifySignedFilePush({ payload, signatureBase64 }, options = {}) {
  const payloadText = requireNonBlankString(payload, "payload");
  const signatureText = normalizeNonEmptyString(signatureBase64, "signatureBase64");

  let parsedMessage;
  try {
    parsedMessage = JSON.parse(payloadText);
  } catch {
    throw new Error("Signed file push payload must be valid JSON");
  }

  const message = validateFilePushMessage(parsedMessage);
  const peer = await findTrustedPeer(message.deviceId, options);
  if (!peer) {
    throw new Error("Unknown peer deviceId");
  }

  const verified = await verifyMessage(payloadText, signatureText, peer.publicKey);
  if (!verified) {
    throw new Error("Peer file push signature verification failed");
  }

  return {
    ok: true,
    peer: {
      deviceId: peer.deviceId,
      deviceName: peer.deviceName,
    },
    message,
  };
}

export async function createSignedFileRequest({ relativePath }, options = {}) {
  const identity = await ensureDeviceIdentity(options);
  const message = validateFileRequestMessage({
    type: FILE_REQUEST_TYPE,
    version: FILE_REQUEST_VERSION,
    deviceId: identity.deviceId,
    deviceName: identity.deviceName,
    timestamp: options.timestamp ?? new Date().toISOString(),
    relativePath,
  });

  const { payload, signatureBase64 } = await signMessage(message, options);
  return {
    payload,
    signatureBase64,
    deviceId: message.deviceId,
  };
}

export async function verifySignedFileRequest({ payload, signatureBase64 }, options = {}) {
  const payloadText = requireNonBlankString(payload, "payload");
  const signatureText = normalizeNonEmptyString(signatureBase64, "signatureBase64");

  let parsedMessage;
  try {
    parsedMessage = JSON.parse(payloadText);
  } catch {
    throw new Error("Signed file request payload must be valid JSON");
  }

  const message = validateFileRequestMessage(parsedMessage);
  const peer = await findTrustedPeer(message.deviceId, options);
  if (!peer) {
    throw new Error("Unknown peer deviceId");
  }

  const verified = await verifyMessage(payloadText, signatureText, peer.publicKey);
  if (!verified) {
    throw new Error("Peer file request signature verification failed");
  }

  return {
    ok: true,
    peer: {
      deviceId: peer.deviceId,
      deviceName: peer.deviceName,
    },
    message,
  };
}
