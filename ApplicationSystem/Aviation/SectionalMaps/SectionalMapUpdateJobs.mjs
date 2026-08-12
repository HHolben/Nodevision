// Nodevision/ApplicationSystem/Aviation/SectionalMaps/SectionalMapUpdateJobs.mjs
// This module tracks in-memory FAA sectional update jobs for Server Settings and command callers.

import { updateSectionalMaps } from "./SectionalMapUpdater.mjs";

function nowIso() {
  return new Date().toISOString();
}

function snapshot(job) {
  return {
    jobId: job.jobId,
    status: job.status,
    phase: job.phase,
    message: job.message,
    progress: job.progress,
    complete: job.complete,
    total: job.total,
    currentChart: job.currentChart,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    result: job.result,
    error: job.error,
  };
}

function applyProgress(job, update = {}) {
  job.updatedAt = nowIso();
  if (update.state) job.phase = update.state;
  if (update.message) job.message = update.message;
  if (Number.isFinite(Number(update.progress))) job.progress = Math.max(0, Math.min(1, Number(update.progress)));
  if (Number.isFinite(Number(update.complete))) job.complete = Number(update.complete);
  if (Number.isFinite(Number(update.total))) job.total = Number(update.total);
  if (update.chartName) job.currentChart = update.chartName;
}

export function createSectionalMapUpdateJobManager(ctx, options = {}) {
  const jobs = new Map();
  const fetchImpl = options.fetchImpl;

  function startUpdate(input = {}) {
    const jobId = `sectionals-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const job = {
      jobId,
      status: "running",
      phase: "starting",
      progress: 0,
      complete: 0,
      total: 0,
      currentChart: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      result: null,
      error: null,
      controller: new AbortController(),
    };
    jobs.set(jobId, job);

    updateSectionalMaps(ctx, {
      fetchImpl,
      createDirectory: input.createDirectory === true,
      signal: job.controller.signal,
      onProgress: (progress) => applyProgress(job, progress),
    }).then((result) => {
      job.status = "complete";
      job.result = result;
      job.progress = 1;
      job.phase = result.status === "current" ? "current" : "complete";
      job.updatedAt = nowIso();
    }).catch((err) => {
      if (job.controller.signal.aborted) {
        job.status = "cancelled";
        job.phase = "cancelled";
      } else {
        job.status = "failed";
        job.error = err?.message || String(err);
      }
      job.updatedAt = nowIso();
    });

    return snapshot(job);
  }

  return {
    startUpdate,
    get(jobId) {
      const job = jobs.get(jobId);
      return job ? snapshot(job) : null;
    },
    cancel(jobId) {
      const job = jobs.get(jobId);
      if (!job) return null;
      job.controller.abort();
      job.status = "cancelled";
      job.phase = "cancelled";
      job.updatedAt = nowIso();
      return snapshot(job);
    },
  };
}
