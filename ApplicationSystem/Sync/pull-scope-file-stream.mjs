// Nodevision/ApplicationSystem/Sync/pull-scope-file-stream.mjs
// This script streams one scoped file from a trusted peer to a temp file, then atomically finalizes to target or conflict copy without loading full file contents into memory.

import fs from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import { pipeline } from "node:stream/promises";
import { Readable, Transform } from "node:stream";

import { createSignedScopeFileRequest, validateScopedRelativePath } from "./ScopePeerSync.mjs";
import { resolveScopeNotebookPath, validateSyncScope } from "./SyncScopes.mjs";
import { normalizePeerUrl, resolveRuntimeRoot } from "./sync-sync-test-two-way.mjs";

const DOWNLOAD_SUFFIX = ".nodevision-download";
const USAGE = "Usage: node ApplicationSystem/Sync/pull-scope-file-stream.mjs <peerUrl> <scope> <relativePath>";

function toNotebookDir(runtimeRoot, notebookDir) {
  if (notebookDir) return path.resolve(String(notebookDir));
  return path.resolve(runtimeRoot, "Notebook");
}

export function createCancelledError(message = "Sync job cancelled") {
  const err = new Error(message);
  err.name = "SyncJobCancelledError";
  return err;
}

function sanitizePeerLabel(value) {
  const raw = String(value || "peer").trim() || "peer";
  return raw.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "peer";
}

function buildScopedConflictRelativePath(originalRelativePath, peerLabel, timestamp) {
  const parsed = path.posix.parse(originalRelativePath);
  const scope = originalRelativePath.split("/")[0];
  const nestedDir = originalRelativePath.split("/").slice(1, -1).join("/");
  const safeTs = new Date(Date.parse(timestamp)).toISOString().replaceAll(":", "-").replaceAll(".", "-");
  const safePeer = sanitizePeerLabel(peerLabel);
  const conflictName = parsed.ext
    ? `${parsed.name}.from-${safePeer}.${safeTs}${parsed.ext}`
    : `${parsed.base}.from-${safePeer}.${safeTs}`;
  return nestedDir
    ? `${scope}/.conflicts/${nestedDir}/${conflictName}`
    : `${scope}/.conflicts/${conflictName}`;
}

function ensureSafeScopeTarget(scopeRoot, candidatePath, label) {
  const rel = path.relative(scopeRoot, candidatePath);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`${label} escaped scope root`);
  }
}

async function hashFile(filePath) {
  const hasher = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) {
    hasher.update(chunk);
  }
  return hasher.digest("hex");
}

export async function pullScopeFileStream({
  peerUrl,
  scope,
  relativePath,
  runtimeRoot,
  notebookDir,
  shouldCancel,
  onByteDelta,
  peerLabel,
} = {}) {
  const normalizedPeerUrl = normalizePeerUrl(peerUrl);
  const normalizedScope = validateSyncScope(scope);
  const normalizedRelativePath = validateScopedRelativePath(relativePath, normalizedScope);
  const resolvedRuntimeRoot = resolveRuntimeRoot({ runtimeRoot });
  const resolvedNotebookDir = toNotebookDir(resolvedRuntimeRoot, notebookDir);
  const scopeRoot = resolveScopeNotebookPath({ notebookDir: resolvedNotebookDir, scope: normalizedScope });
  const targetPath = path.resolve(scopeRoot, normalizedRelativePath.slice(`${normalizedScope}/`.length));
  ensureSafeScopeTarget(scopeRoot, targetPath, "target path");
  const tempPath = `${targetPath}${DOWNLOAD_SUFFIX}`;

  if (shouldCancel?.()) throw createCancelledError();

  const signed = await createSignedScopeFileRequest(
    { scope: normalizedScope, relativePath: normalizedRelativePath },
    { runtimeRoot: resolvedRuntimeRoot },
  );
  const streamUrl = new URL("/api/peer/scope/file-stream", `${normalizedPeerUrl}/`);
  streamUrl.searchParams.set("payload", signed.payload);
  streamUrl.searchParams.set("signatureBase64", signed.signatureBase64);

  const response = await fetch(streamUrl.toString(), { method: "GET" });
  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    const asJson = await response.json().catch(() => null);
    if (asJson?.error) detail = String(asJson.error);
    throw new Error(`scope file-stream failed (${response.status}): ${detail}`);
  }
  if (!response.body) throw new Error("scope file-stream response body is missing");

  const returnedRelativePath = String(response.headers.get("x-nodevision-relative-path") || "").trim();
  if (returnedRelativePath && returnedRelativePath !== normalizedRelativePath) {
    throw new Error("scope file-stream returned mismatched relative path");
  }
  const expectedSha = String(response.headers.get("x-nodevision-sha256") || "").trim().toLowerCase() || null;
  const lengthHeader = String(response.headers.get("content-length") || "").trim();
  const expectedBytes = lengthHeader ? Number(lengthHeader) : null;
  if (expectedBytes !== null && (!Number.isFinite(expectedBytes) || expectedBytes < 0)) {
    throw new Error("scope file-stream returned invalid content-length");
  }

  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.rm(tempPath, { force: true });

  let bytesDownloaded = 0;
  const streamHash = createHash("sha256");
  try {
    const countingTransform = new Transform({
      transform(chunk, encoding, callback) {
        try {
          if (shouldCancel?.()) {
            callback(createCancelledError());
            return;
          }
          const size = Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(String(chunk));
          bytesDownloaded += size;
          streamHash.update(chunk);
          onByteDelta?.(size);
          callback(null, chunk);
        } catch (err) {
          callback(err);
        }
      },
    });

    await pipeline(
      Readable.fromWeb(response.body),
      countingTransform,
      createWriteStream(tempPath, { flags: "wx" }),
    );
  } catch (err) {
    await fs.rm(tempPath, { force: true }).catch(() => {});
    throw err;
  }

  if (expectedBytes !== null && bytesDownloaded !== expectedBytes) {
    await fs.rm(tempPath, { force: true }).catch(() => {});
    throw new Error(`scope file-stream content-length mismatch (${bytesDownloaded} !== ${expectedBytes})`);
  }

  const downloadedSha = streamHash.digest("hex");
  if (expectedSha && downloadedSha !== expectedSha) {
    await fs.rm(tempPath, { force: true }).catch(() => {});
    throw new Error("scope file-stream sha256 header mismatch");
  }

  let mode = "created";
  let savedRelativePath = normalizedRelativePath;
  let conflictRelativePath = null;
  try {
    const existingStat = await fs.stat(targetPath);
    if (!existingStat.isFile()) throw new Error("existing target path is not a file");
    const existingSha = await hashFile(targetPath);
    if (existingSha === downloadedSha) {
      mode = "noop";
      await fs.rm(tempPath, { force: true });
    } else {
      mode = "conflict";
      conflictRelativePath = buildScopedConflictRelativePath(
        normalizedRelativePath,
        peerLabel || new URL(normalizedPeerUrl).hostname,
        new Date().toISOString(),
      );
      const conflictTargetPath = path.resolve(scopeRoot, conflictRelativePath.slice(`${normalizedScope}/`.length));
      ensureSafeScopeTarget(scopeRoot, conflictTargetPath, "conflict path");
      await fs.mkdir(path.dirname(conflictTargetPath), { recursive: true });
      await fs.rename(tempPath, conflictTargetPath);
      savedRelativePath = conflictRelativePath;
    }
  } catch (err) {
    if (err?.code === "ENOENT") {
      await fs.rename(tempPath, targetPath);
    } else {
      await fs.rm(tempPath, { force: true }).catch(() => {});
      throw err;
    }
  }

  return {
    ok: true,
    peerUrl: normalizedPeerUrl,
    scope: normalizedScope,
    relativePath: normalizedRelativePath,
    savedRelativePath,
    conflictRelativePath,
    mode,
    bytesDownloaded,
    sha256: downloadedSha,
    expectedSha256: expectedSha,
  };
}

async function main() {
  const peerUrl = process.argv[2];
  const scope = process.argv[3];
  const relativePath = process.argv[4];
  if (!peerUrl || !scope || !relativePath) {
    process.stdout.write(`${JSON.stringify({ ok: false, error: USAGE }, null, 2)}\n`);
    process.exitCode = 1;
    return;
  }

  try {
    const report = await pullScopeFileStream({ peerUrl, scope, relativePath });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } catch (err) {
    process.stdout.write(`${JSON.stringify({ ok: false, error: err?.message || String(err) }, null, 2)}\n`);
    process.exitCode = 1;
  }
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main();
}
