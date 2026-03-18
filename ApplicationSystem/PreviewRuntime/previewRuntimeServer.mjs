// Nodevision/ApplicationSystem/PreviewRuntime/previewRuntimeServer.js
// This file defines the preview Runtime Server module for the Nodevision ApplicationSystem. It provides helper logic and exports functionality for other modules.
import http from 'node:http';
import { URL } from 'node:url';
import { loadPreviewRuntimeConfig } from './previewConfig.mjs';
import { normalizePreviewJobRequest } from './previewValidation.mjs';
import { PreviewJobManager } from './previewJobManager.mjs';
import { stageWorkspaceForJob } from './workspaceManager.mjs';
import { sanitizeResult } from './resultSanitizer.mjs';
import { LocalDevRunner } from './localDevRunner.mjs';

function requireLocalOnly(config) {
  const host = String(config.previewRuntimeService.host || '');
  return host === '127.0.0.1' || host === 'localhost' || host === '::1';
}

function tokenFromConfig(config) {
  const envName = config.previewRuntimeService.tokenEnv;
  const token = process.env[envName];
  return token || null;
}

function isLocalRemoteAddress(remoteAddress) {
  const ip = String(remoteAddress || '');
  return ip === '127.0.0.1' || ip === '::1' || ip.endsWith('127.0.0.1');
}

function json(res, statusCode, payload) {
  const body = JSON.stringify(payload ?? {});
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Length', Buffer.byteLength(body));
  res.setHeader('Cache-Control', 'no-store');
  res.end(body);
}

async function readJsonBody(req, { limitBytes = 2 * 1024 * 1024 } = {}) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > limitBytes) {
      throw new Error('request body too large');
    }
    chunks.push(buf);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw.trim()) return null;
  return JSON.parse(raw);
}

function authCheck(req, config) {
  const token = tokenFromConfig(config);
  if (!token) return { ok: false, statusCode: 500, error: 'Preview Runtime token not configured' };
  const header = req.headers.authorization || '';
  const expected = `Bearer ${token}`;
  if (header !== expected) return { ok: false, statusCode: 401, error: 'Unauthorized' };
  return { ok: true };
}

function localOnlyCheck(req, config) {
  const localOnly = requireLocalOnly(config);
  if (!localOnly) return { ok: true };
  const ip = req.socket?.remoteAddress || '';
  if (isLocalRemoteAddress(ip)) return { ok: true };
  return { ok: false, statusCode: 403, error: 'Forbidden (local only)' };
}

function toPublicJob(job) {
  const result = job.result || {};
  return { jobId: job.id, status: job.status, ...result };
}

export function createPreviewRuntimeApp(runtimeRoot) {
  const config = loadPreviewRuntimeConfig({ runtimeRoot });

  const runner = new LocalDevRunner({ config });
  const jobManager = new PreviewJobManager({
    runner,
    workspaceManager: { stageWorkspaceForJob },
    sanitizer: { sanitizeResult },
    config,
  });

  const basePath = String(config.previewRuntimeService.basePath || '').trim() || '';
  const normalizedBasePath = basePath ? (basePath.startsWith('/') ? basePath : `/${basePath}`) : '';

  const handler = async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');

    const localOnly = localOnlyCheck(req, config);
    if (!localOnly.ok) return json(res, localOnly.statusCode, { ok: false, error: localOnly.error });

    const auth = authCheck(req, config);
    if (!auth.ok) return json(res, auth.statusCode, { ok: false, error: auth.error });

    const requestUrl = new URL(req.url || '/', 'http://127.0.0.1');
    const pathname = requestUrl.pathname || '/';
    const method = String(req.method || 'GET').toUpperCase();

    const pathWithoutBase = normalizedBasePath && pathname.startsWith(normalizedBasePath)
      ? pathname.slice(normalizedBasePath.length) || '/'
      : pathname;

    if (method === 'GET' && pathWithoutBase === '/health') {
      return json(res, 200, {
        ok: true,
        service: 'nodevision-preview-runtime',
        runner: runner.runner,
      });
    }

    if (method === 'POST' && pathWithoutBase === '/run') {
      try {
        const body = await readJsonBody(req, { limitBytes: 2 * 1024 * 1024 });
        const normalized = normalizePreviewJobRequest(body, config);
        const job = jobManager.createJob(normalized);
        const result = await jobManager.runJob(job);
        return json(res, 200, { jobId: job.id, status: job.status, ...result });
      } catch (err) {
        return json(res, 400, { ok: false, error: String(err?.message || err) });
      }
    }

    if (method === 'GET' && pathWithoutBase.startsWith('/jobs/')) {
      const id = decodeURIComponent(pathWithoutBase.slice('/jobs/'.length));
      const job = jobManager.getJob(id);
      if (!job) return json(res, 404, { ok: false, error: 'job not found' });
      return json(res, 200, toPublicJob(job));
    }

    return json(res, 404, { ok: false, error: 'not found' });
  };

  return { handler, config };
}

export async function startPreviewRuntimeServer({ runtimeRoot } = {}) {
  const { handler, config } = createPreviewRuntimeApp(runtimeRoot);
  const server = http.createServer((req, res) => {
    Promise.resolve(handler(req, res)).catch((err) => {
      json(res, 500, { ok: false, error: String(err?.message || err) });
    });
  });
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
