// Nodevision/ApplicationSystem/Sync/test-sync-panel-run-route.mjs
// This script validates sync-panel run route failures are reported with actionable statuses instead of internal errors.

import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";

import { createSyncPanelState, getDiscoveredPeer, upsertDiscoveredPeer } from "./SyncPanelState.mjs";
import { registerSyncPanelRoutes } from "../server/routes/syncPanelRoutes.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function createReachablePeerServer(getDeviceId = () => "nv_dev_reachable_probe") {
  return http.createServer((req, res) => {
    if (req.url === "/api/peer/status") {
      const deviceId = String(getDeviceId?.() ?? "").trim() || "nv_dev_reachable_probe";
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, localDevice: { deviceId } }));
      return;
    }
    if (req.url === "/api/peer/scope/manifest") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({
        ok: true,
        manifest: {
          scope: "SyncTest",
          generatedAt: "2026-05-11T12:00:00.000Z",
          files: [],
        },
      }));
      return;
    }
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: false }));
  });
}

function createMockApp() {
  const routes = new Map();
  return {
    get(routePath, handler) {
      routes.set(`GET ${routePath}`, handler);
    },
    post(routePath, handler) {
      routes.set(`POST ${routePath}`, handler);
    },
    delete(routePath, handler) {
      routes.set(`DELETE ${routePath}`, handler);
    },
    async request(method, routePath, { body = {}, identity = { userId: "test-user" } } = {}) {
      const handler = routes.get(`${String(method).toUpperCase()} ${routePath}`);
      if (!handler) throw new Error(`Route not registered: ${method} ${routePath}`);

      const req = { body, identity };
      const res = {
        statusCode: 200,
        payload: null,
        sent: false,
        status(code) {
          this.statusCode = Number(code);
          return this;
        },
        json(payload) {
          this.payload = payload;
          this.sent = true;
          return this;
        },
      };

      await Promise.resolve(handler(req, res));
      if (!res.sent) throw new Error(`Route did not return JSON: ${method} ${routePath}`);
      return { statusCode: res.statusCode, payload: res.payload };
    },
  };
}

async function main() {
  const runtimeRoot = await fs.mkdtemp(path.join(os.tmpdir(), "nodevision-sync-panel-run-route-"));
  const state = createSyncPanelState();
  const app = createMockApp();
  let injectedRediscoveryPeer = null;
  registerSyncPanelRoutes(app, {
    runtimeRoot,
    syncPanelState: state,
    peerEndpointRediscoveryTimeoutMs: 120,
    peerDiscoveryListenerFactory(options = {}) {
      const timer = setTimeout(() => {
        if (!injectedRediscoveryPeer || typeof options.onPeerDiscovered !== "function") return;
        options.onPeerDiscovered({ peer: injectedRediscoveryPeer });
      }, 10);
      return {
        close() {
          clearTimeout(timer);
        },
      };
    },
  });

  upsertDiscoveredPeer(state, {
    deviceId: "nv_dev_trusted_sync",
    deviceName: "Trusted Sync Peer",
    trusted: true,
    address: "127.0.0.1",
    port: 65534,
    lastSeen: "2026-05-10T04:00:00.000Z",
    capabilities: { sync: true, conflictResolution: true },
    publicKey: "-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEA1111111111111111111111111111111111111111111=\n-----END PUBLIC KEY-----",
  });

  const unreachableRun = await app.request("POST", "/api/sync/run", {
    body: { deviceId: "nv_dev_trusted_sync", scope: "SyncTest", dryRun: true },
  });
  assert(unreachableRun.statusCode === 502, "Expected unreachable peer run to return 502");
  assert(unreachableRun.payload?.ok === false, "Expected unreachable peer run to return ok=false");
  assert(unreachableRun.payload?.error === "Selected peer is unreachable", "Expected unreachable peer error");
  assert(typeof unreachableRun.payload?.details === "string" && unreachableRun.payload.details.length > 0, "Expected sync failure details");
  assert(String(unreachableRun.payload?.details || "").includes("Attempted URLs:"), "Expected attempted URL list in sync failure details");
  assert(String(unreachableRun.payload?.details || "").includes("http://127.0.0.1:65534"), "Expected discovered URL in attempted URL details");
  assert(String(unreachableRun.payload?.details || "").includes("http://localhost:65534"), "Expected localhost fallback URL in attempted URL details");

  let reachableProbeDeviceId = "nv_dev_trusted_same_machine";
  const reachableProbeServer = createReachablePeerServer(() => reachableProbeDeviceId);
  const reachableProbePort = await new Promise((resolve, reject) => {
    reachableProbeServer.once("error", reject);
    reachableProbeServer.listen(0, "127.0.0.1", () => {
      const address = reachableProbeServer.address();
      if (!address || typeof address === "string" || !Number.isInteger(address.port)) {
        reject(new Error("Probe server missing bound port"));
        return;
      }
      resolve(address.port);
    });
  });
  assert(reachableProbePort > 1, "Expected probe port > 1 for fallback-port recovery test");

  try {
    upsertDiscoveredPeer(state, {
      deviceId: "nv_dev_trusted_same_machine",
      deviceName: "Trusted Same-Machine Peer",
      trusted: true,
      address: "127.0.0.2",
      port: reachableProbePort,
      lastSeen: "2026-05-10T04:00:15.000Z",
      capabilities: { sync: true, conflictResolution: true },
      publicKey: "-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEA5555555555555555555555555555555555555555555=\n-----END PUBLIC KEY-----",
    });

    const sameMachinePreflight = await app.request("POST", "/api/sync/preflight", {
      body: { deviceId: "nv_dev_trusted_same_machine", scope: "SyncTest" },
    });
    assert(sameMachinePreflight.statusCode === 200, "Expected same-machine preflight to succeed");
    assert(sameMachinePreflight.payload?.ok === true, "Expected same-machine preflight payload ok=true");
    assert(sameMachinePreflight.payload?.preflight === true, "Expected preflight marker in payload");
    assert(sameMachinePreflight.payload?.ready === true, "Expected preflight ready=true");
    assert(sameMachinePreflight.payload?.dryRun === true, "Expected preflight dryRun=true");

    reachableProbeDeviceId = "nv_dev_trusted_same_machine";
    const sameMachineFallbackRun = await app.request("POST", "/api/sync/run", {
      body: { deviceId: "nv_dev_trusted_same_machine", scope: "SyncTest", dryRun: true },
    });
    assert(sameMachineFallbackRun.statusCode === 200, "Expected same-machine fallback run to succeed");
    assert(sameMachineFallbackRun.payload?.ok === true, "Expected same-machine fallback run to return ok=true");
    assert(sameMachineFallbackRun.payload?.discoveredPeer?.url === `http://localhost:${reachableProbePort}`, "Expected localhost URL fallback selection");
    assert(getDiscoveredPeer(state, "nv_dev_trusted_same_machine")?.address === "localhost", "Expected same-machine fallback to persist localhost endpoint");

    upsertDiscoveredPeer(state, {
      deviceId: "nv_dev_trusted_port_recovery",
      deviceName: "Trusted Peer Port Recovery",
      trusted: true,
      address: "127.0.0.1",
      port: reachableProbePort - 1,
      lastSeen: "2026-05-10T04:00:30.000Z",
      capabilities: { sync: true, conflictResolution: true },
      publicKey: "-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEA3333333333333333333333333333333333333333333=\n-----END PUBLIC KEY-----",
    });

    reachableProbeDeviceId = "nv_dev_trusted_port_recovery";
    const recoveredPortRun = await app.request("POST", "/api/sync/run", {
      body: { deviceId: "nv_dev_trusted_port_recovery", scope: "SyncTest", dryRun: true },
    });
    assert(recoveredPortRun.statusCode === 409, "Expected recovered port run to return 409 retry status");
    assert(recoveredPortRun.payload?.ok === false, "Expected recovered port run to return ok=false");
    assert(String(recoveredPortRun.payload?.error || "").includes("Retry sync"), "Expected recovered port run retry message");
    assert(String(recoveredPortRun.payload?.details || "").includes(`:${reachableProbePort}`), "Expected recovered port details to include recovered port");
    assert(getDiscoveredPeer(state, "nv_dev_trusted_port_recovery")?.port === reachableProbePort, "Expected discovered peer port auto-recovery");

    upsertDiscoveredPeer(state, {
      deviceId: "nv_dev_trusted_loopback_port_recovery",
      deviceName: "Trusted Loopback Port Recovery",
      trusted: true,
      address: "172.20.20.20",
      port: reachableProbePort - 1,
      lastSeen: "2026-05-10T04:00:35.000Z",
      capabilities: { sync: true, conflictResolution: true },
      publicKey: "-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEA6666666666666666666666666666666666666666666=\n-----END PUBLIC KEY-----",
    });

    reachableProbeDeviceId = "nv_dev_trusted_loopback_port_recovery";
    const recoveredLoopbackPortRun = await app.request("POST", "/api/sync/run", {
      body: { deviceId: "nv_dev_trusted_loopback_port_recovery", scope: "SyncTest", dryRun: true },
    });
    assert(recoveredLoopbackPortRun.statusCode === 409, "Expected loopback port recovery run to return 409 retry status");
    assert(recoveredLoopbackPortRun.payload?.ok === false, "Expected loopback port recovery run to return ok=false");
    assert(String(recoveredLoopbackPortRun.payload?.error || "").includes("Retry sync"), "Expected loopback port recovery retry message");
    assert(String(recoveredLoopbackPortRun.payload?.details || "").includes(`http://localhost:${reachableProbePort}`), "Expected loopback port recovery details to include localhost recovered URL");
    assert(getDiscoveredPeer(state, "nv_dev_trusted_loopback_port_recovery")?.address === "localhost", "Expected loopback port recovery to persist localhost endpoint");
    assert(getDiscoveredPeer(state, "nv_dev_trusted_loopback_port_recovery")?.port === reachableProbePort, "Expected loopback port recovery to persist recovered port");

    upsertDiscoveredPeer(state, {
      deviceId: "nv_dev_trusted_endpoint_recovery",
      deviceName: "Trusted Peer Endpoint Recovery",
      trusted: true,
      address: "127.0.0.2",
      port: reachableProbePort - 30,
      lastSeen: "2026-05-10T04:00:45.000Z",
      capabilities: { sync: true, conflictResolution: true },
      publicKey: "-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEA4444444444444444444444444444444444444444444=\n-----END PUBLIC KEY-----",
    });
    reachableProbeDeviceId = "nv_dev_trusted_endpoint_recovery_mismatch";
    injectedRediscoveryPeer = {
      deviceId: "nv_dev_trusted_endpoint_recovery",
      deviceName: "Trusted Peer Endpoint Recovery",
      trusted: true,
      address: "127.0.0.1",
      port: reachableProbePort,
      lastSeen: "2026-05-10T04:00:46.000Z",
      capabilities: { sync: true, conflictResolution: true },
      publicKey: "-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEA4444444444444444444444444444444444444444444=\n-----END PUBLIC KEY-----",
    };

    const recoveredEndpointRun = await app.request("POST", "/api/sync/run", {
      body: { deviceId: "nv_dev_trusted_endpoint_recovery", scope: "SyncTest", dryRun: true },
    });
    assert(recoveredEndpointRun.statusCode === 409, "Expected endpoint rediscovery run to return 409 retry status");
    assert(recoveredEndpointRun.payload?.ok === false, "Expected endpoint rediscovery run to return ok=false");
    assert(String(recoveredEndpointRun.payload?.error || "").includes("Retry sync"), "Expected endpoint rediscovery retry message");
    assert(String(recoveredEndpointRun.payload?.details || "").includes(`http://127.0.0.1:${reachableProbePort}`), "Expected endpoint rediscovery details to include refreshed URL");
    assert(getDiscoveredPeer(state, "nv_dev_trusted_endpoint_recovery")?.address === "127.0.0.1", "Expected discovered peer address auto-recovery");
    injectedRediscoveryPeer = null;
  } finally {
    await new Promise((resolve) => reachableProbeServer.close(() => resolve()));
  }

  upsertDiscoveredPeer(state, {
    deviceId: "nv_dev_trusted_no_sync",
    deviceName: "Trusted Non-Sync Peer",
    trusted: true,
    address: "127.0.0.1",
    port: 65535,
    lastSeen: "2026-05-10T04:01:00.000Z",
    capabilities: { sync: false, conflictResolution: true },
    publicKey: "-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEA2222222222222222222222222222222222222222222=\n-----END PUBLIC KEY-----",
  });

  const unsupportedRun = await app.request("POST", "/api/sync/run", {
    body: { deviceId: "nv_dev_trusted_no_sync", scope: "SyncTest", dryRun: true },
  });
  assert(unsupportedRun.statusCode === 403, "Expected non-sync-capable peer run to return 403");
  assert(unsupportedRun.payload?.ok === false, "Expected non-sync-capable peer run to return ok=false");
  assert(String(unsupportedRun.payload?.error || "").includes("sync-capable"), "Expected non-sync-capable peer error message");

  const unsupportedPreflight = await app.request("POST", "/api/sync/preflight", {
    body: { deviceId: "nv_dev_trusted_no_sync", scope: "SyncTest" },
  });
  assert(unsupportedPreflight.statusCode === 403, "Expected non-sync-capable preflight to return 403");
  assert(unsupportedPreflight.payload?.ok === false, "Expected non-sync-capable preflight to return ok=false");
  assert(String(unsupportedPreflight.payload?.error || "").includes("sync-capable"), "Expected non-sync-capable preflight error message");

  console.log("PASS");
}

main().catch((err) => {
  console.error("Sync panel run-route test failed:", err);
  process.exitCode = 1;
});
