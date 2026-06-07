// Nodevision/ApplicationSystem/Sync/SyncPanelState.mjs
// This module manages in-memory sync-panel runtime state by tracking discovery toggles, discovered peers, selected peer identity, and trusted-peer URL resolution without persisting peer data or exposing key material.

import { buildDiscoveredPeerUrl } from "./sync-discovered-sync-test.mjs";
import { createHash } from "node:crypto";

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.prototype.toString.call(value) === "[object Object]";
}

function normalizeNonEmptyString(value, fieldName) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`${fieldName} must be a nonempty string`);
  return text;
}

function normalizePort(value, fieldName = "port") {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${fieldName} must be an integer between 1 and 65535`);
  }
  return port;
}

function normalizeCapabilities(raw) {
  const source = isPlainObject(raw) ? raw : {};
  const protectedFromIncomingWrites = source.protectedFromIncomingWrites === true || source.protectedFromPeerWrites === true;
  const supportedSyncModes = Array.isArray(source.supportedSyncModes)
    ? source.supportedSyncModes.map((item) => String(item || "").trim()).filter(Boolean)
    : null;
  return {
    sync: Boolean(source.sync),
    conflictResolution: Boolean(source.conflictResolution),
    protectedFromIncomingWrites,
    acceptsIncomingSyncWrites: source.acceptsIncomingSyncWrites === undefined ? !protectedFromIncomingWrites : source.acceptsIncomingSyncWrites !== false,
    allowsOutgoingSyncReads: source.allowsOutgoingSyncReads === undefined ? true : source.allowsOutgoingSyncReads !== false,
    supportedSyncModes,
  };
}

function normalizeLastSeen(value) {
  const text = String(value ?? "").trim();
  if (!text) return new Date().toISOString();
  const ms = Date.parse(text);
  if (Number.isNaN(ms)) return new Date().toISOString();
  return new Date(ms).toISOString();
}

function normalizePublicKey(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (text.includes("PRIVATE KEY")) {
    throw new Error("peer.publicKey must not contain private key material");
  }
  return text;
}

function buildPublicKeyFingerprint(publicKey) {
  if (!publicKey) return null;
  return createHash("sha256").update(publicKey).digest("hex").slice(0, 16);
}

export function createSyncPanelState() {
  return {
    scanning: false,
    discoverable: false,
    selectedPeerDeviceId: null,
    discoveredPeersByDeviceId: new Map(),
    listenerHandle: null,
    broadcasterHandle: null,
    shutdownHookInstalled: false,
  };
}

export function normalizeDiscoveredPeerRecord(input) {
  if (!isPlainObject(input)) throw new Error("peer must be a plain object");
  const publicKey = normalizePublicKey(input.publicKey);
  return {
    deviceId: normalizeNonEmptyString(input.deviceId, "peer.deviceId"),
    deviceName: normalizeNonEmptyString(input.deviceName, "peer.deviceName"),
    trusted: Boolean(input.trusted),
    address: normalizeNonEmptyString(input.address, "peer.address"),
    port: normalizePort(input.port, "peer.port"),
    lastSeen: normalizeLastSeen(input.lastSeen),
    capabilities: normalizeCapabilities(input.capabilities),
    publicKey,
    publicKeyFingerprint: buildPublicKeyFingerprint(publicKey),
  };
}

export function upsertDiscoveredPeer(state, peer) {
  const normalized = normalizeDiscoveredPeerRecord(peer);
  state.discoveredPeersByDeviceId.set(normalized.deviceId, normalized);
  if (state.selectedPeerDeviceId && !state.discoveredPeersByDeviceId.has(state.selectedPeerDeviceId)) {
    state.selectedPeerDeviceId = null;
  }
  return normalized;
}

export function listDiscoveredPeers(state) {
  return [...state.discoveredPeersByDeviceId.values()].sort((a, b) => {
    const nameCmp = a.deviceName.localeCompare(b.deviceName);
    if (nameCmp !== 0) return nameCmp;
    return a.deviceId.localeCompare(b.deviceId);
  });
}

export function getDiscoveredPeer(state, deviceId) {
  const id = normalizeNonEmptyString(deviceId, "deviceId");
  return state.discoveredPeersByDeviceId.get(id) || null;
}

export function setSelectedPeerDeviceId(state, deviceId) {
  const id = normalizeNonEmptyString(deviceId, "deviceId");
  if (!state.discoveredPeersByDeviceId.has(id)) {
    throw new Error("Selected peer is not discovered");
  }
  state.selectedPeerDeviceId = id;
  return id;
}

export function setScanningEnabled(state, enabled) {
  state.scanning = Boolean(enabled);
  return state.scanning;
}

export function setDiscoverableEnabled(state, enabled) {
  state.discoverable = Boolean(enabled);
  return state.discoverable;
}

export function canRunSyncWithDiscoveredPeer(state, deviceId) {
  const peer = getDiscoveredPeer(state, deviceId);
  return Boolean(peer && peer.trusted === true && peer.capabilities?.sync === true);
}

export function buildTrustedDiscoveredPeerUrl(state, deviceId) {
  const peer = getDiscoveredPeer(state, deviceId);
  if (!peer) throw new Error("Discovered peer not found");
  if (peer.trusted !== true) throw new Error("Discovered peer is not trusted");
  return buildDiscoveredPeerUrl(peer);
}
