// Nodevision/ApplicationSystem/Sync/test-sync-plan.mjs
// This script verifies SyncTest manifest-plan comparison output for only-local, only-remote, changed, and same cases while ensuring plan paths remain relative and scoped to SyncTest.

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { compareManifests } from "./SyncManifest.mjs";
import { saveSyncScopes } from "./SyncScopes.mjs";
import { runScopeSyncTwoWay } from "./sync-scope-two-way.mjs";

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

function sha256(text) {
  return createHash("sha256").update(String(text)).digest("hex");
}

async function writeScopedFile(notebookDir, relativePath, content) {
  const filePath = path.resolve(notebookDir, relativePath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
}

async function testSkipSameNameLocationSizeOption() {
  const runtimeRoot = await fs.mkdtemp(path.join(os.tmpdir(), "nodevision-same-size-skip-"));
  try {
    const scope = "Shared";
    const notebookDir = path.resolve(runtimeRoot, "Notebook");
    const relativePath = "Shared/photos/same-size.jpg";
    await saveSyncScopes(["SyncTest", scope], { runtimeRoot });
    await writeScopedFile(notebookDir, relativePath, "local");

    const remoteManifest = {
      scope,
      generatedAt: "2026-01-01T00:00:00.000Z",
      files: [{
        relativePath,
        size: 5,
        mtimeMs: 1,
        sha256: sha256("remot"),
        transferMode: "json",
        tooLargeForJson: false,
      }],
    };
    const transport = {
      kind: "test-transport",
      async listFiles(requestedScope) {
        assert(requestedScope === scope, "Expected dry-run to request the Shared scope");
        return remoteManifest;
      },
    };

    const defaultDryRun = await runScopeSyncTwoWay({ scope, runtimeRoot, dryRun: true, transport });
    assert(defaultDryRun.operations.wouldConflict.includes(relativePath), "Expected same-size changed file to conflict by default");

    const skipDryRun = await runScopeSyncTwoWay({ scope, runtimeRoot, dryRun: true, transport, skipSameNameLocationSize: true });
    assert(skipDryRun.skipSameNameLocationSize === true, "Expected skipSameNameLocationSize flag in dry-run result");
    assert(skipDryRun.operations.wouldConflict.length === 0, "Expected same-size changed file to be removed from conflict operations");
    assert(skipDryRun.before.unfilteredPlan.changed.includes(relativePath), "Expected unfiltered plan to preserve the original changed file");
    assert(skipDryRun.before.plan.changed.length === 0, "Expected filtered plan to skip the same-size changed file");
    const skipped = skipDryRun.operations.skipped.sameNameLocationSize;
    assert(Array.isArray(skipped) && skipped.length === 1, "Expected one same-name/location/size skipped record");
    assert(skipped[0].relativePath === relativePath, "Expected skipped record path to match");
    assert(skipped[0].fileName === "same-size.jpg", "Expected skipped record to include file name");
    assert(skipped[0].location === "Shared/photos", "Expected skipped record to include location");
    assert(skipped[0].size === 5 && skipped[0].reason === "same_name_location_size", "Expected skipped record size and reason");
  } finally {
    await fs.rm(runtimeRoot, { recursive: true, force: true });
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

  await testSkipSameNameLocationSizeOption();

  console.log("PASS");
}

main().catch((err) => {
  console.error("Sync plan test failed:", err);
  process.exitCode = 1;
});
