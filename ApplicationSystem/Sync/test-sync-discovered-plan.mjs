// Nodevision/ApplicationSystem/Sync/test-sync-discovered-plan.mjs
// This script validates trusted discovered-peer selection, ignores untrusted or non-sync peers, checks peer URL construction, and confirms timeout handling for discovered SyncTest synchronization planning.

import {
  parseSyncDiscoveredArgs,
  isTrustedSyncCapablePeer,
  buildDiscoveredPeerUrl,
  discoverTrustedSyncPeer,
  runDiscoveredSyncTest,
} from "./sync-discovered-sync-test.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function expectReject(label, promiseFactory) {
  let didReject = false;
  try {
    await promiseFactory();
  } catch {
    didReject = true;
  }
  assert(didReject, `${label} should reject`);
}

function createMockDiscoveryHarness() {
  let listenerOptions = null;
  let broadcasterOptions = null;
  let listenerCloseCount = 0;
  let broadcasterStopCount = 0;

  return {
    listenerFactory(options) {
      listenerOptions = options;
      return {
        async close() {
          listenerCloseCount += 1;
        },
      };
    },
    broadcasterFactory(options) {
      broadcasterOptions = options;
      return {
        async stop() {
          broadcasterStopCount += 1;
        },
      };
    },
    emit(peer) {
      listenerOptions?.onPeerDiscovered?.({ peer });
    },
    getListenerCloseCount() {
      return listenerCloseCount;
    },
    getBroadcasterStopCount() {
      return broadcasterStopCount;
    },
    getListenerOptions() {
      return listenerOptions;
    },
    getBroadcasterOptions() {
      return broadcasterOptions;
    },
  };
}

async function main() {
  const defaultArgs = parseSyncDiscoveredArgs([]);
  assert(defaultArgs.timeoutMs === 15_000, "Expected default timeout");
  const customArgs = parseSyncDiscoveredArgs(["--timeout-ms", "9000"]);
  assert(customArgs.timeoutMs === 9000, "Expected custom timeout parsing");

  assert(
    isTrustedSyncCapablePeer({
      trusted: true,
      address: "10.0.0.38",
      port: 3001,
      capabilities: { sync: true },
    }) === true,
    "Expected trusted sync-capable peer acceptance",
  );
  assert(
    isTrustedSyncCapablePeer({
      trusted: false,
      address: "10.0.0.38",
      port: 3001,
      capabilities: { sync: true },
    }) === false,
    "Expected untrusted peer rejection",
  );
  assert(
    isTrustedSyncCapablePeer({
      trusted: true,
      address: "10.0.0.38",
      port: 3001,
      capabilities: { sync: false },
    }) === false,
    "Expected non-sync trusted peer rejection",
  );

  const builtUrl = buildDiscoveredPeerUrl({
    address: "10.0.0.38",
    port: 3001,
  });
  assert(builtUrl === "http://10.0.0.38:3001", "Expected discovered peer URL format");

  const harness = createMockDiscoveryHarness();
  const pendingDiscovery = discoverTrustedSyncPeer({
    timeoutMs: 2000,
    listenerFactory: harness.listenerFactory,
    broadcasterFactory: harness.broadcasterFactory,
  });
  harness.emit({
    deviceId: "peer_untrusted",
    deviceName: "Untrusted Peer",
    trusted: false,
    address: "10.0.0.10",
    port: 3000,
    capabilities: { sync: true },
  });
  harness.emit({
    deviceId: "peer_no_sync",
    deviceName: "No Sync Peer",
    trusted: true,
    address: "10.0.0.11",
    port: 3002,
    capabilities: { sync: false },
  });
  harness.emit({
    deviceId: "peer_trusted_sync",
    deviceName: "Trusted Sync Peer",
    trusted: true,
    address: "10.0.0.38",
    port: 3001,
    capabilities: { sync: true, conflictResolution: true },
  });

  const selectedPeer = await pendingDiscovery;
  assert(selectedPeer.deviceId === "peer_trusted_sync", "Expected trusted sync-capable peer selection");
  assert(harness.getListenerCloseCount() === 1, "Expected listener cleanup");
  assert(harness.getBroadcasterStopCount() === 1, "Expected broadcaster cleanup");
  assert(Boolean(harness.getListenerOptions()), "Expected listener options capture");
  assert(Boolean(harness.getBroadcasterOptions()), "Expected broadcaster options capture");

  const runHarness = createMockDiscoveryHarness();
  const pendingRun = runDiscoveredSyncTest({
    timeoutMs: 2000,
    listenerFactory: runHarness.listenerFactory,
    broadcasterFactory: runHarness.broadcasterFactory,
    syncRunner: async ({ peerUrl }) => ({
      ok: true,
      peerUrl,
      scope: "SyncTest",
      operations: { pulled: [], pushed: [], conflicts: [], skipped: { same: [] } },
    }),
  });
  runHarness.emit({
    deviceId: "peer_sync_runner",
    deviceName: "Sync Runner Peer",
    trusted: true,
    address: "10.0.0.50",
    port: 3010,
    capabilities: { sync: true, conflictResolution: true },
  });
  const runResult = await pendingRun;
  assert(runResult.ok === true, "Expected discovered sync run ok=true");
  assert(runResult.discoveredPeer.url === "http://10.0.0.50:3010", "Expected URL built from discovered address and advertised port");
  assert(runResult.sync.peerUrl === "http://10.0.0.50:3010", "Expected sync runner peerUrl");

  const timeoutHarness = createMockDiscoveryHarness();
  await expectReject("discover timeout", async () => {
    await discoverTrustedSyncPeer({
      timeoutMs: 30,
      listenerFactory: timeoutHarness.listenerFactory,
      broadcasterFactory: timeoutHarness.broadcasterFactory,
    });
  });
  assert(timeoutHarness.getListenerCloseCount() === 1, "Expected timeout listener cleanup");
  assert(timeoutHarness.getBroadcasterStopCount() === 1, "Expected timeout broadcaster cleanup");

  console.log("PASS");
}

main().catch((err) => {
  console.error("Discovered sync plan test failed:", err);
  process.exitCode = 1;
});
