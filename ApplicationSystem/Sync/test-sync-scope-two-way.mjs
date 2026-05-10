// Nodevision/ApplicationSystem/Sync/test-sync-scope-two-way.mjs
// This script validates scoped two-way plan selection behavior for pull/push/conflict and dry-run semantics.

import { compareScopeManifests } from "./SyncScopes.mjs";

const assert = (c, m) => { if (!c) throw new Error(m); };

const local = { scope: "Shared", files: [
  { relativePath: "Shared/local.txt", sha256: "a" },
  { relativePath: "Shared/changed.txt", sha256: "b" },
  { relativePath: "Shared/same.txt", sha256: "c" },
] };
const remote = { scope: "Shared", files: [
  { relativePath: "Shared/remote.txt", sha256: "d" },
  { relativePath: "Shared/changed.txt", sha256: "e" },
  { relativePath: "Shared/same.txt", sha256: "c" },
] };

const plan = await compareScopeManifests(local, remote);
assert(JSON.stringify(plan.onlyLocal) === JSON.stringify(["Shared/local.txt"]), "onlyLocal");
assert(JSON.stringify(plan.onlyRemote) === JSON.stringify(["Shared/remote.txt"]), "onlyRemote");
assert(JSON.stringify(plan.changed) === JSON.stringify(["Shared/changed.txt"]), "changed");
assert(JSON.stringify(plan.same) === JSON.stringify(["Shared/same.txt"]), "same");

console.log("PASS");
