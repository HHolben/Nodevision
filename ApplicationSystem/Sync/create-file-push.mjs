// Nodevision/ApplicationSystem/Sync/create-file-push.mjs
// This script creates a signed benchmark file-push request from local identity using a SyncTest-relative path and UTF-8 text content so it can be submitted to /api/peer/file-push.

import { Buffer } from "node:buffer";

import { createSignedFilePush } from "./PeerFileTransfer.mjs";

async function main() {
  const [relativePath, textContent, contentType] = process.argv.slice(2);
  if (!relativePath || textContent === undefined) {
    throw new Error("Usage: node ApplicationSystem/Sync/create-file-push.mjs SyncTest/hello-from-a.txt \"Hello from A\"");
  }

  const contentBase64 = Buffer.from(String(textContent), "utf8").toString("base64");
  const signed = await createSignedFilePush({
    relativePath,
    contentBase64,
    contentType,
  });

  process.stdout.write(`${JSON.stringify(signed, null, 2)}\n`);
}

main().catch((err) => {
  process.stderr.write(`${err?.message || String(err)}\n`);
  process.exitCode = 1;
});
