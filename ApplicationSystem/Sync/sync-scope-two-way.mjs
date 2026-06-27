// Nodevision/ApplicationSystem/Sync/sync-scope-two-way.mjs
// This script performs safe two-way synchronization for a validated configured Notebook scope by planning pulls/pushes/conflicts, applying without blind overwrite, and returning JSON reports.

import fs from "node:fs/promises";
import path from "node:path";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { buildScopeManifest, compareScopeManifests, isPathInsideScope, loadSyncScopes, validateSyncScope } from "./SyncScopes.mjs";
import { normalizePeerUrl, resolveRuntimeRoot } from "./sync-sync-test-two-way.mjs";
import { MAX_FILE_PUSH_BYTES } from "./PeerFileTransfer.mjs";
import { createCancelledError, pullScopeFileStream } from "./pull-scope-file-stream.mjs";
import { pushScopeFileStream } from "./push-scope-file-stream.mjs";
import { createPreOverwriteRecoverySnapshot, createSyncRecoveryJobId } from "./SyncRecovery.mjs";
import { HttpSyncTransport } from "./SyncTransport.mjs";

const hash = (b) => createHash("sha256").update(b).digest("hex");
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
function extensionSummary(relativePath) {
  const ext = path.posix.extname(String(relativePath || "")).toLowerCase();
  return {
    extension: ext || null,
    image: IMAGE_EXTENSIONS.has(ext),
  };
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
    };
  } catch {
    return { parsed: false, deviceId: null, scope: null, relativePath: null, timestampPresent: false };
  }
}

function logSignedScopeFileFetchStart({ endpoint, method, operation, caller, transferMode, signed, rawRelativePath, normalizedRelativePath }) {
  try {
    const payloadFields = summarizeSignedPayloadForLog(signed?.payload);
    const normalizedPath = normalizedRelativePath || payloadFields.relativePath || "";
    const ext = extensionSummary(normalizedPath);
    console.debug("[sync] signed scope file fetch start", {
      endpoint,
      method,
      operation,
      caller,
      transferMode,
      extension: ext.extension,
      image: ext.image,
      contentType: transferMode === "json" ? "application/json" : null,
      scope: payloadFields.scope,
      relativePath: payloadFields.relativePath,
      deviceId: payloadFields.deviceId,
      signed: typeof signed?.payload === "string" && signed.payload.length > 0
        && typeof signed?.signatureBase64 === "string" && signed.signatureBase64.length > 0,
      deviceIdPresent: typeof payloadFields.deviceId === "string" && payloadFields.deviceId.length > 0,
      timestampPresent: Boolean(payloadFields.timestampPresent),
      relativePathRawLength: typeof rawRelativePath === "string" ? rawRelativePath.length : null,
      relativePathNormalizedLength: typeof normalizedPath === "string" ? normalizedPath.length : null,
    });
  } catch {}
}

function buildScopedConflictRelativePath(originalRelativePath, peerDeviceId, timestamp) {
  const parsed = path.posix.parse(originalRelativePath);
  const safeTs = new Date(Date.parse(timestamp)).toISOString().replaceAll(":", "-").replaceAll(".", "-");
  const safePeer = String(peerDeviceId || "peer").replace(/[^A-Za-z0-9_-]+/g, "-");
  const name = parsed.ext ? `${parsed.name}.from-${safePeer}.${safeTs}${parsed.ext}` : `${parsed.base}.from-${safePeer}.${safeTs}`;
  return `${parsed.dir.split("/")[0]}/.conflicts/${parsed.dir.split("/").slice(1).filter(Boolean).join("/")}${parsed.dir.includes("/") ? "/" : ""}${name}`.replace(/\/\.conflicts\/$/, "/.conflicts");
}

function toManifestEntryMap(manifest) {
  const files = Array.isArray(manifest?.files) ? manifest.files : [];
  return new Map(files.map((entry) => [String(entry?.relativePath || ""), entry]));
}

function toNonNegativeSize(value) {
  const size = Number(value);
  if (!Number.isFinite(size) || size < 0) return 0;
  return Math.trunc(size);
}

function normalizeSyncErrorMessage(err) {
  const text = String(err?.message || err || "Sync operation failed").trim();
  return text || "Sync operation failed";
}

function normalizeSyncErrorStatusCode(err) {
  const parsed = Number(err?.status ?? err?.statusCode ?? err?.response?.status);
  return Number.isFinite(parsed) && parsed >= 100 && parsed <= 599 ? Math.trunc(parsed) : null;
}

function normalizeFileErrorMode(value) {
  const mode = String(value || "fail").trim().toLowerCase();
  return mode === "pause" || mode === "skip" ? mode : "fail";
}

export function normalizeSyncDirection(value) {
  const direction = String(value || "sync").trim().toLowerCase();
  if (direction === "pull" || direction === "pull-from-peer" || direction === "peer-to-local") return "pull";
  if (direction === "push" || direction === "push-to-peer" || direction === "local-to-peer") return "push";
  if (direction === "sync" || direction === "two-way" || direction === "two-way-sync") return "sync";
  return "sync";
}

function directionSkipRecord({ relativePath, operation, entry, localEntry = null, remoteEntry = null, syncDirection }) {
  return {
    relativePath,
    operation,
    size: toNonNegativeSize(entry?.size),
    localSize: localEntry ? toNonNegativeSize(localEntry.size) : null,
    remoteSize: remoteEntry ? toNonNegativeSize(remoteEntry.size) : null,
    syncDirection,
    reason: "disallowed_by_sync_direction",
  };
}

function applySyncDirectionToPlan(plan, localEntries, remoteEntries, syncDirection) {
  const direction = normalizeSyncDirection(syncDirection);
  const nextPlan = { onlyLocal: [], onlyRemote: [], changed: [], same: Array.from(plan.same || []) };
  const skippedByDirection = [];

  if (direction === "sync") {
    return { plan, skippedByDirection, syncDirection: direction };
  }

  for (const relativePath of plan.onlyRemote || []) {
    const remoteEntry = remoteEntries.get(relativePath);
    if (direction === "pull") {
      nextPlan.onlyRemote.push(relativePath);
    } else {
      skippedByDirection.push(directionSkipRecord({ relativePath, operation: "pull", entry: remoteEntry, remoteEntry, syncDirection: direction }));
    }
  }

  for (const relativePath of plan.onlyLocal || []) {
    const localEntry = localEntries.get(relativePath);
    if (direction === "push") {
      nextPlan.onlyLocal.push(relativePath);
    } else {
      skippedByDirection.push(directionSkipRecord({ relativePath, operation: "push", entry: localEntry, localEntry, syncDirection: direction }));
    }
  }

  for (const relativePath of plan.changed || []) {
    const localEntry = localEntries.get(relativePath);
    const remoteEntry = remoteEntries.get(relativePath);
    nextPlan.changed.push(relativePath);
    if (direction === "pull") {
      skippedByDirection.push(directionSkipRecord({ relativePath, operation: "push", entry: localEntry, localEntry, remoteEntry, syncDirection: direction }));
    } else if (direction === "push") {
      skippedByDirection.push(directionSkipRecord({ relativePath, operation: "pull", entry: remoteEntry, localEntry, remoteEntry, syncDirection: direction }));
    }
  }

  return { plan: nextPlan, skippedByDirection, syncDirection: direction };
}

function shouldUseStreamTransfer(manifestEntry) {
  if (manifestEntry?.transferMode === "stream" || manifestEntry?.tooLargeForJson === true) return true;
  const size = Number(manifestEntry?.size);
  return Number.isFinite(size) && size > MAX_FILE_PUSH_BYTES;
}

function isJsonPullTooLargeError(err) {
  const message = normalizeSyncErrorMessage(err).toLowerCase();
  return message === "file too large"
    || message.includes("file too large")
    || message.includes("content exceeds");
}

function isJsonPushTooLargeError(err) {
  const message = normalizeSyncErrorMessage(err).toLowerCase();
  return message === "file too large for json push"
    || message.includes("too large for json push")
    || message.includes("content exceeds")
    || message.includes("size limit");
}

function normalizeMaxFileSizeBytes(value) {
  if (value === undefined || value === null || value === "") return null;
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return null;
  return Math.min(Math.trunc(bytes), Number.MAX_SAFE_INTEGER);
}

function isEntryOverSizeLimit(entry, maxFileSizeBytes) {
  if (maxFileSizeBytes === null) return false;
  const size = Number(entry?.size);
  return Number.isFinite(size) && size > maxFileSizeBytes;
}

function sizeLimitSkipRecord({ relativePath, operation, entry, localEntry = null, remoteEntry = null, maxFileSizeBytes }) {
  return {
    relativePath,
    operation,
    size: toNonNegativeSize(entry?.size),
    localSize: localEntry ? toNonNegativeSize(localEntry.size) : null,
    remoteSize: remoteEntry ? toNonNegativeSize(remoteEntry.size) : null,
    maxFileSizeBytes,
  };
}

function applyFileSizeLimitToPlan(plan, localEntries, remoteEntries, maxFileSizeBytes) {
  const normalizedLimit = normalizeMaxFileSizeBytes(maxFileSizeBytes);
  const skippedBySize = [];
  if (normalizedLimit === null) {
    return { plan, skippedBySize, maxFileSizeBytes: null };
  }

  const nextPlan = { onlyLocal: [], onlyRemote: [], changed: [], same: Array.from(plan.same || []) };
  for (const relativePath of plan.onlyRemote || []) {
    const remoteEntry = remoteEntries.get(relativePath);
    if (isEntryOverSizeLimit(remoteEntry, normalizedLimit)) {
      skippedBySize.push(sizeLimitSkipRecord({ relativePath, operation: "pull", entry: remoteEntry, remoteEntry, maxFileSizeBytes: normalizedLimit }));
    } else {
      nextPlan.onlyRemote.push(relativePath);
    }
  }
  for (const relativePath of plan.onlyLocal || []) {
    const localEntry = localEntries.get(relativePath);
    if (isEntryOverSizeLimit(localEntry, normalizedLimit)) {
      skippedBySize.push(sizeLimitSkipRecord({ relativePath, operation: "push", entry: localEntry, localEntry, maxFileSizeBytes: normalizedLimit }));
    } else {
      nextPlan.onlyLocal.push(relativePath);
    }
  }
  for (const relativePath of plan.changed || []) {
    const localEntry = localEntries.get(relativePath);
    const remoteEntry = remoteEntries.get(relativePath);
    if (isEntryOverSizeLimit(remoteEntry, normalizedLimit)) {
      skippedBySize.push(sizeLimitSkipRecord({ relativePath, operation: "conflict", entry: remoteEntry, localEntry, remoteEntry, maxFileSizeBytes: normalizedLimit }));
    } else {
      nextPlan.changed.push(relativePath);
    }
  }
  return { plan: nextPlan, skippedBySize, maxFileSizeBytes: normalizedLimit };
}

function resolveLocalPathFromRelativePath({ notebookDir, scope, relativePath }) {
  const scopeRoot = path.resolve(notebookDir, scope);
  return path.resolve(scopeRoot, relativePath.slice(`${scope}/`.length));
}

async function shouldUseStreamPushForLocalFile({ manifestEntry, notebookDir, scope, relativePath }) {
  if (shouldUseStreamTransfer(manifestEntry)) return true;
  try {
    const localPath = resolveLocalPathFromRelativePath({ notebookDir, scope, relativePath });
    const stat = await fs.stat(localPath);
    return stat.isFile() && stat.size > MAX_FILE_PUSH_BYTES;
  } catch {
    return false;
  }
}

async function saveScopedConflictCopy({ notebookDir, scope, originalRelativePath, contentBuffer, peerDeviceId, timestamp }) {
  const conflictRelativePath = buildScopedConflictRelativePath(originalRelativePath, peerDeviceId, timestamp);
  const scopeRoot = path.resolve(notebookDir, scope);
  const conflictRoot = path.resolve(scopeRoot, ".conflicts");
  const target = path.resolve(scopeRoot, conflictRelativePath.slice(`${scope}/`.length));
  const rel = path.relative(conflictRoot, target);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) throw new Error("conflict path escaped scope");
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, contentBuffer);
  return { relativePath: conflictRelativePath, bytes: contentBuffer.length };
}

async function fetchManifest(transport, scope) {
  return transport.listFiles(scope);
}

async function fetchRemoteFile(transport, scope, relativePath, { operation = "pull", caller = "normal pull" } = {}) {
  const rawRelativePath = typeof relativePath === "string" ? relativePath : String(relativePath ?? "");
  logSignedScopeFileFetchStart({
    endpoint: "transport:getFile",
    method: transport?.kind || "transport",
    operation,
    caller,
    transferMode: "json",
    signed: null,
    rawRelativePath,
    normalizedRelativePath: rawRelativePath,
  });
  return transport.getFile(scope, relativePath);
}

async function pullOne({ transport, scope, relativePath, notebookDir, runtimeRoot, saveMode = "auto", recoveryJobId = null, sourceDevice = null, destinationDevice = null, incomingEntry = null }) {
  const remote = await fetchRemoteFile(transport, scope, relativePath, { operation: "pull", caller: "normal pull" });
  if (remote.relativePath !== relativePath) throw new Error("mismatched relativePath");
  const buf = Buffer.from(String(remote.contentBase64 || ""), "base64");
  if (buf.toString("base64") !== remote.contentBase64) throw new Error("invalid base64");
  if (buf.length > MAX_FILE_PUSH_BYTES) throw new Error("file too large");
  const incomingSha = hash(buf);
  if (incomingSha !== String(remote.sha256 || "")) throw new Error("sha mismatch");
  const scopeRoot = path.resolve(notebookDir, scope);
  const target = path.resolve(scopeRoot, relativePath.slice(`${scope}/`.length));
  if (!isPathInsideScope({ relativePath, scope })) throw new Error("scope escape");
  const incoming = {
    size: buf.length,
    sha256: incomingSha,
    mtimeMs: Number.isFinite(Number(incomingEntry?.mtimeMs ?? remote.mtimeMs)) ? Math.trunc(Number(incomingEntry?.mtimeMs ?? remote.mtimeMs)) : null,
  };
  await fs.mkdir(path.dirname(target), { recursive: true });
  try {
    const existing = await fs.readFile(target);
    const existingSha = hash(existing);
    if (existingSha === incomingSha) {
      return { relativePath, bytes: buf.length, sha256: incomingSha, mode: "noop", savedRelativePath: relativePath };
    }
    await createPreOverwriteRecoverySnapshot({
      runtimeRoot,
      jobId: recoveryJobId,
      scope,
      relativePath,
      targetPath: target,
      operation: saveMode === "replace" ? "replace" : "write",
      mode: "pull",
      sourceDevice,
      destinationDevice,
      incoming,
    });
  } catch (err) {
    if (err?.code !== "ENOENT") throw err;
  }
  await fs.writeFile(target, buf);
  return { relativePath, bytes: buf.length, sha256: incomingSha, mode: saveMode === "replace" ? "replaced" : "created", savedRelativePath: relativePath };
}

async function pullOneStream({ peerUrl, scope, relativePath, notebookDir, runtimeRoot, shouldCancel, onByteDelta, saveMode = "auto", recoveryJobId = null, sourceDevice = null, destinationDevice = null, incomingEntry = null }) {
  const report = await pullScopeFileStream({
    peerUrl,
    scope,
    relativePath,
    notebookDir,
    runtimeRoot,
    shouldCancel,
    onByteDelta,
    peerLabel: "peer",
    saveMode,
    recoveryJobId,
    sourceDevice,
    destinationDevice,
    incomingEntry,
  });
  if (!report?.ok) throw new Error("stream pull did not complete");
  return {
    relativePath,
    bytes: toNonNegativeSize(report.bytesDownloaded),
    sha256: String(report.sha256 || ""),
    mode: String(report.mode || "created"),
    savedRelativePath: String(report.savedRelativePath || relativePath),
    conflictRelativePath: report.conflictRelativePath ? String(report.conflictRelativePath) : null,
    transferMode: "stream",
  };
}

async function pushOne({ transport, peerUrl, scope, relativePath, notebookDir, runtimeRoot, saveMode = "auto", recoveryJobId = null }) {
  const localPath = resolveLocalPathFromRelativePath({ notebookDir, scope, relativePath });
  const stat = await fs.stat(localPath);
  if (!stat.isFile()) throw new Error("local path is not a file");
  if (stat.size > MAX_FILE_PUSH_BYTES) {
    return pushOneStream({
      peerUrl,
      scope,
      relativePath,
      notebookDir,
      runtimeRoot,
      saveMode,
      recoveryJobId,
    });
  }
  const buf = await fs.readFile(localPath);
  const body = await transport.putFile(scope, relativePath, buf, {
    contentType: "application/octet-stream",
    mtimeMs: Math.trunc(stat.mtimeMs),
    saveMode,
    recoveryJobId,
  });
  const saved = body?.saved && typeof body.saved === "object" ? body.saved : {};
  return {
    relativePath,
    bytes: buf.length,
    sha256: hash(buf),
    mode: String(saved.mode || "created"),
    savedRelativePath: String(saved.relativePath || relativePath),
    conflictRelativePath: saved.conflictRelativePath ? String(saved.conflictRelativePath) : null,
    transferMode: "json",
  };
}

async function pushOneStream({ peerUrl, scope, relativePath, notebookDir, runtimeRoot, shouldCancel, onByteDelta, saveMode = "auto", recoveryJobId = null }) {
  const report = await pushScopeFileStream({
    peerUrl,
    scope,
    relativePath,
    notebookDir,
    runtimeRoot,
    shouldCancel,
    onByteDelta,
    saveMode,
    recoveryJobId,
  });
  if (!report?.ok) throw new Error("stream push did not complete");
  return {
    relativePath,
    bytes: toNonNegativeSize(report.bytesUploaded),
    sha256: String(report.sha256 || ""),
    mode: String(report.mode || "created"),
    savedRelativePath: String(report.savedRelativePath || relativePath),
    conflictRelativePath: report.conflictRelativePath ? String(report.conflictRelativePath) : null,
    transferMode: "stream",
  };
}

async function pullConflict({ transport, scope, relativePath, notebookDir, runtimeRoot, peerDeviceId }) {
  const remote = await fetchRemoteFile(transport, scope, relativePath, { operation: "conflict", caller: "conflict resolver" });
  const buf = Buffer.from(String(remote.contentBase64 || ""), "base64");
  const expected = String(remote.sha256 || "");
  const actual = hash(buf);
  if (actual !== expected) throw new Error("sha mismatch");
  const saved = await saveScopedConflictCopy({
    notebookDir,
    scope,
    originalRelativePath: relativePath,
    contentBuffer: buf,
    peerDeviceId,
    timestamp: new Date().toISOString(),
  });
  return { originalRelativePath: relativePath, conflictRelativePath: saved.relativePath, bytes: buf.length, sha256: actual };
}

async function pullConflictStream({
  peerUrl,
  scope,
  relativePath,
  notebookDir,
  runtimeRoot,
  shouldCancel,
  onByteDelta,
}) {
  const report = await pullScopeFileStream({
    peerUrl,
    scope,
    relativePath,
    notebookDir,
    runtimeRoot,
    shouldCancel,
    peerLabel: "peer",
    operation: "conflict",
    caller: "conflict resolver",
    saveMode: "conflict",
    onByteDelta,
  });
  if (!report?.ok) throw new Error("stream conflict pull did not complete");
  return {
    originalRelativePath: relativePath,
    conflictRelativePath: report.conflictRelativePath || null,
    savedRelativePath: report.savedRelativePath || relativePath,
    mode: report.mode || "created",
    bytes: toNonNegativeSize(report.bytesDownloaded),
    sha256: String(report.sha256 || ""),
    transferMode: "stream",
    direction: "pull",
  };
}

function normalizePushedConflictReport(relativePath, report) {
  return {
    originalRelativePath: relativePath,
    conflictRelativePath: report?.conflictRelativePath || null,
    savedRelativePath: report?.savedRelativePath || relativePath,
    mode: report?.mode || "created",
    bytes: toNonNegativeSize(report?.bytes),
    sha256: String(report?.sha256 || ""),
    transferMode: report?.transferMode || "json",
    direction: "push",
  };
}

export async function runScopeSyncTwoWay({
  peerUrl,
  scope,
  runtimeRoot,
  dryRun = true,
  shouldCancel,
  onProgress,
  onFileError = "fail",
  onFileErrorControl,
  maxFileSizeBytes = null,
  syncDirection = "sync",
  transport = null,
} = {}) {
  const resolvedRuntimeRoot = resolveRuntimeRoot({ runtimeRoot });
  const syncTransport = transport || new HttpSyncTransport({ peerUrl, runtimeRoot: resolvedRuntimeRoot });
  const normalizedPeerUrl = syncTransport.peerUrl ? normalizePeerUrl(syncTransport.peerUrl) : String(peerUrl || syncTransport.kind || "sync-transport");
  const normalizedScope = validateSyncScope(scope);
  const loaded = await loadSyncScopes({ runtimeRoot: resolvedRuntimeRoot });
  if (!loaded.syncScopes.includes(normalizedScope)) throw new Error(`Scope is not enabled: ${normalizedScope}`);
  const notebookDir = path.resolve(resolvedRuntimeRoot, "Notebook");

  const remoteBefore = await fetchManifest(syncTransport, normalizedScope);
  const localBefore = await buildScopeManifest({ notebookDir, scope: normalizedScope });
  const rawPlan = await compareScopeManifests(localBefore, remoteBefore);
  const localEntries = toManifestEntryMap(localBefore);
  const remoteEntries = toManifestEntryMap(remoteBefore);
  const limited = applyFileSizeLimitToPlan(rawPlan, localEntries, remoteEntries, maxFileSizeBytes);
  const directional = applySyncDirectionToPlan(limited.plan, localEntries, remoteEntries, syncDirection);
  const plan = directional.plan;
  const normalizedSyncDirection = directional.syncDirection;
  const progressState = {
    filesTotal: plan.onlyRemote.length + plan.onlyLocal.length + plan.changed.length,
    filesDone: 0,
    filesSkipped: 0,
    bytesTotal: 0,
    bytesDone: 0,
    bytesSkipped: 0,
    currentFile: null,
  };
  const fileErrorMode = normalizeFileErrorMode(onFileError);
  const skippedOperations = [];
  const emitProgress = (event, details = {}) => {
    if (typeof onProgress !== "function") return;
    onProgress({
      event,
      ...progressState,
      ...details,
    });
  };
  const ensureNotCancelled = () => {
    if (typeof shouldCancel === "function" && shouldCancel()) throw createCancelledError();
  };
  for (const rp of plan.onlyRemote) {
    progressState.bytesTotal += toNonNegativeSize(remoteEntries.get(rp)?.size);
  }
  for (const rp of plan.onlyLocal) {
    progressState.bytesTotal += toNonNegativeSize(localEntries.get(rp)?.size);
  }
  for (const rp of plan.changed) {
    const entry = normalizedSyncDirection === "push" ? localEntries.get(rp) : remoteEntries.get(rp);
    progressState.bytesTotal += toNonNegativeSize(entry?.size);
  }
  emitProgress("plan");

  if (dryRun) {
    return { ok: true, dryRun: true, scope: normalizedScope, peerUrl: normalizedPeerUrl, syncDirection: normalizedSyncDirection, maxFileSizeBytes: limited.maxFileSizeBytes, before: { localFileCount: localBefore.files.length, remoteFileCount: remoteBefore.files.length, plan, unfilteredPlan: rawPlan }, operations: { wouldPull: plan.onlyRemote, wouldPush: plan.onlyLocal, wouldConflict: plan.changed, skipped: { same: plan.same, oversized: limited.skippedBySize, direction: directional.skippedByDirection } } };
  }

  const pulled = []; const pushed = []; const conflicts = [];
  const estimateBytes = (operation, relativePath) => {
    const entry = operation === "push" || (operation === "conflict" && normalizedSyncDirection === "push")
      ? localEntries.get(relativePath)
      : remoteEntries.get(relativePath);
    return toNonNegativeSize(entry?.size);
  };
  const recordSkippedOperation = ({ operation, relativePath, err, retryCount }) => {
    const skipped = {
      operation,
      type: operation,
      scope: normalizedScope,
      peerUrl: normalizedPeerUrl,
      relativePath,
      error: normalizeSyncErrorMessage(err),
      statusCode: normalizeSyncErrorStatusCode(err),
      retryCount: toNonNegativeSize(retryCount),
      safelyRetryable: true,
      bytes: estimateBytes(operation, relativePath),
      timestamp: new Date().toISOString(),
    };
    skippedOperations.push(skipped);
    progressState.filesSkipped = skippedOperations.length;
    progressState.bytesSkipped += toNonNegativeSize(skipped.bytes);
    return skipped;
  };
  const handleFailedFile = async ({ operation, relativePath, err, retryCount, bytesBefore, emitSkippedProgress = true }) => {
    progressState.bytesDone = bytesBefore;
    const statusCode = normalizeSyncErrorStatusCode(err);
    emitProgress("file-error", {
      operation,
      relativePath,
      error: normalizeSyncErrorMessage(err),
      statusCode,
      retryCount,
      safelyRetryable: true,
      scope: normalizedScope,
      peerUrl: normalizedPeerUrl,
    });
    if (fileErrorMode === "fail") throw err;
    if (fileErrorMode === "skip") {
      const skipped = recordSkippedOperation({ operation, relativePath, err, retryCount });
      if (emitSkippedProgress) emitProgress("file-skipped", skipped);
      return "skip";
    }
    if (typeof onFileErrorControl !== "function") throw err;
    const decision = await onFileErrorControl({
      operation,
      scope: normalizedScope,
      peerUrl: normalizedPeerUrl,
      relativePath,
      error: normalizeSyncErrorMessage(err),
      statusCode,
      retryCount,
      safelyRetryable: true,
      bytes: estimateBytes(operation, relativePath),
      progress: { ...progressState },
      timestamp: new Date().toISOString(),
    });
    const action = String(decision?.action || "").toLowerCase();
    if (action === "retry") return "retry";
    if (action === "skip") {
      const skipped = recordSkippedOperation({ operation, relativePath, err, retryCount: decision?.retryCount ?? retryCount });
      return "skip";
    }
    const cancelled = createCancelledError("Sync job aborted after file error");
    cancelled.name = "SyncJobCancelledError";
    throw cancelled;
  };
  for (const rp of plan.onlyRemote) {
    ensureNotCancelled();
    progressState.currentFile = rp;
    emitProgress("file-start", { operation: "pull", relativePath: rp });
    let retryCount = 0;
    while (true) {
      const bytesBefore = progressState.bytesDone;
      try {
        const remoteEntry = remoteEntries.get(rp);
        let useStream = shouldUseStreamTransfer(remoteEntry);
        let pulledReport;
        try {
          pulledReport = useStream
            ? await pullOneStream({
              peerUrl: normalizedPeerUrl,
              scope: normalizedScope,
              relativePath: rp,
              notebookDir,
              runtimeRoot: resolvedRuntimeRoot,
              shouldCancel,
              onByteDelta(delta) {
                progressState.bytesDone += toNonNegativeSize(delta);
                emitProgress("file-progress", { operation: "pull", relativePath: rp });
              },
            })
            : await pullOne({
              transport: syncTransport,
              peerUrl: normalizedPeerUrl,
              scope: normalizedScope,
              relativePath: rp,
              notebookDir,
              runtimeRoot: resolvedRuntimeRoot,
            });
        } catch (err) {
          if (!useStream && isJsonPullTooLargeError(err)) {
            useStream = true;
            pulledReport = await pullOneStream({
              peerUrl: normalizedPeerUrl,
              scope: normalizedScope,
              relativePath: rp,
              notebookDir,
              runtimeRoot: resolvedRuntimeRoot,
              shouldCancel,
              onByteDelta(delta) {
                progressState.bytesDone += toNonNegativeSize(delta);
                emitProgress("file-progress", { operation: "pull", relativePath: rp });
              },
            });
          } else {
            throw err;
          }
        }
        if (!useStream) {
          progressState.bytesDone += toNonNegativeSize(pulledReport?.bytes);
        }
        progressState.filesDone += 1;
        pulled.push(pulledReport);
        emitProgress("file-complete", { operation: "pull", relativePath: rp });
        break;
      } catch (err) {
        const action = await handleFailedFile({ operation: "pull", relativePath: rp, err, retryCount, bytesBefore });
        if (action === "retry") {
          retryCount += 1;
          ensureNotCancelled();
          emitProgress("file-retry", { operation: "pull", relativePath: rp, retryCount });
          continue;
        }
        if (action === "skip") break;
      }
    }
  }
  for (const rp of plan.onlyLocal) {
    ensureNotCancelled();
    progressState.currentFile = rp;
    emitProgress("file-start", { operation: "push", relativePath: rp });
    let retryCount = 0;
    while (true) {
      const bytesBefore = progressState.bytesDone;
      try {
        const localEntry = localEntries.get(rp);
        let useStream = await shouldUseStreamPushForLocalFile({
          manifestEntry: localEntry,
          notebookDir,
          scope: normalizedScope,
          relativePath: rp,
        });
        let pushedReport;
        try {
          pushedReport = useStream
            ? await pushOneStream({
              peerUrl: normalizedPeerUrl,
              scope: normalizedScope,
              relativePath: rp,
              notebookDir,
              runtimeRoot: resolvedRuntimeRoot,
              shouldCancel,
              onByteDelta(delta) {
                progressState.bytesDone += toNonNegativeSize(delta);
                emitProgress("file-progress", { operation: "push", relativePath: rp });
              },
            })
            : await pushOne({
              transport: syncTransport,
              peerUrl: normalizedPeerUrl,
              scope: normalizedScope,
              relativePath: rp,
              notebookDir,
              runtimeRoot: resolvedRuntimeRoot,
            });
        } catch (err) {
          if (!useStream && isJsonPushTooLargeError(err)) {
            useStream = true;
            pushedReport = await pushOneStream({
              peerUrl: normalizedPeerUrl,
              scope: normalizedScope,
              relativePath: rp,
              notebookDir,
              runtimeRoot: resolvedRuntimeRoot,
              shouldCancel,
              onByteDelta(delta) {
                progressState.bytesDone += toNonNegativeSize(delta);
                emitProgress("file-progress", { operation: "push", relativePath: rp });
              },
            });
          } else {
            throw err;
          }
        }
        if (!useStream) {
          progressState.bytesDone += toNonNegativeSize(pushedReport?.bytes);
        }
        progressState.filesDone += 1;
        pushed.push(pushedReport);
        emitProgress("file-complete", { operation: "push", relativePath: rp });
        break;
      } catch (err) {
        const action = await handleFailedFile({ operation: "push", relativePath: rp, err, retryCount, bytesBefore });
        if (action === "retry") {
          retryCount += 1;
          ensureNotCancelled();
          emitProgress("file-retry", { operation: "push", relativePath: rp, retryCount });
          continue;
        }
        if (action === "skip") break;
      }
    }
  }
  for (const rp of plan.changed) {
    ensureNotCancelled();
    progressState.currentFile = rp;
    emitProgress("file-start", { operation: "conflict", relativePath: rp });
    let retryCount = 0;
    while (true) {
      const bytesBefore = progressState.bytesDone;
      try {
        const operationDirection = normalizedSyncDirection === "push" ? "push" : "pull";
        let useStream;
        let conflictReport;
        if (operationDirection === "push") {
          const localEntry = localEntries.get(rp);
          useStream = await shouldUseStreamPushForLocalFile({
            manifestEntry: localEntry,
            notebookDir,
            scope: normalizedScope,
            relativePath: rp,
          });
          try {
            conflictReport = normalizePushedConflictReport(rp, useStream
              ? await pushOneStream({
                peerUrl: normalizedPeerUrl,
                scope: normalizedScope,
                relativePath: rp,
                notebookDir,
                runtimeRoot: resolvedRuntimeRoot,
                shouldCancel,
                onByteDelta(delta) {
                  progressState.bytesDone += toNonNegativeSize(delta);
                  emitProgress("file-progress", { operation: "conflict", relativePath: rp, syncDirection: normalizedSyncDirection });
                },
              })
              : await pushOne({
                transport: syncTransport,
                peerUrl: normalizedPeerUrl,
                scope: normalizedScope,
                relativePath: rp,
                notebookDir,
                runtimeRoot: resolvedRuntimeRoot,
              }));
          } catch (err) {
            if (!useStream && isJsonPushTooLargeError(err)) {
              useStream = true;
              conflictReport = normalizePushedConflictReport(rp, await pushOneStream({
                peerUrl: normalizedPeerUrl,
                scope: normalizedScope,
                relativePath: rp,
                notebookDir,
                runtimeRoot: resolvedRuntimeRoot,
                shouldCancel,
                onByteDelta(delta) {
                  progressState.bytesDone += toNonNegativeSize(delta);
                  emitProgress("file-progress", { operation: "conflict", relativePath: rp, syncDirection: normalizedSyncDirection });
                },
              }));
            } else {
              throw err;
            }
          }
        } else {
          const remoteEntry = remoteEntries.get(rp);
          useStream = shouldUseStreamTransfer(remoteEntry);
          conflictReport = useStream
            ? await pullConflictStream({
              peerUrl: normalizedPeerUrl,
              scope: normalizedScope,
              relativePath: rp,
              notebookDir,
              runtimeRoot: resolvedRuntimeRoot,
              shouldCancel,
              onByteDelta(delta) {
                progressState.bytesDone += toNonNegativeSize(delta);
                emitProgress("file-progress", { operation: "conflict", relativePath: rp, syncDirection: normalizedSyncDirection });
              },
            })
            : await pullConflict({
              transport: syncTransport,
              peerUrl: normalizedPeerUrl,
              scope: normalizedScope,
              relativePath: rp,
              notebookDir,
              runtimeRoot: resolvedRuntimeRoot,
              peerDeviceId: "peer",
            });
        }
        if (!useStream) {
          progressState.bytesDone += toNonNegativeSize(conflictReport?.bytes);
        }
        progressState.filesDone += 1;
        conflicts.push(conflictReport);
        emitProgress("file-complete", { operation: "conflict", relativePath: rp });
        break;
      } catch (err) {
        const action = await handleFailedFile({ operation: "conflict", relativePath: rp, err, retryCount, bytesBefore });
        if (action === "retry") {
          retryCount += 1;
          ensureNotCancelled();
          emitProgress("file-retry", { operation: "conflict", relativePath: rp, retryCount });
          continue;
        }
        if (action === "skip") break;
      }
    }
  }
  progressState.currentFile = null;
  emitProgress("sync-complete");

  const localAfter = await buildScopeManifest({ notebookDir, scope: normalizedScope });
  const remoteAfter = await fetchManifest(syncTransport, normalizedScope);
  const afterPlan = await compareScopeManifests(localAfter, remoteAfter);
  const partial = skippedOperations.length > 0;
  return {
    ok: true,
    partial,
    status: partial ? "completed_with_skips" : "completed",
    dryRun: false,
    scope: normalizedScope,
    peerUrl: normalizedPeerUrl,
    syncDirection: normalizedSyncDirection,
    maxFileSizeBytes: limited.maxFileSizeBytes,
    before: { localFileCount: localBefore.files.length, remoteFileCount: remoteBefore.files.length, plan, unfilteredPlan: rawPlan },
    operations: {
      pulled,
      pushed,
      conflicts,
      skipped: { same: plan.same, oversized: limited.skippedBySize, direction: directional.skippedByDirection },
      skippedOperations,
    },
    skippedFiles: skippedOperations.map((entry) => ({
      relativePath: entry.relativePath,
      operation: entry.operation,
      error: entry.error,
      statusCode: entry.statusCode,
      retryCount: entry.retryCount,
    })),
    filesSkipped: skippedOperations.length,
    bytesSkipped: skippedOperations.reduce((sum, entry) => sum + toNonNegativeSize(entry.bytes), 0),
    after: { localFileCount: localAfter.files.length, remoteFileCount: remoteAfter.files.length, plan: afterPlan },
  };
}

async function main() {
  const peerUrl = process.argv[2]; const scope = process.argv[3];
  if (!peerUrl || !scope) { process.stderr.write("Usage: node ApplicationSystem/Sync/sync-scope-two-way.mjs <peerUrl> <scope> [--dry-run|--apply]\n"); process.exitCode = 1; return; }
  const dryRun = !process.argv.includes("--apply");
  try { const out = await runScopeSyncTwoWay({ peerUrl, scope, dryRun }); process.stdout.write(`${JSON.stringify(out, null, 2)}\n`); }
  catch (err) { process.stderr.write(`${err?.message || String(err)}\n`); process.exitCode = 1; }
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) main();
