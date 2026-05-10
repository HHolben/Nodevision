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

function normalizeCapabilities(raw) {
  const input = isPlainObject(raw) ? raw : {};
  return {
    sync: Boolean(input.sync),
    conflictResolution: Boolean(input.conflictResolution),
  };
}

function capabilitiesSignature(raw) {
  const normalized = normalizeCapabilities(raw);
  return `${normalized.sync ? 1 : 0}:${normalized.conflictResolution ? 1 : 0}`;
}

function normalizeDiscoveryAddress(value) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error("address must be a nonempty string");
  return text;
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
          || previous.capabilitySig !== capabilitySig;
        emit = unseenExpired || changed;
      }

      peerState.set(key, {
        lastSeenMs: currentMs,
        port: peer.port,
        trusted: peer.trusted,
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

export async function createDiscoveryBeacon(options = {}) {
  const identity = await ensureDeviceIdentity(options);
  const message = normalizeDiscoveryMessage({
    type: DISCOVERY_TYPE,
    version: DISCOVERY_VERSION,
    deviceId: identity.deviceId,
    deviceName: identity.deviceName,
    port: resolveAdvertisedPort(options),
    timestamp: options.timestamp ?? new Date().toISOString(),
    capabilities: options.capabilities ?? { sync: true, conflictResolution: true },
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
    if (typeof payload !== "string" || !payload.trim()) return { ok: false };
    const signatureBytes = decodeBase64Signature(signatureBase64);
    if (!signatureBytes) return { ok: false };

    let parsedPayload;
    try {
      parsedPayload = JSON.parse(payload);
    } catch {
      return { ok: false };
    }

    let message;
    try {
      message = normalizeDiscoveryMessage(parsedPayload);
    } catch {
      return { ok: false };
    }

    const peer = await findTrustedPeer(message.deviceId, options);
    if (!peer) {
      return {
        ok: true,
        trusted: false,
        peer: null,
        message,
      };
    }

    const verified = await verifyMessage(payload, signatureBase64, peer.publicKey);
    if (!verified) return { ok: false };

    return {
      ok: true,
      trusted: true,
      peer: {
        deviceId: peer.deviceId,
        deviceName: peer.deviceName,
      },
      message,
    };
  } catch {
    return { ok: false };
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
    capabilities: normalizedMessage.capabilities,
  };
}

export async function parseAndVerifyDiscoveryDatagram(buffer, verifyOptions = {}) {
  let envelope;
  try {
    const raw = String(buffer ?? "");
    envelope = normalizeBeaconEnvelope(JSON.parse(raw));
  } catch {
    return { ok: false };
  }
  return verifyDiscoveryBeacon(envelope, verifyOptions);
}

export function startPeerDiscoveryListener(options = {}) {
  const discoveryPort = normalizePort(options.discoveryPort ?? DEFAULT_DISCOVERY_PORT, "discoveryPort");
  const multicastGroup = normalizeDiscoveryAddress(options.multicastGroup ?? DEFAULT_MULTICAST_GROUP);
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
    let verified;
    try {
      verified = await parseAndVerifyDiscoveryDatagram(msgBuffer, verifyOptions);
    } catch {
      verified = { ok: false };
    }
    if (!verified?.ok) {
      debugLog(debugEnabled, "Ignored invalid discovery datagram from", remoteInfo?.address || "unknown");
      return;
    }

    const localDeviceId = await localIdentityPromise;
    if (isSelfBeacon(localDeviceId, verified.message.deviceId)) {
      debugLog(debugEnabled, "Ignored self-beacon from device", verified.message.deviceId);
      return;
    }

    const peer = normalizeDiscoveredPeer({ ...verified.message, trusted: verified.trusted }, remoteInfo);
    const shouldEmit = deduper.shouldEmit({
      deviceId: peer.deviceId,
      address: peer.address,
      port: peer.port,
      trusted: peer.trusted,
      capabilities: peer.capabilities,
    });
    if (!shouldEmit) return;

    if (onPeerDiscovered) onPeerDiscovered({ trusted: verified.trusted, peer, verification: verified });
    if (verified.trusted && onTrustedPeer) onTrustedPeer(peer, verified);
    if (!verified.trusted && onUntrustedPeer) onUntrustedPeer(peer, verified);
  });

  socket.bind(discoveryPort, () => {
    debugLog(debugEnabled, "Listener bound on UDP port", discoveryPort);
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

  async function broadcastOnce() {
    if (closed) return;
    const beacon = await createDiscoveryBeacon(options);
    const payload = Buffer.from(JSON.stringify(beacon), "utf8");
    await new Promise((resolve, reject) => {
      socket.send(payload, discoveryPort, multicastGroup, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    debugLog(debugEnabled, "Beacon sent for device", beacon.deviceId, "advertised port", JSON.parse(beacon.payload).port);
  }

  const ready = new Promise((resolve, reject) => {
    socket.bind(0, () => {
      debugLog(debugEnabled, "Broadcaster bound on ephemeral UDP port");
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
