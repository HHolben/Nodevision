// Nodevision/ApplicationSystem/Sync/test-sync-scopes.mjs
// This script validates sync scope policy, persistence helpers, candidate folder filtering, scope-safe path resolution, manifest exclusions, and scope manifest comparison behavior.

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  addSyncScope,
  buildScopeManifest,
  compareScopeManifests,
  isPathInsideScope,
  listCandidateNotebookFolders,
  loadSyncScopes,
  removeSyncScope,
  resolveScopeNotebookPath,
  saveSyncScopes,
  validateSyncScope,
} from "./SyncScopes.mjs";

const assert = (c, m) => { if (!c) throw new Error(m); };
const expectThrow = (label, fn) => { let ok = false; try { fn(); } catch { ok = true; } assert(ok, `${label} should throw`); };
const writeFile = async (root, rel, content) => { const p = path.resolve(root, rel); await fs.mkdir(path.dirname(p), { recursive: true }); await fs.writeFile(p, content); };

async function main() {
  assert(validateSyncScope("SyncTest") === "SyncTest", "valid scope");
  assert(validateSyncScope("Projects/demo") === "Projects/demo", "nested scope");
  expectThrow("absolute", () => validateSyncScope("/x"));
  expectThrow("traversal", () => validateSyncScope("../x"));
  expectThrow("backslash", () => validateSyncScope("a\\b"));
  expectThrow("hidden", () => validateSyncScope(".hidden"));
  expectThrow("system", () => validateSyncScope("ApplicationSystem"));

  const runtimeRoot = await fs.mkdtemp(path.join(os.tmpdir(), "nodevision-sync-scopes-root-"));
  const notebookDir = path.resolve(runtimeRoot, "Notebook");

  const defaults = await loadSyncScopes({ runtimeRoot });
  assert(JSON.stringify(defaults.syncScopes) === JSON.stringify(["SyncTest"]), "default scopes");

  const saved = await saveSyncScopes(["SyncTest", "Shared", "Shared"], { runtimeRoot });
  assert(JSON.stringify(saved.syncScopes) === JSON.stringify(["SyncTest", "Shared"]), "dedupe on save");
  const added = await addSyncScope("Projects", { runtimeRoot });
  assert(added.syncScopes.includes("Projects"), "add scope");
  const removed = await removeSyncScope("Projects", { runtimeRoot });
  assert(!removed.syncScopes.includes("Projects"), "remove scope");
  let blocked = false; try { await removeSyncScope("SyncTest", { runtimeRoot }); } catch { blocked = true; }
  assert(blocked, "cannot remove SyncTest");

  await fs.mkdir(path.resolve(notebookDir, "Shared"), { recursive: true });
  await fs.mkdir(path.resolve(notebookDir, "Projects"), { recursive: true });
  await fs.mkdir(path.resolve(notebookDir, ".private"), { recursive: true });
  await fs.mkdir(path.resolve(notebookDir, "ApplicationSystem"), { recursive: true });
  const candidates = await listCandidateNotebookFolders({ runtimeRoot });
  assert(candidates.some((f) => f.relativePath === "Shared"), "Shared candidate");
  assert(candidates.some((f) => f.relativePath === "Projects"), "Projects candidate");
  assert(!candidates.some((f) => f.relativePath.startsWith(".")), "hidden excluded");
  assert(!candidates.some((f) => path.isAbsolute(f.relativePath)), "relative only");

  const sharedScopePath = resolveScopeNotebookPath({ notebookDir, scope: "Shared" });
  assert(sharedScopePath === path.resolve(notebookDir, "Shared"), "scope resolve");

  await writeFile(notebookDir, "Shared/visible.txt", "visible");
  await writeFile(notebookDir, "Shared/.hidden.txt", "hidden");
  await writeFile(notebookDir, "Shared/.conflicts/skip.txt", "skip");
  await writeFile(notebookDir, "Shared/.resolved-conflicts/skip.txt", "skip");
  await writeFile(notebookDir, "Shared/.conflict-backups/skip.txt", "skip");
  await writeFile(notebookDir, "Shared/sub/visible-two.txt", "visible-two");

  const manifest = await buildScopeManifest({ notebookDir, scope: "Shared" });
  const paths = manifest.files.map((f) => f.relativePath);
  assert(JSON.stringify(paths) === JSON.stringify(["Shared/sub/visible-two.txt", "Shared/visible.txt"]), "manifest exclusion");

  const compared = await compareScopeManifests(
    { scope: "Shared", files: [ { relativePath: "Shared/a.txt", sha256: "a" }, { relativePath: "Shared/c.txt", sha256: "c" } ] },
    { scope: "Shared", files: [ { relativePath: "Shared/b.txt", sha256: "b" }, { relativePath: "Shared/c.txt", sha256: "d" } ] },
  );
  assert(JSON.stringify(compared.onlyLocal) === JSON.stringify(["Shared/a.txt"]), "onlyLocal");
  assert(JSON.stringify(compared.onlyRemote) === JSON.stringify(["Shared/b.txt"]), "onlyRemote");
  assert(JSON.stringify(compared.changed) === JSON.stringify(["Shared/c.txt"]), "changed");

  assert(isPathInsideScope({ relativePath: "Shared/file.txt", scope: "Shared" }) === true, "inside scope");
  assert(isPathInsideScope({ relativePath: "SyncTest/file.txt", scope: "Shared" }) === false, "outside scope");
  console.log("PASS");
}

main().catch((err) => { console.error("Sync scopes test failed:", err); process.exitCode = 1; });
