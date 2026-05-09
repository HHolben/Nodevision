// Nodevision/ApplicationSystem/Sync/pull-changed-sync-test-conflicts.mjs
// This script pulls remote versions of changed SyncTest files from a trusted peer and stores them as conflict copies under Notebook/SyncTest/.conflicts without overwriting local originals.

import path from "node:path";
import { fileURLToPath } from "node:url";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";

import {
  buildSyncTestManifest,
  compareManifests,
  createSignedManifestRequest,
} from "./SyncManifest.mjs";
import {
  createSignedFileRequest,
  validateSyncTestRelativePath,
  MAX_FILE_PUSH_BYTES,
} from "./PeerFileTransfer.mjs";
import { saveConflictCopy } from "./ConflictCopies.mjs";

const USAGE = "Usage: node ApplicationSystem/Sync/pull-changed-sync-test-conflicts.mjs http://localhost:3001";

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

function decodeBase64Strict(contentBase64) {
  const encoded = String(contentBase64 ?? "");
  if (!encoded || encoded !== encoded.trim()) throw new Error("Invalid base64 content");
  const decoded = Buffer.from(encoded, "base64");
  if (decoded.toString("base64") !== encoded) throw new Error("Invalid base64 content");
  if (decoded.length > MAX_FILE_PUSH_BYTES) throw new Error(`File exceeds ${MAX_FILE_PUSH_BYTES} bytes`);
  return decoded;
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

async function fetchRemoteManifestWithPeer(peerUrl) {
  const signedRequest = await createSignedManifestRequest();
  const body = await postJson(peerUrl, "/api/peer/manifest", signedRequest);
  if (!body || body.ok !== true || !body.manifest) {
    throw new Error("Peer manifest response missing manifest payload");
  }

  const peerDeviceId = String(body?.peer?.deviceId ?? "").trim();
  if (!peerDeviceId) throw new Error("Peer manifest response missing peer.deviceId");

  return {
    manifest: body.manifest,
    peerDeviceId,
  };
}

async function fetchRemoteFile(peerUrl, relativePath) {
  const signedRequest = await createSignedFileRequest({ relativePath });
  const body = await postJson(peerUrl, "/api/peer/file-get", signedRequest);
  if (!body || body.ok !== true || !body.file) {
    throw new Error("Peer file-get response missing file payload");
  }
  return body.file;
}

async function pullChangedConflict(peerUrl, notebookDir, requestedRelativePath, peerDeviceId, timestamp) {
  const remoteFile = await fetchRemoteFile(peerUrl, requestedRelativePath);
  const returnedRelativePath = validateSyncTestRelativePath(remoteFile.relativePath);
  if (returnedRelativePath !== requestedRelativePath) {
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

  const saved = await saveConflictCopy({
    notebookDir,
    originalRelativePath: requestedRelativePath,
    contentBuffer,
    peerDeviceId,
    timestamp,
  });

  return {
    originalRelativePath: requestedRelativePath,
    conflictRelativePath: saved.relativePath,
    bytes: saved.bytes,
    sha256,
  };
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
    const { manifest: remoteManifest, peerDeviceId } = await fetchRemoteManifestWithPeer(peerUrl);
    const localManifest = await buildSyncTestManifest();
    const plan = await compareManifests(localManifest, remoteManifest);
    const changed = Array.isArray(plan.changed) ? plan.changed.map((item) => validateSyncTestRelativePath(item)) : [];

    const notebookDir = path.resolve(resolveRuntimeRoot(), "Notebook");
    const conflicts = [];
    for (const relativePath of changed) {
      try {
        conflicts.push(await pullChangedConflict(peerUrl, notebookDir, relativePath, peerDeviceId, new Date().toISOString()));
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
      plan,
      conflicts,
      skipped: {
        onlyLocal: plan.onlyLocal,
        onlyRemote: plan.onlyRemote,
        same: plan.same,
      },
    }, null, 2)}\n`);
  } catch (err) {
    process.stderr.write(`${err?.message || String(err)}\n`);
    process.exitCode = 1;
  }
}

main();
