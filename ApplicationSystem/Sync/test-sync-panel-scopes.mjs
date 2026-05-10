// Nodevision/ApplicationSystem/Sync/test-sync-panel-scopes.mjs
// This script validates sync-panel scope helper behavior: safe scope list/update, safe candidate folder listing, and configured-scope readiness assumptions.

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { addSyncScope, listCandidateNotebookFolders, loadSyncScopes, removeSyncScope, validateSyncScope } from "./SyncScopes.mjs";

const assert = (c, m) => { if (!c) throw new Error(m); };

async function main() {
  const runtimeRoot = await fs.mkdtemp(path.join(os.tmpdir(), "nodevision-sync-panel-scopes-"));
  const notebookDir = path.resolve(runtimeRoot, "Notebook");
  await fs.mkdir(path.resolve(notebookDir, "Shared"), { recursive: true });
  await fs.mkdir(path.resolve(notebookDir, "Projects"), { recursive: true });
  await fs.mkdir(path.resolve(notebookDir, ".hidden"), { recursive: true });

  await addSyncScope("Shared", { runtimeRoot });
  let scopes = await loadSyncScopes({ runtimeRoot });
  assert(scopes.syncScopes.includes("Shared"), "scope add behavior");

  scopes = await removeSyncScope("Shared", { runtimeRoot });
  assert(!scopes.syncScopes.includes("Shared"), "scope remove behavior");

  const folders = await listCandidateNotebookFolders({ runtimeRoot });
  assert(folders.every((f) => !path.isAbsolute(f.relativePath)), "no absolute folder paths");
  assert(!folders.some((f) => f.relativePath.startsWith(".")), "hidden folder excluded");

  let invalidBlocked = false;
  try { validateSyncScope("../evil"); } catch { invalidBlocked = true; }
  assert(invalidBlocked, "invalid scope rejected");

  assert(scopes.syncScopes.includes("SyncTest"), "default SyncTest remains enabled");
  assert(validateSyncScope("Shared") === "Shared", "configured scope accepted");
  assert(validateSyncScope("Projects/sub") === "Projects/sub", "nested scope accepted");

  console.log("PASS");
}

main().catch((err) => { console.error("Sync panel scopes test failed:", err); process.exitCode = 1; });
