// Nodevision/ApplicationSystem/Sync/pull-missing-sync-test-files.mjs
// This script pulls all SyncTest files that exist only on a trusted peer by comparing manifests, then writes each pulled file under local Notebook/SyncTest with strict path and integrity validation.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";

import { buildSyncTestManifest, compareManifests, createSignedManifestRequest } from "./SyncManifest.mjs";
import { createSignedFileRequest, validateSyncTestRelativePath, MAX_FILE_PUSH_BYTES } from "./PeerFileTransfer.mjs";

const USAGE = "Usage: node ApplicationSystem/Sync/pull-missing-sync-test-files.mjs http://localhost:3001";

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

function isEntryModule() {
  const argvPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
  return argvPath === fileURLToPath(import.meta.url);
}

function resolveSyncTestTarget(notebookDir, relativePath) {
  const normalized = validateSyncTestRelativePath(relativePath);
  const syncTestRoot = path.resolve(String(notebookDir || ""), "SyncTest");
  const targetPath = path.resolve(syncTestRoot, normalized.slice("SyncTest/".length));
  const relative = path.relative(syncTestRoot, targetPath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Invalid file path");
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

function normalizePathList(value, fieldName) {
  if (!Array.isArray(value)) throw new Error(`${fieldName} must be an array`);
  return value.map((entry, index) => {
    try {
      return validateSyncTestRelativePath(entry);
    } catch {
      throw new Error(`${fieldName}[${index}] is not a valid SyncTest relative path`);
    }
  });
}

export function buildMissingPullSelection(plan) {
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) throw new Error("plan must be a plain object");

  const onlyLocal = normalizePathList(plan.onlyLocal, "plan.onlyLocal");
  const onlyRemote = normalizePathList(plan.onlyRemote, "plan.onlyRemote");
  const changed = normalizePathList(plan.changed, "plan.changed");
  const same = normalizePathList(plan.same, "plan.same");

  return {
    plan: { onlyLocal, onlyRemote, changed, same },
    pullQueue: onlyRemote,
    skipped: { changed, same, onlyLocal },
  };
}

async function postJson(peerUrl, endpointPath, body) {
  const response = await fetch(new URL(endpointPath, `${peerUrl}/`).toString(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    // no-op
  }

  if (!response.ok) {
    const detail = payload?.error ? String(payload.error) : `HTTP ${response.status}`;
    throw new Error(`${endpointPath} failed (${response.status}): ${detail}`);
  }
  return payload;
}

async function fetchRemoteManifest(peerUrl) {
  const signedRequest = await createSignedManifestRequest();
  const body = await postJson(peerUrl, "/api/peer/manifest", signedRequest);
  if (!body || body.ok !== true || !body.manifest) throw new Error("Peer manifest response missing manifest payload");
  return body.manifest;
}

async function fetchRemoteFile(peerUrl, relativePath) {
  const signedRequest = await createSignedFileRequest({ relativePath });
  const body = await postJson(peerUrl, "/api/peer/file-get", signedRequest);
  if (!body || body.ok !== true || !body.file) throw new Error("Peer file-get response missing file payload");
  return body.file;
}

async function pullOneFile(peerUrl, notebookDir, requestedRelativePath) {
  const remoteFile = await fetchRemoteFile(peerUrl, requestedRelativePath);
  const returnedRelativePath = validateSyncTestRelativePath(remoteFile.relativePath);
  if (returnedRelativePath !== requestedRelativePath) throw new Error("Peer returned unexpected relativePath");

  const contentBuffer = decodeBase64Strict(remoteFile.contentBase64);
  if (!Number.isInteger(remoteFile.bytes) || remoteFile.bytes !== contentBuffer.length) {
    throw new Error("Peer file metadata bytes mismatch");
  }

  const sha256 = createHash("sha256").update(contentBuffer).digest("hex");
  if (String(remoteFile.sha256 ?? "").toLowerCase() !== sha256) {
    throw new Error("Peer file metadata sha256 mismatch");
  }

  const target = resolveSyncTestTarget(notebookDir, returnedRelativePath);
  await fs.mkdir(path.dirname(target.targetPath), { recursive: true });
  await fs.writeFile(target.targetPath, contentBuffer);

  return { relativePath: target.normalizedRelativePath, bytes: contentBuffer.length, sha256 };
}

async function main() {
  const peerArg = process.argv[2];
  if (!peerArg) {
    process.stderr.write(`${USAGE}\n`);
    process.exitCode = 1;
    return;
  }

  let peerUrl;
  try {
    peerUrl = normalizePeerUrl(peerArg);
  } catch (err) {
    process.stderr.write(`${err?.message || String(err)}\n`);
    process.exitCode = 1;
    return;
  }

  try {
    const remoteManifest = await fetchRemoteManifest(peerUrl);
    const localManifest = await buildSyncTestManifest();
    const selection = buildMissingPullSelection(await compareManifests(localManifest, remoteManifest));

    const pulled = [];
    const notebookDir = path.resolve(resolveRuntimeRoot(), "Notebook");
    for (const relativePath of selection.pullQueue) {
      try {
        pulled.push(await pullOneFile(peerUrl, notebookDir, relativePath));
      } catch (err) {
        process.stderr.write(`Failed to pull ${relativePath}: ${err?.message || String(err)}\n`);
        process.exitCode = 1;
        return;
      }
    }

    process.stdout.write(`${JSON.stringify({
      ok: true,
      peerUrl,
      scope: "SyncTest",
      plan: selection.plan,
      pulled,
      skipped: selection.skipped,
    }, null, 2)}\n`);
  } catch (err) {
    process.stderr.write(`${err?.message || String(err)}\n`);
    process.exitCode = 1;
  }
}

if (isEntryModule()) {
  main();
}
