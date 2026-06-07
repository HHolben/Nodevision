// Nodevision/ApplicationSystem/Sync/push-scope-file-stream.mjs
// This module streams one scoped local file to a trusted peer using signed header auth, without loading full file content into memory.

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

function encodeBase64Url(text) {
  return Buffer.from(String(text), "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function sanitizeHeaderValue(value, fallback = "unknown") {
  const text = String(value || fallback).trim() || fallback;
  return text.replace(/[^\t\x20-\x7e]+/g, "?").slice(0, 120);
}

function buildSignedStreamPushHeaders({ signed, operation, caller, attempt }) {
  return {
    "x-nodevision-peer-payload-base64": encodeBase64Url(signed.payload),
    "x-nodevision-peer-signature": signed.signatureBase64,
    "x-nodevision-sync-operation": sanitizeHeaderValue(operation),
    "x-nodevision-sync-caller": sanitizeHeaderValue(caller),
    "x-nodevision-sync-attempt": String(Number.isFinite(Number(attempt)) ? Math.trunc(Number(attempt)) : 0),
    "x-nodevision-sync-retry": attempt > 0 ? "true" : "false",
  };
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

function summarizeSignedPayloadForLog(payloadText) {
  try {
    const parsed = JSON.parse(String(payloadText || ""));
    return {
      parsed: Boolean(parsed && typeof parsed === "object" && !Array.isArray(parsed)),
      deviceId: typeof parsed?.deviceId === "string" ? parsed.deviceId : null,
      scope: typeof parsed?.scope === "string" ? parsed.scope : null,
      relativePath: typeof parsed?.relativePath === "string" ? parsed.relativePath : null,
      timestampPresent: typeof parsed?.timestamp === "string" && parsed.timestamp.length > 0,
      size: Number.isFinite(Number(parsed?.size)) ? Number(parsed.size) : null,
      sha256Present: typeof parsed?.sha256 === "string" && parsed.sha256.length > 0,
    };
  } catch {
    return { parsed: false, deviceId: null, scope: null, relativePath: null, timestampPresent: false, size: null, sha256Present: false };
  }
}

function logOutgoingScopedStreamRequest({ endpoint, method, url, signed, headers = [], operation = "push", caller = "normal push", attempt = 0 }) {
  try {
    const parsedUrl = new URL(url);
    const payloadFields = summarizeSignedPayloadForLog(signed?.payload);
    console.debug("[sync] outgoing scoped stream request", {
      endpoint,
      method,
      peerUrl: parsedUrl.origin,
      requestPath: parsedUrl.pathname,
      operation,
      caller,
      retry: Number(attempt) > 0,
      attempt: Number.isFinite(Number(attempt)) ? Math.trunc(Number(attempt)) : 0,
      scope: payloadFields.scope,
      relativePath: payloadFields.relativePath,
      deviceId: payloadFields.deviceId,
      signed: typeof signed?.payload === "string" && signed.payload.length > 0
        && typeof signed?.signatureBase64 === "string" && signed.signatureBase64.length > 0,
      timestampPresent: Boolean(payloadFields.timestampPresent),
      queryKeys: Array.from(parsedUrl.searchParams.keys()).sort(),
      headers,
      bodyFields: ["stream"],
      payloadPresent: typeof signed?.payload === "string" && signed.payload.length > 0,
      signaturePresent: typeof signed?.signatureBase64 === "string" && signed.signatureBase64.length > 0,
      payloadFields,
    });
  } catch {}
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


function createStreamSigningError(err, endpointLabel) {
  const detail = err?.message || String(err);
  const message = String(detail || "unknown signing error");
  if (/device identity|device private key|partial device identity|private\.pem|public\.pem|device\.json/i.test(message)) {
    const wrapped = new Error(
      `Local device identity is missing or incomplete; cannot sign peer ${endpointLabel} request. ${message}`,
    );
    wrapped.cause = err;
    return wrapped;
  }
  const wrapped = new Error(`Unable to sign peer ${endpointLabel} request. ${message}`);
  wrapped.cause = err;
  return wrapped;
}

async function createSignedStreamPushRequest({ scope, relativePath, size, sha256, runtimeRoot, attempt, createSignedRequest }) {
  try {
    if (typeof createSignedRequest === "function") {
      return await createSignedRequest(
        { scope, relativePath, size, sha256 },
        { runtimeRoot, attempt },
      );
    }
    return await createSignedScopeFileStreamPush(
      { scope, relativePath, size, sha256 },
      { runtimeRoot },
    );
  } catch (err) {
    throw createStreamSigningError(err, "scope file-stream-push");
  }
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
  operation = "push",
  caller = "normal push",
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
    const authHeaders = buildSignedStreamPushHeaders({ signed, operation, caller, attempt });

    logOutgoingScopedStreamRequest({
      endpoint: "scope/file-stream-push",
      method: "POST",
      url: streamUrl.toString(),
      signed,
      headers: [...Object.keys(authHeaders), "content-type", "content-length"].sort(),
      operation,
      caller,
      attempt,
    });

    let response;
    try {
      response = await fetch(streamUrl.toString(), {
        method: "POST",
        headers: {
          ...authHeaders,
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
