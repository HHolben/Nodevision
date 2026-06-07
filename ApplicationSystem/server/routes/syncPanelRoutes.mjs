// Nodevision/ApplicationSystem/server/routes/syncPanelRoutes.mjs
// This file registers authenticated Sync Panel API endpoints that manage in-memory discovery state, expose safe local/discovery status, and run trusted scope-limited sync operations only after explicit user actions.

import { addTrustedPeer, getLocalPeerInfo } from "../../Sync/TrustedPeers.mjs";
import {
  addSyncScope,
  listCandidateNotebookFolders,
  loadSyncScopes,
  removeSyncScope,
  validateSyncScope,
} from "../../Sync/SyncScopes.mjs";
import { runScopeSyncTwoWay } from "../../Sync/sync-scope-two-way.mjs";
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
    return {
      statusCode: 502,
      error: "Selected peer returned an error",
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

function buildPeerUrlCandidates(discoveredPeer) {
  const address = String(discoveredPeer?.address ?? "").trim();
  const port = Number(discoveredPeer?.port);
  if (!address || !isValidPort(port)) return [];
  const candidates = [];
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
  syncRunnerOptions = null,
} = {}) {
  const candidates = buildPeerUrlCandidates(discoveredPeer);
  const expectedDeviceId = String(discoveredPeer?.deviceId ?? "").trim();
  const attemptedPeerUrls = [];
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
      const sync = await syncRunner({
        peerUrl,
        scope,
        runtimeRoot,
        dryRun,
        ...(syncRunnerOptions && typeof syncRunnerOptions === "object" ? syncRunnerOptions : {}),
      });
      return {
        sync,
        resolvedPeerUrl: peerUrl,
        attemptedPeerUrls: [...new Set(attemptedPeerUrls)],
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
  const direction = String(body?.direction || body?.syncDirection || "two-way").trim();
  return direction || "two-way";
}

function getRequestedSyncMode(body, dryRun) {
  const mode = String(body?.mode || body?.syncMode || (dryRun ? "dry-run" : "apply")).trim();
  return mode || (dryRun ? "dry-run" : "apply");
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

function ensureBroadcaster(state, ctx) {
  if (state.broadcasterHandle) return;
  const broadcasterFactory = resolvePeerDiscoveryBroadcasterFactory(ctx);
  state.broadcasterHandle = broadcasterFactory({
    runtimeRoot: ctx?.runtimeRoot,
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

  app.post("/api/sync/discovery/scanning", async (req, res) => {
    if (!requireSession(req, res)) return;

    let enabled;
    try {
      enabled = parseEnabledFlag(req.body);
    } catch (err) {
      return res.status(400).json({ ok: false, error: err?.message || "Invalid request body" });
    }

    try {
      if (enabled) ensureListener(state, ctx);
      else await stopListener(state);
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
      if (enabled) ensureBroadcaster(state, ctx);
      else await stopBroadcaster(state);
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

    let peerUrl;
    try {
      peerUrl = buildTrustedDiscoveredPeerUrl(state, deviceId);
    } catch {
      return res.status(403).json({ ok: false, error: "Selected peer is not eligible for sync" });
    }
    const syncRunner = resolveSyncRunner(ctx);

    try {
      const syncResult = await runScopeSyncWithPeerUrlFallback({
        discoveredPeer,
        scope,
        runtimeRoot: ctx?.runtimeRoot,
        dryRun: true,
        syncRunner,
        syncRunnerOptions: { maxFileSizeBytes },
      });
      peerUrl = syncResult.resolvedPeerUrl || peerUrl;
      discoveredPeer = maybePersistLoopbackPeerEndpoint(state, discoveredPeer, peerUrl);
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
        sync: syncResult.sync,
      });
    } catch (err) {
      if (err?.name === "PeerSyncNetworkError") {
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

    let peerUrl;
    try {
      peerUrl = buildTrustedDiscoveredPeerUrl(state, deviceId);
    } catch {
      return res.status(403).json({ ok: false, error: "Selected peer is not eligible for sync" });
    }
    const syncRunner = resolveSyncRunner(ctx);

    try {
      const syncResult = await runScopeSyncWithPeerUrlFallback({
        discoveredPeer,
        scope,
        runtimeRoot: ctx?.runtimeRoot,
        dryRun,
        syncRunner,
        syncRunnerOptions: { maxFileSizeBytes, onFileError: onFileError === "pause" ? "fail" : onFileError },
      });
      peerUrl = syncResult.resolvedPeerUrl || peerUrl;
      discoveredPeer = maybePersistLoopbackPeerEndpoint(state, discoveredPeer, peerUrl);
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
        sync: syncResult.sync,
      });
    } catch (err) {
      if (err?.name === "PeerSyncNetworkError") {
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
    const syncRunner = resolveSyncRunner(ctx);
    const discoveredPeerSnapshot = { ...discoveredPeer };

    try {
      const started = syncJobManager.startJob({
        scope,
        peerUrl,
        dryRun,
        async run({ onProgress, isCancelled, onFileError: onFileErrorControl }) {
          const syncResult = await runScopeSyncWithPeerUrlFallback({
            discoveredPeer: discoveredPeerSnapshot,
            scope,
            runtimeRoot: ctx?.runtimeRoot,
            dryRun,
            syncRunner,
            syncRunnerOptions: {
              onProgress,
              shouldCancel: isCancelled,
              onFileError,
              onFileErrorControl,
              maxFileSizeBytes,
            },
          });
          maybePersistLoopbackPeerEndpoint(state, discoveredPeerSnapshot, syncResult.resolvedPeerUrl || peerUrl);
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
      });
      return res.status(202).json({ ok: true, jobId: started.jobId, job: started });
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
