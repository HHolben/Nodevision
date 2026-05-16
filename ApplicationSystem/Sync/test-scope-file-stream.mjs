// Nodevision/ApplicationSystem/Sync/test-scope-file-stream.mjs
// This script validates signed scoped file streaming guards and verifies streamed downloads finalize from temp path to final target safely.

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import express from "express";
import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";

import { ensureDeviceIdentity, signMessage } from "./DeviceIdentity.mjs";
import { addTrustedPeer } from "./TrustedPeers.mjs";
import { saveSyncScopes } from "./SyncScopes.mjs";
import { pullScopeFileStream } from "./pull-scope-file-stream.mjs";
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
  const sourceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "nodevision-scope-stream-source-"));
  const destRoot = await fs.mkdtemp(path.join(os.tmpdir(), "nodevision-scope-stream-dest-"));
  const sourceNotebookDir = path.resolve(sourceRoot, "Notebook");
  const destNotebookDir = path.resolve(destRoot, "Notebook");
  await fs.mkdir(path.resolve(sourceNotebookDir, "Shared"), { recursive: true });
  await fs.mkdir(path.resolve(destNotebookDir, "Shared"), { recursive: true });

  await saveSyncScopes(["SyncTest", "Shared"], { runtimeRoot: sourceRoot });
  await saveSyncScopes(["SyncTest", "Shared"], { runtimeRoot: destRoot });

  const sourceIdentity = await ensureDeviceIdentity({ runtimeRoot: sourceRoot, deviceName: "stream-source" });
  const destIdentity = await ensureDeviceIdentity({ runtimeRoot: destRoot, deviceName: "stream-dest" });
  await addTrustedPeer(
    {
      deviceId: destIdentity.deviceId,
      deviceName: destIdentity.deviceName,
      publicKey: destIdentity.publicKey,
    },
    { runtimeRoot: sourceRoot },
  );

  const relativePath = "Shared/big-stream.bin";
  const sourceFilePath = path.resolve(sourceNotebookDir, "Shared", "big-stream.bin");
  const data = Buffer.alloc(320 * 1024, 0x42);
  await fs.writeFile(sourceFilePath, data);

  const serverHandle = await startPeerServer({ runtimeRoot: sourceRoot, notebookDir: sourceNotebookDir });
  try {
    const traversalMessage = {
      type: "nodevision.peer.scopeFileRequest",
      version: 1,
      deviceId: destIdentity.deviceId,
      deviceName: destIdentity.deviceName,
      timestamp: new Date().toISOString(),
      scope: "Shared",
      relativePath: "Shared/../blocked.bin",
    };
    const signedTraversal = await signMessage(traversalMessage, { runtimeRoot: destRoot });
    const traversalUrl = new URL("/api/peer/scope/file-stream", `${serverHandle.peerUrl}/`);
    traversalUrl.searchParams.set("payload", signedTraversal.payload);
    traversalUrl.searchParams.set("signatureBase64", signedTraversal.signatureBase64);
    const traversalResponse = await fetch(traversalUrl.toString());
    assert(traversalResponse.status === 400, "Expected path traversal stream request to be rejected");

    const pullReport = await pullScopeFileStream({
      peerUrl: serverHandle.peerUrl,
      scope: "Shared",
      relativePath,
      runtimeRoot: destRoot,
    });
    assert(pullReport.ok === true, "Expected stream pull to succeed");
    assert(pullReport.mode === "created", "Expected first stream pull to create target file");
    assert(pullReport.bytesDownloaded === data.length, "Expected byte count to match source");

    const targetPath = path.resolve(destNotebookDir, "Shared", "big-stream.bin");
    const tempPath = `${targetPath}.nodevision-download`;
    const targetBuffer = await fs.readFile(targetPath);
    assert(sha256OfBuffer(targetBuffer) === sha256OfBuffer(data), "Expected streamed file content to match source");
    let tempExists = true;
    try {
      await fs.stat(tempPath);
    } catch (err) {
      if (err?.code === "ENOENT") tempExists = false;
      else throw err;
    }
    assert(tempExists === false, "Expected temp download file to be removed after finalize");
  } finally {
    await serverHandle.close();
  }

  console.log("PASS");
}

main().catch((err) => {
  console.error("Scope file stream test failed:", err);
  process.exitCode = 1;
});
