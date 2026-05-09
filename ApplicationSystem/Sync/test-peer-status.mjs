// Nodevision/ApplicationSystem/Sync/test-peer-status.mjs
// This script validates trusted peer status normalization, stale-online derivation, and status persistence updates in an isolated runtime root.

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  addTrustedPeer,
  getTrustedPeerStatus,
  loadTrustedPeers,
  updatePeerStatus,
} from "./TrustedPeers.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const runtimeRoot = await fs.mkdtemp(path.join(os.tmpdir(), "nodevision-peer-status-"));
  const options = { runtimeRoot };

  const deviceId = "peer_status_test_device";
  const publicKey = "peer_status_test_public_key";
  const added = await addTrustedPeer(
    {
      deviceId,
      deviceName: "Peer Status Device",
      publicKey,
    },
    options,
  );

  const staleBase = new Date("2026-01-01T00:00:00.000Z");
  await updatePeerStatus(
    deviceId,
    {
      status: "online",
      lastSeen: staleBase.toISOString(),
      lastHelloSuccess: staleBase.toISOString(),
    },
    options,
  );

  const staleNow = new Date(staleBase.getTime() + 6 * 60 * 1000);
  const staleStore = await loadTrustedPeers({ ...options, now: staleNow.toISOString() });

  console.log("Peer statuses after stale evaluation:");
  for (const peer of staleStore.trustedPeers) {
    console.log(
      `- ${peer.deviceId}: status=${peer.status}, lastSeen=${peer.lastSeen}, lastHelloSuccess=${peer.lastHelloSuccess}`,
    );
  }

  const staleStatus = await getTrustedPeerStatus(deviceId, {
    ...options,
    now: staleNow.toISOString(),
  });
  assert(staleStatus, "Expected peer status record");
  assert(staleStatus.status === "offline", "Expected stale online peer to evaluate as offline");

  const refreshedTime = new Date(staleNow.getTime() + 30 * 1000).toISOString();
  const updated = await updatePeerStatus(
    deviceId,
    {
      status: "online",
      lastSeen: refreshedTime,
      lastHelloSuccess: refreshedTime,
      deviceName: "Peer Status Device Updated",
    },
    options,
  );

  assert(updated.publicKey === publicKey, "updatePeerStatus must preserve publicKey");
  assert(updated.pairedAt === added.pairedAt, "updatePeerStatus must preserve pairedAt");

  const freshStatus = await getTrustedPeerStatus(deviceId, {
    ...options,
    now: refreshedTime,
  });
  assert(freshStatus.status === "online", "Expected refreshed peer status to be online");
  assert(freshStatus.deviceName === "Peer Status Device Updated", "Expected deviceName update to persist");

  console.log("PASS");
}

main().catch((err) => {
  console.error("Peer status test failed:", err);
  process.exitCode = 1;
});
