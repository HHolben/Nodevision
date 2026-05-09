// Nodevision/ApplicationSystem/Sync/test-pull-missing-plan.mjs
// This script validates missing-file pull selection by ensuring only onlyRemote paths are queued while changed, same, and onlyLocal paths are skipped with strict SyncTest path validation.

import { buildMissingPullSelection } from "./pull-missing-sync-test-files.mjs";

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

async function main() {
  const selection = buildMissingPullSelection({
    onlyLocal: ["SyncTest/local-only.txt"],
    onlyRemote: ["SyncTest/remote-only.txt", "SyncTest/sub/remote-two.txt"],
    changed: ["SyncTest/changed.txt"],
    same: ["SyncTest/same.txt"],
  });

  assert(
    JSON.stringify(selection.pullQueue) === JSON.stringify(["SyncTest/remote-only.txt", "SyncTest/sub/remote-two.txt"]),
    "Expected only onlyRemote files in pull queue",
  );
  assert(
    JSON.stringify(selection.skipped.changed) === JSON.stringify(["SyncTest/changed.txt"]),
    "Expected changed files to be skipped",
  );
  assert(
    JSON.stringify(selection.skipped.same) === JSON.stringify(["SyncTest/same.txt"]),
    "Expected same files to be skipped",
  );
  assert(
    JSON.stringify(selection.skipped.onlyLocal) === JSON.stringify(["SyncTest/local-only.txt"]),
    "Expected onlyLocal files to be skipped",
  );

  expectThrow("invalid relative path in onlyRemote", () => {
    buildMissingPullSelection({
      onlyLocal: [],
      onlyRemote: ["../evil.txt"],
      changed: [],
      same: [],
    });
  });

  expectThrow("absolute path in changed", () => {
    buildMissingPullSelection({
      onlyLocal: [],
      onlyRemote: [],
      changed: ["/absolute/path"],
      same: [],
    });
  });

  expectThrow("backslash path in same", () => {
    buildMissingPullSelection({
      onlyLocal: [],
      onlyRemote: [],
      changed: [],
      same: ["SyncTest\\bad.txt"],
    });
  });

  console.log("PASS");
}

main().catch((err) => {
  console.error("Pull-missing plan test failed:", err);
  process.exitCode = 1;
});
