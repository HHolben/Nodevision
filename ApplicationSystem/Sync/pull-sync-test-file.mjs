// Nodevision/ApplicationSystem/Sync/pull-sync-test-file.mjs
// This script requests one signed SyncTest file from a trusted peer and saves it under the local Notebook/SyncTest directory after strict path and integrity checks.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";

import {
  createSignedFileRequest,
  validateSyncTestRelativePath,
  MAX_FILE_PUSH_BYTES,
} from "./PeerFileTransfer.mjs";

const USAGE = "Usage: node ApplicationSystem/Sync/pull-sync-test-file.mjs http://localhost:3001 SyncTest/hello-from-codex.txt";

function normalizePeerUrl(rawUrl) {
  const text = String(rawUrl ?? "").trim();
  if (!text) throw new Error(USAGE);

  let parsed;
  try {
    parsed = new URL(text);
  } catch {
    throw new Error(`Invalid peer base URL: ${text}`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Peer base URL must use http or https: ${text}`);
  }

  const pathname = parsed.pathname.replace(/\/+$/, "");
  return `${parsed.protocol}//${parsed.host}${pathname === "/" ? "" : pathname}`;
}

function resolveRuntimeRoot() {
  if (process.env.NODEVISION_ROOT) return path.resolve(process.env.NODEVISION_ROOT);
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(moduleDir, "..", "..");
}

function resolveSyncTestTarget(notebookDir, relativePath) {
  const normalized = validateSyncTestRelativePath(relativePath);
  const syncTestRoot = path.resolve(String(notebookDir || ""), "SyncTest");
  const targetSubPath = normalized.slice("SyncTest/".length);
  const targetPath = path.resolve(syncTestRoot, targetSubPath);
  const relative = path.relative(syncTestRoot, targetPath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Invalid file path");
  }
  return { normalizedRelativePath: normalized, targetPath };
}

function decodeBase64Strict(contentBase64) {
  const encoded = String(contentBase64 ?? "");
  if (!encoded || encoded !== encoded.trim()) throw new Error("Invalid base64 content");
  const decoded = Buffer.from(encoded, "base64");
  if (decoded.toString("base64") !== encoded) throw new Error("Invalid base64 content");
  if (decoded.length > MAX_FILE_PUSH_BYTES) throw new Error(`File exceeds ${MAX_FILE_PUSH_BYTES} bytes`);
  return decoded;
}

async function fetchRemoteFile(peerUrl, signedRequest) {
  const endpoint = new URL("/api/peer/file-get", `${peerUrl}/`).toString();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(signedRequest),
  });

  let body = null;
  try {
    body = await response.json();
  } catch {
    // no-op
  }

  if (!response.ok) {
    const detail = body?.error ? String(body.error) : `HTTP ${response.status}`;
    throw new Error(`Peer file-get failed (${response.status}): ${detail}`);
  }
  if (!body || body.ok !== true || !body.file) {
    throw new Error("Peer file-get response missing file payload");
  }
  return body.file;
}

async function main() {
  const peerArg = process.argv[2];
  const relativePathArg = process.argv[3];
  if (!peerArg || !relativePathArg) {
    process.stderr.write(`${USAGE}\n`);
    process.exitCode = 1;
    return;
  }

  try {
    const peerUrl = normalizePeerUrl(peerArg);
    const requestedRelativePath = validateSyncTestRelativePath(relativePathArg);

    const signedRequest = await createSignedFileRequest({ relativePath: requestedRelativePath });
    const remoteFile = await fetchRemoteFile(peerUrl, signedRequest);
    const remoteRelativePath = validateSyncTestRelativePath(remoteFile.relativePath);
    if (remoteRelativePath !== requestedRelativePath) {
      throw new Error("Peer returned unexpected relativePath");
    }

    const contentBuffer = decodeBase64Strict(remoteFile.contentBase64);
    if (!Number.isInteger(remoteFile.bytes) || remoteFile.bytes !== contentBuffer.length) {
      throw new Error("Peer file metadata bytes mismatch");
    }

    const sha256 = createHash("sha256").update(contentBuffer).digest("hex");
    if (String(remoteFile.sha256 ?? "").toLowerCase() !== sha256) {
      throw new Error("Peer file metadata sha256 mismatch");
    }

    const notebookDir = path.resolve(resolveRuntimeRoot(), "Notebook");
    const target = resolveSyncTestTarget(notebookDir, requestedRelativePath);
    await fs.mkdir(path.dirname(target.targetPath), { recursive: true });
    await fs.writeFile(target.targetPath, contentBuffer);

    process.stdout.write(`${JSON.stringify({
      ok: true,
      peerUrl,
      pulled: {
        relativePath: target.normalizedRelativePath,
        bytes: contentBuffer.length,
        sha256,
      },
    }, null, 2)}\n`);
  } catch (err) {
    process.stderr.write(`${err?.message || String(err)}\n`);
    process.exitCode = 1;
  }
}

main();
