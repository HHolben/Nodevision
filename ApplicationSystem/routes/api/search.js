// Nodevision/ApplicationSystem/routes/api/search.js
// This file defines the search API route handler for the Nodevision server. It validates requests and sends responses for search operations.
// routes/api/search.js
// Search files and textual contents under Notebook.

import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServerContext } from '../../shared/serverContext.mjs';

const BASE_CONTEXT = createServerContext();
const TEXT_EXTENSIONS = new Set([
  '.txt', '.md', '.markdown', '.json', '.jsonl', '.yaml', '.yml', '.xml', '.csv', '.tsv',
  '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.css', '.scss', '.html', '.htm', '.php',
  '.py', '.java', '.c', '.h', '.cpp', '.hpp', '.rs', '.go', '.rb', '.sh', '.toml', '.ini',
  '.conf', '.cfg', '.log', '.sql', '.graphql', '.gql', '.tex', '.rst', '.pgn'
]);

function isLikelyTextFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return TEXT_EXTENSIONS.has(ext);
}

export default function createSearchRouter(ctx = BASE_CONTEXT) {
  const NOTEBOOK_ROOT = ctx.notebookDir;
  const router = express.Router();

  async function collectSearchResults({ query, scope, limit }) {
    const roots = [{ label: 'Notebook', abs: NOTEBOOK_ROOT }];

    const q = query.toLowerCase();
    const results = [];
    const wantsName = scope === 'all' || scope === 'name';
    const wantsContent = scope === 'all' || scope === 'content';

    const stack = [];
    for (const root of roots) {
      stack.push({
        rootLabel: root.label,
        absPath: root.abs,
        relPath: ''
      });
    }

    while (stack.length > 0 && results.length < limit) {
      const current = stack.pop();
      let entries = [];

      try {
        entries = await fs.readdir(current.absPath, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const entry of entries) {
        if (results.length >= limit) break;

        const rel = current.relPath ? `${current.relPath}/${entry.name}` : entry.name;
        const resultPath = rel;
        const abs = path.join(current.absPath, entry.name);
        const nameMatches = entry.name.toLowerCase().includes(q);

        if (entry.isDirectory()) {
          if (wantsName && nameMatches) {
            results.push({
              kind: 'directory',
              match: 'name',
              path: resultPath
            });
            if (results.length >= limit) break;
          }

          stack.push({
            rootLabel: current.rootLabel,
            absPath: abs,
            relPath: rel
          });
          continue;
        }

        if (!entry.isFile()) continue;

        if (wantsName && nameMatches) {
          results.push({
            kind: 'file',
            match: 'name',
            path: resultPath
          });
          if (results.length >= limit) break;
        }

        if (!wantsContent || !isLikelyTextFile(abs)) continue;

        try {
          const content = await fs.readFile(abs, 'utf8');
          const idx = content.toLowerCase().indexOf(q);
          if (idx !== -1) {
            const start = Math.max(0, idx - 60);
            const end = Math.min(content.length, idx + q.length + 60);
            const snippet = content.slice(start, end).replace(/\s+/g, ' ').trim();

            results.push({
              kind: 'file',
              match: 'content',
              path: resultPath,
              snippet
            });
            if (results.length >= limit) break;
          }
        } catch {
          // Skip unreadable files silently.
        }
      }
    }

    return results;
  }

  async function handleSearch(req, res) {
    const query = String(req.query.q || '').trim();
    const scope = String(req.query.scope || 'all').toLowerCase();
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 300);

    if (!query) {
      res.status(400).json({ error: 'Missing required query parameter: q' });
      return;
    }

    if (!['all', 'name', 'content'].includes(scope)) {
      res.status(400).json({ error: 'Invalid scope. Use all, name, or content.' });
      return;
    }

    try {
      const results = await collectSearchResults({ query, scope, limit });
      const files = results.filter((r) => r.kind === 'file').map((r) => r.path);

      res.json({
        query,
        scope,
        total: results.length,
        results,
        files
      });
    } catch (error) {
      console.error('Search route error:', error);
      res.status(500).json({ error: 'Search failed' });
    }
  }

  router.get('/search', handleSearch);
  return router;
}
