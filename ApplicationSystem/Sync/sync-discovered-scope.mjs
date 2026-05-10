// Nodevision/ApplicationSystem/Sync/sync-discovered-scope.mjs
// This script discovers a trusted sync-capable peer on LAN and runs scope-limited two-way sync for a selected configured Notebook scope.

import { discoverTrustedSyncPeer, buildDiscoveredPeerUrl } from "./sync-discovered-sync-test.mjs";
import { runScopeSyncTwoWay } from "./sync-scope-two-way.mjs";

async function main() {
  const scope = process.argv[2];
  if (!scope) { process.stderr.write("Usage: node ApplicationSystem/Sync/sync-discovered-scope.mjs <scope> [--dry-run|--apply]\n"); process.exitCode = 1; return; }
  const dryRun = !process.argv.includes("--apply");
  try {
    const peer = await discoverTrustedSyncPeer({ timeoutMs: 15000 });
    const peerUrl = buildDiscoveredPeerUrl(peer);
    const sync = await runScopeSyncTwoWay({ peerUrl, scope, dryRun });
    process.stdout.write(`${JSON.stringify({ ok: true, discoveredPeer: { deviceId: peer.deviceId, deviceName: peer.deviceName, address: peer.address, port: peer.port, url: peerUrl }, sync }, null, 2)}\n`);
  } catch (err) {
    process.stderr.write(`${err?.message || String(err)}\n`);
    process.exitCode = 1;
  }
}

main();
