// Nodevision/ApplicationSystem/Sync/test-sync-panel-state.mjs
// This script validates in-memory Sync Panel runtime state updates, selection safety, trusted-peer sync eligibility, and trusted discovered-peer URL resolution.

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
} from "./SyncPanelState.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function expectThrow(label, fn) {
  let didThrow = false;
  try {
    fn();
  } catch {
    didThrow = true;
  }
  assert(didThrow, `${label} should throw`);
}

async function main() {
  const state = createSyncPanelState();

  const untrusted = upsertDiscoveredPeer(state, {
    deviceId: "peer_a",
    deviceName: "Peer A",
    trusted: false,
    address: "10.0.0.38",
    port: 3001,
    lastSeen: "2026-05-10T00:00:00.000Z",
    capabilities: { sync: true, conflictResolution: true },
  });
  assert(untrusted.deviceId === "peer_a", "Expected peer upsert");
  assert(listDiscoveredPeers(state).length === 1, "Expected one discovered peer");

  const updated = upsertDiscoveredPeer(state, {
    deviceId: "peer_a",
    deviceName: "Peer A Updated",
    trusted: true,
    address: "10.0.0.39",
    port: 3002,
    lastSeen: "2026-05-10T00:01:00.000Z",
    capabilities: { sync: true, conflictResolution: false },
  });
  assert(updated.deviceName === "Peer A Updated", "Expected peer update");
  assert(updated.address === "10.0.0.39", "Expected updated peer address");
  assert(getDiscoveredPeer(state, "peer_a")?.trusted === true, "Expected trusted update");

  expectThrow("selected peer must exist", () => {
    setSelectedPeerDeviceId(state, "unknown_peer");
  });
  setSelectedPeerDeviceId(state, "peer_a");
  assert(state.selectedPeerDeviceId === "peer_a", "Expected selected peer update");

  upsertDiscoveredPeer(state, {
    deviceId: "peer_untrusted",
    deviceName: "Peer Untrusted",
    trusted: false,
    address: "10.0.0.40",
    port: 3003,
    lastSeen: "2026-05-10T00:02:00.000Z",
    capabilities: { sync: true, conflictResolution: true },
  });
  assert(canRunSyncWithDiscoveredPeer(state, "peer_untrusted") === false, "Expected untrusted peer sync rejection");
  assert(canRunSyncWithDiscoveredPeer(state, "peer_a") === true, "Expected trusted peer sync acceptance");

  const trustedUrl = buildTrustedDiscoveredPeerUrl(state, "peer_a");
  assert(trustedUrl === "http://10.0.0.39:3002", "Expected trusted peer URL from discovered address/port");
  expectThrow("untrusted peer URL reject", () => {
    buildTrustedDiscoveredPeerUrl(state, "peer_untrusted");
  });

  assert(setScanningEnabled(state, true) === true, "Expected scanning enabled");
  assert(setScanningEnabled(state, false) === false, "Expected scanning disabled");
  assert(setDiscoverableEnabled(state, true) === true, "Expected discoverable enabled");
  assert(setDiscoverableEnabled(state, false) === false, "Expected discoverable disabled");

  console.log("PASS");
}

main().catch((err) => {
  console.error("Sync panel state test failed:", err);
  process.exitCode = 1;
});
