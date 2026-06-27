// Nodevision/ApplicationSystem/server/routes/syncPanelRoutes.mjs
// This file registers authenticated Sync Panel API endpoints that manage in-memory discovery state, expose safe local/discovery status, and run trusted scope-limited sync operations only after explicit user actions.

import os from "node:os";
import net from "node:net";
import multer from "multer";
import { addTrustedPeer, findTrustedPeer, getLocalPeerInfo } from "../../Sync/TrustedPeers.mjs";
import {
  addSyncScope,
  listCandidateNotebookFolders,
  loadSyncScopes,
  removeSyncScope,
  validateSyncScope,
} from "../../Sync/SyncScopes.mjs";
import { normalizeSyncDirection, runScopeSyncTwoWay } from "../../Sync/sync-scope-two-way.mjs";
import { applyLocalSyncPackage, createLocalSyncPackage, inspectLocalSyncPackage } from "../../Sync/LocalSyncPackageTransport.mjs";
import { loadSyncProtection, saveSyncProtection } from "../../Sync/SyncProtection.mjs";
import { createSyncJobManager } from "../../Sync/SyncJobManager.mjs";
import { buildDiscoveredPeerUrl } from "../../Sync/sync-discovered-sync-test.mjs";
import {
  startPeerDiscoveryListener,
  startPeerDiscoveryBroadcaster,
} from "../../Sync/PeerDiscovery.mjs";
import {
  buildTrustedDiscoveredPeerUrl,
  canRunSyncWithDiscoveredPeer,
  createSyncPanelState,
  getDiscoveredPeer,
  listDiscoveredPeers,
  setDiscoverableEnabled,
  setScanningEnabled,
  setSelectedPeerDeviceId,
  upsertDiscoveredPeer,
} from "../../Sync/SyncPanelState.mjs";

const DEFAULT_SYNC_SCOPE = "SyncTest";
const DEFAULT_PEER_PORT_RECOVERY_SCAN_COUNT = 25;
const DEFAULT_PEER_PORT_RECOVERY_TIMEOUT_MS = 650;
const DEFAULT_PEER_ENDPOINT_REDISCOVERY_TIMEOUT_MS = 11_000;
const DEFAULT_PEER_ENDPOINT_REDISCOVERY_POLL_MS = 150;
const DEFAULT_PEER_URL_FALLBACK_PROBE_TIMEOUT_MS = 900;
const DEFAULT_USB_DISCOVERY_PROBE_CONCURRENCY = 16;
const DEFAULT_SYNC_PACKAGE_MAX_BYTES = 512 * 1024 * 1024;
const COMMON_USB_PEER_HOSTS = [
  "192.168.42.129",
  "192.168.42.1",
  "192.168.43.1",
  "172.20.10.1",
  "172.20.10.2",
  "192.168.7.1",
  "192.168.7.2",
  "192.168.55.1",
  "192.168.55.100",
];
const PEER_WRITE_BLOCKED_MESSAGE = "Peer is protected from incoming sync writes. Use Pull mode from the receiving device or disable protection on the peer.";

function requireSession(req, res) {
  if (!req.identity) {
    res.status(401).json({ ok: false, error: "Authentication required" });
    return false;
  }
  return true;
}

function parseEnabledFlag(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Body must be a JSON object");
  }
  if (typeof body.enabled !== "boolean") {
    throw new Error("enabled must be a boolean");
  }
  return body.enabled;
}

function parseDeviceId(value) {
  if (typeof value !== "string") {
    throw new Error("deviceId must be a nonempty string");
  }
  const deviceId = value.trim();
  if (!deviceId) {
    throw new Error("deviceId must be a nonempty string");
  }
  return deviceId;
}

function sanitizeSyncRunErrorDetails(errorMessage) {
  let safe = String(errorMessage || "Unknown sync error");
  safe = safe.replace(
    /-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/gi,
    "[REDACTED_PRIVATE_KEY]",
  );
  safe = safe.replace(
    /-----BEGIN [^-]*KEY-----[\s\S]*?-----END [^-]*KEY-----/gi,
    "[REDACTED_KEY_MATERIAL]",
  );
  safe = safe.replace(
    /(?:[A-Za-z]:)?(?:\/|\\)[^\s"'`]*ServerSettings(?:\/|\\)[^\s"'`]*/g,
    "[REDACTED_SERVER_SETTINGS_PATH]",
  );
  safe = safe.replace(
    /(?:[A-Za-z]:)?(?:\/|\\)[^\s"'`]*ServerSettings\b/g,
    "[REDACTED_SERVER_SETTINGS_PATH]",
  );
  if (safe.length > 400) safe = `${safe.slice(0, 400)}...`;
  return safe.trim() || "Unknown sync error";
}

function getSafeSyncRunErrorDetails(err) {
  const message = err?.message ? String(err.message) : String(err || "Unknown sync error");
  const attemptedUrls = Array.isArray(err?.attemptedPeerUrls)
    ? [...new Set(err.attemptedPeerUrls.map((item) => String(item || "").trim()).filter(Boolean))]
    : [];
  const attemptedSuffix = attemptedUrls.length ? ` Attempted URLs: ${attemptedUrls.join(", ")}` : "";
  return sanitizeSyncRunErrorDetails(`${message}${attemptedSuffix}`);
}

function classifySyncRunError(err) {
  const name = String(err?.name || "");
  if (name === "PeerSyncNetworkError") {
    return {
      statusCode: 502,
      error: "Selected peer is unreachable",
    };
  }
  if (name === "PeerSyncHttpError") {
    const status = Number(err?.status ?? err?.statusCode);
    const payloadError = String(err?.responsePayload?.error || err?.message || "");
    if (status === 403 && payloadError.toLowerCase().includes("protected from incoming sync writes")) {
      return {
        statusCode: 409,
        error: PEER_WRITE_BLOCKED_MESSAGE,
      };
    }
    return {
      statusCode: 502,
      error: "Selected peer returned an error",
    };
  }
  if (name === "PeerSyncDirectionBlockedError") {
    return {
      statusCode: Number(err?.statusCode) || 409,
      error: PEER_WRITE_BLOCKED_MESSAGE,
    };
  }
  return {
    statusCode: 500,
    error: "Sync failed",
  };
}

function isValidPort(value) {
  const port = Number(value);
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}

async function probePeerHttpReachability(peerUrl, timeoutMs = DEFAULT_PEER_PORT_RECOVERY_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await fetch(new URL("/api/peer/status", `${peerUrl}/`).toString(), {
      method: "GET",
      signal: controller.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function recoverDiscoveredPeerPort(state, discoveredPeer) {
  const address = String(discoveredPeer?.address ?? "").trim();
  const basePort = Number(discoveredPeer?.port);
  if (!address || !isValidPort(basePort)) return null;
  const expectedDeviceId = String(discoveredPeer?.deviceId ?? "").trim();
  const candidateAddresses = [...new Set([address, "localhost", "127.0.0.1"])];
  const maxOffset = Math.max(1, DEFAULT_PEER_PORT_RECOVERY_SCAN_COUNT);

  for (let offset = 1; offset <= maxOffset; offset += 1) {
    const candidatePort = basePort + offset;
    if (!isValidPort(candidatePort)) break;
    for (const candidateAddress of candidateAddresses) {
      let candidateUrl;
      try {
        candidateUrl = buildDiscoveredPeerUrl({ address: candidateAddress, port: candidatePort });
      } catch {
        continue;
      }
      const probe = await probePeerCandidateUrl(candidateUrl, { expectedDeviceId });
      if (!probe.ok) continue;
      try {
        const recoveredPeer = upsertDiscoveredPeer(state, {
          ...discoveredPeer,
          address: candidateAddress,
          port: candidatePort,
        });
        return {
          recoveryKind: "port",
          recoveredPeer,
          recoveredPeerUrl: candidateUrl,
        };
      } catch {
        return null;
      }
    }
  }
  return null;
}

function buildPeerUrlCandidates(discoveredPeer, preferredPeerUrl = "", options = {}) {
  const address = String(discoveredPeer?.address ?? "").trim();
  const port = Number(discoveredPeer?.port);
  const strictPreferredPeerUrl = options?.strictPreferredPeerUrl === true;
  const candidates = [];
  const addUrl = (peerUrl) => {
    const text = String(peerUrl || "").trim();
    if (!text) return;
    try {
      const parsed = new URL(text);
      if ((parsed.protocol === "http:" || parsed.protocol === "https:") && parsed.hostname && !candidates.includes(parsed.origin)) candidates.push(parsed.origin);
    } catch {
      // ignore invalid preferred peer URL
    }
  };
  addUrl(preferredPeerUrl);
  if (strictPreferredPeerUrl) return candidates;
  if (!address || !isValidPort(port)) return candidates;
  const add = (candidateAddress) => {
    try {
      const peerUrl = buildDiscoveredPeerUrl({ address: candidateAddress, port });
      if (!candidates.includes(peerUrl)) candidates.push(peerUrl);
    } catch {
      // ignore invalid candidate construction
    }
  };
  add(address);
  add("localhost");
  add("127.0.0.1");
  return candidates;
}

async function probePeerCandidateUrl(peerUrl, { expectedDeviceId } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_PEER_URL_FALLBACK_PROBE_TIMEOUT_MS);
  try {
    const response = await fetch(new URL("/api/peer/status", `${peerUrl}/`).toString(), {
      method: "GET",
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    const reportedDeviceId = String(payload?.localDevice?.deviceId ?? "").trim();
    if (reportedDeviceId && expectedDeviceId && reportedDeviceId !== expectedDeviceId) {
      return {
        ok: false,
        reason: "device_mismatch",
      };
    }
    return {
      ok: true,
    };
  } catch (err) {
    return {
      ok: false,
      reason: "network_error",
      error: err,
    };
  } finally {
    clearTimeout(timer);
  }
}

function attachAttemptedPeerUrls(err, attemptedPeerUrls) {
  if (!err || typeof err !== "object") return err;
  const uniqueUrls = [...new Set((Array.isArray(attemptedPeerUrls) ? attemptedPeerUrls : []).map((item) => String(item || "").trim()).filter(Boolean))];
  err.attemptedPeerUrls = uniqueUrls;
  return err;
}

function resolveSyncRunner(ctx) {
  return typeof ctx?.syncRunner === "function"
    ? ctx.syncRunner
    : runScopeSyncTwoWay;
}

async function runScopeSyncWithPeerUrlFallback({
  discoveredPeer,
  scope,
  runtimeRoot,
  dryRun,
  syncRunner,
  syncDirection = "sync",
  syncRunnerOptions = null,
  preferredPeerUrl = "",
  strictPreferredPeerUrl = false,
} = {}) {
  const candidates = buildPeerUrlCandidates(discoveredPeer, preferredPeerUrl, { strictPreferredPeerUrl });
  const expectedDeviceId = String(discoveredPeer?.deviceId ?? "").trim();
  const attemptedPeerUrls = [];
  const normalizedSyncDirection = normalizeSyncDirection(syncDirection);
  let lastNetworkError = null;

  for (const peerUrl of candidates) {
    attemptedPeerUrls.push(peerUrl);
    const probe = await probePeerCandidateUrl(peerUrl, { expectedDeviceId });
    if (!probe.ok) {
      if (probe.reason === "network_error") {
        const networkError = new Error(`Unable to reach peer at ${peerUrl}: ${probe.error?.message || "network request failed"}`);
        networkError.name = "PeerSyncNetworkError";
        networkError.peerUrl = peerUrl;
        networkError.endpointPath = "/api/peer/status";
        networkError.cause = probe.error;
        lastNetworkError = networkError;
      }
      continue;
    }

    try {
      const peerCapabilities = await enforcePeerSyncDirectionCapabilities({ peerUrl, syncDirection: normalizedSyncDirection });
      const sync = await syncRunner({
        peerUrl,
        scope,
        runtimeRoot,
        dryRun,
        ...(syncRunnerOptions && typeof syncRunnerOptions === "object" ? syncRunnerOptions : {}),
        syncDirection: normalizedSyncDirection,
      });
      return {
        sync,
        resolvedPeerUrl: peerUrl,
        attemptedPeerUrls: [...new Set(attemptedPeerUrls)],
        peerCapabilities,
        syncDirection: normalizedSyncDirection,
      };
    } catch (err) {
      if (err?.name === "PeerSyncNetworkError") {
        lastNetworkError = err;
        continue;
      }
      throw attachAttemptedPeerUrls(err, attemptedPeerUrls);
    }
  }

  if (lastNetworkError) {
    throw attachAttemptedPeerUrls(lastNetworkError, attemptedPeerUrls);
  }

  const fallbackError = new Error(`Unable to reach peer at ${candidates[0] || "unknown peer URL"}: no candidate endpoint responded`);
  fallbackError.name = "PeerSyncNetworkError";
  fallbackError.peerUrl = candidates[0] || "";
  throw attachAttemptedPeerUrls(fallbackError, attemptedPeerUrls);
}

function maybePersistLoopbackPeerEndpoint(state, discoveredPeer, resolvedPeerUrl) {
  try {
    const parsed = new URL(String(resolvedPeerUrl || ""));
    const host = String(parsed.hostname || "").trim();
    const port = Number(parsed.port);
    if (!host || !isValidPort(port)) return discoveredPeer;
    if (host !== "localhost" && host !== "127.0.0.1") return discoveredPeer;
    if (String(discoveredPeer?.address ?? "").trim() === host && Number(discoveredPeer?.port) === port) {
      return discoveredPeer;
    }
    return upsertDiscoveredPeer(state, {
      ...discoveredPeer,
      address: host,
      port,
    });
  } catch {
    return discoveredPeer;
  }
}

function maybePersistResolvedPeerEndpointForTransport(state, discoveredPeer, resolvedPeerUrl, syncTransport) {
  if (syncTransportRequiresExplicitPeerUrl(syncTransport)) return discoveredPeer;
  return maybePersistLoopbackPeerEndpoint(state, discoveredPeer, resolvedPeerUrl);
}

function getPeerEndpointSnapshot(peer) {
  return {
    address: String(peer?.address ?? "").trim(),
    port: Number(peer?.port),
  };
}

function didPeerEndpointChange(previousPeer, nextPeer) {
  const prev = getPeerEndpointSnapshot(previousPeer);
  const next = getPeerEndpointSnapshot(nextPeer);
  return prev.address !== next.address || prev.port !== next.port;
}

function resolvePeerEndpointRediscoveryTimeoutMs(ctx) {
  const configured = Number(ctx?.peerEndpointRediscoveryTimeoutMs);
  if (Number.isFinite(configured) && configured >= 250) {
    return Math.floor(configured);
  }
  return DEFAULT_PEER_ENDPOINT_REDISCOVERY_TIMEOUT_MS;
}

function resolvePeerDiscoveryListenerFactory(ctx) {
  return typeof ctx?.peerDiscoveryListenerFactory === "function"
    ? ctx.peerDiscoveryListenerFactory
    : startPeerDiscoveryListener;
}

function resolvePeerDiscoveryBroadcasterFactory(ctx) {
  return typeof ctx?.peerDiscoveryBroadcasterFactory === "function"
    ? ctx.peerDiscoveryBroadcasterFactory
    : startPeerDiscoveryBroadcaster;
}

async function waitForDiscoveredPeerEndpointUpdate(state, deviceId, baselinePeer, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const latest = getDiscoveredPeer(state, deviceId);
    if (latest && latest.trusted === true && latest.capabilities?.sync === true && didPeerEndpointChange(baselinePeer, latest)) {
      return latest;
    }
    await new Promise((resolve) => setTimeout(resolve, DEFAULT_PEER_ENDPOINT_REDISCOVERY_POLL_MS));
  }
  return null;
}

async function recoverDiscoveredPeerEndpoint(state, discoveredPeer, ctx) {
  const deviceId = String(discoveredPeer?.deviceId ?? "").trim();
  if (!deviceId) return null;

  let temporaryListenerHandle = null;
  if (!state.listenerHandle) {
    const listenerFactory = resolvePeerDiscoveryListenerFactory(ctx);
    try {
      temporaryListenerHandle = listenerFactory({
        verifyOptions: { runtimeRoot: ctx?.runtimeRoot },
        onPeerDiscovered({ peer }) {
          try {
            upsertDiscoveredPeer(state, peer);
          } catch {
            // ignore malformed peer events
          }
        },
      });
    } catch {
      return null;
    }
  }

  try {
    const refreshedPeer = await waitForDiscoveredPeerEndpointUpdate(
      state,
      deviceId,
      discoveredPeer,
      resolvePeerEndpointRediscoveryTimeoutMs(ctx),
    );
    if (!refreshedPeer) return null;

    const recoveredPeerUrl = buildDiscoveredPeerUrl(refreshedPeer);
    const reachable = await probePeerHttpReachability(recoveredPeerUrl);
    if (!reachable) return null;

    return {
      recoveryKind: "endpoint",
      recoveredPeer: refreshedPeer,
      recoveredPeerUrl,
    };
  } catch {
    return null;
  } finally {
    if (temporaryListenerHandle) {
      await Promise.resolve(temporaryListenerHandle.close?.()).catch(() => {});
    }
  }
}

function logSyncRunExecutionError(err) {
  if (err instanceof Error) {
    const renderedStack = err.stack || `${err.name}: ${err.message}`;
    console.error("[/api/sync/run] Sync execution failed:\n%s", renderedStack);
    return;
  }
  console.error("[/api/sync/run] Sync execution failed:", err);
}

function getRequestSourceForSyncJobCreation(req) {
  return req?.identity ? "local-ui-session" : "peer-api-or-unauthenticated";
}

function getRequestedSyncDirection(body) {
  try {
    return parseSyncDirection(body);
  } catch {
    return normalizeSyncDirection(body?.direction || body?.syncDirection || "sync");
  }
}

function getRequestedSyncMode(body, dryRun) {
  const mode = String(body?.mode || body?.syncMode || (dryRun ? "dry-run" : "apply")).trim();
  return mode || (dryRun ? "dry-run" : "apply");
}

function parseSyncTransport(body) {
  const raw = body && typeof body === "object" && !Array.isArray(body)
    ? (body.syncTransport ?? body.transport ?? "wireless")
    : "wireless";
  const text = String(raw || "wireless").trim().toLowerCase();
  if (text === "usb" || text === "usb-cable" || text === "usb cable" || text === "usb-network" || text === "usb network") return "usb";
  if (text === "offline" || text === "offline-package" || text === "offline package" || text === "package") return "offline-package";
  return "wireless";
}

function syncTransportRequiresExplicitPeerUrl(syncTransport) {
  return parseSyncTransport({ syncTransport }) === "usb";
}

function shouldRecoverPeerEndpointForTransport(syncTransport) {
  return !syncTransportRequiresExplicitPeerUrl(syncTransport);
}

function parsePeerUrlOrigin(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  try {
    const parsed = new URL(text);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    return parsed.origin;
  } catch {
    return "";
  }
}

function normalizeUsbDiscoveryPort(value) {
  const port = Number(value);
  return Number.isInteger(port) && port >= 1 && port <= 65535 ? port : null;
}

function addParsedPeerUrlOrigin(targets, value) {
  const origin = parsePeerUrlOrigin(value);
  if (origin && !targets.includes(origin)) targets.push(origin);
}

function parseIpv4Octets(address) {
  const parts = String(address || "").split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
  return parts;
}

function buildIpv4Address(parts) {
  if (!Array.isArray(parts) || parts.length !== 4) return "";
  if (parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return "";
  return parts.join(".");
}

function calculateIpv4BroadcastAddress(address, netmask) {
  const addressOctets = parseIpv4Octets(address);
  const maskOctets = parseIpv4Octets(netmask);
  if (!addressOctets || !maskOctets) return "";
  const broadcastOctets = addressOctets.map((part, index) => part | (255 - maskOctets[index]));
  return buildIpv4Address(broadcastOctets);
}

function addUsbCandidateHost(hosts, host, localAddress = "") {
  const text = String(host || "").trim();
  if (!text || text === String(localAddress || "").trim()) return;
  if (net.isIP(text) !== 4) return;
  if (!hosts.includes(text)) hosts.push(text);
}

function addUsbCandidateHostsFromLocalAddress(hosts, localAddress) {
  const octets = parseIpv4Octets(localAddress);
  if (!octets) return;
  const prefix = octets.slice(0, 3);
  const last = octets[3];
  for (const suffix of [1, 2, 129, 254, last - 1, last + 1]) {
    if (suffix < 1 || suffix > 254) continue;
    addUsbCandidateHost(hosts, buildIpv4Address([...prefix, suffix]), localAddress);
  }
}

function getConfiguredNetworkInterfaces(ctx = {}) {
  return ctx?.networkInterfaces && typeof ctx.networkInterfaces === "object"
    ? ctx.networkInterfaces
    : os.networkInterfaces();
}

function getLocalUsbCandidateHosts(ctx = {}) {
  const hosts = [];
  const configuredInterfaces = getConfiguredNetworkInterfaces(ctx);
  for (const entries of Object.values(configuredInterfaces || {})) {
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      if (!entry || entry.family !== "IPv4" || entry.internal === true) continue;
      addUsbCandidateHostsFromLocalAddress(hosts, entry.address);
    }
  }
  for (const host of COMMON_USB_PEER_HOSTS) addUsbCandidateHost(hosts, host);
  return hosts;
}

function getLocalUsbDiscoveryTargetAddresses(ctx = {}) {
  const targets = [];
  const addTarget = (address) => addUsbCandidateHost(targets, address);
  const configuredInterfaces = getConfiguredNetworkInterfaces(ctx);
  for (const entries of Object.values(configuredInterfaces || {})) {
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      if (!entry || entry.family !== "IPv4" || entry.internal === true) continue;
      const broadcast = calculateIpv4BroadcastAddress(entry.address, entry.netmask);
      if (broadcast && broadcast !== "255.255.255.255") addTarget(broadcast);
      addUsbCandidateHostsFromLocalAddress(targets, entry.address);
    }
  }
  for (const host of COMMON_USB_PEER_HOSTS) addTarget(host);
  return targets;
}

function getUsbDiscoveryPorts(body, ctx = {}) {
  const ports = [];
  const addPort = (value) => {
    const port = normalizeUsbDiscoveryPort(value);
    if (port && !ports.includes(port)) ports.push(port);
  };
  for (const value of [body?.peerUrl, body?.usbPeerUrl]) {
    try { addPort(new URL(String(value || "")).port); } catch {}
  }
  addPort(ctx?.port);
  addPort(process.env.PORT);
  addPort(3000);
  return ports;
}

function getUsbPeerDiscoveryCandidateUrls(body, ctx = {}) {
  if (Array.isArray(ctx?.usbPeerCandidateUrls)) {
    const urls = [];
    for (const peerUrl of ctx.usbPeerCandidateUrls) addParsedPeerUrlOrigin(urls, peerUrl);
    return urls;
  }

  const urls = [];
  addParsedPeerUrlOrigin(urls, body?.peerUrl);
  addParsedPeerUrlOrigin(urls, body?.usbPeerUrl);

  const hosts = getLocalUsbCandidateHosts(ctx);
  const ports = getUsbDiscoveryPorts(body, ctx);
  for (const host of hosts) {
    for (const port of ports) {
      try {
        const peerUrl = buildDiscoveredPeerUrl({ address: host, port });
        if (!urls.includes(peerUrl)) urls.push(peerUrl);
      } catch {
        // Ignore malformed USB candidates.
      }
    }
  }
  return urls;
}

async function discoverPeersFromUsbCandidates(state, body, ctx) {
  const candidates = getUsbPeerDiscoveryCandidateUrls(body, ctx);
  const discovered = [];
  for (let index = 0; index < candidates.length; index += DEFAULT_USB_DISCOVERY_PROBE_CONCURRENCY) {
    const batch = candidates.slice(index, index + DEFAULT_USB_DISCOVERY_PROBE_CONCURRENCY);
    const results = await Promise.all(batch.map((peerUrl) => discoverPeerFromHttpStatusUrl(state, peerUrl, ctx)));
    for (const peer of results) {
      if (peer && !discovered.some((item) => item.deviceId === peer.deviceId)) discovered.push(peer);
    }
  }
  return discovered;
}

function getDiscoveryOptionsFromRequestBody(body, ctx = {}) {
  const syncTransport = parseSyncTransport(body);
  const options = { syncTransport };
  if (syncTransportRequiresExplicitPeerUrl(syncTransport)) {
    const targets = getLocalUsbDiscoveryTargetAddresses(ctx);
    const peerUrl = parsePeerUrlOrigin(body?.peerUrl || body?.usbPeerUrl || "");
    if (peerUrl) {
      try {
        const parsed = new URL(peerUrl);
        if (parsed.hostname && !targets.includes(parsed.hostname)) targets.unshift(parsed.hostname);
      } catch {
        // Keep USB discovery usable without a known peer URL.
      }
    }
    options.extraTargetAddresses = targets;
  }
  return options;
}

function extractPeerStatusCapabilities(payload = {}) {
  const localDevice = payload?.localDevice && typeof payload.localDevice === "object"
    ? payload.localDevice
    : {};
  const protectedFromIncomingWrites = payload?.protectedFromIncomingWrites === true
    || localDevice.protectedFromIncomingWrites === true;
  const acceptsIncomingSyncWrites = payload?.acceptsIncomingSyncWrites ?? localDevice.acceptsIncomingSyncWrites;
  const allowsOutgoingSyncReads = payload?.allowsOutgoingSyncReads ?? localDevice.allowsOutgoingSyncReads;
  const supportedSyncModes = Array.isArray(payload?.supportedSyncModes)
    ? payload.supportedSyncModes
    : Array.isArray(localDevice.supportedSyncModes) ? localDevice.supportedSyncModes : null;
  return {
    sync: true,
    conflictResolution: true,
    protectedFromIncomingWrites,
    acceptsIncomingSyncWrites: acceptsIncomingSyncWrites === undefined ? !protectedFromIncomingWrites : acceptsIncomingSyncWrites !== false,
    allowsOutgoingSyncReads: allowsOutgoingSyncReads === undefined ? true : allowsOutgoingSyncReads !== false,
    supportedSyncModes,
  };
}

async function discoverPeerFromHttpStatusUrl(state, peerUrl, ctx) {
  const origin = parsePeerUrlOrigin(peerUrl);
  if (!origin) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_PEER_URL_FALLBACK_PROBE_TIMEOUT_MS);
  try {
    const response = await fetch(new URL("/api/peer/status", origin + "/").toString(), {
      method: "GET",
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.ok === false) return null;

    const parsed = new URL(origin);
    const localDevice = payload?.localDevice && typeof payload.localDevice === "object"
      ? payload.localDevice
      : {};
    const deviceId = String(localDevice.deviceId || payload?.deviceId || "").trim();
    const deviceName = String(localDevice.deviceName || payload?.deviceName || "Unknown Device").trim();
    const publicKey = String(localDevice.publicKey || payload?.publicKey || "").trim();
    if (!deviceId || !deviceName || !publicKey) return null;

    const localPeerInfo = await getLocalPeerInfo({ runtimeRoot: ctx?.runtimeRoot }).catch(() => null);
    if (String(localPeerInfo?.deviceId || "").trim() === deviceId) return null;

    const trustedPeer = await findTrustedPeer(deviceId, { runtimeRoot: ctx?.runtimeRoot }).catch(() => null);
    const trusted = Boolean(
      trustedPeer
      && String(trustedPeer.publicKey || "").trim()
      && String(trustedPeer.publicKey || "").trim() === publicKey,
    );

    return upsertDiscoveredPeer(state, {
      deviceId,
      deviceName,
      trusted,
      address: parsed.hostname,
      port: Number(parsed.port) || (parsed.protocol === "https:" ? 443 : 80),
      lastSeen: new Date().toISOString(),
      publicKey,
      capabilities: extractPeerStatusCapabilities(payload),
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function logSyncJobCreationDecision(req, body, protection, decision, details = {}) {
  try {
    const dryRun = body?.dryRun === undefined ? false : Boolean(body.dryRun);
    console.info("[/api/sync/jobs/start] Sync job creation", {
      decision,
      protectedFromPeerWrites: protection?.protectedFromPeerWrites === true,
      direction: getRequestedSyncDirection(body),
      mode: getRequestedSyncMode(body, dryRun),
      dryRun,
      requestSource: getRequestSourceForSyncJobCreation(req),
      userId: req?.identity?.userId || null,
      requestedDeviceId: body?.deviceId ? String(body.deviceId) : null,
      requestedScope: body?.scope ? String(body.scope) : null,
      ...details,
    });
  } catch {
    // Job creation logging is diagnostic-only.
  }
}

function syncPackageResultStatus(result, fallback = 400) {
  if (result?.ok !== false) return 200;
  const reason = String(result?.reason || "");
  if (reason === "untrusted_peer" || reason === "invalid_signature") return 403;
  if (reason === "invalid_package" || reason === "invalid_path") return 400;
  return fallback;
}

function installShutdownHookIfNeeded(state) {
  if (state.shutdownHookInstalled) return;
  state.shutdownHookInstalled = true;

  const cleanup = () => {
    try {
      state.listenerHandle?.close?.();
    } catch {
      // no-op
    }
    try {
      state.broadcasterHandle?.stop?.();
    } catch {
      // no-op
    }
    state.listenerHandle = null;
    state.broadcasterHandle = null;
    state.scanning = false;
    state.discoverable = false;
  };

  process.once("exit", cleanup);
  process.once("SIGINT", cleanup);
  process.once("SIGTERM", cleanup);
}

async function stopListener(state) {
  if (!state.listenerHandle) return;
  const handle = state.listenerHandle;
  state.listenerHandle = null;
  await Promise.resolve(handle.close?.()).catch(() => {});
  setScanningEnabled(state, false);
}

async function stopBroadcaster(state) {
  if (!state.broadcasterHandle) return;
  const handle = state.broadcasterHandle;
  state.broadcasterHandle = null;
  await Promise.resolve(handle.stop?.()).catch(() => {});
  setDiscoverableEnabled(state, false);
}

function ensureListener(state, ctx) {
  if (state.listenerHandle) return;
  const listenerFactory = resolvePeerDiscoveryListenerFactory(ctx);
  state.listenerHandle = listenerFactory({
    verifyOptions: { runtimeRoot: ctx?.runtimeRoot },
    onPeerDiscovered({ peer }) {
      try {
        upsertDiscoveredPeer(state, peer);
      } catch {
        // ignore malformed peer events
      }
    },
    onError(err) {
      console.warn("Sync discovery listener error:", err?.message || String(err));
    },
  });
  setScanningEnabled(state, true);
}

function ensureBroadcaster(state, ctx, discoveryOptions = {}) {
  if (state.broadcasterHandle) return;
  const broadcasterFactory = resolvePeerDiscoveryBroadcasterFactory(ctx);
  state.broadcasterHandle = broadcasterFactory({
    ...discoveryOptions,
    runtimeRoot: ctx?.runtimeRoot,
    async capabilities() {
      const protection = await loadSyncProtection({ runtimeRoot: ctx?.runtimeRoot })
        .catch(() => ({ protectedFromPeerWrites: false }));
      const protectedFromIncomingWrites = protection?.protectedFromPeerWrites === true;
      return {
        sync: true,
        conflictResolution: true,
        protectedFromIncomingWrites,
        acceptsIncomingSyncWrites: !protectedFromIncomingWrites,
        allowsOutgoingSyncReads: true,
        supportedSyncModes: protectedFromIncomingWrites ? ["pull"] : ["pull", "push", "sync"],
      };
    },
    onError(err) {
      console.warn("Sync discovery broadcaster error:", err?.message || String(err));
    },
  });
  setDiscoverableEnabled(state, true);
}

function getSelectedOrRequestedDeviceId(state, body) {
  if (body && typeof body === "object" && !Array.isArray(body) && body.deviceId !== undefined) {
    return String(body.deviceId ?? "").trim();
  }
  return String(state.selectedPeerDeviceId ?? "").trim();
}

async function resolveRequestedScope(body, options) {
  const requestedScope = String(body?.scope ?? DEFAULT_SYNC_SCOPE).trim() || DEFAULT_SYNC_SCOPE;
  const scope = validateSyncScope(requestedScope);
  const loaded = await loadSyncScopes(options);
  if (!loaded.syncScopes.includes(scope)) {
    throw new Error(`Scope is not enabled: ${scope}`);
  }
  return scope;
}

function parseMaxFileSizeBytes(body) {
  const raw = body && typeof body === "object" && !Array.isArray(body)
    ? body.maxFileSizeBytes
    : undefined;
  if (raw === undefined || raw === null || raw === "") return null;
  const bytes = Number(raw);
  if (!Number.isFinite(bytes) || bytes < 0 || bytes > Number.MAX_SAFE_INTEGER) {
    throw new Error("maxFileSizeBytes must be a nonnegative safe integer");
  }
  const normalized = Math.trunc(bytes);
  return normalized > 0 ? normalized : null;
}

function parseOnFileErrorMode(body) {
  const raw = body && typeof body === "object" && !Array.isArray(body)
    ? body.onFileError
    : undefined;
  const mode = String(raw || "fail").trim().toLowerCase();
  if (mode === "fail" || mode === "pause" || mode === "skip") return mode;
  throw new Error("onFileError must be one of: fail, pause, skip");
}

function parseSyncDirection(body) {
  const raw = body && typeof body === "object" && !Array.isArray(body)
    ? (body.syncDirection ?? body.direction ?? "sync")
    : "sync";
  const text = String(raw || "sync").trim().toLowerCase();
  const accepted = new Set(["pull", "pull-from-peer", "peer-to-local", "push", "push-to-peer", "local-to-peer", "sync", "two-way", "two-way-sync"]);
  if (!accepted.has(text)) throw new Error("syncDirection must be one of: pull, push, sync");
  return normalizeSyncDirection(text);
}

function syncDirectionRequiresPeerWrites(syncDirection) {
  const direction = normalizeSyncDirection(syncDirection);
  return direction === "push" || direction === "sync";
}

function createPeerWriteBlockedError(peerCapabilities, syncDirection) {
  const err = new Error(PEER_WRITE_BLOCKED_MESSAGE);
  err.name = "PeerSyncDirectionBlockedError";
  err.statusCode = 409;
  err.syncDirection = normalizeSyncDirection(syncDirection);
  err.peerCapabilities = peerCapabilities || null;
  return err;
}

async function fetchPeerSyncCapabilities(peerUrl) {
  try {
    const peerBaseUrl = String(peerUrl || "").endsWith("/") ? String(peerUrl || "") : String(peerUrl || "") + "/";
    const response = await fetch(new URL("/api/peer/status", peerBaseUrl).toString(), { method: "GET" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.ok === false) return null;
    const localDevice = payload?.localDevice && typeof payload.localDevice === "object" ? payload.localDevice : {};
    const protectedFromIncomingWrites = payload?.protectedFromIncomingWrites === true || localDevice.protectedFromIncomingWrites === true;
    const acceptsRaw = payload?.acceptsIncomingSyncWrites ?? localDevice.acceptsIncomingSyncWrites;
    const allowsReadsRaw = payload?.allowsOutgoingSyncReads ?? localDevice.allowsOutgoingSyncReads;
    const supported = Array.isArray(payload?.supportedSyncModes)
      ? payload.supportedSyncModes
      : Array.isArray(localDevice.supportedSyncModes) ? localDevice.supportedSyncModes : null;
    return {
      deviceId: String(localDevice.deviceId || payload?.deviceId || ""),
      deviceName: String(localDevice.deviceName || payload?.deviceName || ""),
      protectedFromIncomingWrites,
      acceptsIncomingSyncWrites: acceptsRaw === undefined ? true : acceptsRaw !== false,
      allowsOutgoingSyncReads: allowsReadsRaw === undefined ? true : allowsReadsRaw !== false,
      supportedSyncModes: supported,
    };
  } catch {
    return null;
  }
}

async function enforcePeerSyncDirectionCapabilities({ peerUrl, syncDirection }) {
  const peerCapabilities = await fetchPeerSyncCapabilities(peerUrl);
  if (syncDirectionRequiresPeerWrites(syncDirection) && peerCapabilities?.acceptsIncomingSyncWrites === false) {
    throw createPeerWriteBlockedError(peerCapabilities, syncDirection);
  }
  return peerCapabilities;
}

function interfaceNameLooksWireless(name) {
  return /(?:wi-?fi|wifi|wlan|airport|wireless|^wl)/i.test(String(name || ""));
}

function getDetectedNonWifiNetworkInterfaces(ctx = {}) {
  const detected = [];
  const configuredInterfaces = getConfiguredNetworkInterfaces(ctx);
  for (const [name, entries] of Object.entries(configuredInterfaces || {})) {
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      if (!entry || entry.family !== "IPv4" || entry.internal === true) continue;
      if (interfaceNameLooksWireless(name)) continue;
      detected.push({
        name,
        address: String(entry.address || ""),
        netmask: String(entry.netmask || ""),
        mac: String(entry.mac || ""),
        family: "IPv4",
      });
    }
  }
  return detected;
}

function getListeningAddressSnapshot(ctx = {}) {
  const host = String(ctx?.host || ctx?.hostname || ctx?.listenHost || process.env.HOST || "0.0.0.0").trim() || "0.0.0.0";
  const port = normalizeUsbDiscoveryPort(ctx?.port) || normalizeUsbDiscoveryPort(process.env.PORT) || 3000;
  return {
    host,
    port,
    listensOnAllInterfaces: host === "0.0.0.0" || host === "::",
    loopbackOnly: host === "127.0.0.1" || host === "localhost" || host === "::1",
  };
}

function getUsbNetworkDiagnostics(ctx = {}) {
  const interfaces = getDetectedNonWifiNetworkInterfaces(ctx);
  const listening = getListeningAddressSnapshot(ctx);
  const candidatePeerProbeUrls = getUsbPeerDiscoveryCandidateUrls({}, ctx).slice(0, 80);
  const noUsbNetworkInterfaceDetected = interfaces.length === 0;
  const messages = [];
  if (noUsbNetworkInterfaceDetected) {
    messages.push("No USB network interface detected. The operating system has not created a network link over this cable. Use a USB Ethernet adapter, Thunderbolt networking, USB tethering, or Offline Package mode.");
  }
  if (listening.loopbackOnly) {
    messages.push("Nodevision appears to be listening only on loopback. Peers cannot reach this device unless the server listens on 0.0.0.0 or the USB network interface address.");
  }
  return {
    interfaces,
    listening,
    candidatePeerProbeUrls,
    noUsbNetworkInterfaceDetected,
    message: messages.join(" "),
  };
}

async function syncStateResponse(state, ctx) {
  const protection = await loadSyncProtection({ runtimeRoot: ctx?.runtimeRoot }).catch(() => ({ protectedFromPeerWrites: false }));
  return {
    ok: true,
    protection,
    discovery: {
      scanning: Boolean(state.scanning),
      discoverable: Boolean(state.discoverable),
    },
    discoveredPeers: listDiscoveredPeers(state),
    selectedPeerDeviceId: state.selectedPeerDeviceId || null,
    usbNetworkDiagnostics: getUsbNetworkDiagnostics(ctx),
  };
}

export function registerSyncPanelRoutes(app, ctx) {
  const state = ctx?.syncPanelState && typeof ctx.syncPanelState === "object"
    ? ctx.syncPanelState
    : createSyncPanelState();
  installShutdownHookIfNeeded(state);
  const syncJobManager = ctx?.syncJobManager && typeof ctx.syncJobManager === "object"
    ? ctx.syncJobManager
    : createSyncJobManager();
  const syncPackageUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: Number(ctx?.syncPackageMaxBytes) || DEFAULT_SYNC_PACKAGE_MAX_BYTES },
  }).single("package");
  const handleSyncPackageUpload = (req, res, next) => {
    syncPackageUpload(req, res, (err) => {
      if (err) return res.status(400).json({ ok: false, error: err?.message || "Failed to read sync package upload" });
      return next();
    });
  };

  app.get("/api/sync/local-device", async (req, res) => {
    if (!requireSession(req, res)) return;
    try {
      const localDevice = await getLocalPeerInfo({ runtimeRoot: ctx?.runtimeRoot });
      return res.json({ ok: true, localDevice });
    } catch {
      return res.status(500).json({ ok: false, error: "Failed to load local device" });
    }
  });

  app.get("/api/sync/protection", async (req, res) => {
    if (!requireSession(req, res)) return;
    try {
      const protection = await loadSyncProtection({ runtimeRoot: ctx?.runtimeRoot });
      return res.json({ ok: true, protection });
    } catch {
      return res.status(500).json({ ok: false, error: "Failed to load sync protection settings" });
    }
  });

  app.post("/api/sync/protection", async (req, res) => {
    if (!requireSession(req, res)) return;
    try {
      const protectedFromPeerWrites = req.body?.protectedFromPeerWrites === true;
      const protection = await saveSyncProtection({ protectedFromPeerWrites }, { runtimeRoot: ctx?.runtimeRoot });
      return res.json({ ok: true, protection });
    } catch {
      return res.status(500).json({ ok: false, error: "Failed to save sync protection settings" });
    }
  });

  app.get("/api/sync/scopes", async (req, res) => {
    if (!requireSession(req, res)) return;
    try {
      const scopes = await loadSyncScopes({ runtimeRoot: ctx?.runtimeRoot });
      return res.json({ ok: true, syncScopes: scopes.syncScopes });
    } catch {
      return res.status(500).json({ ok: false, error: "Failed to load sync scopes" });
    }
  });

  app.get("/api/sync/notebook-folders", async (req, res) => {
    if (!requireSession(req, res)) return;
    try {
      const folders = await listCandidateNotebookFolders({ runtimeRoot: ctx?.runtimeRoot });
      return res.json({ ok: true, folders });
    } catch {
      return res.status(500).json({ ok: false, error: "Failed to list notebook folders" });
    }
  });

  app.post("/api/sync/scopes", async (req, res) => {
    if (!requireSession(req, res)) return;
    try {
      const scope = validateSyncScope(req.body?.scope);
      const updated = await addSyncScope(scope, { runtimeRoot: ctx?.runtimeRoot });
      return res.json({ ok: true, syncScopes: updated.syncScopes });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err?.message || "Failed to add scope" });
    }
  });

  app.delete("/api/sync/scopes", async (req, res) => {
    if (!requireSession(req, res)) return;
    try {
      const scope = validateSyncScope(req.body?.scope);
      const updated = await removeSyncScope(scope, { runtimeRoot: ctx?.runtimeRoot });
      return res.json({ ok: true, syncScopes: updated.syncScopes });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err?.message || "Failed to remove scope" });
    }
  });

  app.get("/api/sync/status", async (req, res) => {
    if (!requireSession(req, res)) return;
    return res.json(await syncStateResponse(state, ctx));
  });

  app.get("/api/sync/package/export", async (req, res) => {
    if (!requireSession(req, res)) return;
    let scope;
    try {
      scope = await resolveRequestedScope(req.query || {}, { runtimeRoot: ctx?.runtimeRoot });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err?.message || "Invalid scope" });
    }
    try {
      const exported = await createLocalSyncPackage({
        runtimeRoot: ctx?.runtimeRoot,
        scope,
        syncMode: "offline-package",
      });
      res.setHeader("Content-Type", "application/octet-stream");
      res.setHeader("Content-Disposition", "attachment; filename=\"" + exported.filename + "\"");
      res.setHeader("X-Nodevision-Sync-Files", String(exported.filesExported || 0));
      return res.send(exported.packageBuffer);
    } catch (err) {
      return res.status(500).json({ ok: false, error: err?.message || "Failed to export sync package" });
    }
  });

  app.post("/api/sync/package/preview", handleSyncPackageUpload, async (req, res) => {
    if (!requireSession(req, res)) return;
    if (!req.file?.buffer) return res.status(400).json({ ok: false, error: "Sync package file is required" });
    try {
      const preview = await inspectLocalSyncPackage({
        packageBuffer: req.file.buffer,
        runtimeRoot: ctx?.runtimeRoot,
        targetScope: req.body?.scope,
      });
      return res.status(200).json({ ...preview, preview: true });
    } catch (err) {
      return res.status(400).json({ ok: false, preview: true, error: err?.message || "Failed to preview sync package" });
    }
  });

  app.post("/api/sync/package/import", handleSyncPackageUpload, async (req, res) => {
    if (!requireSession(req, res)) return;
    if (!req.file?.buffer) return res.status(400).json({ ok: false, error: "Sync package file is required" });
    try {
      const imported = await applyLocalSyncPackage({
        packageBuffer: req.file.buffer,
        runtimeRoot: ctx?.runtimeRoot,
        targetScope: req.body?.scope,
      });
      return res.status(syncPackageResultStatus(imported, 409)).json({ ...imported, imported: imported.ok !== false });
    } catch (err) {
      const statusCode = Number(err?.statusCode) || Number(err?.status) || 400;
      return res.status(statusCode >= 400 && statusCode <= 599 ? statusCode : 400).json({
        ok: false,
        imported: false,
        error: err?.message || "Failed to import sync package",
        trust: err?.trust || null,
      });
    }
  });

  app.post("/api/sync/discovery/scanning", async (req, res) => {
    if (!requireSession(req, res)) return;

    let enabled;
    try {
      enabled = parseEnabledFlag(req.body);
    } catch (err) {
      return res.status(400).json({ ok: false, error: err?.message || "Invalid request body" });
    }

    try {
      if (enabled) {
        ensureListener(state, ctx);
        const discoveryOptions = getDiscoveryOptionsFromRequestBody(req.body, ctx);
        if (syncTransportRequiresExplicitPeerUrl(discoveryOptions.syncTransport)) {
          await discoverPeersFromUsbCandidates(state, req.body, ctx);
        }
      } else {
        await stopListener(state);
      }
      return res.json(await syncStateResponse(state, ctx));
    } catch {
      return res.status(500).json({ ok: false, error: "Failed to update scanning state" });
    }
  });

  app.post("/api/sync/discovery/discoverable", async (req, res) => {
    if (!requireSession(req, res)) return;

    let enabled;
    try {
      enabled = parseEnabledFlag(req.body);
    } catch (err) {
      return res.status(400).json({ ok: false, error: err?.message || "Invalid request body" });
    }

    try {
      if (enabled) {
        const discoveryOptions = getDiscoveryOptionsFromRequestBody(req.body, ctx);
        ensureBroadcaster(state, ctx, discoveryOptions);
        if (syncTransportRequiresExplicitPeerUrl(discoveryOptions.syncTransport)) {
          await discoverPeersFromUsbCandidates(state, req.body, ctx);
        }
      } else {
        await stopBroadcaster(state);
      }
      return res.json(await syncStateResponse(state, ctx));
    } catch {
      return res.status(500).json({ ok: false, error: "Failed to update discoverable state" });
    }
  });

  app.post("/api/sync/select-peer", async (req, res) => {
    if (!requireSession(req, res)) return;
    try {
      const deviceId = String(req.body?.deviceId ?? "").trim();
      if (!deviceId) {
        return res.status(400).json({ ok: false, error: "deviceId is required" });
      }
      setSelectedPeerDeviceId(state, deviceId);
      return res.json(await syncStateResponse(state, ctx));
    } catch {
      return res.status(400).json({ ok: false, error: "Unknown discovered peer" });
    }
  });

  app.post("/api/sync/trust-peer", async (req, res) => {
    if (!requireSession(req, res)) return;

    let deviceId;
    try {
      deviceId = parseDeviceId(req.body?.deviceId);
    } catch (err) {
      return res.status(400).json({ ok: false, error: err?.message || "Invalid deviceId" });
    }

    let discoveredPeer;
    try {
      discoveredPeer = getDiscoveredPeer(state, deviceId);
    } catch (err) {
      return res.status(400).json({ ok: false, error: err?.message || "Invalid deviceId" });
    }
    if (!discoveredPeer) {
      return res.status(404).json({ ok: false, error: "Discovered peer not found" });
    }

    if (discoveredPeer.trusted === true) {
      return res.json({
        ok: true,
        trustedPeer: {
          deviceId: discoveredPeer.deviceId,
          deviceName: discoveredPeer.deviceName,
          trusted: true,
        },
      });
    }

    const publicKey = String(discoveredPeer.publicKey ?? "").trim();
    if (!publicKey) {
      return res.status(400).json({ ok: false, error: "Discovered peer is missing a public key" });
    }

    try {
      await addTrustedPeer({
        deviceId: discoveredPeer.deviceId,
        deviceName: discoveredPeer.deviceName,
        publicKey,
      }, {
        runtimeRoot: ctx?.runtimeRoot,
      });

      const trustedPeer = upsertDiscoveredPeer(state, {
        ...discoveredPeer,
        trusted: true,
        publicKey,
      });
      return res.json({
        ok: true,
        trustedPeer: {
          deviceId: trustedPeer.deviceId,
          deviceName: trustedPeer.deviceName,
          trusted: true,
        },
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err?.message || "Failed to trust discovered peer" });
    }
  });

  const getRequestedPeerUrl = (body) => parsePeerUrlOrigin(body?.peerUrl || body?.usbPeerUrl || "");

  app.post("/api/sync/preflight", async (req, res) => {
    if (!requireSession(req, res)) return;

    const body = req.body && typeof req.body === "object" && !Array.isArray(req.body)
      ? req.body
      : {};
    const deviceId = getSelectedOrRequestedDeviceId(state, body);
    if (!deviceId) {
      return res.status(400).json({ ok: false, error: "deviceId is required" });
    }

    let discoveredPeer = getDiscoveredPeer(state, deviceId);
    if (!discoveredPeer) {
      return res.status(404).json({ ok: false, error: "Discovered peer not found" });
    }
    if (!canRunSyncWithDiscoveredPeer(state, deviceId)) {
      return res.status(403).json({ ok: false, error: "Only trusted sync-capable peers can be synced" });
    }

    let scope;
    try {
      scope = await resolveRequestedScope(body, { runtimeRoot: ctx?.runtimeRoot });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err?.message || "Invalid scope" });
    }

    let maxFileSizeBytes;
    try {
      maxFileSizeBytes = parseMaxFileSizeBytes(body);
    } catch (err) {
      return res.status(400).json({ ok: false, error: err?.message || "Invalid max file size" });
    }
    try {
      parseOnFileErrorMode(body);
    } catch (err) {
      return res.status(400).json({ ok: false, error: err?.message || "Invalid file error mode" });
    }
    let syncDirection;
    try {
      syncDirection = parseSyncDirection(body);
    } catch (err) {
      return res.status(400).json({ ok: false, error: err?.message || "Invalid sync direction" });
    }

    let peerUrl;
    try {
      peerUrl = buildTrustedDiscoveredPeerUrl(state, deviceId);
    } catch {
      return res.status(403).json({ ok: false, error: "Selected peer is not eligible for sync" });
    }
    const requestedPeerUrl = getRequestedPeerUrl(body);
    const syncTransport = parseSyncTransport(body);
    if (syncTransport === "offline-package") {
      return res.status(400).json({ ok: false, error: "Offline Package mode uses package export and import routes instead of peer sync." });
    }
    if (syncTransportRequiresExplicitPeerUrl(syncTransport) && !requestedPeerUrl) {
      return res.status(400).json({ ok: false, preflight: true, ready: false, error: "USB Network sync requires a peer URL on the USB network" });
    }
    const syncRunner = resolveSyncRunner(ctx);

    try {
      const syncResult = await runScopeSyncWithPeerUrlFallback({
        discoveredPeer,
        preferredPeerUrl: requestedPeerUrl,
        strictPreferredPeerUrl: syncTransportRequiresExplicitPeerUrl(syncTransport),
        scope,
        runtimeRoot: ctx?.runtimeRoot,
        dryRun: true,
        syncRunner,
        syncDirection,
        syncRunnerOptions: { maxFileSizeBytes },
      });
      peerUrl = syncResult.resolvedPeerUrl || peerUrl;
      discoveredPeer = maybePersistResolvedPeerEndpointForTransport(state, discoveredPeer, peerUrl, syncTransport);
      return res.json({
        ok: true,
        preflight: true,
        ready: true,
        discoveredPeer: {
          deviceId: discoveredPeer.deviceId,
          deviceName: discoveredPeer.deviceName,
          trusted: discoveredPeer.trusted,
          address: discoveredPeer.address,
          port: discoveredPeer.port,
          lastSeen: discoveredPeer.lastSeen,
          capabilities: discoveredPeer.capabilities,
          url: peerUrl,
        },
        scope,
        dryRun: true,
        syncDirection,
        syncTransport,
        peerCapabilities: syncResult.peerCapabilities || null,
        sync: syncResult.sync,
      });
    } catch (err) {
      if (err?.name === "PeerSyncNetworkError" && shouldRecoverPeerEndpointForTransport(syncTransport)) {
        const recovered = await recoverDiscoveredPeerPort(state, discoveredPeer)
          || await recoverDiscoveredPeerEndpoint(state, discoveredPeer, ctx);
        if (recovered?.recoveredPeer && recovered?.recoveredPeerUrl) {
          discoveredPeer = recovered.recoveredPeer;
          const details = recovered.recoveryKind === "endpoint"
            ? `Peer was re-discovered at ${recovered.recoveredPeerUrl}. The discovered peer endpoint was updated automatically; run preflight again.`
            : `Peer is reachable at ${recovered.recoveredPeerUrl}. The discovered peer port was updated automatically; run preflight again.`;
          return res.status(409).json({
            ok: false,
            preflight: true,
            ready: false,
            error: "Selected peer endpoint was updated. Retry preflight.",
            details,
          });
        }
      }
      logSyncRunExecutionError(err);
      const classified = classifySyncRunError(err);
      return res.status(classified.statusCode).json({
        ok: false,
        preflight: true,
        ready: false,
        error: classified.error,
        details: getSafeSyncRunErrorDetails(err),
      });
    }
  });

  app.post("/api/sync/run", async (req, res) => {
    if (!requireSession(req, res)) return;

    const body = req.body && typeof req.body === "object" && !Array.isArray(req.body)
      ? req.body
      : {};
    const deviceId = getSelectedOrRequestedDeviceId(state, body);
    if (!deviceId) {
      return res.status(400).json({ ok: false, error: "deviceId is required" });
    }

    let discoveredPeer = getDiscoveredPeer(state, deviceId);
    if (!discoveredPeer) {
      return res.status(404).json({ ok: false, error: "Discovered peer not found" });
    }
    if (!canRunSyncWithDiscoveredPeer(state, deviceId)) {
      return res.status(403).json({ ok: false, error: "Only trusted sync-capable peers can be synced" });
    }

    let scope;
    try {
      scope = await resolveRequestedScope(body, { runtimeRoot: ctx?.runtimeRoot });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err?.message || "Invalid scope" });
    }

    const dryRun = body?.dryRun === undefined ? true : Boolean(body.dryRun);
    let maxFileSizeBytes;
    try {
      maxFileSizeBytes = parseMaxFileSizeBytes(body);
    } catch (err) {
      return res.status(400).json({ ok: false, error: err?.message || "Invalid max file size" });
    }
    let onFileError;
    try {
      onFileError = parseOnFileErrorMode(body);
    } catch (err) {
      return res.status(400).json({ ok: false, error: err?.message || "Invalid file error mode" });
    }
    let syncDirection;
    try {
      syncDirection = parseSyncDirection(body);
    } catch (err) {
      return res.status(400).json({ ok: false, error: err?.message || "Invalid sync direction" });
    }

    let peerUrl;
    try {
      peerUrl = buildTrustedDiscoveredPeerUrl(state, deviceId);
    } catch {
      return res.status(403).json({ ok: false, error: "Selected peer is not eligible for sync" });
    }
    const requestedPeerUrl = getRequestedPeerUrl(body);
    const syncTransport = parseSyncTransport(body);
    if (syncTransport === "offline-package") {
      return res.status(400).json({ ok: false, error: "Offline Package mode uses package export and import routes instead of peer sync." });
    }
    if (syncTransportRequiresExplicitPeerUrl(syncTransport) && !requestedPeerUrl) {
      return res.status(400).json({ ok: false, error: "USB Network sync requires a peer URL on the USB network" });
    }
    const syncRunner = resolveSyncRunner(ctx);

    try {
      const syncResult = await runScopeSyncWithPeerUrlFallback({
        discoveredPeer,
        preferredPeerUrl: requestedPeerUrl,
        strictPreferredPeerUrl: syncTransportRequiresExplicitPeerUrl(syncTransport),
        scope,
        runtimeRoot: ctx?.runtimeRoot,
        dryRun,
        syncRunner,
        syncDirection,
        syncRunnerOptions: { maxFileSizeBytes, onFileError: onFileError === "pause" ? "fail" : onFileError },
      });
      peerUrl = syncResult.resolvedPeerUrl || peerUrl;
      discoveredPeer = maybePersistResolvedPeerEndpointForTransport(state, discoveredPeer, peerUrl, syncTransport);
      return res.json({
        ok: true,
        discoveredPeer: {
          deviceId: discoveredPeer.deviceId,
          deviceName: discoveredPeer.deviceName,
          trusted: discoveredPeer.trusted,
          address: discoveredPeer.address,
          port: discoveredPeer.port,
          lastSeen: discoveredPeer.lastSeen,
          capabilities: discoveredPeer.capabilities,
          url: peerUrl,
        },
        scope,
        dryRun,
        syncDirection,
        syncTransport,
        peerCapabilities: syncResult.peerCapabilities || null,
        sync: syncResult.sync,
      });
    } catch (err) {
      if (err?.name === "PeerSyncNetworkError" && shouldRecoverPeerEndpointForTransport(syncTransport)) {
        const recovered = await recoverDiscoveredPeerPort(state, discoveredPeer)
          || await recoverDiscoveredPeerEndpoint(state, discoveredPeer, ctx);
        if (recovered?.recoveredPeer && recovered?.recoveredPeerUrl) {
          discoveredPeer = recovered.recoveredPeer;
          const details = recovered.recoveryKind === "endpoint"
            ? `Peer was re-discovered at ${recovered.recoveredPeerUrl}. The discovered peer endpoint was updated automatically; run sync again.`
            : `Peer is reachable at ${recovered.recoveredPeerUrl}. The discovered peer port was updated automatically; run sync again.`;
          return res.status(409).json({
            ok: false,
            error: "Selected peer endpoint was updated. Retry sync.",
            details,
          });
        }
      }
      logSyncRunExecutionError(err);
      const classified = classifySyncRunError(err);
      return res.status(classified.statusCode).json({
        ok: false,
        error: classified.error,
        details: getSafeSyncRunErrorDetails(err),
      });
    }
  });

  app.post("/api/sync/jobs/start", async (req, res) => {
    const body = req.body && typeof req.body === "object" && !Array.isArray(req.body)
      ? req.body
      : {};
    const protection = await loadSyncProtection({ runtimeRoot: ctx?.runtimeRoot })
      .catch(() => ({ protectedFromPeerWrites: false }));

    if (!req.identity) {
      logSyncJobCreationDecision(req, body, protection, "rejected", {
        statusCode: 401,
        reason: "authentication_required",
      });
      return res.status(401).json({ ok: false, error: "Authentication required" });
    }

    const deviceId = getSelectedOrRequestedDeviceId(state, body);
    if (!deviceId) {
      logSyncJobCreationDecision(req, body, protection, "rejected", {
        statusCode: 400,
        reason: "deviceId is required",
      });
      return res.status(400).json({ ok: false, error: "deviceId is required" });
    }

    let discoveredPeer = getDiscoveredPeer(state, deviceId);
    if (!discoveredPeer) {
      logSyncJobCreationDecision(req, body, protection, "rejected", {
        statusCode: 404,
        reason: "Discovered peer not found",
        selectedPeerDeviceId: deviceId,
      });
      return res.status(404).json({ ok: false, error: "Discovered peer not found" });
    }
    if (!canRunSyncWithDiscoveredPeer(state, deviceId)) {
      logSyncJobCreationDecision(req, body, protection, "rejected", {
        statusCode: 403,
        reason: "Only trusted sync-capable peers can be synced",
        selectedPeerDeviceId: deviceId,
      });
      return res.status(403).json({ ok: false, error: "Only trusted sync-capable peers can be synced" });
    }

    let scope;
    try {
      scope = await resolveRequestedScope(body, { runtimeRoot: ctx?.runtimeRoot });
    } catch (err) {
      logSyncJobCreationDecision(req, body, protection, "rejected", {
        statusCode: 400,
        reason: err?.message || "Invalid scope",
        selectedPeerDeviceId: deviceId,
      });
      return res.status(400).json({ ok: false, error: err?.message || "Invalid scope" });
    }

    let maxFileSizeBytes;
    try {
      maxFileSizeBytes = parseMaxFileSizeBytes(body);
    } catch (err) {
      logSyncJobCreationDecision(req, body, protection, "rejected", {
        statusCode: 400,
        reason: err?.message || "Invalid max file size",
        selectedPeerDeviceId: deviceId,
        scope,
      });
      return res.status(400).json({ ok: false, error: err?.message || "Invalid max file size" });
    }
    let onFileError;
    try {
      onFileError = parseOnFileErrorMode(body);
    } catch (err) {
      logSyncJobCreationDecision(req, body, protection, "rejected", {
        statusCode: 400,
        reason: err?.message || "Invalid file error mode",
        selectedPeerDeviceId: deviceId,
        scope,
      });
      return res.status(400).json({ ok: false, error: err?.message || "Invalid file error mode" });
    }
    let syncDirection;
    try {
      syncDirection = parseSyncDirection(body);
    } catch (err) {
      logSyncJobCreationDecision(req, body, protection, "rejected", {
        statusCode: 400,
        reason: err?.message || "Invalid sync direction",
        selectedPeerDeviceId: deviceId,
        scope,
      });
      return res.status(400).json({ ok: false, error: err?.message || "Invalid sync direction" });
    }

    let peerUrl;
    try {
      peerUrl = buildTrustedDiscoveredPeerUrl(state, deviceId);
    } catch {
      logSyncJobCreationDecision(req, body, protection, "rejected", {
        statusCode: 403,
        reason: "Selected peer is not eligible for sync",
        selectedPeerDeviceId: deviceId,
        scope,
      });
      return res.status(403).json({ ok: false, error: "Selected peer is not eligible for sync" });
    }
    const dryRun = body?.dryRun === undefined ? false : Boolean(body.dryRun);
    const requestedPeerUrl = getRequestedPeerUrl(body);
    const syncTransport = parseSyncTransport(body);
    if (syncTransport === "offline-package") {
      return res.status(400).json({ ok: false, error: "Offline Package mode uses package export and import routes instead of peer sync." });
    }
    if (syncTransportRequiresExplicitPeerUrl(syncTransport) && !requestedPeerUrl) {
      logSyncJobCreationDecision(req, body, protection, "rejected", {
        statusCode: 400,
        reason: "USB Network sync requires a peer URL on the USB network",
        selectedPeerDeviceId: deviceId,
        scope,
      });
      return res.status(400).json({ ok: false, error: "USB Network sync requires a peer URL on the USB network" });
    }
    const syncRunner = resolveSyncRunner(ctx);

    let peerCapabilities = null;
    try {
      const capabilityPreflight = await runScopeSyncWithPeerUrlFallback({
        discoveredPeer,
        preferredPeerUrl: requestedPeerUrl,
        strictPreferredPeerUrl: syncTransportRequiresExplicitPeerUrl(syncTransport),
        scope,
        runtimeRoot: ctx?.runtimeRoot,
        dryRun: true,
        syncRunner: async () => ({ ok: true, dryRun: true, scope, syncDirection }),
        syncDirection,
      });
      peerCapabilities = capabilityPreflight.peerCapabilities || null;
      peerUrl = capabilityPreflight.resolvedPeerUrl || peerUrl;
      discoveredPeer = maybePersistResolvedPeerEndpointForTransport(state, discoveredPeer, peerUrl, syncTransport);
    } catch (err) {
      const classified = classifySyncRunError(err);
      logSyncJobCreationDecision(req, body, protection, "rejected", {
        statusCode: classified.statusCode,
        reason: err?.message || classified.error,
        selectedPeerDeviceId: deviceId,
        scope,
        peerUrl,
        syncDirection,
      });
      return res.status(classified.statusCode).json({
        ok: false,
        error: classified.error,
        details: getSafeSyncRunErrorDetails(err),
        syncDirection,
        peerCapabilities: err?.peerCapabilities || peerCapabilities,
      });
    }

    const discoveredPeerSnapshot = { ...discoveredPeer };

    try {
      const started = syncJobManager.startJob({
        scope,
        peerUrl,
        dryRun,
        async run({ onProgress, isCancelled, onFileError: onFileErrorControl }) {
          const syncResult = await runScopeSyncWithPeerUrlFallback({
            discoveredPeer: discoveredPeerSnapshot,
            preferredPeerUrl: requestedPeerUrl,
            strictPreferredPeerUrl: syncTransportRequiresExplicitPeerUrl(syncTransport),
            scope,
            runtimeRoot: ctx?.runtimeRoot,
            dryRun,
            syncRunner,
            syncDirection,
            syncRunnerOptions: {
              onProgress,
              shouldCancel: isCancelled,
              onFileError,
              onFileErrorControl,
              maxFileSizeBytes,
            },
          });
          maybePersistResolvedPeerEndpointForTransport(state, discoveredPeerSnapshot, syncResult.resolvedPeerUrl || peerUrl, syncTransport);
          return syncResult.sync;
        },
      });
      logSyncJobCreationDecision(req, body, protection, "created", {
        statusCode: 202,
        selectedPeerDeviceId: deviceId,
        scope,
        peerUrl,
        jobId: started.jobId,
        maxFileSizeBytes,
        onFileError,
        syncDirection,
        syncTransport,
        peerCapabilities,
      });
      return res.status(202).json({ ok: true, jobId: started.jobId, job: started, syncDirection, syncTransport, peerCapabilities });
    } catch (err) {
      logSyncJobCreationDecision(req, body, protection, "rejected", {
        statusCode: 500,
        reason: err?.message || "Failed to start sync job",
        selectedPeerDeviceId: deviceId,
        scope,
        peerUrl,
      });
      return res.status(500).json({ ok: false, error: err?.message || "Failed to start sync job" });
    }
  });

  app.get("/api/sync/jobs/:jobId", (req, res) => {
    if (!requireSession(req, res)) return;
    const jobId = String(req.params?.jobId || "").trim();
    if (!jobId) {
      return res.status(400).json({ ok: false, error: "jobId is required" });
    }
    const job = syncJobManager.getJobStatus(jobId);
    if (!job) {
      return res.status(404).json({ ok: false, error: "Sync job not found" });
    }
    return res.json({ ok: true, job });
  });

  app.post("/api/sync/jobs/:jobId/cancel", (req, res) => {
    if (!requireSession(req, res)) return;
    const jobId = String(req.params?.jobId || "").trim();
    if (!jobId) {
      return res.status(400).json({ ok: false, error: "jobId is required" });
    }
    const job = syncJobManager.cancelJob(jobId);
    if (!job) {
      return res.status(404).json({ ok: false, error: "Sync job not found" });
    }
    return res.json({ ok: true, job });
  });

  app.post("/api/sync/jobs/:jobId/retry", (req, res) => {
    if (!requireSession(req, res)) return;
    const jobId = String(req.params?.jobId || "").trim();
    if (!jobId) return res.status(400).json({ ok: false, error: "jobId is required" });
    const job = syncJobManager.retryPausedJob(jobId);
    if (!job) return res.status(404).json({ ok: false, error: "Sync job not found" });
    return res.json({ ok: true, job });
  });

  app.post("/api/sync/jobs/:jobId/skip", (req, res) => {
    if (!requireSession(req, res)) return;
    const jobId = String(req.params?.jobId || "").trim();
    if (!jobId) return res.status(400).json({ ok: false, error: "jobId is required" });
    const job = syncJobManager.skipPausedJob(jobId);
    if (!job) return res.status(404).json({ ok: false, error: "Sync job not found" });
    return res.json({ ok: true, job });
  });

  app.post("/api/sync/jobs/:jobId/abort", (req, res) => {
    if (!requireSession(req, res)) return;
    const jobId = String(req.params?.jobId || "").trim();
    if (!jobId) return res.status(400).json({ ok: false, error: "jobId is required" });
    const job = syncJobManager.abortJob(jobId);
    if (!job) return res.status(404).json({ ok: false, error: "Sync job not found" });
    return res.json({ ok: true, job });
  });
}
