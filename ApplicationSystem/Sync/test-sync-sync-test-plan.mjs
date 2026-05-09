// Nodevision/ApplicationSystem/Sync/test-sync-sync-test-plan.mjs
// This script validates one-command SyncTest convergence planning by checking onlyRemote pulls, changed conflict handling, skipped categories, invalid-path rejection, and after-plan expectations.

import { compareManifests } from "./SyncManifest.mjs";
import { buildSyncConvergenceSelection } from "./sync-sync-test.mjs";

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

function createManifest(fileHashes) {
  return {
    scope: "SyncTest",
    generatedAt: "2026-05-09T18:00:00.000Z",
    files: Object.entries(fileHashes).map(([relativePath, sha256]) => ({
      relativePath,
      size: 1,
      mtimeMs: 1,
      sha256,
    })),
  };
}

async function main() {
  const localBefore = createManifest({
    "SyncTest/only-local.txt": "sha-local-only",
    "SyncTest/changed.txt": "sha-changed-local",
    "SyncTest/same.txt": "sha-same",
  });
  const remote = createManifest({
    "SyncTest/only-remote.txt": "sha-remote-only",
    "SyncTest/changed.txt": "sha-changed-remote",
    "SyncTest/same.txt": "sha-same",
  });

  const beforePlan = await compareManifests(localBefore, remote);
  const beforeSelection = buildSyncConvergenceSelection(beforePlan);

  assert(
    JSON.stringify(beforeSelection.pullQueue) === JSON.stringify(["SyncTest/only-remote.txt"]),
    "Expected onlyRemote files to be selected for pull",
  );
  assert(
    JSON.stringify(beforeSelection.conflictQueue) === JSON.stringify(["SyncTest/changed.txt"]),
    "Expected changed files to be selected for conflict handling",
  );
  assert(
    JSON.stringify(beforeSelection.skipped.onlyLocal) === JSON.stringify(["SyncTest/only-local.txt"]),
    "Expected onlyLocal files to be skipped",
  );
  assert(
    JSON.stringify(beforeSelection.skipped.same) === JSON.stringify(["SyncTest/same.txt"]),
    "Expected same files to be skipped",
  );

  const localAfter = createManifest({
    "SyncTest/only-local.txt": "sha-local-only",
    "SyncTest/changed.txt": "sha-changed-local",
    "SyncTest/same.txt": "sha-same",
    "SyncTest/only-remote.txt": "sha-remote-only",
  });
  const afterPlan = await compareManifests(localAfter, remote);

  assert(afterPlan.onlyRemote.length === 0, "Expected onlyRemote to be empty after pulling onlyRemote files");
  assert(
    JSON.stringify(afterPlan.changed) === JSON.stringify(["SyncTest/changed.txt"]),
    "Expected changed file to remain changed because local original is preserved",
  );
  assert(
    JSON.stringify(afterPlan.onlyLocal) === JSON.stringify(["SyncTest/only-local.txt"]),
    "Expected onlyLocal file to remain local-only",
  );
  assert(
    JSON.stringify(afterPlan.same) === JSON.stringify(["SyncTest/only-remote.txt", "SyncTest/same.txt"]),
    "Expected pulled onlyRemote file and same file to appear in same after pull",
  );

  expectThrow("invalid path in onlyRemote", () => {
    buildSyncConvergenceSelection({
      onlyLocal: [],
      onlyRemote: ["../evil.txt"],
      changed: [],
      same: [],
    });
  });

  expectThrow("absolute path in changed", () => {
    buildSyncConvergenceSelection({
      onlyLocal: [],
      onlyRemote: [],
      changed: ["/absolute/path"],
      same: [],
    });
  });

  expectThrow("backslash path in same", () => {
    buildSyncConvergenceSelection({
      onlyLocal: [],
      onlyRemote: [],
      changed: [],
      same: ["SyncTest\\bad.txt"],
    });
  });

  console.log("PASS");
}

main().catch((err) => {
  console.error("Sync-sync-test plan test failed:", err);
  process.exitCode = 1;
});
