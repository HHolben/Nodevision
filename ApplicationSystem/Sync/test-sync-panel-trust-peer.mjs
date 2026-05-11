// Nodevision/ApplicationSystem/Sync/test-sync-panel-trust-peer.mjs
// This script validates explicit Sync Panel trust approval for discovered peers, including rejection cases, idempotency, persisted trust updates, and private-key non-exposure.

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { ensureDeviceIdentity } from "./DeviceIdentity.mjs";
import { findTrustedPeer } from "./TrustedPeers.mjs";
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
  const runtimeRoot = await fs.mkdtemp(path.join(os.tmpdir(), "nodevision-sync-panel-trust-route-"));
  const peerRoot = await fs.mkdtemp(path.join(os.tmpdir(), "nodevision-sync-panel-trust-peer-"));
  const peerIdentity = await ensureDeviceIdentity({
    runtimeRoot: peerRoot,
    deviceId: "nv_dev_sync_panel_untrusted",
    deviceName: "Untrusted Sync Peer",
  });
  const peerPublicKey = String(peerIdentity.publicKey || "").trim();

  const state = createSyncPanelState();
  const app = createMockApp();
  registerSyncPanelRoutes(app, { runtimeRoot, syncPanelState: state });

  upsertDiscoveredPeer(state, {
    deviceId: peerIdentity.deviceId,
    deviceName: peerIdentity.deviceName,
    trusted: false,
    address: "10.0.0.44",
    port: 3001,
    lastSeen: "2026-05-10T02:15:00.000Z",
    capabilities: { sync: true, conflictResolution: true },
    publicKey: peerPublicKey,
  });

  upsertDiscoveredPeer(state, {
    deviceId: "nv_dev_missing_public_key",
    deviceName: "Missing Key Peer",
    trusted: false,
    address: "10.0.0.45",
    port: 3002,
    lastSeen: "2026-05-10T02:16:00.000Z",
    capabilities: { sync: true, conflictResolution: true },
  });

  const trustedResponse = await app.request("POST", "/api/sync/trust-peer", {
    body: { deviceId: peerIdentity.deviceId },
  });
  assert(trustedResponse.statusCode === 200, "Expected trust-peer success status");
  assert(trustedResponse.payload?.ok === true, "Expected trust-peer ok=true");
  assert(trustedResponse.payload?.trustedPeer?.deviceId === peerIdentity.deviceId, "Expected trusted peer deviceId in response");
  assert(trustedResponse.payload?.trustedPeer?.deviceName === peerIdentity.deviceName, "Expected trusted peer deviceName in response");
  assert(trustedResponse.payload?.trustedPeer?.trusted === true, "Expected trusted peer trusted=true in response");

  const storedTrustedPeer = await findTrustedPeer(peerIdentity.deviceId, { runtimeRoot });
  assert(Boolean(storedTrustedPeer), "Expected trusted peer to be persisted");
  assert(String(storedTrustedPeer.publicKey || "").trim() === peerPublicKey, "Expected persisted trusted peer publicKey");

  const statusAfterTrust = await app.request("GET", "/api/sync/status");
  assert(statusAfterTrust.statusCode === 200, "Expected sync status success");
  const trustedDiscoveredPeer = (statusAfterTrust.payload?.discoveredPeers || []).find((peer) => peer.deviceId === peerIdentity.deviceId);
  assert(Boolean(trustedDiscoveredPeer), "Expected trusted peer to remain in discovered list");
  assert(trustedDiscoveredPeer.trusted === true, "Expected discovered peer to be marked trusted after approval");
  assert(!Object.keys(trustedDiscoveredPeer).some((key) => /private/i.test(key)), "Discovered peer response must not contain private-key fields");
  assert(!JSON.stringify(statusAfterTrust.payload).includes("PRIVATE KEY"), "Sync status response must not expose private key material");

  const idempotentResponse = await app.request("POST", "/api/sync/trust-peer", {
    body: { deviceId: peerIdentity.deviceId },
  });
  assert(idempotentResponse.statusCode === 200, "Expected idempotent trust-peer success");
  assert(idempotentResponse.payload?.ok === true, "Expected idempotent trust-peer ok=true");
  assert(idempotentResponse.payload?.trustedPeer?.trusted === true, "Expected idempotent trusted peer response");

  const missingKeyResponse = await app.request("POST", "/api/sync/trust-peer", {
    body: { deviceId: "nv_dev_missing_public_key" },
  });
  assert(missingKeyResponse.statusCode === 400, "Expected missing-publicKey trust rejection");
  assert(missingKeyResponse.payload?.ok === false, "Expected missing-publicKey rejection payload");

  const unknownDeviceResponse = await app.request("POST", "/api/sync/trust-peer", {
    body: { deviceId: "nv_dev_not_discovered" },
  });
  assert(unknownDeviceResponse.statusCode === 404, "Expected unknown discovered device rejection");
  assert(unknownDeviceResponse.payload?.ok === false, "Expected unknown-device rejection payload");

  const malformedDeviceIdResponse = await app.request("POST", "/api/sync/trust-peer", {
    body: { deviceId: "   " },
  });
  assert(malformedDeviceIdResponse.statusCode === 400, "Expected malformed deviceId rejection");
  assert(malformedDeviceIdResponse.payload?.ok === false, "Expected malformed deviceId rejection payload");

  const nonStringDeviceIdResponse = await app.request("POST", "/api/sync/trust-peer", {
    body: { deviceId: 42 },
  });
  assert(nonStringDeviceIdResponse.statusCode === 400, "Expected non-string deviceId rejection");
  assert(nonStringDeviceIdResponse.payload?.ok === false, "Expected non-string deviceId rejection payload");

  console.log("PASS");
}

main().catch((err) => {
  console.error("Sync panel trust-peer test failed:", err);
  process.exitCode = 1;
});
