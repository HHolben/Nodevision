// Nodevision/ApplicationSystem/Sync/test-sync-scope-two-way-stream.mjs
// This script validates scoped two-way sync routes large onlyLocal files through stream push and preserves 0-byte JSON push behavior.

import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import express from "express";
import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";

import { ensureDeviceIdentity } from "./DeviceIdentity.mjs";
import { addTrustedPeer } from "./TrustedPeers.mjs";
import { saveSyncScopes } from "./SyncScopes.mjs";
import { runScopeSyncTwoWay } from "./sync-scope-two-way.mjs";
import { MAX_FILE_PUSH_BYTES } from "./PeerFileTransfer.mjs";
import { registerPeerRoutes } from "../server/routes/peerRoutes.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256OfBuffer(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function startPeerServer(ctx) {
  const app = express();
  app.use(express.json({ limit: "50mb" }));
  registerPeerRoutes(app, ctx);
  const server = http.createServer(app);
  const port = await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string" || !Number.isInteger(address.port)) {
        reject(new Error("Failed to bind peer test server"));
        return;
      }
      resolve(address.port);
    });
  });
  return {
    server,
    peerUrl: `http://127.0.0.1:${port}`,
    async close() {
      await new Promise((resolve) => server.close(() => resolve()));
    },
  };
}

async function main() {
  const sourceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "nodevision-scope-two-way-source-"));
  const destRoot = await fs.mkdtemp(path.join(os.tmpdir(), "nodevision-scope-two-way-dest-"));
  const sourceNotebookDir = path.resolve(sourceRoot, "Notebook");
  const destNotebookDir = path.resolve(destRoot, "Notebook");
  await fs.mkdir(path.resolve(sourceNotebookDir, "Shared"), { recursive: true });
  await fs.mkdir(path.resolve(destNotebookDir, "Shared"), { recursive: true });

  await saveSyncScopes(["SyncTest", "Shared"], { runtimeRoot: sourceRoot });
  await saveSyncScopes(["SyncTest", "Shared"], { runtimeRoot: destRoot });

  const sourceIdentity = await ensureDeviceIdentity({ runtimeRoot: sourceRoot, deviceName: "stream-source-two-way" });
  await ensureDeviceIdentity({ runtimeRoot: destRoot, deviceName: "stream-dest-two-way" });
  await addTrustedPeer({
    deviceId: sourceIdentity.deviceId,
    deviceName: sourceIdentity.deviceName,
    publicKey: sourceIdentity.publicKey,
  }, { runtimeRoot: destRoot });

  const largeRelativePath = "Shared/large-local.bin";
  const largeLocalPath = path.resolve(sourceNotebookDir, "Shared", "large-local.bin");
  const largeData = Buffer.alloc(MAX_FILE_PUSH_BYTES + 4096, 0x5a);
  await fs.writeFile(largeLocalPath, largeData);

  const peerServer = await startPeerServer({ runtimeRoot: destRoot, notebookDir: destNotebookDir });
  try {
    const firstSync = await runScopeSyncTwoWay({
      peerUrl: peerServer.peerUrl,
      scope: "Shared",
      runtimeRoot: sourceRoot,
      dryRun: false,
    });
    assert(firstSync.ok === true, "Expected first sync to succeed");
    const largePush = firstSync?.operations?.pushed?.find((item) => item?.relativePath === largeRelativePath);
    assert(largePush, "Expected large file to be pushed");
    assert(largePush.transferMode === "stream", "Expected large file push transferMode=stream");
    assert(largePush.bytes === largeData.length, "Expected large stream push byte count");

    const largeRemoteBuffer = await fs.readFile(path.resolve(destNotebookDir, "Shared", "large-local.bin"));
    assert(sha256OfBuffer(largeRemoteBuffer) === sha256OfBuffer(largeData), "Expected large stream push content to match");

    const zeroRelativePath = "Shared/zero-local.bin";
    await fs.writeFile(path.resolve(sourceNotebookDir, "Shared", "zero-local.bin"), Buffer.alloc(0));
    const secondSync = await runScopeSyncTwoWay({
      peerUrl: peerServer.peerUrl,
      scope: "Shared",
      runtimeRoot: sourceRoot,
      dryRun: false,
    });
    assert(secondSync.ok === true, "Expected second sync to succeed");
    const zeroPush = secondSync?.operations?.pushed?.find((item) => item?.relativePath === zeroRelativePath);
    assert(zeroPush, "Expected 0-byte file to be pushed");
    assert(Number(zeroPush.bytes) === 0, "Expected 0-byte push byte count");
    assert(!zeroPush.transferMode || zeroPush.transferMode === "json", "Expected 0-byte push to stay on JSON path");

    const zeroStat = await fs.stat(path.resolve(destNotebookDir, "Shared", "zero-local.bin"));
    assert(zeroStat.isFile(), "Expected 0-byte remote file");
    assert(zeroStat.size === 0, "Expected remote 0-byte file size");
  } finally {
    await peerServer.close();
  }

  console.log("PASS");
}

main().catch((err) => {
  console.error("Sync scope two-way stream test failed:", err);
  process.exitCode = 1;
});
