// Nodevision/ApplicationSystem/server/routes/phoneImportRoutes.mjs
// Authenticated API routes for the read-only Import from Phone MVP.

import { createPhoneImportService } from "../../PhoneImport/PhoneImportService.mjs";
import { serializePhoneImportError } from "../../PhoneImport/PhoneImportErrors.mjs";

function requireSession(req, res) {
  if (!req.identity) {
    res.status(401).json({ ok: false, error: "Authentication required" });
    return false;
  }
  return true;
}

function getService(ctx) {
  if (!ctx.phoneImportService) ctx.phoneImportService = createPhoneImportService(ctx);
  return ctx.phoneImportService;
}

function sendError(res, err) {
  const payload = serializePhoneImportError(err);
  return res.status(payload.statusCode || 500).json(payload);
}

export function registerPhoneImportRoutes(app, ctx) {
  app.post("/api/phone-import/scan", (req, res) => {
    if (!requireSession(req, res)) return;
    try {
      const job = getService(ctx).startScan({ backupPath: req.body?.backupPath, options: req.body?.options || {} });
      return res.status(202).json({ ok: true, jobId: job.jobId, job });
    } catch (err) {
      return sendError(res, err);
    }
  });

  app.post("/api/phone-import/import", (req, res) => {
    if (!requireSession(req, res)) return;
    try {
      const job = getService(ctx).startImport(req.body || {});
      return res.status(202).json({ ok: true, jobId: job.jobId, job });
    } catch (err) {
      return sendError(res, err);
    }
  });

  app.get("/api/phone-import/status/:jobId", (req, res) => {
    if (!requireSession(req, res)) return;
    const jobId = String(req.params?.jobId || "").trim();
    if (!jobId) return res.status(400).json({ ok: false, error: "jobId is required" });
    const job = getService(ctx).getJobStatus(jobId);
    if (!job) return res.status(404).json({ ok: false, error: "Phone import job not found" });
    return res.json({ ok: true, job });
  });

  app.post("/api/phone-import/cancel/:jobId", (req, res) => {
    if (!requireSession(req, res)) return;
    const jobId = String(req.params?.jobId || "").trim();
    if (!jobId) return res.status(400).json({ ok: false, error: "jobId is required" });
    const job = getService(ctx).cancelJob(jobId);
    if (!job) return res.status(404).json({ ok: false, error: "Phone import job not found" });
    return res.json({ ok: true, job });
  });
}

export default registerPhoneImportRoutes;
