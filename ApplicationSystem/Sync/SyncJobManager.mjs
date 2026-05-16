// Nodevision/ApplicationSystem/Sync/SyncJobManager.mjs
// This module tracks in-memory long-running sync jobs with progress, cancellation, and result/error lifecycle state for Sync Panel polling.

import { randomUUID } from "node:crypto";

const FINAL_STATUSES = new Set(["complete", "failed", "cancelled"]);

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

export function createSyncJobManager({ maxJobs = 100 } = {}) {
  const jobs = new Map();

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
    }
    return cloneJob(job);
  }

  function startJob({ scope, peerUrl, dryRun = false, run }) {
    if (typeof run !== "function") {
      throw new Error("run must be a function");
    }
    const job = createJobRecord({ scope, peerUrl, dryRun });
    jobs.set(job.jobId, job);
    pruneIfNeeded();

    queueMicrotask(async () => {
      if (job.cancelRequested) {
        job.status = "cancelled";
        job.finishedAt = nowIso();
        job.currentFile = null;
        return;
      }
      job.status = "running";
      try {
        const result = await run({
          onProgress(update) {
            applyProgressUpdate(job, update);
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
