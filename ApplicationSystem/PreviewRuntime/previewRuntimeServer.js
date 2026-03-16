// Nodevision/ApplicationSystem/PreviewRuntime/previewRuntimeServer.js
// This file defines the preview Runtime Server module for the Nodevision ApplicationSystem. It provides helper logic and exports functionality for other modules.
import express from 'express';
import http from 'node:http';
import { loadPreviewRuntimeConfig } from './previewConfig.js';
import { normalizePreviewJobRequest } from './previewValidation.js';
import { PreviewJobManager } from './previewJobManager.js';
import { stageWorkspaceForJob } from './workspaceManager.js';
import { sanitizeResult } from './resultSanitizer.js';
import { LocalDevRunner } from './localDevRunner.js';

function requireLocalOnly(config) {
  const host = String(config.previewRuntimeService.host || '');
  return host === '127.0.0.1' || host === 'localhost' || host === '::1';
}

function tokenFromConfig(config) {
  const envName = config.previewRuntimeService.tokenEnv;
  const token = process.env[envName];
  return token || null;
}

function authMiddleware(config) {
  const token = tokenFromConfig(config);
  return (req, res, next) => {
    if (!token) {
      return res.status(500).json({ ok: false, error: 'Preview Runtime token not configured' });
    }
    const header = req.headers.authorization || '';
    const expected = `Bearer ${token}`;
    if (header !== expected) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
    next();
  };
}

function localOnlyMiddleware(config) {
  const localOnly = requireLocalOnly(config);
  return (req, res, next) => {
    if (!localOnly) return next();
    const ip = req.ip || '';
    if (ip === '127.0.0.1' || ip === '::1' || ip.endsWith('127.0.0.1')) return next();
    return res.status(403).json({ ok: false, error: 'Forbidden (local only)' });
  };
}

function toPublicJob(job) {
  const result = job.result || {};
  return { jobId: job.id, status: job.status, ...result };
}

export function createPreviewRuntimeApp(runtimeRoot) {
  const config = loadPreviewRuntimeConfig({ runtimeRoot });
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '2mb' }));

  app.use(localOnlyMiddleware(config));
  app.use(authMiddleware(config));

  const runner = new LocalDevRunner({ config });
  const jobManager = new PreviewJobManager({
    runner,
    workspaceManager: { stageWorkspaceForJob },
    sanitizer: { sanitizeResult },
    config,
  });

  app.get('/v1/health', (req, res) => {
    res.json({
      ok: true,
      service: 'nodevision-preview-runtime',
      runner: runner.runner,
    });
  });

  app.post('/v1/run', async (req, res) => {
    try {
      const normalized = normalizePreviewJobRequest(req.body, config);
      const job = jobManager.createJob(normalized);
      const result = await jobManager.runJob(job);
      res.json({ jobId: job.id, status: job.status, ...result });
    } catch (err) {
      res.status(400).json({ ok: false, error: String(err?.message || err) });
    }
  });

  app.get('/v1/jobs/:id', (req, res) => {
    const job = jobManager.getJob(req.params.id);
    if (!job) return res.status(404).json({ ok: false, error: 'job not found' });
    res.json(toPublicJob(job));
  });

  return { app, config };
}

export async function startPreviewRuntimeServer({ runtimeRoot } = {}) {
  const { app, config } = createPreviewRuntimeApp(runtimeRoot);
  const server = http.createServer(app);
  const host = config.previewRuntimeService.host;
  const port = config.previewRuntimeService.port;

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolve());
  });

  console.log(`[PreviewRuntime] listening on http://${host}:${port}${config.previewRuntimeService.basePath}`);
  return { server, config };
}

if (process.argv[1] && process.argv[1].endsWith('previewRuntimeServer.js')) {
  startPreviewRuntimeServer().catch((err) => {
    console.error('[PreviewRuntime] failed to start:', err);
    process.exitCode = 1;
  });
}
