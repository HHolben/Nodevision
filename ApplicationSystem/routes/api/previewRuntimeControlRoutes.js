// Nodevision/ApplicationSystem/routes/api/previewRuntimeControlRoutes.js
// This file defines the preview Runtime Control Routes API route handler for the Nodevision server. It validates requests and sends responses for preview Runtime Control Routes operations.
import express from 'express';
import crypto from 'node:crypto';
import { createPreviewRuntimeSupervisor } from '../../PreviewRuntime/previewRuntimeSupervisor.mjs';

function requireIdentity(req, res, next) {
  if (req.identity) return next();
  return res.status(401).json({ ok: false, error: 'Unauthorized' });
}

function requireAdmin(req, res, next) {
  if (req.identity?.role === 'admin') return next();
  return res.status(403).json({ ok: false, error: 'Admin role required' });
}

function generateToken() {
  return crypto.randomBytes(24).toString('hex');
}

export default function createPreviewRuntimeControlRoutes(ctx) {
  const router = express.Router();
  const supervisor = createPreviewRuntimeSupervisor(ctx, { logger: console });

  // Scope auth guards to this router's own namespace so other /api routes
  // (e.g., /api/save) aren't intercepted and rejected with 401/403.
  router.use('/preview/runtime', requireIdentity, requireAdmin);

  router.get('/preview/runtime/status', (req, res) => {
    res.json({ ok: true, ...supervisor.status() });
  });

  router.post('/preview/runtime/token', async (req, res) => {
    try {
      const token = req.body?.generate ? generateToken() : req.body?.token;
      await supervisor.setToken(token);
      res.json({ ok: true, tokenSet: true });
    } catch (err) {
      res.status(400).json({ ok: false, error: String(err?.message || err) });
    }
  });

  router.post('/preview/runtime/restart', async (req, res) => {
    try {
      const result = await supervisor.restart();
      res.json(result);
    } catch (err) {
      res.status(400).json({ ok: false, error: String(err?.message || err) });
    }
  });

  router.post('/preview/runtime/start', async (req, res) => {
    try {
      const result = await supervisor.start();
      res.json(result);
    } catch (err) {
      res.status(400).json({ ok: false, error: String(err?.message || err) });
    }
  });

  return router;
}
