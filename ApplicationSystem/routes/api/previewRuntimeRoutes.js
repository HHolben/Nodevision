// Nodevision/ApplicationSystem/routes/api/previewRuntimeRoutes.js
// This file defines the preview Runtime Routes API route handler for the Nodevision server. It validates requests and sends responses for preview Runtime Routes operations.
import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServerContext } from '../../shared/serverContext.mjs';
import { loadPreviewRuntimeConfig, getPreviewRuntimeBaseUrl } from '../../PreviewRuntime/previewConfig.js';
import { normalizeLanguage, isSupportedExtensionForLanguage } from '../../PreviewRuntime/previewTypes.js';

const BASE_CONTEXT = createServerContext();

function requireAuthJson(req, res, next) {
  if (req.identity) return next();
  return res.status(401).json({ ok: false, error: 'Authentication required' });
}

function resolveNotebookFile(ctx, userFilePath) {
  if (typeof userFilePath !== 'string' || !userFilePath.trim()) {
    throw new Error('filePath is required');
  }
  const NOTEBOOK_DIR = ctx.notebookDir;

  const sanitized = userFilePath
    .replace(/\0/g, '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/^\.\//, '');

  const rel = sanitized.startsWith('Notebook/') ? sanitized.slice('Notebook/'.length) : sanitized;
  const fullPath = path.resolve(NOTEBOOK_DIR, rel);
  const relative = path.relative(NOTEBOOK_DIR, fullPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Access denied: Path outside Notebook');
  }

  return {
    fullPath,
    notebookPath: `Notebook/${relative.split(path.sep).join('/')}`,
    fileName: path.basename(fullPath),
    ext: path.extname(fullPath).toLowerCase(),
  };
}

function validateUiRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('request body must be an object');
  const language = normalizeLanguage(body.language);
  if (!language) throw new Error('unsupported language');

  const timeoutMs = body.timeoutMs == null ? null : Number(body.timeoutMs);
  if (timeoutMs != null && (!Number.isFinite(timeoutMs) || timeoutMs <= 0)) throw new Error('timeoutMs must be a positive number');

  return {
    filePath: body.filePath,
    language,
    timeoutMs,
  };
}

export default function createPreviewRuntimeRoutes(ctx = BASE_CONTEXT) {
  const router = express.Router();

  const previewConfig = loadPreviewRuntimeConfig({ runtimeRoot: ctx.runtimeRoot });
  const previewBaseUrl = getPreviewRuntimeBaseUrl(previewConfig);
  const tokenEnv = previewConfig.previewRuntimeService.tokenEnv;
  async function loadToken() {
    const envToken = process.env[tokenEnv];
    if (envToken) return String(envToken).trim();
    try {
      const t = await fs.readFile(path.join(ctx.configDir, 'previewRuntime.token'), 'utf8');
      return String(t || '').trim();
    } catch {
      return null;
    }
  }

  async function createClient() {
    const token = await loadToken();
    return {
      token,
      requestJson: async (method, requestPath, body = undefined) => {
        const url = new URL(String(requestPath || ''), previewBaseUrl);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60_000);
        try {
          const headers = {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          };
          if (body !== undefined) headers['Content-Type'] = 'application/json';

          const resp = await fetch(url, {
            method,
            headers,
            body: body === undefined ? undefined : JSON.stringify(body),
            signal: controller.signal,
          });

          const text = await resp.text().catch(() => '');
          let data = null;
          if (text) {
            try {
              data = JSON.parse(text);
            } catch {
              data = text;
            }
          }

          return { status: resp.status, ok: resp.ok, data };
        } finally {
          clearTimeout(timeout);
        }
      },
    };
  }

  router.post('/preview/run', requireAuthJson, async (req, res) => {
    try {
      const { token, requestJson } = await createClient();
      if (!token) {
        return res.status(500).json({ ok: false, error: `Preview Runtime token missing (env ${tokenEnv})` });
      }
      const uiReq = validateUiRequest(req.body);
      const resolved = resolveNotebookFile(ctx, uiReq.filePath);
      if (!isSupportedExtensionForLanguage(resolved.ext, uiReq.language)) {
        return res.status(400).json({ ok: false, error: `file extension ${resolved.ext} does not match language ${uiReq.language}` });
      }

      const lst = await fs.lstat(resolved.fullPath);
      if (lst.isSymbolicLink()) return res.status(400).json({ ok: false, error: 'symlinks are not allowed for preview runs' });
      const stat = await fs.stat(resolved.fullPath);
      if (!stat.isFile()) return res.status(400).json({ ok: false, error: 'filePath must be a file' });
      if (stat.size > previewConfig.sourceLimit) {
        return res.status(413).json({ ok: false, error: `file too large (max ${previewConfig.sourceLimit} bytes)` });
      }

      const content = await fs.readFile(resolved.fullPath, 'utf8');

      const payload = {
        language: uiReq.language,
        timeoutMs: uiReq.timeoutMs || undefined,
        source: {
          filePath: resolved.notebookPath,
          content,
        },
      };

      const r = await requestJson('POST', '/run', payload);
      if (r.ok) return res.status(200).json(r.data);
      return res.status(502).json({ ok: false, error: 'Preview Runtime error', details: r.data });
    } catch (err) {
      res.status(400).json({ ok: false, error: String(err?.message || err) });
    }
  });

  router.get('/preview/job/:id', requireAuthJson, async (req, res) => {
    try {
      const { token, requestJson } = await createClient();
      if (!token) {
        return res.status(500).json({ ok: false, error: `Preview Runtime token missing (env ${tokenEnv})` });
      }
      const r = await requestJson('GET', `/jobs/${encodeURIComponent(req.params.id)}`);
      if (r.ok) return res.status(200).json(r.data);
      return res.status(502).json({ ok: false, error: 'Preview Runtime error', details: r.data });
    } catch (err) {
      res.status(502).json({ ok: false, error: 'Preview Runtime unavailable' });
    }
  });

  return router;
}
