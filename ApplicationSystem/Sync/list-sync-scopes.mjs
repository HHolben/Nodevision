// Nodevision/ApplicationSystem/Sync/list-sync-scopes.mjs
// This script prints the currently configured safe Notebook sync scopes so operators can inspect allowed scope policy without exposing filesystem paths or broadening sync access.

import { loadSyncScopes } from "./SyncScopes.mjs";

async function main() {
  try {
    const result = await loadSyncScopes();
    process.stdout.write(`${JSON.stringify({ ok: true, syncScopes: result.syncScopes }, null, 2)}\n`);
  } catch (err) {
    process.stderr.write(`${err?.message || String(err)}\n`);
    process.exitCode = 1;
  }
}

main();
