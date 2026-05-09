// Nodevision/ApplicationSystem/Sync/test-sync-two-way-plan.mjs
// This script validates two-way SyncTest convergence planning by checking pull/push/conflict queues, skipped same files, after-plan expectations, and path-safety rejection.

import { compareManifests } from "./SyncManifest.mjs";
import { buildTwoWaySyncSelection } from "./sync-sync-test-two-way.mjs";

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
    "SyncTest/only-local.txt": "sha-only-local",
    "SyncTest/changed.txt": "sha-local-changed",
    "SyncTest/same.txt": "sha-same",
  });
  const remoteBefore = createManifest({
    "SyncTest/only-remote.txt": "sha-only-remote",
    "SyncTest/changed.txt": "sha-remote-changed",
    "SyncTest/same.txt": "sha-same",
  });

  const beforePlan = await compareManifests(localBefore, remoteBefore);
  const selection = buildTwoWaySyncSelection(beforePlan);

  assert(
    JSON.stringify(selection.pullQueue) === JSON.stringify(["SyncTest/only-remote.txt"]),
    "Expected onlyRemote to be selected for pull",
  );
  assert(
    JSON.stringify(selection.pushQueue) === JSON.stringify(["SyncTest/only-local.txt"]),
    "Expected onlyLocal to be selected for push",
  );
  assert(
    JSON.stringify(selection.conflictQueue) === JSON.stringify(["SyncTest/changed.txt"]),
    "Expected changed to be selected for conflicts",
  );
  assert(
    JSON.stringify(selection.skipped.same) === JSON.stringify(["SyncTest/same.txt"]),
    "Expected same files to be skipped",
  );

  const localAfter = createManifest({
    "SyncTest/only-local.txt": "sha-only-local",
    "SyncTest/only-remote.txt": "sha-only-remote",
    "SyncTest/changed.txt": "sha-local-changed",
    "SyncTest/same.txt": "sha-same",
  });
  const remoteAfter = createManifest({
    "SyncTest/only-local.txt": "sha-only-local",
    "SyncTest/only-remote.txt": "sha-only-remote",
    "SyncTest/changed.txt": "sha-remote-changed",
    "SyncTest/same.txt": "sha-same",
  });
  const afterPlan = await compareManifests(localAfter, remoteAfter);

  assert(afterPlan.onlyRemote.length === 0, "Expected onlyRemote to clear after pull");
  assert(afterPlan.onlyLocal.length === 0, "Expected onlyLocal to clear after push");
  assert(
    JSON.stringify(afterPlan.changed) === JSON.stringify(["SyncTest/changed.txt"]),
    "Expected changed to remain changed because originals are preserved",
  );
  assert(
    JSON.stringify(afterPlan.same) === JSON.stringify(["SyncTest/only-local.txt", "SyncTest/only-remote.txt", "SyncTest/same.txt"]),
    "Expected pulled/pushed/same files to align in same",
  );

  expectThrow("invalid onlyRemote path", () => {
    buildTwoWaySyncSelection({
      onlyLocal: [],
      onlyRemote: ["../evil.txt"],
      changed: [],
      same: [],
    });
  });

  expectThrow("invalid onlyLocal path", () => {
    buildTwoWaySyncSelection({
      onlyLocal: ["/absolute/path"],
      onlyRemote: [],
      changed: [],
      same: [],
    });
  });

  expectThrow("invalid changed path", () => {
    buildTwoWaySyncSelection({
      onlyLocal: [],
      onlyRemote: [],
      changed: ["SyncTest\\bad.txt"],
      same: [],
    });
  });

  console.log("PASS");
}

main().catch((err) => {
  console.error("Sync two-way plan test failed:", err);
  process.exitCode = 1;
});
