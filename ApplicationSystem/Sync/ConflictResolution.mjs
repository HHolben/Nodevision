// Nodevision/ApplicationSystem/Sync/ConflictResolution.mjs
// This module validates SyncTest conflict-resolution paths, creates backup/resolved file locations, and safely resolves a conflict by either promoting the conflict copy or keeping local content while preserving all data.

import fs from "node:fs/promises";
import path from "node:path";
import { validateSyncTestRelativePath } from "./PeerFileTransfer.mjs";

const SYNCTEST_ROOT = "SyncTest";
const SYNCTEST_PREFIX = "SyncTest/";
const CONFLICTS_PREFIX = "SyncTest/.conflicts/";
const RESOLVED_PREFIX = "SyncTest/.resolved-conflicts/";
const BACKUPS_PREFIX = "SyncTest/.conflict-backups/";

function normalizeNonEmptyString(value, fieldName) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`${fieldName} must be a nonempty string`);
  return text;
}

function sanitizeTimestamp(timestamp) {
  const text = normalizeNonEmptyString(timestamp, "timestamp");
  const ms = Date.parse(text);
  if (Number.isNaN(ms)) throw new Error("timestamp must be a valid ISO date string");
  return new Date(ms).toISOString().replaceAll(":", "-").replaceAll(".", "-");
}

function isSafeDescendant(rootPath, targetPath) {
  const relative = path.relative(rootPath, targetPath);
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function validateTargetRelativePath(value) {
  const normalized = validateSyncTestRelativePath(value);
  if (!normalized.startsWith(SYNCTEST_PREFIX)) {
    throw new Error("targetRelativePath must start with SyncTest/");
  }
  if (normalized.startsWith(CONFLICTS_PREFIX)) {
    throw new Error("targetRelativePath must not be inside SyncTest/.conflicts/");
  }
  return normalized;
}

function validateConflictRelativePath(value) {
  const normalized = validateSyncTestRelativePath(value);
  if (!normalized.startsWith(CONFLICTS_PREFIX)) {
    throw new Error("conflictRelativePath must start with SyncTest/.conflicts/");
  }
  return normalized;
}

function ensurePathWithinNotebookScope(notebookDir, relativePath, allowedRootRelativePath, fieldName) {
  const allowedRootPath = path.resolve(notebookDir, allowedRootRelativePath);
  const absolutePath = path.resolve(notebookDir, relativePath);
  if (!isSafeDescendant(allowedRootPath, absolutePath)) {
    throw new Error(`${fieldName} escapes ${allowedRootRelativePath}`);
  }
  return absolutePath;
}

async function readRegularFile(filePath, fieldName) {
  let stat;
  try {
    stat = await fs.stat(filePath);
  } catch (err) {
    if (err?.code === "ENOENT") throw new Error(`${fieldName} not found`);
    throw err;
  }
  if (!stat.isFile()) throw new Error(`${fieldName} must be a file`);
  return fs.readFile(filePath);
}

export function validateSyncTestConflictPaths({ targetRelativePath, conflictRelativePath }) {
  return {
    targetRelativePath: validateTargetRelativePath(targetRelativePath),
    conflictRelativePath: validateConflictRelativePath(conflictRelativePath),
  };
}

export function buildConflictBackupRelativePath({ targetRelativePath, timestamp }) {
  const targetPath = validateTargetRelativePath(targetRelativePath);
  const safeTimestamp = sanitizeTimestamp(timestamp);

  const relativeFromSyncRoot = targetPath.slice(SYNCTEST_PREFIX.length);
  const parsed = path.posix.parse(relativeFromSyncRoot);
  const suffix = `.local-before-resolution.${safeTimestamp}`;
  const backupFileName = parsed.ext
    ? `${parsed.name}${suffix}${parsed.ext}`
    : `${parsed.base}${suffix}`;
  const backupSubdir = parsed.dir && parsed.dir !== "." ? `${parsed.dir}/` : "";

  return `${BACKUPS_PREFIX}${backupSubdir}${backupFileName}`;
}

export function buildResolvedConflictRelativePath({ conflictRelativePath, timestamp }) {
  const conflictPath = validateConflictRelativePath(conflictRelativePath);
  const safeTimestamp = sanitizeTimestamp(timestamp);

  const relativeFromConflictsRoot = conflictPath.slice(CONFLICTS_PREFIX.length);
  const parsed = path.posix.parse(relativeFromConflictsRoot);
  const suffix = `.resolved-${safeTimestamp}`;
  const resolvedFileName = parsed.ext
    ? `${parsed.name}${suffix}${parsed.ext}`
    : `${parsed.base}${suffix}`;
  const resolvedSubdir = parsed.dir && parsed.dir !== "." ? `${parsed.dir}/` : "";

  return `${RESOLVED_PREFIX}${resolvedSubdir}${resolvedFileName}`;
}

export async function resolveConflict({ notebookDir, targetRelativePath, conflictRelativePath, action }) {
  const actionText = normalizeNonEmptyString(action, "action");
  if (actionText !== "use-conflict" && actionText !== "keep-local") {
    throw new Error("action must be \"use-conflict\" or \"keep-local\"");
  }

  const baseNotebookDir = path.resolve(normalizeNonEmptyString(notebookDir, "notebookDir"));
  const validated = validateSyncTestConflictPaths({ targetRelativePath, conflictRelativePath });
  const timestamp = new Date().toISOString();

  const targetPath = ensurePathWithinNotebookScope(
    baseNotebookDir,
    validated.targetRelativePath,
    SYNCTEST_ROOT,
    "targetRelativePath",
  );
  const conflictPath = ensurePathWithinNotebookScope(
    baseNotebookDir,
    validated.conflictRelativePath,
    CONFLICTS_PREFIX,
    "conflictRelativePath",
  );

  let backupRelativePath = null;
  if (actionText === "use-conflict") {
    const localTargetContent = await readRegularFile(targetPath, "target file");
    const remoteConflictContent = await readRegularFile(conflictPath, "conflict file");

    backupRelativePath = buildConflictBackupRelativePath({
      targetRelativePath: validated.targetRelativePath,
      timestamp,
    });
    const backupPath = ensurePathWithinNotebookScope(
      baseNotebookDir,
      backupRelativePath,
      BACKUPS_PREFIX,
      "backupRelativePath",
    );

    await fs.mkdir(path.dirname(backupPath), { recursive: true });
    await fs.writeFile(backupPath, localTargetContent);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, remoteConflictContent);
  } else {
    await readRegularFile(conflictPath, "conflict file");
  }

  const resolvedConflictRelativePath = buildResolvedConflictRelativePath({
    conflictRelativePath: validated.conflictRelativePath,
    timestamp,
  });
  const resolvedConflictPath = ensurePathWithinNotebookScope(
    baseNotebookDir,
    resolvedConflictRelativePath,
    RESOLVED_PREFIX,
    "resolvedConflictRelativePath",
  );
  await fs.mkdir(path.dirname(resolvedConflictPath), { recursive: true });
  await fs.rename(conflictPath, resolvedConflictPath);

  return {
    ok: true,
    action: actionText,
    targetRelativePath: validated.targetRelativePath,
    backupRelativePath,
    resolvedConflictRelativePath,
  };
}
