// Nodevision/ApplicationSystem/Sync/SyncJobManager.mjs
// This module tracks in-memory long-running sync jobs with progress, cancellation, and result/error lifecycle state for Sync Panel polling.

import { randomUUID } from "node:crypto";
import { getBroker } from "../MessageBroker/BrokerSingleton.mjs";

const FINAL_STATUSES = new Set(["complete", "failed", "cancelled"]);
const PROGRESS_PUBLISH_INTERVAL_MS = 250;
const SYNC_JOB_TOPICS = {
  started: "nodevision/sync/job/started",
  progress: "nodevision/sync/job/progress",
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
    errors: [...job.errors],
    operations: [...job.operations],
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
    errors: [],
    operations: [],
    cancelRequested: false,
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
    currentFile: sanitizeCurrentFile(job.currentFile),
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
    if (job.status === "queued") {
      job.status = "cancelled";
      job.finishedAt = nowIso();
      job.currentFile = null;
      publishSyncEvent(SYNC_JOB_TOPICS.cancelled, job, { retain: true });
    }
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
        });
        if (job.cancelRequested) {
          job.status = "cancelled";
        } else {
          job.status = "complete";
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
        job.currentFile = null;
        job.finishedAt = nowIso();
        if (job.status === "complete") {
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
  };
}
