// Nodevision/ApplicationSystem/Sync/ConflictCopies.mjs
// This module builds conflict-copy paths for changed SyncTest files and saves remote conflict copies only under Notebook/SyncTest/.conflicts without altering original local files.

import fs from "node:fs/promises";
import path from "node:path";
import { Buffer } from "node:buffer";
import { validateSyncTestRelativePath } from "./PeerFileTransfer.mjs";

const SYNCTEST_PREFIX = "SyncTest/";
const CONFLICTS_PREFIX = "SyncTest/.conflicts/";

function normalizeNonEmptyString(value, fieldName) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`${fieldName} must be a nonempty string`);
  return text;
}

function sanitizePeerDeviceId(value) {
  const peerId = normalizeNonEmptyString(value, "peerDeviceId");
  const sanitized = peerId.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  if (!sanitized) throw new Error("peerDeviceId must contain at least one safe filename character");
  return sanitized;
}

function sanitizeTimestamp(value) {
  const timestamp = normalizeNonEmptyString(value, "timestamp");
  const ms = Date.parse(timestamp);
  if (Number.isNaN(ms)) throw new Error("timestamp must be a valid ISO date string");
  return new Date(ms).toISOString().replaceAll(":", "-").replaceAll(".", "-");
}

function isSafeDescendant(rootPath, targetPath) {
  const relative = path.relative(rootPath, targetPath);
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
}

export function buildConflictRelativePath({ originalRelativePath, peerDeviceId, timestamp }) {
  const original = validateSyncTestRelativePath(originalRelativePath);
  if (original.startsWith(CONFLICTS_PREFIX)) {
    throw new Error("originalRelativePath must not be inside SyncTest/.conflicts/");
  }

  const safePeerId = sanitizePeerDeviceId(peerDeviceId);
  const safeTimestamp = sanitizeTimestamp(timestamp);
  const relativeFromSyncRoot = original.slice(SYNCTEST_PREFIX.length);
  const parsed = path.posix.parse(relativeFromSyncRoot);
  const suffix = `.from-${safePeerId}.${safeTimestamp}`;

  const conflictFileName = parsed.ext
    ? `${parsed.name}${suffix}${parsed.ext}`
    : `${parsed.base}${suffix}`;
  const conflictSubdir = parsed.dir && parsed.dir !== "." ? `${parsed.dir}/` : "";
  return `${CONFLICTS_PREFIX}${conflictSubdir}${conflictFileName}`;
}

export async function saveConflictCopy({ notebookDir, originalRelativePath, contentBuffer, peerDeviceId, timestamp }) {
  const baseNotebookDir = path.resolve(normalizeNonEmptyString(notebookDir, "notebookDir"));
  const conflictRelativePath = buildConflictRelativePath({
    originalRelativePath,
    peerDeviceId,
    timestamp,
  });

  const conflictRoot = path.resolve(baseNotebookDir, "SyncTest", ".conflicts");
  const targetPath = path.resolve(baseNotebookDir, conflictRelativePath);
  if (!isSafeDescendant(conflictRoot, targetPath)) {
    throw new Error("Conflict path escapes SyncTest/.conflicts");
  }

  const buffer = Buffer.isBuffer(contentBuffer) ? contentBuffer : Buffer.from(contentBuffer ?? []);
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, buffer);

  return {
    relativePath: conflictRelativePath,
    bytes: buffer.length,
  };
}
