// Nodevision/ApplicationSystem/Sync/sync-resolve-conflict.mjs
// This script performs manual SyncTest conflict resolution by safely applying a chosen action, preserving data through backups/resolved archives, and returning JSON-only success output.

import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveConflict } from "./ConflictResolution.mjs";

const USAGE = "Usage: node ApplicationSystem/Sync/sync-resolve-conflict.mjs SyncTest/<target-file> SyncTest/.conflicts/<conflict-file> <use-conflict|keep-local>";

function resolveRuntimeRoot() {
  if (process.env.NODEVISION_ROOT) return path.resolve(process.env.NODEVISION_ROOT);
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(moduleDir, "..", "..");
}

async function main() {
  const targetRelativePath = process.argv[2];
  const conflictRelativePath = process.argv[3];
  const action = process.argv[4];

  if (!targetRelativePath || !conflictRelativePath || !action) {
    process.stderr.write(`${USAGE}\n`);
    process.exitCode = 1;
    return;
  }

  try {
    const notebookDir = path.resolve(resolveRuntimeRoot(), "Notebook");
    const result = await resolveConflict({
      notebookDir,
      targetRelativePath,
      conflictRelativePath,
      action,
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (err) {
    process.stderr.write(`${err?.message || String(err)}\n`);
    process.exitCode = 1;
  }
}

main();
