// Nodevision/ApplicationSystem/Sync/sync-discovered-sync-test.mjs
// This script discovers a trusted sync-capable LAN peer and then runs safe two-way SyncTest synchronization against that peer while keeping stdout JSON-only and refusing untrusted discovery results.

import {
  startPeerDiscoveryListener,
  startPeerDiscoveryBroadcaster,
} from "./PeerDiscovery.mjs";
import { runSyncTestTwoWay } from "./sync-sync-test-two-way.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_TIMEOUT_MS = 15_000;
const USAGE = "Usage: node ApplicationSystem/Sync/sync-discovered-sync-test.mjs [--timeout-ms 15000]";

function isEntryModule() {
  const argvPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
  return argvPath === fileURLToPath(import.meta.url);
}

function normalizeNonEmptyString(value, fieldName) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`${fieldName} must be a nonempty string`);
  return text;
}

function normalizeTimeoutMs(value) {
  const timeoutMs = Number(value);
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error("timeout-ms must be a positive integer");
  }
  return timeoutMs;
}

function normalizePort(value, fieldName = "port") {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${fieldName} must be an integer between 1 and 65535`);
  }
  return port;
}

function normalizeAddress(value) {
  return normalizeNonEmptyString(value, "peer.address");
}

export function parseSyncDiscoveredArgs(argv = process.argv.slice(2)) {
  if (!Array.isArray(argv)) throw new Error("argv must be an array");
  if (argv.length === 0) return { timeoutMs: DEFAULT_TIMEOUT_MS };
  if (argv.length !== 2 || argv[0] !== "--timeout-ms") throw new Error(USAGE);
  return { timeoutMs: normalizeTimeoutMs(argv[1]) };
}

export function isTrustedSyncCapablePeer(peer) {
  if (!peer || typeof peer !== "object" || Array.isArray(peer)) return false;
  if (peer.trusted !== true) return false;
  if (peer.capabilities?.sync !== true) return false;
  try {
    normalizeAddress(peer.address);
    normalizePort(peer.port, "peer.port");
  } catch {
    return false;
  }
  return true;
}

export function buildDiscoveredPeerUrl(peer) {
  if (!peer || typeof peer !== "object" || Array.isArray(peer)) {
    throw new Error("peer must be a plain object");
  }
  const address = normalizeAddress(peer.address);
  const port = normalizePort(peer.port, "peer.port");
  const host = address.includes(":") && !address.startsWith("[") ? `[${address}]` : address;
  const parsed = new URL(`http://${host}:${port}`);
  return `${parsed.protocol}//${parsed.host}`;
}

async function closeDiscoveryHandles(listenerHandle, broadcasterHandle) {
  await Promise.all([
    listenerHandle?.close ? Promise.resolve(listenerHandle.close()).catch(() => {}) : Promise.resolve(),
    broadcasterHandle?.stop ? Promise.resolve(broadcasterHandle.stop()).catch(() => {}) : Promise.resolve(),
  ]);
}

export async function discoverTrustedSyncPeer({
  timeoutMs = DEFAULT_TIMEOUT_MS,
  discoveryOptions = {},
  listenerFactory = startPeerDiscoveryListener,
  broadcasterFactory = startPeerDiscoveryBroadcaster,
} = {}) {
  const waitMs = normalizeTimeoutMs(timeoutMs);
  const options = discoveryOptions && typeof discoveryOptions === "object" ? discoveryOptions : {};
  const upstreamOnPeerDiscovered = typeof options.onPeerDiscovered === "function" ? options.onPeerDiscovered : null;
  const upstreamOnError = typeof options.onError === "function" ? options.onError : null;

  let listenerHandle = null;
  let broadcasterHandle = null;
  let timer = null;
  let settled = false;

  const finish = async (finalizer) => {
    if (settled) return;
    settled = true;
    if (timer) clearTimeout(timer);
    await closeDiscoveryHandles(listenerHandle, broadcasterHandle);
    await finalizer();
  };

  return new Promise((resolve, reject) => {
    try {
      listenerHandle = listenerFactory({
        ...options,
        onPeerDiscovered(event) {
          if (upstreamOnPeerDiscovered) upstreamOnPeerDiscovered(event);
          const peer = event?.peer;
          if (!isTrustedSyncCapablePeer(peer)) return;
          finish(async () => resolve(peer)).catch((err) => reject(err));
        },
        onError(err) {
          if (upstreamOnError) upstreamOnError(err);
        },
      });

      broadcasterHandle = broadcasterFactory({
        ...options,
        onError(err) {
          if (upstreamOnError) upstreamOnError(err);
        },
      });
    } catch (err) {
      finish(async () => reject(err)).catch(() => reject(err));
      return;
    }

    timer = setTimeout(() => {
      const timeoutError = new Error(`Timed out waiting for trusted sync-capable peer after ${waitMs}ms`);
      finish(async () => reject(timeoutError)).catch(() => reject(timeoutError));
    }, waitMs);
  });
}

export async function runDiscoveredSyncTest({
  timeoutMs = DEFAULT_TIMEOUT_MS,
  runtimeRoot,
  discoveryOptions = {},
  listenerFactory = startPeerDiscoveryListener,
  broadcasterFactory = startPeerDiscoveryBroadcaster,
  syncRunner = runSyncTestTwoWay,
} = {}) {
  const peer = await discoverTrustedSyncPeer({
    timeoutMs,
    discoveryOptions,
    listenerFactory,
    broadcasterFactory,
  });
  const url = buildDiscoveredPeerUrl(peer);
  const syncReport = await syncRunner({ peerUrl: url, runtimeRoot });

  return {
    ok: true,
    discoveredPeer: {
      deviceId: String(peer.deviceId ?? ""),
      deviceName: String(peer.deviceName ?? ""),
      address: normalizeAddress(peer.address),
      port: normalizePort(peer.port, "peer.port"),
      url,
    },
    sync: syncReport,
  };
}

async function main() {
  let args;
  try {
    args = parseSyncDiscoveredArgs(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`${err?.message || String(err)}\n`);
    process.exitCode = 1;
    return;
  }

  try {
    const result = await runDiscoveredSyncTest({ timeoutMs: args.timeoutMs });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (err) {
    process.stderr.write(`${err?.message || String(err)}\n`);
    process.exitCode = 1;
  }
}

if (isEntryModule()) {
  main();
}
