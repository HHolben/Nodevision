// Nodevision/ApplicationSystem/Sync/test-conflict-resolution.mjs
// This script verifies manual SyncTest conflict resolution safety by testing use-conflict and keep-local behavior, backup/archive creation, and strict rejection of unsafe path inputs.

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  validateSyncTestConflictPaths,
  buildConflictBackupRelativePath,
  buildResolvedConflictRelativePath,
  resolveConflict,
} from "./ConflictResolution.mjs";

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

async function writeNotebookFile(notebookDir, relativePath, content) {
  const absolutePath = path.resolve(notebookDir, relativePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, content);
}

async function exists(absolutePath) {
  try {
    await fs.access(absolutePath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const timestamp = "2026-05-09T20:18:30.334Z";

  const backupPath = buildConflictBackupRelativePath({
    targetRelativePath: "SyncTest/conflict-demo.txt",
    timestamp,
  });
  assert(
    backupPath === "SyncTest/.conflict-backups/conflict-demo.local-before-resolution.2026-05-09T20-18-30-334Z.txt",
    "Expected backup path format",
  );

  const nestedBackupPath = buildConflictBackupRelativePath({
    targetRelativePath: "SyncTest/folder/notes.txt",
    timestamp,
  });
  assert(
    nestedBackupPath === "SyncTest/.conflict-backups/folder/notes.local-before-resolution.2026-05-09T20-18-30-334Z.txt",
    "Expected nested backup path format",
  );

  const resolvedPath = buildResolvedConflictRelativePath({
    conflictRelativePath: "SyncTest/.conflicts/conflict-demo.from-peer.timestamp.txt",
    timestamp,
  });
  assert(
    resolvedPath === "SyncTest/.resolved-conflicts/conflict-demo.from-peer.timestamp.resolved-2026-05-09T20-18-30-334Z.txt",
    "Expected resolved conflict path format",
  );

  validateSyncTestConflictPaths({
    targetRelativePath: "SyncTest/conflict-demo.txt",
    conflictRelativePath: "SyncTest/.conflicts/conflict-demo.from-peer.timestamp.txt",
  });

  expectThrow("absolute path", () => {
    validateSyncTestConflictPaths({
      targetRelativePath: "/absolute/path.txt",
      conflictRelativePath: "SyncTest/.conflicts/x.txt",
    });
  });

  expectThrow("path traversal", () => {
    validateSyncTestConflictPaths({
      targetRelativePath: "SyncTest/../evil.txt",
      conflictRelativePath: "SyncTest/.conflicts/x.txt",
    });
  });

  expectThrow("backslash path", () => {
    validateSyncTestConflictPaths({
      targetRelativePath: "SyncTest\\evil.txt",
      conflictRelativePath: "SyncTest/.conflicts/x.txt",
    });
  });

  expectThrow("target in conflicts", () => {
    validateSyncTestConflictPaths({
      targetRelativePath: "SyncTest/.conflicts/already.txt",
      conflictRelativePath: "SyncTest/.conflicts/x.txt",
    });
  });

  expectThrow("conflict outside conflicts", () => {
    validateSyncTestConflictPaths({
      targetRelativePath: "SyncTest/normal.txt",
      conflictRelativePath: "SyncTest/normal.txt",
    });
  });

  const notebookDir = await fs.mkdtemp(path.join(os.tmpdir(), "nodevision-conflict-resolution-"));

  const targetA = "SyncTest/conflict-demo.txt";
  const conflictA = "SyncTest/.conflicts/conflict-demo.from-peer.timestamp.txt";
  await writeNotebookFile(notebookDir, targetA, "local content A");
  await writeNotebookFile(notebookDir, conflictA, "remote content A");

  const resultA = await resolveConflict({
    notebookDir,
    targetRelativePath: targetA,
    conflictRelativePath: conflictA,
    action: "use-conflict",
  });

  assert(resultA.ok === true, "use-conflict should return ok=true");
  assert(resultA.action === "use-conflict", "use-conflict should return action");
  assert(resultA.targetRelativePath === targetA, "use-conflict target path mismatch");
  assert(
    String(resultA.backupRelativePath || "").startsWith("SyncTest/.conflict-backups/"),
    "use-conflict should create backup path",
  );
  assert(
    String(resultA.resolvedConflictRelativePath || "").startsWith("SyncTest/.resolved-conflicts/"),
    "use-conflict should create resolved conflict path",
  );

  const targetAPath = path.resolve(notebookDir, targetA);
  const conflictAPath = path.resolve(notebookDir, conflictA);
  const backupAPath = path.resolve(notebookDir, resultA.backupRelativePath);
  const resolvedAPath = path.resolve(notebookDir, resultA.resolvedConflictRelativePath);

  assert((await fs.readFile(targetAPath, "utf8")) === "remote content A", "use-conflict should replace target content");
  assert((await fs.readFile(backupAPath, "utf8")) === "local content A", "use-conflict should backup local target");
  assert((await fs.readFile(resolvedAPath, "utf8")) === "remote content A", "use-conflict should move conflict content");
  assert(!(await exists(conflictAPath)), "use-conflict should move conflict file out of .conflicts");

  const targetB = "SyncTest/folder/notes.txt";
  const conflictB = "SyncTest/.conflicts/folder/notes.from-peer.timestamp.txt";
  await writeNotebookFile(notebookDir, targetB, "local content B");
  await writeNotebookFile(notebookDir, conflictB, "remote content B");

  const resultB = await resolveConflict({
    notebookDir,
    targetRelativePath: targetB,
    conflictRelativePath: conflictB,
    action: "keep-local",
  });

  assert(resultB.ok === true, "keep-local should return ok=true");
  assert(resultB.action === "keep-local", "keep-local should return action");
  assert(resultB.targetRelativePath === targetB, "keep-local target path mismatch");
  assert(resultB.backupRelativePath === null, "keep-local should not create a backup path");
  assert(
    String(resultB.resolvedConflictRelativePath || "").startsWith("SyncTest/.resolved-conflicts/"),
    "keep-local should create resolved conflict path",
  );

  const targetBPath = path.resolve(notebookDir, targetB);
  const conflictBPath = path.resolve(notebookDir, conflictB);
  const resolvedBPath = path.resolve(notebookDir, resultB.resolvedConflictRelativePath);

  assert((await fs.readFile(targetBPath, "utf8")) === "local content B", "keep-local should preserve local target");
  assert((await fs.readFile(resolvedBPath, "utf8")) === "remote content B", "keep-local should move conflict content");
  assert(!(await exists(conflictBPath)), "keep-local should move conflict file out of .conflicts");

  console.log("PASS");
}

main().catch((err) => {
  console.error("Conflict resolution test failed:", err);
  process.exitCode = 1;
});
