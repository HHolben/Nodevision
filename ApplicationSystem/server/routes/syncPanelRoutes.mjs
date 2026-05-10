// Nodevision/ApplicationSystem/server/routes/syncPanelRoutes.mjs
// This file registers authenticated Sync Panel API endpoints that manage in-memory discovery state, expose safe local/discovery status, and run trusted scope-limited sync operations only after explicit user actions.

import { getLocalPeerInfo } from "../../Sync/TrustedPeers.mjs";
import { loadSyncScopes, validateSyncScope } from "../../Sync/SyncScopes.mjs";
import { runSyncTestTwoWay } from "../../Sync/sync-sync-test-two-way.mjs";
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
  state.listenerHandle = startPeerDiscoveryListener({
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
  state.broadcasterHandle = startPeerDiscoveryBroadcaster({
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

function syncStateResponse(state) {
  return {
    ok: true,
    discovery: {
      scanning: Boolean(state.scanning),
      discoverable: Boolean(state.discoverable),
    },
    discoveredPeers: listDiscoveredPeers(state),
    selectedPeerDeviceId: state.selectedPeerDeviceId || null,
  };
}

export function registerSyncPanelRoutes(app, ctx) {
  const state = createSyncPanelState();
  installShutdownHookIfNeeded(state);

  app.get("/api/sync/local-device", async (req, res) => {
    if (!requireSession(req, res)) return;
    try {
      const localDevice = await getLocalPeerInfo({ runtimeRoot: ctx?.runtimeRoot });
      return res.json({ ok: true, localDevice });
    } catch {
      return res.status(500).json({ ok: false, error: "Failed to load local device" });
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

  app.get("/api/sync/status", (req, res) => {
    if (!requireSession(req, res)) return;
    return res.json(syncStateResponse(state));
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
      return res.json(syncStateResponse(state));
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
      return res.json(syncStateResponse(state));
    } catch {
      return res.status(500).json({ ok: false, error: "Failed to update discoverable state" });
    }
  });

  app.post("/api/sync/select-peer", (req, res) => {
    if (!requireSession(req, res)) return;
    try {
      const deviceId = String(req.body?.deviceId ?? "").trim();
      if (!deviceId) {
        return res.status(400).json({ ok: false, error: "deviceId is required" });
      }
      setSelectedPeerDeviceId(state, deviceId);
      return res.json(syncStateResponse(state));
    } catch {
      return res.status(400).json({ ok: false, error: "Unknown discovered peer" });
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

    const discoveredPeer = getDiscoveredPeer(state, deviceId);
    if (!discoveredPeer) {
      return res.status(404).json({ ok: false, error: "Discovered peer not found" });
    }
    if (!canRunSyncWithDiscoveredPeer(state, deviceId)) {
      return res.status(403).json({ ok: false, error: "Untrusted peer cannot be synced" });
    }

    let scope;
    try {
      scope = await resolveRequestedScope(body, { runtimeRoot: ctx?.runtimeRoot });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err?.message || "Invalid scope" });
    }

    // Current benchmark sync runner is SyncTest-only; configurable scopes are surfaced but not auto-enabled here.
    if (scope !== DEFAULT_SYNC_SCOPE) {
      return res.status(400).json({ ok: false, error: `Scope not yet supported by sync runner: ${scope}` });
    }

    const dryRun = body?.dryRun === undefined ? true : Boolean(body.dryRun);
    let peerUrl;
    try {
      peerUrl = buildTrustedDiscoveredPeerUrl(state, deviceId);
    } catch {
      return res.status(403).json({ ok: false, error: "Selected peer is not eligible for sync" });
    }

    try {
      const sync = await runSyncTestTwoWay({
        peerUrl,
        runtimeRoot: ctx?.runtimeRoot,
        dryRun,
      });
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
        sync,
      });
    } catch (err) {
      return res.status(500).json({
        ok: false,
        error: err?.message || "Failed to run sync",
      });
    }
  });
}
