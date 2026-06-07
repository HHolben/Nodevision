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
import { saveSyncProtection } from "./SyncProtection.mjs";
import { runScopeSyncTwoWay } from "./sync-scope-two-way.mjs";
import { MAX_FILE_PUSH_BYTES } from "./PeerFileTransfer.mjs";
import { registerPeerRoutes } from "../server/routes/peerRoutes.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256OfBuffer(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function writeScopedFile(notebookDir, relativePath, content) {
  const filePath = path.resolve(notebookDir, relativePath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content);
  return filePath;
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

    const pushConflictRelativePath = "Shared/direction-mode/push-conflict.txt";
    await writeScopedFile(sourceNotebookDir, pushConflictRelativePath, Buffer.from("local push conflict", "utf8"));
    await writeScopedFile(destNotebookDir, pushConflictRelativePath, Buffer.from("remote push conflict", "utf8"));
    const pushConflictSync = await runScopeSyncTwoWay({
      peerUrl: peerServer.peerUrl,
      scope: "Shared",
      runtimeRoot: sourceRoot,
      dryRun: false,
      syncDirection: "push",
    });
    assert(pushConflictSync.ok === true, "Expected push mode conflict sync to succeed against writable peer");
    assert(Array.isArray(pushConflictSync?.operations?.pulled) && pushConflictSync.operations.pulled.length === 0, "Expected push mode to generate no pulls");
    const pushedConflictReport = pushConflictSync?.operations?.conflicts?.find((item) => item?.originalRelativePath === pushConflictRelativePath);
    assert(pushedConflictReport?.direction === "push", "Expected push mode conflict to report direction=push");
    assert(typeof pushedConflictReport?.conflictRelativePath === "string" && pushedConflictReport.conflictRelativePath.includes("/.conflicts/"), "Expected push mode conflict copy on remote peer");
    const remotePushConflictCopy = await fs.readFile(path.resolve(destNotebookDir, "Shared", pushedConflictReport.conflictRelativePath.slice("Shared/".length)), "utf8");
    assert(remotePushConflictCopy === "local push conflict", "Expected remote push conflict copy to contain local content");
    await fs.rm(path.resolve(sourceNotebookDir, pushConflictRelativePath), { force: true });
    await fs.rm(path.resolve(destNotebookDir, pushConflictRelativePath), { force: true });
    await fs.rm(path.resolve(destNotebookDir, "Shared", pushedConflictReport.conflictRelativePath.slice("Shared/".length)), { force: true });

    await saveSyncProtection({ protectedFromPeerWrites: true }, { runtimeRoot: destRoot });

    const pullModeLocalOnly = "Shared/direction-mode/local-only.txt";
    const pullModeRemoteOnly = "Shared/direction-mode/remote-only.txt";
    await writeScopedFile(sourceNotebookDir, pullModeLocalOnly, Buffer.from("local should not push in pull mode", "utf8"));
    await writeScopedFile(destNotebookDir, pullModeRemoteOnly, Buffer.from("remote should pull in pull mode", "utf8"));
    const pullModeSync = await runScopeSyncTwoWay({
      peerUrl: peerServer.peerUrl,
      scope: "Shared",
      runtimeRoot: sourceRoot,
      dryRun: false,
      syncDirection: "pull",
    });
    assert(pullModeSync.ok === true, "Expected pull mode against protected peer to succeed");
    assert(Array.isArray(pullModeSync?.operations?.pushed) && pullModeSync.operations.pushed.length === 0, "Expected pull mode to generate no pushes");
    assert(pullModeSync?.operations?.pulled?.some((item) => item?.relativePath === pullModeRemoteOnly), "Expected pull mode to pull remote-only file");
    assert((await fs.readFile(path.resolve(sourceNotebookDir, pullModeRemoteOnly), "utf8")) === "remote should pull in pull mode", "Expected pull mode remote file locally");
    try {
      await fs.stat(path.resolve(destNotebookDir, pullModeLocalOnly));
      throw new Error("Expected pull mode local-only file to remain unpushed");
    } catch (err) {
      if (err?.code !== "ENOENT") throw err;
    }
    const directionSkipped = pullModeSync?.operations?.skipped?.direction || [];
    assert(directionSkipped.some((entry) => entry?.operation === "push" && entry?.relativePath === pullModeLocalOnly), "Expected pull mode to record skipped push operation");
    await fs.rm(path.resolve(sourceNotebookDir, pullModeLocalOnly), { force: true });
    await fs.rm(path.resolve(sourceNotebookDir, pullModeRemoteOnly), { force: true });
    await fs.rm(path.resolve(destNotebookDir, pullModeRemoteOnly), { force: true });

    const conflictTextRelativePath = "Shared/conflict-cases/conflicting-text.txt";
    const conflictJpgRelativePath = "Shared/conflict-cases/conflicting-large.jpg";
    const conflictPngRelativePath = "Shared/conflict-cases/conflicting-large.png";
    const specialConflictRelativePath = "Shared/conflict-cases/12_31_24, 2_09\u202fPM Microsoft Lens(6).jpg";
    const remoteJpgData = Buffer.alloc(MAX_FILE_PUSH_BYTES + 8192, 0x11);
    const remotePngData = Buffer.alloc(MAX_FILE_PUSH_BYTES + 4096, 0x22);
    const remoteSpecialData = Buffer.alloc(MAX_FILE_PUSH_BYTES + 2048, 0x33);

    await writeScopedFile(sourceNotebookDir, conflictTextRelativePath, Buffer.from("local text conflict", "utf8"));
    await writeScopedFile(destNotebookDir, conflictTextRelativePath, Buffer.from("remote text conflict", "utf8"));
    await writeScopedFile(sourceNotebookDir, conflictJpgRelativePath, Buffer.from("local jpg conflict", "utf8"));
    await writeScopedFile(destNotebookDir, conflictJpgRelativePath, remoteJpgData);
    await writeScopedFile(sourceNotebookDir, conflictPngRelativePath, Buffer.from("local png conflict", "utf8"));
    await writeScopedFile(destNotebookDir, conflictPngRelativePath, remotePngData);
    await writeScopedFile(sourceNotebookDir, specialConflictRelativePath, Buffer.from("local special image conflict", "utf8"));
    await writeScopedFile(destNotebookDir, specialConflictRelativePath, remoteSpecialData);

    const originalConsoleDebug = console.debug;
    const outgoingStreamLogs = [];
    const jsonFetchLogs = [];
    const acceptedStreamLogs = [];
    try {
      console.debug = (message, detail) => {
        const text = String(message || "");
        if (text.includes("[sync] outgoing scoped stream request") && detail && typeof detail === "object") {
          outgoingStreamLogs.push(detail);
          return;
        }
        if (text.includes("[sync] signed scope file fetch start") && detail && typeof detail === "object") {
          jsonFetchLogs.push(detail);
          return;
        }
        if (text.includes("Accepted scoped stream request") && typeof detail === "string") {
          try { acceptedStreamLogs.push(JSON.parse(detail)); } catch {}
        }
      };

      const conflictSync = await runScopeSyncTwoWay({
        peerUrl: peerServer.peerUrl,
        scope: "Shared",
        runtimeRoot: sourceRoot,
        dryRun: false,
      });
      assert(conflictSync.ok === true, "Expected protected conflict sync to succeed");
      const conflictReports = Array.isArray(conflictSync?.operations?.conflicts) ? conflictSync.operations.conflicts : [];
      for (const relativePath of [conflictTextRelativePath, conflictJpgRelativePath, conflictPngRelativePath, specialConflictRelativePath]) {
        const report = conflictReports.find((item) => item?.originalRelativePath === relativePath);
        assert(report, `Expected conflict report for ${relativePath}`);
        assert(typeof report.conflictRelativePath === "string" && report.conflictRelativePath.includes("/.conflicts/"), "Expected conflict copy path");
        const conflictCopyPath = path.resolve(sourceNotebookDir, "Shared", report.conflictRelativePath.slice("Shared/".length));
        const conflictCopy = await fs.readFile(conflictCopyPath);
        const expectedRemote = relativePath === conflictJpgRelativePath
          ? remoteJpgData
          : relativePath === conflictPngRelativePath
            ? remotePngData
            : relativePath === specialConflictRelativePath
              ? remoteSpecialData
              : Buffer.from("remote text conflict", "utf8");
        assert(sha256OfBuffer(conflictCopy) === sha256OfBuffer(expectedRemote), `Expected conflict copy to match remote for ${relativePath}`);
      }
      assert((await fs.readFile(path.resolve(sourceNotebookDir, conflictTextRelativePath), "utf8")) === "local text conflict", "Expected local text original to remain unchanged");
      assert((await fs.readFile(path.resolve(sourceNotebookDir, conflictJpgRelativePath), "utf8")) === "local jpg conflict", "Expected local jpg original to remain unchanged");
      assert((await fs.readFile(path.resolve(sourceNotebookDir, conflictPngRelativePath), "utf8")) === "local png conflict", "Expected local png original to remain unchanged");
      assert((await fs.readFile(path.resolve(sourceNotebookDir, specialConflictRelativePath), "utf8")) === "local special image conflict", "Expected local special image original to remain unchanged");
    } finally {
      console.debug = originalConsoleDebug;
    }

    const conflictJsonLog = jsonFetchLogs.find((entry) => entry?.operation === "conflict" && entry?.relativePath === conflictTextRelativePath);
    assert(conflictJsonLog?.signed === true, "Expected text conflict JSON fetch to be signed");
    assert(conflictJsonLog?.deviceIdPresent === true, "Expected text conflict JSON fetch to include deviceId");

    for (const relativePath of [conflictJpgRelativePath, conflictPngRelativePath, specialConflictRelativePath]) {
      const outgoing = outgoingStreamLogs.find((entry) => entry?.operation === "conflict" && entry?.relativePath === relativePath);
      assert(outgoing, `Expected outgoing stream conflict log for ${relativePath}`);
      assert(outgoing.caller === "conflict resolver", "Expected stream conflict caller diagnostic");
      assert(outgoing.signed === true, "Expected stream conflict request to be signed");
      assert(outgoing.deviceIdPresent === true, "Expected stream conflict request to include deviceId");
      assert(Array.isArray(outgoing.headers) && outgoing.headers.includes("x-nodevision-peer-payload-base64"), "Expected stream conflict auth payload header");
      assert(Array.isArray(outgoing.queryKeys) && outgoing.queryKeys.length === 0, "Expected stream conflict auth to avoid query encoding");
      assert(outgoing.relativePathRawLength === relativePath.length, "Expected raw relativePath length diagnostic");
      assert(outgoing.relativePathNormalizedLength === relativePath.length, "Expected normalized relativePath length diagnostic");
    }

    const specialOutgoing = outgoingStreamLogs.find((entry) => entry?.relativePath === specialConflictRelativePath);
    assert(specialConflictRelativePath.includes("\u202f"), "Expected special filename to contain narrow no-break space");
    assert(specialOutgoing?.relativePath === specialConflictRelativePath, "Expected signed special relativePath to preserve Unicode exactly");

    const acceptedConflict = acceptedStreamLogs.filter((entry) => entry?.operation === "conflict");
    assert(acceptedConflict.length >= 3, "Expected peer route to accept signed stream conflict requests");
    for (const entry of acceptedConflict) {
      assert(entry.caller === "conflict resolver", "Expected server conflict caller diagnostic");
      assert(entry.signatureVerified === true, "Expected server to verify conflict stream signature");
      assert(entry.trustedPeerFound === true, "Expected server to find trusted peer for conflict stream");
      assert(entry.present?.deviceId === true, "Expected server diagnostic deviceId present");
      assert(entry.present?.scope === true, "Expected server diagnostic scope present");
      assert(entry.present?.relativePath === true, "Expected server diagnostic relativePath present");
      assert(entry.request?.contentType === null, "Expected stream GET content-type diagnostic to be null");
      assert(String(entry.request?.accept || "").includes("application/octet-stream"), "Expected stream GET accept diagnostic");
    }
  } finally {
    await peerServer.close();
  }

  console.log("PASS");
}

main().catch((err) => {
  console.error("Sync scope two-way stream test failed:", err);
  process.exitCode = 1;
});
