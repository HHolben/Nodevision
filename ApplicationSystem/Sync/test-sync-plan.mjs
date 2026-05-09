// Nodevision/ApplicationSystem/Sync/test-sync-plan.mjs
// This script verifies SyncTest manifest-plan comparison output for only-local, only-remote, changed, and same cases while ensuring plan paths remain relative and scoped to SyncTest.

import path from "node:path";
import { compareManifests } from "./SyncManifest.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function createManifest(entries) {
  return {
    scope: "SyncTest",
    generatedAt: "2026-01-01T00:00:00.000Z",
    files: entries.map((entry) => ({
      relativePath: entry.relativePath,
      size: 1,
      mtimeMs: 1,
      sha256: entry.sha256,
    })),
  };
}

function assertRelativePlanPaths(paths) {
  for (const relativePath of paths) {
    assert(typeof relativePath === "string" && relativePath.length > 0, "Plan path must be a non-empty string");
    assert(!path.isAbsolute(relativePath), `Plan path must be relative: ${relativePath}`);
    assert(!relativePath.includes("\\"), `Plan path must be POSIX style: ${relativePath}`);
    assert(relativePath.startsWith("SyncTest/"), `Plan path must stay under SyncTest/: ${relativePath}`);
  }
}

async function main() {
  const localManifest = createManifest([
    { relativePath: "SyncTest/only-local.txt", sha256: "sha-only-local" },
    { relativePath: "SyncTest/changed.txt", sha256: "sha-changed-local" },
    { relativePath: "SyncTest/same.txt", sha256: "sha-same" },
  ]);
  const remoteManifest = createManifest([
    { relativePath: "SyncTest/only-remote.txt", sha256: "sha-only-remote" },
    { relativePath: "SyncTest/changed.txt", sha256: "sha-changed-remote" },
    { relativePath: "SyncTest/same.txt", sha256: "sha-same" },
  ]);

  const plan = await compareManifests(localManifest, remoteManifest);

  assert(JSON.stringify(plan.onlyLocal) === JSON.stringify(["SyncTest/only-local.txt"]), "Expected one onlyLocal file");
  assert(JSON.stringify(plan.onlyRemote) === JSON.stringify(["SyncTest/only-remote.txt"]), "Expected one onlyRemote file");
  assert(JSON.stringify(plan.changed) === JSON.stringify(["SyncTest/changed.txt"]), "Expected one changed file");
  assert(JSON.stringify(plan.same) === JSON.stringify(["SyncTest/same.txt"]), "Expected one same file");

  assertRelativePlanPaths(plan.onlyLocal);
  assertRelativePlanPaths(plan.onlyRemote);
  assertRelativePlanPaths(plan.changed);
  assertRelativePlanPaths(plan.same);

  console.log("PASS");
}

main().catch((err) => {
  console.error("Sync plan test failed:", err);
  process.exitCode = 1;
});
