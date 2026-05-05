// Nodevision/ApplicationSystem/Sync/PeerHello.mjs
// This module builds and verifies signed Nodevision peer hello messages by combining local identity signing with trusted-peer lookup so only known devices can complete hello handshakes.

import { ensureDeviceIdentity, signMessage, verifyMessage } from "./DeviceIdentity.mjs";
import { findTrustedPeer } from "./TrustedPeers.mjs";

const HELLO_TYPE = "nodevision.peer.hello";
const HELLO_VERSION = 1;

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

export async function createSignedHello(options = {}) {
  const identity = await ensureDeviceIdentity(options);
  const message = validateHelloMessage({
    type: HELLO_TYPE,
    version: HELLO_VERSION,
    deviceId: identity.deviceId,
    deviceName: identity.deviceName,
    timestamp: options.timestamp ?? new Date().toISOString(),
  });

  const { payload, signatureBase64 } = await signMessage(message, options);
  return {
    payload,
    signatureBase64,
    deviceId: message.deviceId,
  };
}

export function validateHelloMessage(message) {
  if (!isPlainObject(message)) {
    throw new Error("Hello message must be a plain object");
  }
  if (message.type !== HELLO_TYPE) {
    throw new Error(`Hello message type must be \"${HELLO_TYPE}\"`);
  }
  if (message.version !== HELLO_VERSION) {
    throw new Error("Hello message version must be 1");
  }

  const deviceId = normalizeNonEmptyString(message.deviceId, "deviceId");
  const deviceName = normalizeNonEmptyString(message.deviceName, "deviceName");
  const timestamp = normalizeTimestamp(message.timestamp);

  return {
    type: HELLO_TYPE,
    version: HELLO_VERSION,
    deviceId,
    deviceName,
    timestamp,
  };
}

export async function verifySignedHello({ payload, signatureBase64 }, options = {}) {
  const payloadText = requireNonBlankString(payload, "payload");
  const signatureText = normalizeNonEmptyString(signatureBase64, "signatureBase64");

  let parsedMessage;
  try {
    parsedMessage = JSON.parse(payloadText);
  } catch {
    throw new Error("Signed hello payload must be valid JSON");
  }

  const message = validateHelloMessage(parsedMessage);
  const peer = await findTrustedPeer(message.deviceId, options);
  if (!peer) {
    throw new Error("Unknown peer deviceId");
  }

  const verified = await verifyMessage(payloadText, signatureText, peer.publicKey);
  if (!verified) {
    throw new Error("Peer hello signature verification failed");
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
