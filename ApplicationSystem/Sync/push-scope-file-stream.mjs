// Nodevision/ApplicationSystem/Sync/push-scope-file-stream.mjs
// This module streams one scoped local file to a trusted peer using signed query auth, without loading full file content into memory.

import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { Transform } from "node:stream";

import { createSignedScopeFileStreamPush, validateScopedRelativePath } from "./ScopePeerSync.mjs";
import { resolveScopeNotebookPath, validateSyncScope } from "./SyncScopes.mjs";
import { normalizePeerUrl, resolveRuntimeRoot } from "./sync-sync-test-two-way.mjs";
import { createCancelledError } from "./pull-scope-file-stream.mjs";

const STREAM_UPLOAD_ENDPOINT = "/api/peer/scope/file-stream-push";

function toNotebookDir(runtimeRoot, notebookDir) {
  if (notebookDir) return path.resolve(String(notebookDir));
  return path.resolve(runtimeRoot, "Notebook");
}

function ensureSafeScopeTarget(scopeRoot, candidatePath, label) {
  const rel = path.relative(scopeRoot, candidatePath);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`${label} escaped scope root`);
  }
}

function buildUploadStream(localPath, shouldCancel) {
  const source = createReadStream(localPath);
  const guard = new Transform({
    transform(chunk, _encoding, callback) {
      try {
        if (shouldCancel?.()) {
          callback(createCancelledError());
          return;
        }
        callback(null, chunk);
      } catch (err) {
        callback(err);
      }
    },
  });
  source.on("error", (err) => {
    guard.destroy(err);
  });
  source.pipe(guard);
  return guard;
}

async function readResponseError(response) {
  const payload = await response.json().catch(() => null);
  if (payload && typeof payload.error === "string" && payload.error.trim()) {
    return payload.error.trim();
  }
  return `HTTP ${response.status}`;
}

async function hashFile(localPath) {
  const hasher = createHash("sha256");
  for await (const chunk of createReadStream(localPath)) {
    hasher.update(chunk);
  }
  return hasher.digest("hex");
}

async function createSignedStreamPushRequest({ scope, relativePath, size, sha256, runtimeRoot, attempt, createSignedRequest }) {
  if (typeof createSignedRequest === "function") {
    return createSignedRequest(
      { scope, relativePath, size, sha256 },
      { runtimeRoot, attempt },
    );
  }
  return createSignedScopeFileStreamPush(
    { scope, relativePath, size, sha256 },
    { runtimeRoot },
  );
}

export async function pushScopeFileStream({
  peerUrl,
  scope,
  relativePath,
  runtimeRoot,
  notebookDir,
  shouldCancel,
  onByteDelta,
  createSignedRequest,
} = {}) {
  const normalizedPeerUrl = normalizePeerUrl(peerUrl);
  const normalizedScope = validateSyncScope(scope);
  const normalizedRelativePath = validateScopedRelativePath(relativePath, normalizedScope);
  const resolvedRuntimeRoot = resolveRuntimeRoot({ runtimeRoot });
  const resolvedNotebookDir = toNotebookDir(resolvedRuntimeRoot, notebookDir);
  const scopeRoot = resolveScopeNotebookPath({ notebookDir: resolvedNotebookDir, scope: normalizedScope });
  const localPath = path.resolve(scopeRoot, normalizedRelativePath.slice(`${normalizedScope}/`.length));
  ensureSafeScopeTarget(scopeRoot, localPath, "local path");

  const stat = await fs.stat(localPath);
  if (!stat.isFile()) throw new Error("local path is not a file");
  const size = Number(stat.size);
  if (!Number.isFinite(size) || size < 0 || !Number.isSafeInteger(size)) {
    throw new Error("local file has invalid size");
  }
  const sha256 = await hashFile(localPath);

  if (shouldCancel?.()) throw createCancelledError();

  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const signed = await createSignedStreamPushRequest({
      scope: normalizedScope,
      relativePath: normalizedRelativePath,
      size,
      sha256,
      runtimeRoot: resolvedRuntimeRoot,
      attempt,
      createSignedRequest,
    });

    const streamUrl = new URL(STREAM_UPLOAD_ENDPOINT, `${normalizedPeerUrl}/`);
    streamUrl.searchParams.set("payload", signed.payload);
    streamUrl.searchParams.set("signatureBase64", signed.signatureBase64);

    let response;
    try {
      response = await fetch(streamUrl.toString(), {
        method: "POST",
        headers: {
          "content-type": "application/octet-stream",
          "content-length": String(size),
        },
        body: buildUploadStream(localPath, shouldCancel),
        duplex: "half",
      });
    } catch (err) {
      if (err?.name === "SyncJobCancelledError") throw err;
      throw new Error(`scope file-stream-push failed: ${err?.message || String(err)}`);
    }

    if (!response.ok) {
      const detail = await readResponseError(response);
      const requestError = new Error(`scope file-stream-push failed (${response.status}): ${detail}`);
      requestError.status = response.status;
      lastError = requestError;
      if (response.status === 401 && attempt === 0) {
        continue;
      }
      throw requestError;
    }

    const body = await response.json().catch(() => ({}));
    const saved = body?.saved && typeof body.saved === "object" ? body.saved : {};
    onByteDelta?.(size);
    return {
      ok: true,
      peerUrl: normalizedPeerUrl,
      scope: normalizedScope,
      relativePath: normalizedRelativePath,
      bytesUploaded: size,
      sha256,
      mode: String(saved.mode || "created"),
      savedRelativePath: String(saved.relativePath || normalizedRelativePath),
      conflictRelativePath: saved.conflictRelativePath ? String(saved.conflictRelativePath) : null,
      transferMode: "stream",
    };
  }

  throw lastError || new Error("scope file-stream-push failed");
}
