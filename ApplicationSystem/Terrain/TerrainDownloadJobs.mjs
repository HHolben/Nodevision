// Nodevision/ApplicationSystem/Terrain/TerrainDownloadJobs.mjs
// In-memory terrain job manager for estimate/preview/export workflows.

import { randomUUID } from "node:crypto";
import { normalizeTerrainRegion } from "./TerrainRegionGeometry.mjs";
import { estimateTerrainRegionRequest } from "./TerrainSourceSelector.mjs";
import { createSyntheticElevationRasterForRegion, generateContoursFromRaster } from "./TerrainContourGenerator.mjs";
import { writeTerrainOfflinePackage } from "./TerrainOfflinePackage.mjs";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function nowIso() {
  return new Date().toISOString();
}

export async function estimateTerrainPayload(payload = {}) {
  const region = normalizeTerrainRegion(payload.region || payload);
  const estimate = await estimateTerrainRegionRequest(region, payload.settings || {});
  return { ok: estimate.ok !== false, region, ...estimate };
}

export async function previewTerrainPayload(payload = {}) {
  const region = normalizeTerrainRegion(payload.region || payload);
  const settings = payload.settings || {};
  const estimate = await estimateTerrainRegionRequest(region, settings);
  const raster = createSyntheticElevationRasterForRegion(region, { width: 32, height: 32 });
  const intervalMeters = Number(settings.intervalMeters || settings.customContourIntervalMeters) || 10;
  const indexIntervalMeters = Number(settings.indexIntervalMeters || settings.customIndexContourIntervalMeters) || Math.max(50, intervalMeters * 5);
  const contours = generateContoursFromRaster(raster, { intervalMeters, indexIntervalMeters, region });
  return { ok: true, region, estimate, preview: { raster: { width: raster.width, height: raster.height, bounds: raster.bounds }, contours } };
}

export function createTerrainJobManager(ctx) {
  const jobs = new Map();

  function snapshot(job) {
    const { controller, runner, payload, ...publicJob } = job;
    return clone(publicJob);
  }

  function update(job, patch) {
    Object.assign(job, patch, { updatedAt: nowIso() });
    return snapshot(job);
  }

  async function runExport(job) {
    try {
      update(job, { status: "running", phase: "Validating selected region", progress: 0.03 });
      const result = await writeTerrainOfflinePackage(ctx, job.payload, {
        jobId: job.jobId,
        signal: job.controller.signal,
        onPhase: (phase, progress) => update(job, { phase, progress: Math.max(job.progress || 0, progress || 0) }),
      });
      update(job, { status: "complete", phase: "Complete", progress: 1, result, downloadedBytes: result.estimate?.estimatedElevationBytes || 0, expectedBytes: result.estimate?.estimatedProcessedPackageBytes || null, currentSource: result.estimate?.actualSource || null, warnings: result.estimate?.warnings || [] });
    } catch (err) {
      update(job, { status: job.controller.signal.aborted ? "cancelled" : "failed", phase: job.controller.signal.aborted ? "Cancelled" : "Failed", error: err?.message || String(err), retryable: !job.controller.signal.aborted });
    }
  }

  function startExport(payload = {}) {
    const jobId = randomUUID();
    const job = {
      jobId,
      type: "terrain-export",
      status: "queued",
      phase: "Queued",
      progress: 0,
      downloadedBytes: 0,
      expectedBytes: null,
      currentSource: null,
      warnings: [],
      retryable: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      payload: clone(payload),
      controller: new AbortController(),
      result: null,
      error: null,
    };
    jobs.set(jobId, job);
    job.runner = runExport(job);
    return snapshot(job);
  }

  function get(jobId) {
    const job = jobs.get(String(jobId || ""));
    return job ? snapshot(job) : null;
  }

  function cancel(jobId) {
    const job = jobs.get(String(jobId || ""));
    if (!job) return null;
    job.controller.abort();
    return update(job, { status: "cancelled", phase: "Cancellation requested", retryable: true });
  }

  function retry(jobId) {
    const previous = jobs.get(String(jobId || ""));
    if (!previous) return null;
    if (!["failed", "cancelled"].includes(previous.status)) return snapshot(previous);
    return startExport(previous.payload);
  }

  return { startExport, get, cancel, retry };
}
