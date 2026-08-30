// Nodevision/ApplicationSystem/server/routes/sectionalMapRoutes.mjs
// This module exposes Server Settings and explicit update routes for user-owned FAA sectional chart packages.

import { createSectionalMapUpdateJobManager } from "../../Aviation/SectionalMaps/SectionalMapUpdateJobs.mjs";
import { getSectionalMapsDirectory, loadSectionalMapSettings, saveSectionalMapSettings } from "../../Aviation/SectionalMaps/SectionalMapSettings.mjs";
import { ensureSectionalMapDirectory, getSectionalMapDirectoryStatus } from "../../Aviation/SectionalMaps/SectionalMapStatus.mjs";

function authenticated(req, res) {
  if (req.identity) return true;
  res.status(401).json({ ok: false, error: "Authentication required" });
  return false;
}

function routeError(res, err, status = 400) {
  return res.status(status).json({ ok: false, error: err?.message || String(err) });
}

function statusPayload(status) {
  return {
    exists: status.exists,
    isDirectory: status.isDirectory,
    packageCount: status.packageCount,
    edition: status.edition,
    editionLabel: status.editionLabel,
    updatedAt: status.updatedAt,
    metadata: status.metadata ? {
      provider: status.metadata.provider,
      edition: status.metadata.edition,
      editionLabel: status.metadata.editionLabel,
      updatedAt: status.metadata.updatedAt,
      chartCount: status.metadata.chartCount,
    } : null,
  };
}

async function readSettingsPayload(ctx) {
  const settings = await loadSectionalMapSettings(ctx);
  const resolved = await getSectionalMapsDirectory(ctx);
  const status = await getSectionalMapDirectoryStatus(resolved.absoluteDirectory);
  return {
    ok: true,
    settings,
    resolved: { relativeDirectory: resolved.relativeDirectory },
    status: statusPayload(status),
  };
}

export function registerSectionalMapRoutes(app, ctx) {
  const jobs = createSectionalMapUpdateJobManager(ctx);

  app.get("/api/aviation/sectionals/settings", async (req, res) => {
    if (!authenticated(req, res)) return;
    try {
      return res.json(await readSettingsPayload(ctx));
    } catch (err) {
      return routeError(res, err);
    }
  });

  app.post("/api/aviation/sectionals/settings", async (req, res) => {
    if (!authenticated(req, res)) return;
    try {
      const settings = await saveSectionalMapSettings(ctx, req.body || {});
      console.info("[sectionals] setting saved", { directory: settings.sectionalMapsDirectory });
      return res.json(await readSettingsPayload(ctx));
    } catch (err) {
      return routeError(res, err);
    }
  });

  app.post("/api/aviation/sectionals/create-directory", async (req, res) => {
    if (!authenticated(req, res)) return;
    try {
      const resolved = await getSectionalMapsDirectory(ctx);
      const status = await ensureSectionalMapDirectory(resolved.absoluteDirectory);
      console.info("[sectionals] directory ensured", { directory: resolved.relativeDirectory });
      return res.json({ ok: true, status: statusPayload(status) });
    } catch (err) {
      return routeError(res, err);
    }
  });

  app.post("/api/aviation/sectionals/update", (req, res) => {
    if (!authenticated(req, res)) return;
    try {
      const job = jobs.startUpdate({ createDirectory: req.body?.createDirectory === true });
      return res.json({ ok: true, jobId: job.jobId, job });
    } catch (err) {
      return routeError(res, err);
    }
  });

  app.get("/api/aviation/sectionals/jobs/:jobId", (req, res) => {
    if (!authenticated(req, res)) return;
    const job = jobs.get(req.params.jobId);
    if (!job) return res.status(404).json({ ok: false, error: "Sectional map update job not found" });
    return res.json({ ok: true, job });
  });

  app.post("/api/aviation/sectionals/jobs/:jobId/cancel", (req, res) => {
    if (!authenticated(req, res)) return;
    const job = jobs.cancel(req.params.jobId);
    if (!job) return res.status(404).json({ ok: false, error: "Sectional map update job not found" });
    return res.json({ ok: true, job });
  });
}
