// Nodevision/ApplicationSystem/Sync/test-conflict-copies.mjs
// This script validates conflict-copy path generation and safe conflict-file persistence to ensure changed SyncTest files produce extension-preserving conflict copies only under SyncTest/.conflicts.

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Buffer } from "node:buffer";

import { buildConflictRelativePath, saveConflictCopy } from "./ConflictCopies.mjs";

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
  const timestamp = "2026-05-09T18:00:00.000Z";
  const simple = buildConflictRelativePath({
    originalRelativePath: "SyncTest/notes.txt",
    peerDeviceId: "nv_dev_abc",
    timestamp,
  });
  assert(
    simple === "SyncTest/.conflicts/notes.from-nv_dev_abc.2026-05-09T18-00-00-000Z.txt",
    "Expected simple conflict path format",
  );

  const nested = buildConflictRelativePath({
    originalRelativePath: "SyncTest/folder/notes.txt",
    peerDeviceId: "nv_dev_abc",
    timestamp,
  });
  assert(
    nested === "SyncTest/.conflicts/folder/notes.from-nv_dev_abc.2026-05-09T18-00-00-000Z.txt",
    "Expected nested conflict path format",
  );

  assert(nested.endsWith(".txt"), "Expected extension preservation for nested path");

  const noExt = buildConflictRelativePath({
    originalRelativePath: "SyncTest/folder/README",
    peerDeviceId: "nv_dev_abc",
    timestamp,
  });
  assert(
    noExt === "SyncTest/.conflicts/folder/README.from-nv_dev_abc.2026-05-09T18-00-00-000Z",
    "Expected no-extension conflict format",
  );

  expectThrow("traversal path", () => {
    buildConflictRelativePath({
      originalRelativePath: "../evil.txt",
      peerDeviceId: "nv_dev_abc",
      timestamp,
    });
  });

  expectThrow("absolute path", () => {
    buildConflictRelativePath({
      originalRelativePath: "/absolute/path",
      peerDeviceId: "nv_dev_abc",
      timestamp,
    });
  });

  expectThrow("conflict-of-conflict path", () => {
    buildConflictRelativePath({
      originalRelativePath: "SyncTest/.conflicts/already-conflict.txt",
      peerDeviceId: "nv_dev_abc",
      timestamp,
    });
  });

  const notebookDir = await fs.mkdtemp(path.join(os.tmpdir(), "nodevision-conflicts-"));
  const saveResult = await saveConflictCopy({
    notebookDir,
    originalRelativePath: "SyncTest/folder/notes.txt",
    contentBuffer: Buffer.from("remote content", "utf8"),
    peerDeviceId: "nv_dev_abc",
    timestamp,
  });

  assert(saveResult.relativePath.startsWith("SyncTest/.conflicts/"), "Conflict copy must live under SyncTest/.conflicts/");
  const conflictRoot = path.resolve(notebookDir, "SyncTest", ".conflicts");
  const savedPath = path.resolve(notebookDir, saveResult.relativePath);
  const relative = path.relative(conflictRoot, savedPath);
  assert(relative && !relative.startsWith("..") && !path.isAbsolute(relative), "Saved path must be inside .conflicts root");

  const savedContent = await fs.readFile(savedPath, "utf8");
  assert(savedContent === "remote content", "Saved conflict content mismatch");
  assert(saveResult.bytes === Buffer.byteLength("remote content"), "Saved conflict byte count mismatch");

  console.log("PASS");
}

main().catch((err) => {
  console.error("Conflict copies test failed:", err);
  process.exitCode = 1;
});
