// Nodevision/ApplicationSystem/Sync/build-scope-manifest.mjs
// This script builds and prints a safe manifest for one configured Notebook scope, hashing only scope-contained files and excluding hidden/conflict folders.

import { buildScopeManifest } from "./SyncScopes.mjs";

const USAGE = "Usage: node ApplicationSystem/Sync/build-scope-manifest.mjs <scope>";

async function main() {
  const scope = process.argv[2];
  if (!scope) {
    process.stderr.write(`${USAGE}\n`);
    process.exitCode = 1;
    return;
  }

  try {
    const manifest = await buildScopeManifest({
      notebookDir: undefined,
      scope,
    });
    process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
  } catch (err) {
    process.stderr.write(`${err?.message || String(err)}\n`);
    process.exitCode = 1;
  }
}

main();
