// Nodevision/ApplicationSystem/Sync/create-manifest-request.mjs
// This script creates a signed SyncTest manifest request using local device identity so trusted peers can safely request hash listings under Notebook/SyncTest.

import { createSignedManifestRequest } from "./SyncManifest.mjs";

async function main() {
  const signed = await createSignedManifestRequest();
  process.stdout.write(`${JSON.stringify(signed, null, 2)}\n`);
}

main().catch((err) => {
  process.stderr.write(`${err?.message || String(err)}\n`);
  process.exitCode = 1;
});
