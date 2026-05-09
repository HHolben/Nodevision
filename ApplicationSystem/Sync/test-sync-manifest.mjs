// Nodevision/ApplicationSystem/Sync/test-sync-manifest.mjs
// This script validates SyncTest-only manifest generation, stable hashing, sorted relative outputs, and manifest comparison behavior for the signed peer manifest benchmark.

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";

import {
  buildSyncTestManifest,
  compareManifests,
  validateManifestRequestMessage,
} from "./SyncManifest.mjs";

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

function sha256Text(value) {
  return createHash("sha256").update(Buffer.from(String(value), "utf8")).digest("hex");
}

function createManifest(relativeHashes) {
  return {
    scope: "SyncTest",
    generatedAt: "2026-01-01T00:00:00.000Z",
    files: Object.entries(relativeHashes).map(([relativePath, sha256]) => ({
      relativePath,
      size: 0,
      mtimeMs: 0,
      sha256,
    })),
  };
}

async function main() {
  const runtimeRoot = await fs.mkdtemp(path.join(os.tmpdir(), "nodevision-sync-manifest-"));
  const notebookDir = path.join(runtimeRoot, "Notebook");
  const syncTestDir = path.join(notebookDir, "SyncTest");
  await fs.mkdir(path.join(syncTestDir, "sub"), { recursive: true });
  await fs.mkdir(path.join(syncTestDir, ".hidden-dir"), { recursive: true });

  await fs.writeFile(path.join(syncTestDir, "beta.txt"), "beta", "utf8");
  await fs.writeFile(path.join(syncTestDir, "alpha.txt"), "alpha", "utf8");
  await fs.writeFile(path.join(syncTestDir, "sub", "gamma.txt"), "gamma", "utf8");
  await fs.writeFile(path.join(syncTestDir, ".hidden.txt"), "hidden", "utf8");
  await fs.writeFile(path.join(syncTestDir, ".hidden-dir", "secret.txt"), "secret", "utf8");

  const manifestA = await buildSyncTestManifest({ notebookDir });
  const manifestB = await buildSyncTestManifest({ notebookDir });

  assert(manifestA.scope === "SyncTest", "Expected SyncTest scope");
  assert(Array.isArray(manifestA.files), "Expected manifest files array");
  assert(manifestA.files.length === 3, "Expected only non-hidden SyncTest files");

  const filePaths = manifestA.files.map((entry) => entry.relativePath);
  const sortedPaths = [...filePaths].sort((a, b) => a.localeCompare(b));
  assert(JSON.stringify(filePaths) === JSON.stringify(sortedPaths), "Expected manifest files sorted by relativePath");

  for (const entry of manifestA.files) {
    assert(!path.isAbsolute(entry.relativePath), "Manifest must not include absolute paths");
    assert(entry.relativePath.startsWith("SyncTest/"), "Manifest must only include SyncTest/ paths");
    assert(!entry.relativePath.includes("\\"), "Manifest paths must be POSIX-style");
  }

  const hashA = new Map(manifestA.files.map((entry) => [entry.relativePath, entry.sha256]));
  const hashB = new Map(manifestB.files.map((entry) => [entry.relativePath, entry.sha256]));
  assert(hashA.size === hashB.size, "Expected stable file count across repeated manifest builds");
  for (const [relativePath, sha] of hashA) {
    assert(hashB.get(relativePath) === sha, `Expected stable hash for ${relativePath}`);
  }
  assert(hashA.get("SyncTest/alpha.txt") === sha256Text("alpha"), "Expected deterministic SHA-256 hash for alpha file");

  const emptyManifest = await buildSyncTestManifest({ notebookDir: path.join(runtimeRoot, "EmptyNotebook") });
  assert(emptyManifest.scope === "SyncTest", "Expected empty manifest scope to remain SyncTest");
  assert(Array.isArray(emptyManifest.files) && emptyManifest.files.length === 0, "Expected empty manifest when SyncTest is missing");

  const comparison = await compareManifests(
    createManifest({
      "SyncTest/alpha.txt": "sha-a",
      "SyncTest/beta.txt": "sha-b-local",
      "SyncTest/sub/gamma.txt": "sha-g",
    }),
    createManifest({
      "SyncTest/alpha.txt": "sha-a",
      "SyncTest/beta.txt": "sha-b-remote",
      "SyncTest/delta.txt": "sha-d",
    }),
  );

  assert(JSON.stringify(comparison.onlyLocal) === JSON.stringify(["SyncTest/sub/gamma.txt"]), "Expected onlyLocal classification");
  assert(JSON.stringify(comparison.onlyRemote) === JSON.stringify(["SyncTest/delta.txt"]), "Expected onlyRemote classification");
  assert(JSON.stringify(comparison.changed) === JSON.stringify(["SyncTest/beta.txt"]), "Expected changed classification");
  assert(JSON.stringify(comparison.same) === JSON.stringify(["SyncTest/alpha.txt"]), "Expected same classification");

  validateManifestRequestMessage({
    type: "nodevision.peer.manifestRequest",
    version: 1,
    deviceId: "peer_manifest_test",
    deviceName: "Peer Manifest Test",
    timestamp: "2026-01-01T00:00:00.000Z",
    scope: "SyncTest",
  });

  expectThrow("invalid manifest scope", () => {
    validateManifestRequestMessage({
      type: "nodevision.peer.manifestRequest",
      version: 1,
      deviceId: "peer_manifest_test",
      deviceName: "Peer Manifest Test",
      timestamp: "2026-01-01T00:00:00.000Z",
      scope: "Notebook",
    });
  });

  console.log("PASS");
}

main().catch((err) => {
  console.error("Sync manifest test failed:", err);
  process.exitCode = 1;
});
