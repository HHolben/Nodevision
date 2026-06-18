// Nodevision/ApplicationSystem/Sync/PeerDiscovery.mjs
// This module provides LAN-safe peer discovery beacons for SyncTest by signing minimal identity/capability metadata, verifying trusted peers when possible, filtering self-beacons, and emitting deduplicated discovery events without exposing private keys or notebook data.

import dgram from "node:dgram";
import { Buffer } from "node:buffer";
import { ensureDeviceIdentity, signMessage, verifyMessage } from "./DeviceIdentity.mjs";
import { findTrustedPeer } from "./TrustedPeers.mjs";

const DISCOVERY_TYPE = "nodevision.peer.discovery";
const DISCOVERY_VERSION = 1;
const DEFAULT_ADVERTISED_PORT = 3000;
const DEFAULT_DISCOVERY_PORT = 39000;
const DEFAULT_MULTICAST_GROUP = "239.255.255.250";
const DEFAULT_BROADCAST_INTERVAL_MS = 10_000;
const DEFAULT_DEDUPE_WINDOW_MS = 30_000;
const DEFAULT_BIND_ADDRESS = "0.0.0.0";
const DEFAULT_BROADCAST_ADDRESS = "255.255.255.255";
const DISCOVERY_BEACON_WARN_BYTES = 1200;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.prototype.toString.call(value) === "[object Object]";
}

function normalizeNonEmptyString(value, fieldName) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`${fieldName} must be a nonempty string`);
  return text;
}

function normalizeTimestamp(value) {
  const timestamp = normalizeNonEmptyString(value, "timestamp");
  if (!/^\d{4}-\d{2}-\d{2}T/.test(timestamp) || Number.isNaN(Date.parse(timestamp))) {
    throw new Error("timestamp must be a valid ISO date string");
  }
  return timestamp;
}

function normalizePort(value, fieldName = "port") {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${fieldName} must be an integer between 1 and 65535`);
  }
  return port;
}

function normalizePublicKey(value, fieldName = "publicKey") {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (text.includes("PRIVATE KEY")) {
    throw new Error(`${fieldName} must not contain private key material`);
  }
  if (!text.includes("PUBLIC KEY")) {
    throw new Error(`${fieldName} must be a PEM public key`);
  }
  return text;
}

function normalizeCapabilities(raw) {
  const input = isPlainObject(raw) ? raw : {};
  const protectedFromIncomingWrites = input.protectedFromIncomingWrites === true || input.protectedFromPeerWrites === true;
  const supportedSyncModes = Array.isArray(input.supportedSyncModes)
    ? input.supportedSyncModes.map((item) => String(item || "").trim()).filter(Boolean)
    : null;
  return {
    sync: Boolean(input.sync),
    conflictResolution: Boolean(input.conflictResolution),
    protectedFromIncomingWrites,
    acceptsIncomingSyncWrites: input.acceptsIncomingSyncWrites === undefined ? !protectedFromIncomingWrites : input.acceptsIncomingSyncWrites !== false,
    allowsOutgoingSyncReads: input.allowsOutgoingSyncReads === undefined ? true : input.allowsOutgoingSyncReads !== false,
    supportedSyncModes,
  };
}

function capabilitiesSignature(raw) {
  const normalized = normalizeCapabilities(raw);
  return [
    normalized.sync ? 1 : 0,
    normalized.conflictResolution ? 1 : 0,
    normalized.protectedFromIncomingWrites ? 1 : 0,
    normalized.acceptsIncomingSyncWrites ? 1 : 0,
    normalized.allowsOutgoingSyncReads ? 1 : 0,
    Array.isArray(normalized.supportedSyncModes) ? normalized.supportedSyncModes.join(",") : "",
  ].join(":");
}

function normalizeDiscoveryAddress(value) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error("address must be a nonempty string");
  return text;
}

function normalizeOptionalDiscoveryAddresses(values) {
  const source = Array.isArray(values) ? values : [];
  const normalized = [];
  for (const value of source) {
    try {
      const address = normalizeDiscoveryAddress(value);
      if (!normalized.includes(address)) normalized.push(address);
    } catch {
      // Ignore malformed optional discovery targets.
    }
  }
  return normalized;
}

function decodeBase64Signature(signatureBase64) {
  if (typeof signatureBase64 !== "string") return null;
  if (!signatureBase64.trim() || signatureBase64 !== signatureBase64.trim()) return null;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(signatureBase64)) return null;
  if (signatureBase64.length % 4 !== 0) return null;

  try {
    const decoded = Buffer.from(signatureBase64, "base64");
    if (decoded.length === 0) return null;
    if (decoded.toString("base64") !== signatureBase64) return null;
    return decoded;
  } catch {
    return null;
  }
}

function normalizeDiscoveryMessage(message) {
  if (!isPlainObject(message)) {
    throw new Error("Discovery message must be a plain object");
  }
  if (message.type !== DISCOVERY_TYPE) {
    throw new Error(`Discovery message type must be \"${DISCOVERY_TYPE}\"`);
  }
  if (message.version !== DISCOVERY_VERSION) {
    throw new Error("Discovery message version must be 1");
  }

  return {
    type: DISCOVERY_TYPE,
    version: DISCOVERY_VERSION,
    deviceId: normalizeNonEmptyString(message.deviceId, "deviceId"),
    deviceName: normalizeNonEmptyString(message.deviceName, "deviceName"),
    port: normalizePort(message.port),
    timestamp: normalizeTimestamp(message.timestamp),
    publicKey: normalizePublicKey(message.publicKey),
    capabilities: normalizeCapabilities(message.capabilities),
  };
}

function normalizeBeaconEnvelope(input) {
  if (!isPlainObject(input)) throw new Error("Discovery beacon must be a plain object");
  if (typeof input.payload !== "string" || !input.payload.trim()) throw new Error("payload must be a nonempty string");
  if (typeof input.signatureBase64 !== "string" || !input.signatureBase64.trim()) {
    throw new Error("signatureBase64 must be a nonempty string");
  }
  return {
    payload: input.payload,
    signatureBase64: input.signatureBase64.trim(),
  };
}

function isDebugEnabled(options = {}) {
  if (typeof options.debug === "boolean") return options.debug;
  return String(process.env.NODEVISION_DISCOVERY_DEBUG ?? "") === "1";
}

function debugLog(enabled, message, ...args) {
  if (!enabled) return;
  const renderedArgs = args.length > 0 ? ` ${args.map((item) => String(item)).join(" ")}` : "";
  process.stderr.write(`[PeerDiscovery] ${message}${renderedArgs}\n`);
}

function asErrorMessage(err) {
  return err?.message || String(err);
}

function rejectVerification(reason, detail = "", message = null) {
  return {
    ok: false,
    reason,
    detail: String(detail || "").trim(),
    message: message && typeof message === "object" ? message : null,
  };
}

function describePeerMessage(message) {
  const deviceId = String(message?.deviceId ?? "").trim();
  const deviceName = String(message?.deviceName ?? "").trim();
  const port = Number(message?.port);
  return `deviceId=${deviceId || "?"} deviceName=${deviceName || "?"} advertisedPort=${Number.isInteger(port) ? port : "?"}`;
}

function logRejection(debugEnabled, verified, remoteInfo) {
  const remoteAddress = String(remoteInfo?.address || "unknown");
  const remotePort = Number.isInteger(remoteInfo?.port) ? String(remoteInfo.port) : "?";
  const base = `Rejected discovery datagram from ${remoteAddress}:${remotePort}`;
  const detail = String(verified?.detail || "").trim();
  const messageSummary = verified?.message ? ` (${describePeerMessage(verified.message)})` : "";
  const suffix = detail ? `: ${detail}` : "";
  const reason = String(verified?.reason || "unknown");

  if (reason === "signature_invalid") {
    debugLog(debugEnabled, `${base} due to signature verification failure${messageSummary}${suffix}`);
    return;
  }
  if (reason === "public_key_missing_or_invalid") {
    debugLog(debugEnabled, `${base} due to missing/invalid publicKey${messageSummary}${suffix}`);
    return;
  }
  if (reason === "self_beacon") {
    debugLog(debugEnabled, `${base} rejected as self-beacon${messageSummary}${suffix}`);
    return;
  }
  if (reason === "malformed") {
    debugLog(debugEnabled, `${base} rejected as malformed${messageSummary}${suffix}`);
    return;
  }
  debugLog(debugEnabled, `${base} rejected (${reason})${messageSummary}${suffix}`);
}

function resolveAdvertisedPort(options = {}) {
  if (options.port !== undefined && options.port !== null) {
    return normalizePort(options.port, "port");
  }

  const envPortText = String(process.env.PORT ?? "").trim();
  if (envPortText) {
    try {
      return normalizePort(envPortText, "process.env.PORT");
    } catch {
      // fall through to default port
    }
  }

  return DEFAULT_ADVERTISED_PORT;
}

function isSelfBeacon(localDeviceId, messageDeviceId) {
  const localId = String(localDeviceId ?? "").trim();
  const remoteId = String(messageDeviceId ?? "").trim();
  return Boolean(localId) && Boolean(remoteId) && localId === remoteId;
}

export function isSelfDiscoveryBeacon(localDeviceId, messageDeviceId) {
  return isSelfBeacon(localDeviceId, messageDeviceId);
}

function callSocketMethodSafe(socket, methodName, args = [], debugEnabled = false, context = "") {
  const method = socket?.[methodName];
  if (typeof method !== "function") {
    debugLog(debugEnabled, `${methodName} unavailable${context ? ` (${context})` : ""}`);
    return false;
  }

  try {
    method.apply(socket, args);
    return true;
  } catch (err) {
    debugLog(debugEnabled, `${methodName} failed${context ? ` (${context})` : ""}:`, err?.message || String(err));
    return false;
  }
}

export function applyDiscoverySocketOptionsAfterBind(socket, options = {}) {
  const multicastGroup = normalizeDiscoveryAddress(options.multicastGroup ?? DEFAULT_MULTICAST_GROUP);
  const multicastInterface = options.multicastInterface || undefined;
  const multicastTTL = Number(options.multicastTTL ?? 1);
  const multicastLoopback = options.multicastLoopback ?? true;
  const debugEnabled = isDebugEnabled(options);
  const context = options.context ? String(options.context) : "discovery";

  return {
    setBroadcast: callSocketMethodSafe(socket, "setBroadcast", [true], debugEnabled, context),
    setMulticastTTL: callSocketMethodSafe(socket, "setMulticastTTL", [multicastTTL], debugEnabled, context),
    setMulticastLoopback: callSocketMethodSafe(socket, "setMulticastLoopback", [Boolean(multicastLoopback)], debugEnabled, context),
    addMembership: callSocketMethodSafe(socket, "addMembership", [multicastGroup, multicastInterface], debugEnabled, context),
  };
}

function normalizeDiscoveryState(input, fieldName = "peer") {
  if (!isPlainObject(input)) throw new Error(`${fieldName} must be a plain object`);
  return {
    deviceId: normalizeNonEmptyString(input.deviceId, `${fieldName}.deviceId`),
    address: normalizeDiscoveryAddress(input.address ?? input.host ?? "0.0.0.0"),
    port: normalizePort(input.port, `${fieldName}.port`),
    trusted: Boolean(input.trusted),
    publicKey: normalizePublicKey(input.publicKey, `${fieldName}.publicKey`),
    capabilities: normalizeCapabilities(input.capabilities),
  };
}

export function createDiscoveryDeduper(options = {}) {
  const ttlMs = Number(options.ttlMs ?? DEFAULT_DEDUPE_WINDOW_MS);
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
    throw new Error("ttlMs must be a positive number");
  }

  const seenAt = new Map();
  const peerState = new Map();

  return {
    shouldEmit(input, nowMs = Date.now()) {
      const currentMs = Number.isFinite(nowMs) ? nowMs : Date.now();

      if (typeof input === "string") {
        const id = normalizeNonEmptyString(input, "dedupe key");
        const previousMs = seenAt.get(id);
        if (typeof previousMs === "number" && currentMs - previousMs < ttlMs) {
          return false;
        }
        seenAt.set(id, currentMs);
        return true;
      }

      const peer = normalizeDiscoveryState(input, "peer");
      const key = `${peer.deviceId}|${peer.address}`;
      const capabilitySig = capabilitiesSignature(peer.capabilities);
      const previous = peerState.get(key);

      let emit = false;
      if (!previous) {
        emit = true;
      } else {
        const unseenExpired = currentMs - previous.lastSeenMs > ttlMs;
        const changed = previous.port !== peer.port
          || previous.trusted !== peer.trusted
          || previous.publicKey !== peer.publicKey
          || previous.capabilitySig !== capabilitySig;
        emit = unseenExpired || changed;
      }

      peerState.set(key, {
        lastSeenMs: currentMs,
        port: peer.port,
        trusted: peer.trusted,
        publicKey: peer.publicKey,
        capabilitySig,
      });

      for (const [entryKey, entry] of peerState.entries()) {
        if (currentMs - entry.lastSeenMs > ttlMs * 3) {
          peerState.delete(entryKey);
        }
      }

      return emit;
    },
  };
}

async function resolveDiscoveryCapabilities(options = {}) {
  const configured = typeof options.capabilities === "function"
    ? await options.capabilities()
    : options.capabilities;
  return configured ?? { sync: true, conflictResolution: true };
}

export async function createDiscoveryBeacon(options = {}) {
  const identity = await ensureDeviceIdentity(options);
  const message = normalizeDiscoveryMessage({
    type: DISCOVERY_TYPE,
    version: DISCOVERY_VERSION,
    deviceId: identity.deviceId,
    deviceName: identity.deviceName,
    port: resolveAdvertisedPort(options),
    timestamp: options.timestamp ?? new Date().toISOString(),
    publicKey: String(identity.publicKey ?? "").trim(),
    capabilities: await resolveDiscoveryCapabilities(options),
  });

  const { payload, signatureBase64 } = await signMessage(message, options);
  return {
    payload,
    signatureBase64,
    deviceId: message.deviceId,
  };
}

export async function verifyDiscoveryBeacon({ payload, signatureBase64 }, options = {}) {
  try {
    if (typeof payload !== "string" || !payload.trim()) {
      return rejectVerification("malformed", "payload must be a nonempty string");
    }
    const signatureBytes = decodeBase64Signature(signatureBase64);
    if (!signatureBytes) {
      return rejectVerification("malformed", "signatureBase64 is invalid");
    }

    let parsedPayload;
    try {
      parsedPayload = JSON.parse(payload);
    } catch {
      return rejectVerification("malformed", "payload is not valid JSON");
    }

    let message;
    try {
      message = normalizeDiscoveryMessage(parsedPayload);
    } catch (err) {
      const detail = asErrorMessage(err);
      if (detail.includes("publicKey")) {
        return rejectVerification("public_key_missing_or_invalid", detail);
      }
      return rejectVerification("malformed", detail);
    }

    const peer = await findTrustedPeer(message.deviceId, options);
    if (!peer) {
      let unknownPublicKey;
      try {
        unknownPublicKey = normalizePublicKey(parsedPayload?.publicKey, "message.publicKey");
      } catch (err) {
        return rejectVerification("public_key_missing_or_invalid", asErrorMessage(err), message);
      }
      if (!unknownPublicKey) {
        return rejectVerification("public_key_missing_or_invalid", "message.publicKey is required for unknown peers", message);
      }
      // Verify the exact original payload string as received on the wire.
      const verified = await verifyMessage(payload, signatureBase64, unknownPublicKey);
      if (!verified) {
        return rejectVerification("signature_invalid", "unknown peer signature verification failed", message);
      }
      return {
        ok: true,
        trusted: false,
        peer: null,
        message,
      };
    }

    const verified = await verifyMessage(payload, signatureBase64, peer.publicKey);
    if (!verified) {
      return rejectVerification("signature_invalid", "trusted peer signature verification failed", message);
    }

    return {
      ok: true,
      trusted: true,
      peer: {
        deviceId: peer.deviceId,
        deviceName: peer.deviceName,
        publicKey: peer.publicKey,
      },
      message,
    };
  } catch {
    return rejectVerification("malformed", "unexpected verification failure");
  }
}

export function normalizeDiscoveredPeer(message, remoteInfo = {}) {
  const normalizedMessage = normalizeDiscoveryMessage(message);
  const trusted = Boolean(message?.trusted);
  const address = normalizeDiscoveryAddress(remoteInfo.address ?? remoteInfo.host ?? "0.0.0.0");
  const lastSeen = new Date().toISOString();

  return {
    deviceId: normalizedMessage.deviceId,
    deviceName: normalizedMessage.deviceName,
    trusted,
    address,
    port: normalizedMessage.port,
    lastSeen,
    publicKey: normalizedMessage.publicKey,
    capabilities: normalizedMessage.capabilities,
  };
}

export async function parseAndVerifyDiscoveryDatagram(buffer, verifyOptions = {}) {
  let envelope;
  try {
    const raw = String(buffer ?? "");
    envelope = normalizeBeaconEnvelope(JSON.parse(raw));
  } catch (err) {
    return rejectVerification("malformed", asErrorMessage(err));
  }
  return verifyDiscoveryBeacon(envelope, verifyOptions);
}

export function startPeerDiscoveryListener(options = {}) {
  const discoveryPort = normalizePort(options.discoveryPort ?? DEFAULT_DISCOVERY_PORT, "discoveryPort");
  const multicastGroup = normalizeDiscoveryAddress(options.multicastGroup ?? DEFAULT_MULTICAST_GROUP);
  const bindAddress = normalizeDiscoveryAddress(options.bindAddress ?? DEFAULT_BIND_ADDRESS);
  const socket = dgram.createSocket({ type: "udp4", reuseAddr: true });
  const deduper = options.deduper ?? createDiscoveryDeduper({ ttlMs: options.dedupeWindowMs });
  const verifyOptions = options.verifyOptions ?? options;
  const debugEnabled = isDebugEnabled(options);

  const onTrustedPeer = typeof options.onTrustedPeer === "function" ? options.onTrustedPeer : null;
  const onUntrustedPeer = typeof options.onUntrustedPeer === "function" ? options.onUntrustedPeer : null;
  const onPeerDiscovered = typeof options.onPeerDiscovered === "function" ? options.onPeerDiscovered : null;
  const onError = typeof options.onError === "function" ? options.onError : null;

  const localIdentityPromise = ensureDeviceIdentity(verifyOptions)
    .then((identity) => String(identity.deviceId || ""))
    .catch((err) => {
      if (onError) onError(err);
      return "";
    });

  socket.on("error", (err) => {
    if (onError) onError(err);
  });

  socket.on("message", async (msgBuffer, remoteInfo) => {
    debugLog(
      debugEnabled,
      "Incoming discovery datagram",
      `from=${String(remoteInfo?.address || "unknown")}:${Number.isInteger(remoteInfo?.port) ? String(remoteInfo.port) : "?"}`,
      `bytes=${Buffer.byteLength(msgBuffer)}`,
    );
    let verified;
    try {
      verified = await parseAndVerifyDiscoveryDatagram(msgBuffer, verifyOptions);
    } catch (err) {
      verified = rejectVerification("malformed", asErrorMessage(err));
    }
    if (!verified?.ok) {
      logRejection(debugEnabled, verified, remoteInfo);
      return;
    }

    debugLog(debugEnabled, `Parsed discovery message ${describePeerMessage(verified.message)}`);

    const localDeviceId = await localIdentityPromise;
    if (isSelfBeacon(localDeviceId, verified.message.deviceId)) {
      logRejection(debugEnabled, rejectVerification("self_beacon", "", verified.message), remoteInfo);
      return;
    }

    const peerPublicKey = verified.trusted
      ? String(verified.peer?.publicKey ?? "").trim() || null
      : String(verified.message?.publicKey ?? "").trim() || null;
    const peer = normalizeDiscoveredPeer({ ...verified.message, trusted: verified.trusted, publicKey: peerPublicKey }, remoteInfo);
    const shouldEmit = deduper.shouldEmit({
      deviceId: peer.deviceId,
      address: peer.address,
      port: peer.port,
      trusted: peer.trusted,
      publicKey: peer.publicKey,
      capabilities: peer.capabilities,
    });
    if (!shouldEmit) return;

    debugLog(
      debugEnabled,
      `Accepted discovery peer as ${verified.trusted ? "trusted" : "untrusted"} ${describePeerMessage(peer)}`,
    );
    if (onPeerDiscovered) onPeerDiscovered({ trusted: verified.trusted, peer, verification: verified });
    if (verified.trusted && onTrustedPeer) onTrustedPeer(peer, verified);
    if (!verified.trusted && onUntrustedPeer) onUntrustedPeer(peer, verified);
  });

  socket.bind(discoveryPort, bindAddress, () => {
    const bound = socket.address();
    debugLog(
      debugEnabled,
      "Listener bound",
      `address=${String(bound?.address || bindAddress)}`,
      `port=${Number.isInteger(bound?.port) ? String(bound.port) : String(discoveryPort)}`,
    );
    applyDiscoverySocketOptionsAfterBind(socket, {
      ...options,
      multicastGroup,
      context: "listener",
    });
  });

  return {
    socket,
    close() {
      return new Promise((resolve) => {
        socket.close(() => resolve());
      });
    },
  };
}

export function startPeerDiscoveryBroadcaster(options = {}) {
  const discoveryPort = normalizePort(options.discoveryPort ?? DEFAULT_DISCOVERY_PORT, "discoveryPort");
  const multicastGroup = normalizeDiscoveryAddress(options.multicastGroup ?? DEFAULT_MULTICAST_GROUP);
  const bindAddress = normalizeDiscoveryAddress(options.bindAddress ?? DEFAULT_BIND_ADDRESS);
  const broadcastAddress = normalizeDiscoveryAddress(options.broadcastAddress ?? DEFAULT_BROADCAST_ADDRESS);
  const extraTargetAddresses = normalizeOptionalDiscoveryAddresses(options.extraTargetAddresses);
  const intervalMs = Number(options.intervalMs ?? DEFAULT_BROADCAST_INTERVAL_MS);
  if (!Number.isFinite(intervalMs) || intervalMs < 1_000) {
    throw new Error("intervalMs must be at least 1000ms");
  }

  const socket = dgram.createSocket("udp4");
  const debugEnabled = isDebugEnabled(options);

  let closed = false;
  let timer = null;
  const onError = typeof options.onError === "function" ? options.onError : null;
  socket.on("error", (err) => {
    if (onError) onError(err);
  });

  async function sendDatagram(buffer, targetAddress) {
    await new Promise((resolve, reject) => {
      socket.send(buffer, discoveryPort, targetAddress, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async function broadcastOnce() {
    if (closed) return;
    const beacon = await createDiscoveryBeacon(options);
    const wireBeacon = {
      payload: beacon.payload,
      signatureBase64: beacon.signatureBase64,
    };
    const wireBytes = Buffer.byteLength(JSON.stringify(wireBeacon), "utf8");
    const advertisedPort = JSON.parse(beacon.payload).port;
    debugLog(
      debugEnabled,
      "Beacon prepared",
      `bytes=${wireBytes}`,
      `deviceId=${beacon.deviceId}`,
      `advertisedPort=${advertisedPort}`,
    );
    if (wireBytes > DISCOVERY_BEACON_WARN_BYTES) {
      debugLog(debugEnabled, "Beacon exceeds conservative LAN UDP size budget", `bytes=${wireBytes}`, `budget=${DISCOVERY_BEACON_WARN_BYTES}`);
    }

    const payloadBuffer = Buffer.from(JSON.stringify(wireBeacon), "utf8");
    try {
      await sendDatagram(payloadBuffer, multicastGroup);
      debugLog(debugEnabled, "Beacon sent via multicast", `target=${multicastGroup}:${discoveryPort}`, `bytes=${payloadBuffer.length}`);
    } catch (multicastErr) {
      debugLog(debugEnabled, "Multicast beacon send failed; attempting IPv4 broadcast fallback", asErrorMessage(multicastErr));
      await sendDatagram(payloadBuffer, broadcastAddress);
      debugLog(debugEnabled, "Beacon sent via broadcast fallback", `target=${broadcastAddress}:${discoveryPort}`, `bytes=${payloadBuffer.length}`);
    }

    for (const targetAddress of extraTargetAddresses) {
      try {
        await sendDatagram(payloadBuffer, targetAddress);
        debugLog(debugEnabled, "Beacon sent via extra discovery target", `target=${targetAddress}:${discoveryPort}`, `bytes=${payloadBuffer.length}`);
      } catch (targetErr) {
        debugLog(debugEnabled, "Extra discovery target send failed", `target=${targetAddress}:${discoveryPort}`, asErrorMessage(targetErr));
      }
    }
  }

  const ready = new Promise((resolve, reject) => {
    socket.bind(0, bindAddress, () => {
      const bound = socket.address();
      debugLog(
        debugEnabled,
        "Broadcaster bound",
        `address=${String(bound?.address || bindAddress)}`,
        `port=${Number.isInteger(bound?.port) ? String(bound.port) : "?"}`,
      );
      applyDiscoverySocketOptionsAfterBind(socket, {
        ...options,
        multicastGroup,
        context: "broadcaster",
      });
      resolve();
    });
    socket.once("error", reject);
  });

  (async () => {
    try {
      await ready;
      await broadcastOnce();
      timer = setInterval(() => {
        broadcastOnce().catch((err) => {
          if (onError) onError(err);
        });
      }, intervalMs);
    } catch (err) {
      if (onError) onError(err);
    }
  })();

  return {
    socket,
    async broadcastNow() {
      await ready;
      await broadcastOnce();
    },
    stop() {
      closed = true;
      if (timer) clearInterval(timer);
      return new Promise((resolve) => {
        socket.close(() => resolve());
      });
    },
  };
}
