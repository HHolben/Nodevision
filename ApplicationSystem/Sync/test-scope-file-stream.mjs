// Nodevision/ApplicationSystem/Sync/test-scope-file-stream.mjs
// This script validates scoped stream pull/push auth guards, temp-file finalization, conflict behavior, integrity checks, and one-time 401 re-sign retries.

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import express from "express";
import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";

import { ensureDeviceIdentity, signMessage } from "./DeviceIdentity.mjs";
import { addTrustedPeer } from "./TrustedPeers.mjs";
import { createSignedScopeFileRequest, createSignedScopeFileStreamPush } from "./ScopePeerSync.mjs";
import { saveSyncScopes } from "./SyncScopes.mjs";
import { pullScopeFileStream } from "./pull-scope-file-stream.mjs";
import { saveSyncProtection } from "./SyncProtection.mjs";
import { pushScopeFileStream } from "./push-scope-file-stream.mjs";
import { extractSignedStreamAuth, registerPeerRoutes } from "../server/routes/peerRoutes.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256OfBuffer(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function exists(filePath) {
  try {
    await fs.stat(filePath);
    return true;
  } catch (err) {
    if (err?.code === "ENOENT") return false;
    throw err;
  }
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

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

async function main() {
  const sourceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "nodevision-scope-stream-source-"));
  const destRoot = await fs.mkdtemp(path.join(os.tmpdir(), "nodevision-scope-stream-dest-"));
  const untrustedRoot = await fs.mkdtemp(path.join(os.tmpdir(), "nodevision-scope-stream-untrusted-"));
  const staleRoot = await fs.mkdtemp(path.join(os.tmpdir(), "nodevision-scope-stream-stale-key-"));
  const sourceNotebookDir = path.resolve(sourceRoot, "Notebook");
  const destNotebookDir = path.resolve(destRoot, "Notebook");
  await fs.mkdir(path.resolve(sourceNotebookDir, "Shared"), { recursive: true });
  await fs.mkdir(path.resolve(destNotebookDir, "Shared"), { recursive: true });

  await saveSyncScopes(["SyncTest", "Shared"], { runtimeRoot: sourceRoot });
  await saveSyncScopes(["SyncTest", "Shared"], { runtimeRoot: destRoot });
  await saveSyncScopes(["SyncTest", "Shared"], { runtimeRoot: untrustedRoot });
  await saveSyncProtection({ protectedFromPeerWrites: true }, { runtimeRoot: sourceRoot });
  await saveSyncProtection({ protectedFromPeerWrites: false }, { runtimeRoot: destRoot });

  const sourceIdentity = await ensureDeviceIdentity({ runtimeRoot: sourceRoot, deviceName: "stream-source" });
  const destIdentity = await ensureDeviceIdentity({ runtimeRoot: destRoot, deviceName: "stream-dest" });
  const untrustedIdentity = await ensureDeviceIdentity({ runtimeRoot: untrustedRoot, deviceName: "stream-untrusted" });
  await addTrustedPeer(
    {
      deviceId: destIdentity.deviceId,
      deviceName: destIdentity.deviceName,
      publicKey: destIdentity.publicKey,
    },
    { runtimeRoot: sourceRoot },
  );

  const bigRelativePath = "Shared/big-stream.bin";
  const bigSourceFilePath = path.resolve(sourceNotebookDir, "Shared", "big-stream.bin");
  const bigData = Buffer.alloc(320 * 1024, 0x42);
  await fs.writeFile(bigSourceFilePath, bigData);
  await fs.writeFile(path.resolve(sourceNotebookDir, "Shared", "zero.bin"), Buffer.alloc(0));
  await fs.writeFile(path.resolve(sourceNotebookDir, "Shared", "retry-pull.bin"), Buffer.from("retry-pull", "utf8"));
  const specialRelativePath = "Shared/Codex3ProjectNotebook/Tome1CreativeWriting/Collection3TimesMadness/LongLiveIcarus/12_31_24, 2_09\u202fPM Microsoft Lens(19).jpg";
  const specialData = Buffer.from("special path image bytes", "utf8");
  await fs.mkdir(path.dirname(path.resolve(sourceNotebookDir, specialRelativePath)), { recursive: true });
  await fs.writeFile(path.resolve(sourceNotebookDir, specialRelativePath), specialData);
  await fs.writeFile(path.resolve(sourceNotebookDir, "Shared", "protected-both.bin"), Buffer.from("protected-both", "utf8"));
  await fs.writeFile(path.resolve(sourceNotebookDir, "Shared", "unprotected-both.bin"), Buffer.from("unprotected-both", "utf8"));

  const missingAuth = extractSignedStreamAuth({ method: "GET", path: "/api/peer/scope/file-stream", query: {}, headers: {}, body: undefined });
  assert(missingAuth.diagnostics.payloadSource === "missing", "Expected missing payload diagnostic source");
  assert(missingAuth.diagnostics.signatureSource === "missing", "Expected missing signature diagnostic source");

  const serverHandle = await startPeerServer({ runtimeRoot: sourceRoot, notebookDir: sourceNotebookDir });
  try {
    const noAuthUrl = new URL("/api/peer/scope/file-stream", serverHandle.peerUrl + "/");
    const noAuthResult = await fetchJson(noAuthUrl.toString());
    assert(noAuthResult.response.status === 401, "Expected missing stream auth to be rejected");
    assert(String(noAuthResult.payload.error || "").includes("Unauthorized peer scope file stream request"), "Expected missing stream auth error");

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
    const traversalPayload = await traversalResponse.json().catch(() => ({}));
    assert(traversalResponse.status === 400, "Expected path traversal stream request to be rejected");
    assert(String(traversalPayload.error || "").includes("Invalid scoped path"), "Expected scoped path traversal error");

    const validSignedGet = await createSignedScopeFileRequest(
      { scope: "Shared", relativePath: bigRelativePath },
      { runtimeRoot: destRoot },
    );
    const validGetUrl = new URL("/api/peer/scope/file-stream", `${serverHandle.peerUrl}/`);
    validGetUrl.searchParams.set("payload", validSignedGet.payload);
    validGetUrl.searchParams.set("signatureBase64", validSignedGet.signatureBase64);
    const validGetResponse = await fetch(validGetUrl.toString());
    assert(validGetResponse.ok === true, "Expected signed URL-encoded stream request to succeed");

    const headerSignedGet = await createSignedScopeFileRequest(
      { scope: "Shared", relativePath: bigRelativePath },
      { runtimeRoot: destRoot },
    );
    const headerGetUrl = new URL("/api/peer/scope/file-stream", serverHandle.peerUrl + "/");
    const headerGetResponse = await fetch(headerGetUrl.toString(), {
      headers: {
        "x-nodevision-peer-payload": headerSignedGet.payload,
        "x-nodevision-peer-signature": headerSignedGet.signatureBase64,
      },
    });
    assert(headerGetResponse.ok === true, "Expected signed header-carried stream request to succeed");

    let untrustedRejected = false;
    try {
      await pullScopeFileStream({
        peerUrl: serverHandle.peerUrl,
        scope: "Shared",
        relativePath: specialRelativePath,
        runtimeRoot: untrustedRoot,
      });
    } catch (err) {
      untrustedRejected = Number(err?.status) === 401;
    }
    assert(untrustedRejected === true, "Expected protected trusted-peer stream pull to reject an untrusted device");

    const specialPullReport = await pullScopeFileStream({
      peerUrl: serverHandle.peerUrl,
      scope: "Shared",
      relativePath: specialRelativePath,
      runtimeRoot: destRoot,
    });
    assert(specialPullReport.ok === true, "Expected protected source + unprotected requester stream pull to succeed");
    assert(specialPullReport.savedRelativePath === specialRelativePath, "Expected special path to round-trip unchanged");
    const specialPulled = await fs.readFile(path.resolve(destNotebookDir, specialRelativePath));
    assert(sha256OfBuffer(specialPulled) === sha256OfBuffer(specialData), "Expected special-path stream content to match");

    await saveSyncProtection({ protectedFromPeerWrites: true }, { runtimeRoot: destRoot });
    const protectedBothPull = await pullScopeFileStream({
      peerUrl: serverHandle.peerUrl,
      scope: "Shared",
      relativePath: "Shared/protected-both.bin",
      runtimeRoot: destRoot,
    });
    assert(protectedBothPull.ok === true, "Expected protected source + protected requester stream pull to succeed when trusted");

    await saveSyncProtection({ protectedFromPeerWrites: false }, { runtimeRoot: sourceRoot });
    await saveSyncProtection({ protectedFromPeerWrites: false }, { runtimeRoot: destRoot });
    const unprotectedBothPull = await pullScopeFileStream({
      peerUrl: serverHandle.peerUrl,
      scope: "Shared",
      relativePath: "Shared/unprotected-both.bin",
      runtimeRoot: destRoot,
    });
    assert(unprotectedBothPull.ok === true, "Expected unprotected peers to still sign and complete stream pull when trusted");

    const tamperedPayload = validSignedGet.payload.replace("big-stream.bin", "tampered.bin");
    const tamperedGetUrl = new URL("/api/peer/scope/file-stream", `${serverHandle.peerUrl}/`);
    tamperedGetUrl.searchParams.set("payload", tamperedPayload);
    tamperedGetUrl.searchParams.set("signatureBase64", validSignedGet.signatureBase64);
    const tamperedGet = await fetchJson(tamperedGetUrl.toString());
    assert(tamperedGet.response.status === 401, "Expected tampered GET payload to fail signature verification");
    assert(String(tamperedGet.payload.error || "").includes("Invalid signature"), "Expected tampered GET signature error");

    const malformedSigGetUrl = new URL("/api/peer/scope/file-stream", `${serverHandle.peerUrl}/`);
    malformedSigGetUrl.searchParams.set("payload", validSignedGet.payload);
    malformedSigGetUrl.searchParams.set("signatureBase64", "%%%invalid-signature%%%");
    const malformedGet = await fetchJson(malformedSigGetUrl.toString());
    assert(malformedGet.response.status === 401, "Expected malformed GET signature to be rejected");
    assert(String(malformedGet.payload.error || "").includes("Malformed signature"), "Expected malformed GET signature error");

    const expiredGetMessage = {
      type: "nodevision.peer.scopeFileRequest",
      version: 1,
      deviceId: destIdentity.deviceId,
      deviceName: destIdentity.deviceName,
      timestamp: "2020-01-01T00:00:00.000Z",
      scope: "Shared",
      relativePath: bigRelativePath,
    };
    const signedExpiredGet = await signMessage(expiredGetMessage, { runtimeRoot: destRoot });
    const expiredGetUrl = new URL("/api/peer/scope/file-stream", `${serverHandle.peerUrl}/`);
    expiredGetUrl.searchParams.set("payload", signedExpiredGet.payload);
    expiredGetUrl.searchParams.set("signatureBase64", signedExpiredGet.signatureBase64);
    const expiredGet = await fetchJson(expiredGetUrl.toString());
    assert(expiredGet.response.status === 401, "Expected expired GET request to be rejected");
    assert(String(expiredGet.payload.error || "").includes("Expired request"), "Expected expired GET error");

    const pullReport = await pullScopeFileStream({
      peerUrl: serverHandle.peerUrl,
      scope: "Shared",
      relativePath: bigRelativePath,
      runtimeRoot: destRoot,
    });
    assert(pullReport.ok === true, "Expected stream pull to succeed");
    assert(pullReport.mode === "created", "Expected first stream pull to create target file");
    assert(pullReport.bytesDownloaded === bigData.length, "Expected byte count to match source");

    const pulledTargetPath = path.resolve(destNotebookDir, "Shared", "big-stream.bin");
    const pulledTempPath = `${pulledTargetPath}.nodevision-download`;
    const targetBuffer = await fs.readFile(pulledTargetPath);
    assert(sha256OfBuffer(targetBuffer) === sha256OfBuffer(bigData), "Expected streamed file content to match source");
    assert((await exists(pulledTempPath)) === false, "Expected temp download file to be removed");

    const zeroPullReport = await pullScopeFileStream({
      peerUrl: serverHandle.peerUrl,
      scope: "Shared",
      relativePath: "Shared/zero.bin",
      runtimeRoot: destRoot,
    });
    assert(zeroPullReport.ok === true, "Expected 0-byte pull to succeed");
    assert(zeroPullReport.bytesDownloaded === 0, "Expected 0-byte pull byte count");
    const zeroPulledStat = await fs.stat(path.resolve(destNotebookDir, "Shared", "zero.bin"));
    assert(zeroPulledStat.size === 0, "Expected 0-byte pulled target size");

    let pullRetrySignCount = 0;
    const pullRetryReport = await pullScopeFileStream({
      peerUrl: serverHandle.peerUrl,
      scope: "Shared",
      relativePath: "Shared/retry-pull.bin",
      runtimeRoot: destRoot,
      createSignedRequest: async ({ scope, relativePath }, { runtimeRoot, attempt }) => {
        pullRetrySignCount += 1;
        return createSignedScopeFileRequest(
          { scope, relativePath },
          { runtimeRoot, timestamp: attempt === 0 ? "2020-01-01T00:00:00.000Z" : new Date().toISOString() },
        );
      },
    });
    assert(pullRetrySignCount === 2, "Expected pull stream 401 to retry once with fresh signature");
    assert(pullRetryReport.ok === true, "Expected pull retry flow to succeed");

    const uploadCreatedData = Buffer.from("upload-created", "utf8");
    await fs.writeFile(path.resolve(destNotebookDir, "Shared", "upload-created.bin"), uploadCreatedData);
    const pushCreatedReport = await pushScopeFileStream({
      peerUrl: serverHandle.peerUrl,
      scope: "Shared",
      relativePath: "Shared/upload-created.bin",
      runtimeRoot: destRoot,
    });
    assert(pushCreatedReport.ok === true, "Expected stream push created to succeed");
    assert(pushCreatedReport.mode === "created", "Expected stream push created mode");
    const createdOnSourcePath = path.resolve(sourceNotebookDir, "Shared", "upload-created.bin");
    const createdOnSource = await fs.readFile(createdOnSourcePath);
    assert(sha256OfBuffer(createdOnSource) === sha256OfBuffer(uploadCreatedData), "Expected pushed file content to match");
    assert((await exists(`${createdOnSourcePath}.nodevision-upload`)) === false, "Expected upload temp file cleanup");

    const originalConflictPath = path.resolve(sourceNotebookDir, "Shared", "upload-conflict.bin");
    await fs.writeFile(originalConflictPath, Buffer.from("source-original", "utf8"));
    const conflictUploadData = Buffer.from("dest-conflict-data", "utf8");
    await fs.writeFile(path.resolve(destNotebookDir, "Shared", "upload-conflict.bin"), conflictUploadData);
    const conflictPushReport = await pushScopeFileStream({
      peerUrl: serverHandle.peerUrl,
      scope: "Shared",
      relativePath: "Shared/upload-conflict.bin",
      runtimeRoot: destRoot,
    });
    assert(conflictPushReport.ok === true, "Expected conflict stream push to succeed");
    assert(conflictPushReport.mode === "conflict", "Expected conflict stream push mode");
    assert(typeof conflictPushReport.conflictRelativePath === "string" && conflictPushReport.conflictRelativePath.includes("/.conflicts/"), "Expected conflict relative path");

    const sourceConflictOriginal = await fs.readFile(originalConflictPath, "utf8");
    assert(sourceConflictOriginal === "source-original", "Expected original target to remain unchanged on conflict");
    const resolvedConflictCopyPath = path.resolve(sourceNotebookDir, "Shared", conflictPushReport.conflictRelativePath.slice("Shared/".length));
    const conflictCopyBuffer = await fs.readFile(resolvedConflictCopyPath);
    assert(sha256OfBuffer(conflictCopyBuffer) === sha256OfBuffer(conflictUploadData), "Expected conflict copy content to match uploaded data");

    const badHashMessage = {
      type: "nodevision.peer.scopeFileStreamPush",
      version: 1,
      deviceId: destIdentity.deviceId,
      deviceName: destIdentity.deviceName,
      timestamp: new Date().toISOString(),
      scope: "Shared",
      relativePath: "Shared/hash-mismatch.bin",
      size: 5,
      sha256: "0".repeat(64),
    };
    const badHashSigned = await signMessage(badHashMessage, { runtimeRoot: destRoot });
    const badHashUrl = new URL("/api/peer/scope/file-stream-push", `${serverHandle.peerUrl}/`);
    badHashUrl.searchParams.set("payload", badHashSigned.payload);
    badHashUrl.searchParams.set("signatureBase64", badHashSigned.signatureBase64);
    const badHashResult = await fetchJson(badHashUrl.toString(), {
      method: "POST",
      headers: { "content-type": "application/octet-stream" },
      body: Buffer.from("hello", "utf8"),
    });
    assert(badHashResult.response.status === 400, "Expected hash mismatch to be rejected");
    assert(String(badHashResult.payload.error || "").includes("Invalid hash"), "Expected invalid hash error");
    assert((await exists(path.resolve(sourceNotebookDir, "Shared", "hash-mismatch.bin.nodevision-upload"))) === false, "Expected hash mismatch temp cleanup");

    const badSizeMessage = {
      type: "nodevision.peer.scopeFileStreamPush",
      version: 1,
      deviceId: destIdentity.deviceId,
      deviceName: destIdentity.deviceName,
      timestamp: new Date().toISOString(),
      scope: "Shared",
      relativePath: "Shared/byte-mismatch.bin",
      size: 9,
      sha256: sha256OfBuffer(Buffer.from("hello", "utf8")),
    };
    const badSizeSigned = await signMessage(badSizeMessage, { runtimeRoot: destRoot });
    const badSizeUrl = new URL("/api/peer/scope/file-stream-push", `${serverHandle.peerUrl}/`);
    badSizeUrl.searchParams.set("payload", badSizeSigned.payload);
    badSizeUrl.searchParams.set("signatureBase64", badSizeSigned.signatureBase64);
    const badSizeResult = await fetchJson(badSizeUrl.toString(), {
      method: "POST",
      headers: { "content-type": "application/octet-stream" },
      body: Buffer.from("hello", "utf8"),
    });
    assert(badSizeResult.response.status === 400, "Expected byte mismatch to be rejected");
    assert(String(badSizeResult.payload.error || "").includes("Byte mismatch"), "Expected byte mismatch error");

    const traversalPushMessage = {
      type: "nodevision.peer.scopeFileStreamPush",
      version: 1,
      deviceId: destIdentity.deviceId,
      deviceName: destIdentity.deviceName,
      timestamp: new Date().toISOString(),
      scope: "Shared",
      relativePath: "Shared/../blocked-upload.bin",
      size: 4,
      sha256: sha256OfBuffer(Buffer.from("data", "utf8")),
    };
    const traversalPushSigned = await signMessage(traversalPushMessage, { runtimeRoot: destRoot });
    const traversalPushUrl = new URL("/api/peer/scope/file-stream-push", `${serverHandle.peerUrl}/`);
    traversalPushUrl.searchParams.set("payload", traversalPushSigned.payload);
    traversalPushUrl.searchParams.set("signatureBase64", traversalPushSigned.signatureBase64);
    const traversalPushResult = await fetchJson(traversalPushUrl.toString(), {
      method: "POST",
      headers: { "content-type": "application/octet-stream" },
      body: Buffer.from("data", "utf8"),
    });
    assert(traversalPushResult.response.status === 400, "Expected traversal stream push to be rejected");
    assert(String(traversalPushResult.payload.error || "").includes("Invalid scoped path"), "Expected traversal push path error");

    const urlEncodingPushData = Buffer.from("url-encoding-upload", "utf8");
    const encodedPushSigned = await createSignedScopeFileStreamPush(
      {
        scope: "Shared",
        relativePath: "Shared/url-encoding.bin",
        size: urlEncodingPushData.length,
        sha256: sha256OfBuffer(urlEncodingPushData),
      },
      { runtimeRoot: destRoot },
    );
    const encodedPushUrl = new URL("/api/peer/scope/file-stream-push", `${serverHandle.peerUrl}/`);
    encodedPushUrl.searchParams.set("payload", encodedPushSigned.payload);
    encodedPushUrl.searchParams.set("signatureBase64", encodedPushSigned.signatureBase64);
    const encodedPushResult = await fetchJson(encodedPushUrl.toString(), {
      method: "POST",
      headers: { "content-type": "application/octet-stream" },
      body: urlEncodingPushData,
    });
    assert(encodedPushResult.response.status === 200, "Expected URL-encoded signed stream push to succeed");

    const tamperedPushUrl = new URL("/api/peer/scope/file-stream-push", `${serverHandle.peerUrl}/`);
    tamperedPushUrl.searchParams.set("payload", encodedPushSigned.payload.replace("url-encoding.bin", "url-encoding-bad.bin"));
    tamperedPushUrl.searchParams.set("signatureBase64", encodedPushSigned.signatureBase64);
    const tamperedPushResult = await fetchJson(tamperedPushUrl.toString(), {
      method: "POST",
      headers: { "content-type": "application/octet-stream" },
      body: urlEncodingPushData,
    });
    assert(tamperedPushResult.response.status === 401, "Expected tampered stream push payload to fail verification");
    assert(String(tamperedPushResult.payload.error || "").includes("Invalid signature"), "Expected tampered stream push signature error");

    await fs.writeFile(path.resolve(destNotebookDir, "Shared", "retry-push.bin"), Buffer.from("retry-push-data", "utf8"));
    let pushRetrySignCount = 0;
    const pushRetryReport = await pushScopeFileStream({
      peerUrl: serverHandle.peerUrl,
      scope: "Shared",
      relativePath: "Shared/retry-push.bin",
      runtimeRoot: destRoot,
      createSignedRequest: async ({ scope, relativePath, size, sha256 }, { runtimeRoot, attempt }) => {
        pushRetrySignCount += 1;
        return createSignedScopeFileStreamPush(
          { scope, relativePath, size, sha256 },
          { runtimeRoot, timestamp: attempt === 0 ? "2020-01-01T00:00:00.000Z" : new Date().toISOString() },
        );
      },
    });
    assert(pushRetrySignCount === 2, "Expected stream push 401 retry to re-sign once");
    assert(pushRetryReport.ok === true, "Expected stream push retry flow to succeed");
    assert(pushRetryReport.mode === "created" || pushRetryReport.mode === "noop", "Expected retry push to finalize");

    const staleIdentity = await ensureDeviceIdentity({
      runtimeRoot: staleRoot,
      deviceId: destIdentity.deviceId,
      deviceName: "stream-dest-stale-key",
    });
    await addTrustedPeer({
      deviceId: destIdentity.deviceId,
      deviceName: destIdentity.deviceName,
      publicKey: staleIdentity.publicKey,
    }, { runtimeRoot: sourceRoot });
    let staleKeyRejected = false;
    try {
      await pullScopeFileStream({
        peerUrl: serverHandle.peerUrl,
        scope: "Shared",
        relativePath: "Shared/retry-pull.bin",
        runtimeRoot: destRoot,
      });
    } catch (err) {
      staleKeyRejected = Number(err?.status) === 401 && String(err?.message || "").includes("Invalid signature");
    }
    assert(staleKeyRejected === true, "Expected stale trusted peer public key to fail signature verification");
  } finally {
    await serverHandle.close();
  }

  assert(sourceIdentity.deviceId && sourceIdentity.deviceName, "source identity marker");
  assert(untrustedIdentity.deviceId && untrustedIdentity.deviceName, "untrusted identity marker");
  console.log("PASS");
}

main().catch((err) => {
  console.error("Scope file stream test failed:", err);
  process.exitCode = 1;
});
