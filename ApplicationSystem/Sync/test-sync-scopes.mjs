// Nodevision/ApplicationSystem/Sync/test-sync-scopes.mjs
// This script validates configurable sync-scope policy, scope-safe path resolution, manifest exclusions, and scoped manifest comparison behavior for security-first multi-scope synchronization.

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  loadSyncScopes,
  validateSyncScope,
  resolveScopeNotebookPath,
  buildScopeManifest,
  compareScopeManifests,
  isPathInsideScope,
} from "./SyncScopes.mjs";

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

async function writeFile(root, relativePath, content) {
  const targetPath = path.resolve(root, relativePath);
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, content);
}

async function main() {
  assert(validateSyncScope("SyncTest") === "SyncTest", "Expected SyncTest scope validation");
  assert(validateSyncScope("Shared") === "Shared", "Expected Shared scope validation");
  assert(validateSyncScope("Projects/demo") === "Projects/demo", "Expected nested scope validation");

  expectThrow("absolute scope", () => validateSyncScope("/absolute/path"));
  expectThrow("backslash scope", () => validateSyncScope("Shared\\notes"));
  expectThrow("parent traversal scope", () => validateSyncScope("../evil"));
  expectThrow("normalized traversal scope", () => validateSyncScope("Shared/../evil"));
  expectThrow("hidden top-level scope", () => validateSyncScope(".private"));
  expectThrow("ServerSettings scope", () => validateSyncScope("ServerSettings"));
  expectThrow("ApplicationSystem scope", () => validateSyncScope("ApplicationSystem"));
  expectThrow("node_modules scope", () => validateSyncScope("node_modules"));
  expectThrow(".git scope", () => validateSyncScope(".git"));

  const runtimeRoot = await fs.mkdtemp(path.join(os.tmpdir(), "nodevision-sync-scopes-root-"));
  const defaultScopes = await loadSyncScopes({ runtimeRoot });
  assert(
    JSON.stringify(defaultScopes) === JSON.stringify({ syncScopes: ["SyncTest"] }),
    "Expected default sync scope configuration when file is missing",
  );

  const scopedConfigPath = path.resolve(runtimeRoot, "ServerSettings", "Sync", "sync-scopes.json");
  await fs.mkdir(path.dirname(scopedConfigPath), { recursive: true });
  await fs.writeFile(scopedConfigPath, JSON.stringify({
    syncScopes: ["SyncTest", "Shared", "Projects/demo", "Shared"],
  }, null, 2));
  const loadedScopes = await loadSyncScopes({ runtimeRoot });
  assert(
    JSON.stringify(loadedScopes.syncScopes) === JSON.stringify(["SyncTest", "Shared", "Projects/demo"]),
    "Expected loaded, validated, deduplicated sync scopes",
  );

  const notebookDir = path.resolve(runtimeRoot, "Notebook");
  const sharedScopePath = resolveScopeNotebookPath({ notebookDir, scope: "Shared" });
  assert(sharedScopePath === path.resolve(notebookDir, "Shared"), "Expected scope path under Notebook");
  expectThrow("scope resolve escape", () => resolveScopeNotebookPath({ notebookDir, scope: "../escape" }));

  await writeFile(notebookDir, "Shared/visible.txt", "visible");
  await writeFile(notebookDir, "Shared/.hidden.txt", "hidden");
  await writeFile(notebookDir, "Shared/.conflicts/skip.txt", "skip");
  await writeFile(notebookDir, "Shared/.resolved-conflicts/skip.txt", "skip");
  await writeFile(notebookDir, "Shared/.conflict-backups/skip.txt", "skip");
  await writeFile(notebookDir, "Shared/sub/visible-two.txt", "visible-two");
  await writeFile(notebookDir, "Shared/sub/.hidden-two.txt", "hidden-two");
  await writeFile(notebookDir, "Shared/.hidden-dir/skip.txt", "skip");

  const manifest = await buildScopeManifest({ notebookDir, scope: "Shared" });
  const manifestPaths = manifest.files.map((file) => file.relativePath);
  assert(manifest.scope === "Shared", "Expected scope manifest scope");
  assert(
    JSON.stringify(manifestPaths) === JSON.stringify(["Shared/sub/visible-two.txt", "Shared/visible.txt"]),
    "Expected hidden and conflict folders excluded from scope manifest",
  );
  for (const entry of manifest.files) {
    assert(!path.isAbsolute(entry.relativePath), "Manifest relative paths must not be absolute");
  }

  const localManifest = {
    scope: "Shared",
    generatedAt: "2026-05-10T00:00:00.000Z",
    files: [
      { relativePath: "Shared/local-only.txt", size: 1, mtimeMs: 1, sha256: "a" },
      { relativePath: "Shared/changed.txt", size: 1, mtimeMs: 1, sha256: "b" },
      { relativePath: "Shared/same.txt", size: 1, mtimeMs: 1, sha256: "c" },
    ],
  };
  const remoteManifest = {
    scope: "Shared",
    generatedAt: "2026-05-10T00:00:00.000Z",
    files: [
      { relativePath: "Shared/remote-only.txt", size: 1, mtimeMs: 1, sha256: "d" },
      { relativePath: "Shared/changed.txt", size: 1, mtimeMs: 1, sha256: "e" },
      { relativePath: "Shared/same.txt", size: 1, mtimeMs: 1, sha256: "c" },
    ],
  };
  const compared = await compareScopeManifests(localManifest, remoteManifest);
  assert(JSON.stringify(compared.onlyLocal) === JSON.stringify(["Shared/local-only.txt"]), "Expected onlyLocal detection");
  assert(JSON.stringify(compared.onlyRemote) === JSON.stringify(["Shared/remote-only.txt"]), "Expected onlyRemote detection");
  assert(JSON.stringify(compared.changed) === JSON.stringify(["Shared/changed.txt"]), "Expected changed detection");
  assert(JSON.stringify(compared.same) === JSON.stringify(["Shared/same.txt"]), "Expected same detection");

  assert(isPathInsideScope({ relativePath: "Shared/file.txt", scope: "Shared" }) === true, "Expected in-scope path");
  assert(isPathInsideScope({ relativePath: "Projects/demo/file.txt", scope: "Projects/demo" }) === true, "Expected nested in-scope path");
  assert(isPathInsideScope({ relativePath: "SyncTest/file.txt", scope: "Shared" }) === false, "Expected out-of-scope rejection");
  assert(isPathInsideScope({ relativePath: "Shared", scope: "Shared" }) === true, "Expected scope root acceptance");
  expectThrow("isPathInsideScope traversal rejection", () => isPathInsideScope({ relativePath: "Shared/../evil.txt", scope: "Shared" }));

  console.log("PASS");
}

main().catch((err) => {
  console.error("Sync scopes test failed:", err);
  process.exitCode = 1;
});
