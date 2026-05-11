// Nodevision/ApplicationSystem/Sync/test-sync-panel-run-route.mjs
// This script validates sync-panel run route failures are reported with actionable statuses instead of internal errors.

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createSyncPanelState, upsertDiscoveredPeer } from "./SyncPanelState.mjs";
import { registerSyncPanelRoutes } from "../server/routes/syncPanelRoutes.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
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
  registerSyncPanelRoutes(app, { runtimeRoot, syncPanelState: state });

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
  assert(unreachableRun.statusCode === 500, "Expected unreachable peer run to return 500");
  assert(unreachableRun.payload?.ok === false, "Expected unreachable peer run to return ok=false");
  assert(unreachableRun.payload?.error === "Sync failed", "Expected standardized sync failed error");
  assert(typeof unreachableRun.payload?.details === "string" && unreachableRun.payload.details.length > 0, "Expected sync failure details");

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

  console.log("PASS");
}

main().catch((err) => {
  console.error("Sync panel run-route test failed:", err);
  process.exitCode = 1;
});
