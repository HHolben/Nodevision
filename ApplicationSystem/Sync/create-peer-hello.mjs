// Nodevision/ApplicationSystem/Sync/create-peer-hello.mjs
// This script prints a local signed Nodevision peer hello object so manual curl tests can submit a canonical payload and signature to another instance.

import { createSignedHello } from "./PeerHello.mjs";

async function main() {
  const signedHello = await createSignedHello();
  process.stdout.write(`${JSON.stringify(signedHello, null, 2)}\n`);
}

main().catch((err) => {
  process.stderr.write(`${err?.message || String(err)}\n`);
  process.exitCode = 1;
});
