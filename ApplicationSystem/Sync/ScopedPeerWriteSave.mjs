// Nodevision/ApplicationSystem/Sync/ScopedPeerWriteSave.mjs
// This module centralizes scoped peer-write save behavior so JSON and stream sync uploads share the same create, noop, conflict, and explicit replacement rules while preserving recovery snapshots before overwrites.

import fs from "node:fs/promises";
import path from "node:path";
import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import { createPreOverwriteRecoverySnapshot } from "./SyncRecovery.mjs";

function hashBuffer(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function hashFile(filePath) {
  const hasher = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) {
    hasher.update(chunk);
  }
  return hasher.digest("hex");
}

function scopeFromRelativePath(relativePath) {
  return String(relativePath || "").split("/")[0] || "";
}

function sanitizePeerLabel(peerDevice) {
  const label = String(peerDevice?.deviceId || peerDevice?.deviceName || "peer").trim();
  return label.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "peer";
}

function buildConflictRelativePath(originalRelativePath, peerDevice) {
  const parsed = path.posix.parse(originalRelativePath);
  const safeTs = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
  const safePeer = sanitizePeerLabel(peerDevice);
  const scope = scopeFromRelativePath(originalRelativePath);
  const nestedDir = String(originalRelativePath || "").split("/").slice(1, -1).join("/");
  const name = parsed.ext
    ? `${parsed.name}.from-${safePeer}.${safeTs}${parsed.ext}`
    : `${parsed.base}.from-${safePeer}.${safeTs}`;
  return nestedDir ? `${scope}/.conflicts/${nestedDir}/${name}` : `${scope}/.conflicts/${name}`;
}

function assertInside(rootPath, targetPath, label) {
  const relative = path.relative(rootPath, targetPath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${label} escaped scope`);
  }
}

function conflictTargetFor(scoped, conflictRelativePath) {
  const scope = scopeFromRelativePath(scoped.normalizedRelativePath);
  const suffix = conflictRelativePath.slice(`${scope}/`.length);
  const targetPath = path.resolve(scoped.scopeRoot, suffix);
  assertInside(scoped.scopeRoot, targetPath, "conflict path");
  return targetPath;
}

function incomingMetadata({ bytes, sha256, mtimeMs }) {
  const parsedMtime = Number(mtimeMs);
  return {
    size: Number.isFinite(Number(bytes)) ? Math.trunc(Number(bytes)) : null,
    sha256: String(sha256 || "").trim().toLowerCase() || null,
    mtimeMs: Number.isFinite(parsedMtime) && parsedMtime >= 0 ? Math.trunc(parsedMtime) : null,
  };
}

export function normalizeScopedPeerSaveMode(value) {
  const mode = String(value || "auto").trim().toLowerCase();
  if (mode === "replace" || mode === "conflict") return mode;
  return "auto";
}

async function readExistingHash(targetPath) {
  try {
    const stat = await fs.stat(targetPath);
    if (!stat.isFile()) throw new Error("existing target path is not a file");
    return { exists: true, sha256: await hashFile(targetPath) };
  } catch (err) {
    if (err?.code === "ENOENT") return { exists: false, sha256: null };
    throw err;
  }
}

async function snapshotBeforeReplace({ scoped, runtimeRoot, recoveryJobId, peerDevice, metadata }) {
  await createPreOverwriteRecoverySnapshot({
    runtimeRoot,
    jobId: recoveryJobId,
    scope: scopeFromRelativePath(scoped.normalizedRelativePath),
    relativePath: scoped.normalizedRelativePath,
    targetPath: scoped.targetPath,
    operation: "replace",
    mode: "push",
    sourceDevice: peerDevice,
    incoming: metadata,
  });
}

function savedRecord(scoped, { bytes, sha256, mode, conflictRelativePath = null }) {
  return {
    relativePath: scoped.normalizedRelativePath,
    bytes,
    sha256,
    mode,
    ...(conflictRelativePath ? { conflictRelativePath } : {}),
  };
}

export async function saveScopedPeerBuffer({
  scoped,
  incomingBuffer,
  incomingHash = null,
  saveMode = "auto",
  peerDevice = null,
  runtimeRoot = null,
  recoveryJobId = null,
  incomingMtimeMs = null,
} = {}) {
  const buffer = Buffer.isBuffer(incomingBuffer) ? incomingBuffer : Buffer.from(incomingBuffer || "");
  const sha256 = incomingHash || hashBuffer(buffer);
  const bytes = buffer.length;
  const normalizedSaveMode = normalizeScopedPeerSaveMode(saveMode);
  const metadata = incomingMetadata({ bytes, sha256, mtimeMs: incomingMtimeMs });
  await fs.mkdir(path.dirname(scoped.targetPath), { recursive: true });

  const existing = await readExistingHash(scoped.targetPath);
  if (!existing.exists) {
    await fs.writeFile(scoped.targetPath, buffer);
    return savedRecord(scoped, { bytes, sha256, mode: "created" });
  }
  if (existing.sha256 === sha256) {
    return savedRecord(scoped, { bytes, sha256, mode: "noop" });
  }
  if (normalizedSaveMode === "replace") {
    await snapshotBeforeReplace({ scoped, runtimeRoot, recoveryJobId, peerDevice, metadata });
    await fs.writeFile(scoped.targetPath, buffer);
    return savedRecord(scoped, { bytes, sha256, mode: "replaced" });
  }

  const conflictRelativePath = buildConflictRelativePath(scoped.normalizedRelativePath, peerDevice);
  const conflictTarget = conflictTargetFor(scoped, conflictRelativePath);
  await fs.mkdir(path.dirname(conflictTarget), { recursive: true });
  await fs.writeFile(conflictTarget, buffer);
  return savedRecord(scoped, { bytes, sha256, mode: "conflict", conflictRelativePath });
}

export async function finalizeScopedPeerUpload({
  scoped,
  tempPath,
  bytesReceived,
  incomingHash,
  saveMode = "auto",
  peerDevice = null,
  runtimeRoot = null,
  recoveryJobId = null,
  incomingMtimeMs = null,
} = {}) {
  const bytes = Number(bytesReceived);
  const sha256 = String(incomingHash || "").trim().toLowerCase();
  const normalizedSaveMode = normalizeScopedPeerSaveMode(saveMode);
  const metadata = incomingMetadata({ bytes, sha256, mtimeMs: incomingMtimeMs });
  const existing = await readExistingHash(scoped.targetPath);

  if (!existing.exists) {
    await fs.rename(tempPath, scoped.targetPath);
    return savedRecord(scoped, { bytes, sha256, mode: "created" });
  }
  if (existing.sha256 === sha256) {
    await fs.rm(tempPath, { force: true });
    return savedRecord(scoped, { bytes, sha256, mode: "noop" });
  }
  if (normalizedSaveMode === "replace") {
    await snapshotBeforeReplace({ scoped, runtimeRoot, recoveryJobId, peerDevice, metadata });
    await fs.rename(tempPath, scoped.targetPath);
    return savedRecord(scoped, { bytes, sha256, mode: "replaced" });
  }

  const conflictRelativePath = buildConflictRelativePath(scoped.normalizedRelativePath, peerDevice);
  const conflictTarget = conflictTargetFor(scoped, conflictRelativePath);
  await fs.mkdir(path.dirname(conflictTarget), { recursive: true });
  await fs.rename(tempPath, conflictTarget);
  return savedRecord(scoped, { bytes, sha256, mode: "conflict", conflictRelativePath });
}
