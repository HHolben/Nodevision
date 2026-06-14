// Nodevision/ApplicationSystem/Sync/SyncRecovery.mjs
// Creates mandatory pre-overwrite recovery snapshots for sync writes and restores saved snapshots on demand.

import fs from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { validateScopedRelativePath } from "./ScopePeerSync.mjs";
import { validateSyncScope } from "./SyncScopes.mjs";
import { resolveRuntimeRoot } from "./sync-sync-test-two-way.mjs";

function nowIso() {
  return new Date().toISOString();
}

function sanitizeJobId(value) {
  const text = String(value || "").trim();
  const cleaned = text.replace(/[^A-Za-z0-9_.-]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned || `sync-${Date.now()}-${randomUUID()}`;
}

export function createSyncRecoveryJobId(prefix = "sync") {
  return sanitizeJobId(`${prefix}-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID()}`);
}

export function resolveSyncRecoveryRoot(options = {}) {
  return path.resolve(resolveRuntimeRoot(options), "UserSettings", "SyncRecovery");
}

function normalizeMode(value) {
  const mode = String(value || "sync").trim().toLowerCase();
  return mode === "pull" || mode === "push" || mode === "sync" ? mode : "sync";
}

function normalizeRecoveryRelativePath({ scope, relativePath }) {
  const normalizedScope = validateSyncScope(scope);
  const normalizedRelativePath = validateScopedRelativePath(relativePath, normalizedScope);
  return normalizedRelativePath;
}

function assertInside(rootPath, targetPath, label) {
  const relative = path.relative(rootPath, targetPath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${label} escaped root`);
  }
}

async function hashFile(filePath) {
  const hasher = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) {
    hasher.update(chunk);
  }
  return hasher.digest("hex");
}

export async function getSyncFileMetadata(filePath) {
  const stat = await fs.stat(filePath);
  if (!stat.isFile()) throw new Error("path is not a file");
  return {
    size: Number(stat.size),
    sha256: await hashFile(filePath),
    mtimeMs: Math.trunc(stat.mtimeMs),
  };
}

export function metadataFromBuffer(buffer, fallback = {}) {
  const data = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || "");
  return {
    size: data.length,
    sha256: createHash("sha256").update(data).digest("hex"),
    mtimeMs: Number.isFinite(Number(fallback?.mtimeMs)) ? Math.trunc(Number(fallback.mtimeMs)) : null,
  };
}

export function normalizeIncomingMetadata(input = {}) {
  if (!input || typeof input !== "object") return null;
  const size = Number(input.size ?? input.bytes);
  const sha256 = String(input.sha256 || input.hash || "").trim().toLowerCase() || null;
  const mtimeMs = Number(input.mtimeMs);
  return {
    size: Number.isFinite(size) && size >= 0 ? Math.trunc(size) : null,
    sha256,
    mtimeMs: Number.isFinite(mtimeMs) && mtimeMs >= 0 ? Math.trunc(mtimeMs) : null,
  };
}

function normalizeDevice(input, fallbackName = "unknown") {
  if (!input || typeof input !== "object") {
    return { deviceId: null, deviceName: fallbackName };
  }
  return {
    deviceId: String(input.deviceId || "").trim() || null,
    deviceName: String(input.deviceName || input.name || fallbackName).trim() || fallbackName,
  };
}

async function readManifest(manifestPath, jobId) {
  try {
    const parsed = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      if (!Array.isArray(parsed.entries)) parsed.entries = [];
      return parsed;
    }
  } catch (err) {
    if (err?.code !== "ENOENT") throw err;
  }
  return {
    jobId,
    timestamp: nowIso(),
    mode: "sync",
    sourceDevice: normalizeDevice(null),
    destinationDevice: normalizeDevice(null),
    entries: [],
  };
}

async function writeManifest(manifestPath, manifest) {
  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  const tempPath = `${manifestPath}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tempPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await fs.rename(tempPath, manifestPath);
}

export async function createPreOverwriteRecoverySnapshot({
  runtimeRoot,
  jobId,
  scope,
  relativePath,
  targetPath,
  operation = "replace",
  mode = "sync",
  sourceDevice = null,
  destinationDevice = null,
  incoming = null,
} = {}) {
  const normalizedJobId = sanitizeJobId(jobId || createSyncRecoveryJobId(mode));
  const normalizedScope = validateSyncScope(scope);
  const recoveryRelativePath = normalizeRecoveryRelativePath({ scope: normalizedScope, relativePath });
  const recoveryRoot = resolveSyncRecoveryRoot({ runtimeRoot });
  const jobRoot = path.resolve(recoveryRoot, normalizedJobId);
  assertInside(recoveryRoot, jobRoot, "recovery job path");

  let oldMetadata;
  try {
    oldMetadata = await getSyncFileMetadata(targetPath);
  } catch (err) {
    if (err?.code === "ENOENT") {
      return {
        snapshotted: false,
        jobId: normalizedJobId,
        old: null,
        recoveryPath: null,
      };
    }
    throw err;
  }

  const recoveryPath = path.resolve(jobRoot, recoveryRelativePath);
  assertInside(jobRoot, recoveryPath, "recovery file path");
  await fs.mkdir(path.dirname(recoveryPath), { recursive: true });
  await fs.copyFile(targetPath, recoveryPath);

  const copiedMetadata = await getSyncFileMetadata(recoveryPath);
  if (copiedMetadata.sha256 !== oldMetadata.sha256 || copiedMetadata.size !== oldMetadata.size) {
    throw new Error("Recovery snapshot verification failed");
  }

  const manifestPath = path.resolve(jobRoot, "manifest.json");
  const manifest = await readManifest(manifestPath, normalizedJobId);
  const entry = {
    operation: String(operation || "replace"),
    originalPath: recoveryRelativePath,
    recoveryPath: path.relative(recoveryRoot, recoveryPath).split(path.sep).join("/"),
    old: oldMetadata,
    incoming: normalizeIncomingMetadata(incoming),
    timestamp: nowIso(),
  };
  manifest.jobId = normalizedJobId;
  manifest.mode = normalizeMode(mode || manifest.mode);
  manifest.sourceDevice = normalizeDevice(sourceDevice, manifest.sourceDevice?.deviceName || "unknown");
  manifest.destinationDevice = normalizeDevice(destinationDevice, manifest.destinationDevice?.deviceName || "unknown");
  manifest.entries.push(entry);
  manifest.operation = entry.operation;
  manifest.originalPath = entry.originalPath;
  manifest.recoveryPath = entry.recoveryPath;
  manifest.old = entry.old;
  manifest.incoming = entry.incoming;
  await writeManifest(manifestPath, manifest);

  return {
    snapshotted: true,
    jobId: normalizedJobId,
    recoveryPath,
    manifestPath,
    entry,
    old: oldMetadata,
  };
}

export async function listSyncRecoveryJobs(options = {}) {
  const recoveryRoot = resolveSyncRecoveryRoot(options);
  let entries = [];
  try {
    entries = await fs.readdir(recoveryRoot, { withFileTypes: true });
  } catch (err) {
    if (err?.code === "ENOENT") return [];
    throw err;
  }

  const jobs = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const jobId = sanitizeJobId(entry.name);
    if (jobId !== entry.name) continue;
    const manifestPath = path.resolve(recoveryRoot, jobId, "manifest.json");
    try {
      const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
      const recoveryEntries = Array.isArray(manifest.entries) ? manifest.entries : [];
      jobs.push({
        jobId,
        timestamp: manifest.timestamp || null,
        mode: manifest.mode || "sync",
        sourceDevice: normalizeDevice(manifest.sourceDevice),
        destinationDevice: normalizeDevice(manifest.destinationDevice),
        fileCount: recoveryEntries.length,
        entries: recoveryEntries,
      });
    } catch {
      // Ignore incomplete recovery directories.
    }
  }
  jobs.sort((a, b) => String(b.timestamp || "").localeCompare(String(a.timestamp || "")));
  return jobs;
}

function resolveNotebookTargetFromRecoveryEntry({ notebookDir, entry }) {
  const originalPath = String(entry?.originalPath || "").trim();
  const scope = originalPath.split("/")[0] || "";
  const normalizedScope = validateSyncScope(scope);
  const normalizedRelativePath = validateScopedRelativePath(originalPath, normalizedScope);
  const notebookRoot = path.resolve(String(notebookDir || ""));
  const targetPath = path.resolve(notebookRoot, normalizedRelativePath);
  assertInside(notebookRoot, targetPath, "restore target path");
  return { targetPath, normalizedRelativePath };
}

export async function restoreSyncRecoveryFiles({
  runtimeRoot,
  notebookDir,
  jobId,
  relativePaths = null,
} = {}) {
  const normalizedJobId = sanitizeJobId(jobId);
  const recoveryRoot = resolveSyncRecoveryRoot({ runtimeRoot });
  const jobRoot = path.resolve(recoveryRoot, normalizedJobId);
  assertInside(recoveryRoot, jobRoot, "recovery job path");
  const manifestPath = path.resolve(jobRoot, "manifest.json");
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  const wanted = Array.isArray(relativePaths) && relativePaths.length
    ? new Set(relativePaths.map((item) => String(item || "").trim()).filter(Boolean))
    : null;
  const entries = Array.isArray(manifest.entries) ? manifest.entries : [];
  const restored = [];
  const resolvedNotebookDir = path.resolve(String(notebookDir || path.resolve(resolveRuntimeRoot({ runtimeRoot }), "Notebook")));

  for (const entry of entries) {
    const originalPath = String(entry?.originalPath || "").trim();
    if (wanted && !wanted.has(originalPath)) continue;
    const recoveryPathRelative = String(entry?.recoveryPath || "").trim();
    const recoveryPath = path.resolve(recoveryRoot, recoveryPathRelative);
    assertInside(jobRoot, recoveryPath, "recovery source path");
    const { targetPath, normalizedRelativePath } = resolveNotebookTargetFromRecoveryEntry({
      notebookDir: resolvedNotebookDir,
      entry,
    });
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.copyFile(recoveryPath, targetPath);
    restored.push({
      originalPath: normalizedRelativePath,
      recoveryPath: recoveryPathRelative,
      restoredPath: normalizedRelativePath,
    });
  }

  return {
    ok: true,
    jobId: normalizedJobId,
    restored,
  };
}
