// Nodevision/ApplicationSystem/Sync/SyncJobManager.mjs
// This module tracks in-memory long-running sync jobs with progress, cancellation, and result/error lifecycle state for Sync Panel polling.

import { randomUUID } from "node:crypto";
import { getBroker } from "../MessageBroker/BrokerSingleton.mjs";

const FINAL_STATUSES = new Set(["complete", "completed", "failed", "cancelled"]);
const PROGRESS_PUBLISH_INTERVAL_MS = 250;
const SYNC_JOB_TOPICS = {
  started: "nodevision/sync/job/started",
  progress: "nodevision/sync/job/progress",
  paused: "nodevision/sync/job/paused",
  retried: "nodevision/sync/job/retried",
  skipped: "nodevision/sync/job/skipped",
  aborted: "nodevision/sync/job/aborted",
  completed: "nodevision/sync/job/completed",
  failed: "nodevision/sync/job/failed",
  cancelled: "nodevision/sync/job/cancelled",
};

// Future Graph Manager idea: subscribe to nodevision/sync/# to visualize
// active sync jobs, peer relationships, file transfer activity, failures, and conflicts.

function nowIso() {
  return new Date().toISOString();
}

function normalizeErrorMessage(err) {
  if (!err) return "Unknown sync error";
  if (typeof err === "string") return err;
  if (err instanceof Error && err.message) return err.message;
  return String(err);
}

function normalizeStatusCode(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 100 && parsed <= 599 ? Math.trunc(parsed) : null;
}

function extractErrorStatus(err) {
  return normalizeStatusCode(err?.status ?? err?.statusCode ?? err?.response?.status);
}

function toNonNegativeInteger(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 0;
}

function cloneJob(job) {
  return {
    jobId: job.jobId,
    scope: job.scope,
    peerUrl: job.peerUrl,
    dryRun: job.dryRun,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    status: job.status,
    currentFile: job.currentFile,
    filesTotal: job.filesTotal,
    filesDone: job.filesDone,
    bytesTotal: job.bytesTotal,
    bytesDone: job.bytesDone,
    filesSkipped: job.filesSkipped,
    bytesSkipped: job.bytesSkipped,
    pauseReason: job.pauseReason,
    pausedOperation: job.pausedOperation ? { ...job.pausedOperation } : null,
    pausedError: job.pausedError ? { ...job.pausedError } : null,
    retryCount: job.retryCount,
    skippedOperations: job.skippedOperations.map((entry) => ({ ...entry })),
    errors: [...job.errors],
    operations: [...job.operations],
    result: job.result,
  };
}

function createJobRecord({ scope, peerUrl, dryRun }) {
  return {
    jobId: randomUUID(),
    scope: String(scope),
    peerUrl: String(peerUrl),
    dryRun: Boolean(dryRun),
    startedAt: nowIso(),
    finishedAt: null,
    status: "queued",
    currentFile: null,
    filesTotal: 0,
    filesDone: 0,
    bytesTotal: 0,
    bytesDone: 0,
    filesSkipped: 0,
    bytesSkipped: 0,
    pauseReason: null,
    pausedOperation: null,
    pausedError: null,
    retryCount: 0,
    skippedOperations: [],
    errors: [],
    operations: [],
    result: null,
    cancelRequested: false,
    pauseControl: null,
  };
}

function isUnsafeRelativePath(value) {
  const text = String(value || "");
  return (
    !text ||
    text.startsWith("/") ||
    /^[A-Za-z]:[\\/]/.test(text) ||
    text.split(/[\\/]+/).includes("ServerSettings")
  );
}

function sanitizeCurrentFile(value) {
  if (value === null || value === undefined) return null;
  const text = String(value);
  return isUnsafeRelativePath(text) ? null : text;
}

function sanitizePeerUrl(value) {
  if (!value) return "";
  try {
    const parsed = new URL(String(value));
    parsed.username = "";
    parsed.password = "";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return String(value).split("?")[0].split("#")[0];
  }
}

function sanitizePausedOperation(value) {
  if (!value || typeof value !== "object") return null;
  return {
    ...value,
    peerUrl: sanitizePeerUrl(value.peerUrl),
    relativePath: sanitizeCurrentFile(value.relativePath),
  };
}

function createSyncEventPayload(job, status = job.status) {
  return {
    jobId: job.jobId,
    scope: job.scope,
    peerUrl: sanitizePeerUrl(job.peerUrl),
    status,
    filesDone: job.filesDone,
    filesTotal: job.filesTotal,
    bytesDone: job.bytesDone,
    bytesTotal: job.bytesTotal,
    filesSkipped: job.filesSkipped,
    bytesSkipped: job.bytesSkipped,
    currentFile: sanitizeCurrentFile(job.currentFile),
    pauseReason: job.pauseReason,
    pausedOperation: sanitizePausedOperation(job.pausedOperation),
    pausedError: job.pausedError,
    retryCount: job.retryCount,
    timestamp: nowIso(),
  };
}

function jobStateTopic(job) {
  return "nodevision/sync/job/" + job.jobId + "/state";
}

function isFinalStatus(status) {
  return FINAL_STATUSES.has(String(status || ""));
}

function applyProgressUpdate(job, update) {
  if (!update || typeof update !== "object") return;
  if (update.currentFile !== undefined) job.currentFile = update.currentFile === null ? null : String(update.currentFile || "");
  if (update.filesTotal !== undefined && Number.isFinite(Number(update.filesTotal))) job.filesTotal = Math.max(0, Math.trunc(Number(update.filesTotal)));
  if (update.filesDone !== undefined && Number.isFinite(Number(update.filesDone))) job.filesDone = Math.max(0, Math.trunc(Number(update.filesDone)));
  if (update.bytesTotal !== undefined && Number.isFinite(Number(update.bytesTotal))) job.bytesTotal = Math.max(0, Math.trunc(Number(update.bytesTotal)));
  if (update.bytesDone !== undefined && Number.isFinite(Number(update.bytesDone))) job.bytesDone = Math.max(0, Math.trunc(Number(update.bytesDone)));
  if (update.filesSkipped !== undefined && Number.isFinite(Number(update.filesSkipped))) job.filesSkipped = Math.max(0, Math.trunc(Number(update.filesSkipped)));
  if (update.bytesSkipped !== undefined && Number.isFinite(Number(update.bytesSkipped))) job.bytesSkipped = Math.max(0, Math.trunc(Number(update.bytesSkipped)));
  if (update.event === "file-error") {
    const message = normalizeErrorMessage(update.error || update.details || update.message);
    const op = update.operation ? String(update.operation) : "file";
    const rp = update.relativePath ? String(update.relativePath) : "";
    const composed = rp ? `${op}:${rp}: ${message}` : message;
    if (composed) job.errors.push(composed);
  }
  if (update.event === "file-complete" && update.relativePath) {
    job.operations.push({
      type: String(update.operation || "file"),
      relativePath: String(update.relativePath),
      at: nowIso(),
    });
  }
  if (update.event === "file-skipped" && update.relativePath) {
    const skipped = {
      type: String(update.operation || "file"),
      operation: String(update.operation || "file"),
      scope: update.scope ? String(update.scope) : job.scope,
      peerUrl: sanitizePeerUrl(update.peerUrl || job.peerUrl),
      relativePath: String(update.relativePath),
      error: normalizeErrorMessage(update.error || update.message),
      statusCode: normalizeStatusCode(update.statusCode),
      retryCount: toNonNegativeInteger(update.retryCount),
      safelyRetryable: update.safelyRetryable !== false,
      bytes: toNonNegativeInteger(update.bytes || update.size),
      at: nowIso(),
    };
    job.skippedOperations.push(skipped);
    job.filesSkipped = Math.max(job.filesSkipped, job.skippedOperations.length);
    if (skipped.bytes > 0) job.bytesSkipped += skipped.bytes;
  }
}

function applyResultOperations(job, result) {
  if (!result || typeof result !== "object") return;
  const operations = [];
  const pulled = Array.isArray(result?.operations?.pulled) ? result.operations.pulled : [];
  const pushed = Array.isArray(result?.operations?.pushed) ? result.operations.pushed : [];
  const conflicts = Array.isArray(result?.operations?.conflicts) ? result.operations.conflicts : [];
  for (const item of pulled) {
    operations.push({ type: "pull", relativePath: String(item?.relativePath || ""), bytes: Number(item?.bytes || 0) });
  }
  for (const item of pushed) {
    operations.push({ type: "push", relativePath: String(item?.relativePath || ""), bytes: Number(item?.bytes || 0) });
  }
  for (const item of conflicts) {
    operations.push({ type: "conflict", relativePath: String(item?.originalRelativePath || ""), bytes: Number(item?.bytes || 0) });
  }
  if (operations.length) {
    job.operations = operations;
  }
  const skippedOperations = Array.isArray(result?.operations?.skippedOperations)
    ? result.operations.skippedOperations
    : Array.isArray(result?.skippedOperations)
      ? result.skippedOperations
      : [];
  if (skippedOperations.length) {
    job.skippedOperations = skippedOperations.map((entry) => ({ ...entry }));
    job.filesSkipped = job.skippedOperations.length;
    job.bytesSkipped = job.skippedOperations.reduce((sum, entry) => sum + toNonNegativeInteger(entry?.bytes || entry?.size), 0);
  }
}

function normalizePausedOperation(input = {}, job) {
  const operation = String(input.operation || input.type || "file");
  const relativePath = String(input.relativePath || job.currentFile || "");
  return {
    operation,
    type: operation,
    scope: String(input.scope || job.scope),
    peerUrl: sanitizePeerUrl(input.peerUrl || job.peerUrl),
    relativePath,
    statusCode: normalizeStatusCode(input.statusCode),
    retryCount: toNonNegativeInteger(input.retryCount),
    safelyRetryable: input.safelyRetryable !== false,
    bytes: toNonNegativeInteger(input.bytes || input.size),
    timestamp: nowIso(),
    progress: {
      filesDone: job.filesDone,
      filesTotal: job.filesTotal,
      bytesDone: job.bytesDone,
      bytesTotal: job.bytesTotal,
      filesSkipped: job.filesSkipped,
      bytesSkipped: job.bytesSkipped,
    },
  };
}

function createPausedError(input = {}) {
  return {
    message: normalizeErrorMessage(input.error || input.message),
    statusCode: normalizeStatusCode(input.statusCode),
    timestamp: nowIso(),
  };
}

function createSkippedOperationFromPause(job) {
  return {
    ...(job.pausedOperation || {}),
    error: job.pausedError?.message || "Skipped",
    statusCode: normalizeStatusCode(job.pausedError?.statusCode ?? job.pausedOperation?.statusCode),
    retryCount: toNonNegativeInteger(job.retryCount),
    skippedAt: nowIso(),
  };
}

export function createSyncJobManager({ maxJobs = 100, broker = getBroker() } = {}) {
  const jobs = new Map();

  function publishSyncEvent(topic, job, { status = job.status, retain = false } = {}) {
    const payload = createSyncEventPayload(job, status);
    broker.publish(topic, payload, { retain });
    broker.publish(jobStateTopic(job), payload, { retain: true });
    return payload;
  }

  function pruneIfNeeded() {
    if (jobs.size <= maxJobs) return;
    const done = [...jobs.values()]
      .filter((job) => isFinalStatus(job.status))
      .sort((a, b) => Date.parse(a.finishedAt || a.startedAt) - Date.parse(b.finishedAt || b.startedAt));
    while (jobs.size > maxJobs && done.length) {
      const oldest = done.shift();
      jobs.delete(oldest.jobId);
    }
  }

  function getJobStatus(jobId) {
    const job = jobs.get(String(jobId || ""));
    return job ? cloneJob(job) : null;
  }

  function cancelJob(jobId) {
    const job = jobs.get(String(jobId || ""));
    if (!job) return null;
    if (isFinalStatus(job.status)) return cloneJob(job);
    job.cancelRequested = true;
    if (job.status === "paused" && job.pauseControl) {
      job.status = "cancelled";
      publishSyncEvent(SYNC_JOB_TOPICS.aborted, job, { status: "cancelled", retain: true });
      job.pauseControl.resolve({ action: "abort" });
      job.pauseControl = null;
      return cloneJob(job);
    }
    if (job.status === "queued") {
      job.status = "cancelled";
      job.finishedAt = nowIso();
      job.currentFile = null;
      publishSyncEvent(SYNC_JOB_TOPICS.cancelled, job, { retain: true });
    }
    return cloneJob(job);
  }

  function abortJob(jobId) {
    const job = jobs.get(String(jobId || ""));
    if (!job) return null;
    if (isFinalStatus(job.status)) return cloneJob(job);
    job.cancelRequested = true;
    if (job.status === "paused" && job.pauseControl) {
      job.status = "cancelled";
      publishSyncEvent(SYNC_JOB_TOPICS.aborted, job, { status: "cancelled", retain: true });
      job.pauseControl.resolve({ action: "abort" });
      job.pauseControl = null;
      return cloneJob(job);
    }
    return cancelJob(jobId);
  }

  function retryPausedJob(jobId) {
    const job = jobs.get(String(jobId || ""));
    if (!job) return null;
    if (job.status !== "paused" || !job.pauseControl) return cloneJob(job);
    job.retryCount += 1;
    if (job.pausedOperation) job.pausedOperation.retryCount = job.retryCount;
    job.status = "running";
    job.pauseReason = null;
    publishSyncEvent(SYNC_JOB_TOPICS.retried, job, { status: "running" });
    job.pauseControl.resolve({ action: "retry", retryCount: job.retryCount });
    job.pauseControl = null;
    return cloneJob(job);
  }

  function skipPausedJob(jobId) {
    const job = jobs.get(String(jobId || ""));
    if (!job) return null;
    if (job.status !== "paused" || !job.pauseControl) return cloneJob(job);
    const skipped = createSkippedOperationFromPause(job);
    job.skippedOperations.push(skipped);
    job.filesSkipped = job.skippedOperations.length;
    if (skipped.bytes > 0) job.bytesSkipped += skipped.bytes;
    job.status = "running";
    job.pauseReason = null;
    publishSyncEvent(SYNC_JOB_TOPICS.skipped, job, { status: "running" });
    job.pauseControl.resolve({ action: "skip", skippedOperation: skipped });
    job.pauseControl = null;
    return cloneJob(job);
  }

  function startJob({ scope, peerUrl, dryRun = false, run }) {
    if (typeof run !== "function") {
      throw new Error("run must be a function");
    }
    const job = createJobRecord({ scope, peerUrl, dryRun });
    let lastProgressPublishedAt = 0;
    jobs.set(job.jobId, job);
    pruneIfNeeded();
    publishSyncEvent(SYNC_JOB_TOPICS.started, job, { retain: true });

    queueMicrotask(async () => {
      if (job.cancelRequested) {
        const alreadyCancelled = job.status === "cancelled";
        job.status = "cancelled";
        job.finishedAt = job.finishedAt || nowIso();
        job.currentFile = null;
        if (!alreadyCancelled) {
          publishSyncEvent(SYNC_JOB_TOPICS.cancelled, job, { retain: true });
        }
        return;
      }
      job.status = "running";
      publishSyncEvent(SYNC_JOB_TOPICS.started, job, { retain: true });
      try {
        const result = await run({
          onProgress(update) {
            applyProgressUpdate(job, update);
            const elapsed = Date.now() - lastProgressPublishedAt;
            const isCompleteUpdate = update?.event === "file-complete" || (job.filesTotal > 0 && job.filesDone >= job.filesTotal);
            if (elapsed >= PROGRESS_PUBLISH_INTERVAL_MS || isCompleteUpdate) {
              lastProgressPublishedAt = Date.now();
              publishSyncEvent(SYNC_JOB_TOPICS.progress, job);
            }
          },
          isCancelled() {
            return job.cancelRequested === true;
          },
          async onFileError(details = {}) {
            const normalized = {
              ...details,
              statusCode: normalizeStatusCode(details.statusCode ?? extractErrorStatus(details.error)),
              error: normalizeErrorMessage(details.error || details.message),
            };
            job.currentFile = normalized.relativePath ? String(normalized.relativePath) : job.currentFile;
            job.pausedOperation = normalizePausedOperation(normalized, job);
            job.pausedError = createPausedError(normalized);
            job.pauseReason = "file-error";
            job.retryCount = toNonNegativeInteger(normalized.retryCount);
            job.status = "paused";
            return await new Promise((resolve) => {
              job.pauseControl = { resolve };
              publishSyncEvent(SYNC_JOB_TOPICS.paused, job, { status: "paused", retain: true });
            });
          },
        });
        if (job.cancelRequested) {
          job.status = "cancelled";
        } else {
          job.status = "completed";
          job.result = result && typeof result === "object" ? result : null;
          applyResultOperations(job, result);
        }
      } catch (err) {
        if (job.cancelRequested || err?.name === "SyncJobCancelledError") {
          job.status = "cancelled";
        } else {
          job.status = "failed";
          job.errors.push(normalizeErrorMessage(err));
        }
      } finally {
        if (job.status !== "paused") job.currentFile = null;
        job.finishedAt = nowIso();
        if (job.status === "completed" || job.status === "complete") {
          publishSyncEvent(SYNC_JOB_TOPICS.completed, job, { retain: true });
        } else if (job.status === "failed") {
          publishSyncEvent(SYNC_JOB_TOPICS.failed, job, { retain: true });
        } else if (job.status === "cancelled") {
          publishSyncEvent(SYNC_JOB_TOPICS.cancelled, job, { retain: true });
        }
      }
    });

    return cloneJob(job);
  }

  return {
    startJob,
    getJobStatus,
    cancelJob,
    abortJob,
    retryPausedJob,
    skipPausedJob,
  };
}
