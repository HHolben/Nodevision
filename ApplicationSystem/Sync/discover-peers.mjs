// Nodevision/ApplicationSystem/Sync/discover-peers.mjs
// This script runs LAN peer discovery by broadcasting signed discovery beacons and printing deduplicated trusted/untrusted discovery events as JSON lines until interrupted.

import {
  startPeerDiscoveryListener,
  startPeerDiscoveryBroadcaster,
} from "./PeerDiscovery.mjs";

async function main() {
  const listener = startPeerDiscoveryListener({
    onPeerDiscovered({ peer }) {
      process.stdout.write(`${JSON.stringify({ event: "peer-discovered", peer })}\n`);
    },
    onError(err) {
      process.stderr.write(`${err?.message || String(err)}\n`);
    },
  });

  const broadcaster = startPeerDiscoveryBroadcaster({
    onError(err) {
      process.stderr.write(`${err?.message || String(err)}\n`);
    },
  });

  let stopping = false;
  async function shutdown() {
    if (stopping) return;
    stopping = true;
    await Promise.all([
      listener.close().catch(() => {}),
      broadcaster.stop().catch(() => {}),
    ]);
    process.exit(0);
  }

  process.on("SIGINT", () => {
    shutdown().catch(() => {
      process.exit(1);
    });
  });
  process.on("SIGTERM", () => {
    shutdown().catch(() => {
      process.exit(1);
    });
  });
}

main().catch((err) => {
  process.stderr.write(`${err?.message || String(err)}\n`);
  process.exitCode = 1;
});
