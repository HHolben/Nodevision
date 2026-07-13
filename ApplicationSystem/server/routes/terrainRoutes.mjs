// Nodevision/ApplicationSystem/server/routes/terrainRoutes.mjs
// Terrain-region API routes for KML terrain view/export workflows.

import { createTerrainJobManager, estimateTerrainPayload, previewTerrainPayload } from "../../Terrain/TerrainDownloadJobs.mjs";

function authenticated(req, res) {
  if (req.identity) return true;
  res.status(401).json({ error: "Authentication required" });
  return false;
}

function sendError(res, err, status = 400) {
  return res.status(status).json({ ok: false, error: err?.message || String(err) });
}

export function registerTerrainRoutes(app, ctx) {
  const manager = createTerrainJobManager(ctx);

  app.post("/api/terrain/coverage", async (req, res) => {
    if (!authenticated(req, res)) return;
    try {
      const estimate = await estimateTerrainPayload(req.body || {});
      return res.json({ ok: true, requestedSource: estimate.requestedSource, actualSource: estimate.actualSource, fallbackUsed: estimate.fallbackUsed, warnings: estimate.warnings || [], attribution: estimate.attribution || "" });
    } catch (err) {
      return sendError(res, err);
    }
  });

  app.post("/api/terrain/estimate", async (req, res) => {
    if (!authenticated(req, res)) return;
    try {
      return res.json(await estimateTerrainPayload(req.body || {}));
    } catch (err) {
      return sendError(res, err);
    }
  });

  app.post("/api/terrain/preview", async (req, res) => {
    if (!authenticated(req, res)) return;
    try {
      return res.json(await previewTerrainPayload(req.body || {}));
    } catch (err) {
      return sendError(res, err);
    }
  });

  app.post("/api/terrain/export", async (req, res) => {
    if (!authenticated(req, res)) return;
    try {
      const job = manager.startExport(req.body || {});
      return res.json({ ok: true, jobId: job.jobId, job });
    } catch (err) {
      return sendError(res, err);
    }
  });

  app.get("/api/terrain/jobs/:jobId", (req, res) => {
    if (!authenticated(req, res)) return;
    const job = manager.get(req.params.jobId);
    if (!job) return res.status(404).json({ ok: false, error: "Terrain job not found" });
    return res.json({ ok: true, job });
  });

  app.post("/api/terrain/jobs/:jobId/cancel", (req, res) => {
    if (!authenticated(req, res)) return;
    const job = manager.cancel(req.params.jobId);
    if (!job) return res.status(404).json({ ok: false, error: "Terrain job not found" });
    return res.json({ ok: true, job });
  });

  app.post("/api/terrain/jobs/:jobId/retry", (req, res) => {
    if (!authenticated(req, res)) return;
    const job = manager.retry(req.params.jobId);
    if (!job) return res.status(404).json({ ok: false, error: "Terrain job not found" });
    return res.json({ ok: true, jobId: job.jobId, job });
  });
}
