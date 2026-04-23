// Nodevision/ApplicationSystem/routes/api/files.js
// This file defines the files API route handler for the Nodevision server. It validates requests and sends responses for files operations.
// routes/api/files.js
// File and directory management API

import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServerContext } from '../../shared/serverContext.mjs';

const BASE_CONTEXT = createServerContext();
const DIRECTORY_IMAGE_CANDIDATES = [
  '.directory.svg',
  '.directory.png',
  'directory.svg',
  'directory.png',
];

function tokenizeName(value) {
  const str = String(value ?? '');
  return str
    .split(/(\d+)/)
    .filter(Boolean)
    .map((part) => {
      const isNumber = /^\d+$/.test(part);
      return {
        raw: part,
        isNumber,
        number: isNumber ? Number(part) : null,
        text: isNumber ? null : part.toLowerCase(),
      };
    });
}

function compareEntriesNatural(a, b) {
  const tokensA = tokenizeName(a?.name);
  const tokensB = tokenizeName(b?.name);
  const max = Math.max(tokensA.length, tokensB.length);

  for (let i = 0; i < max; i += 1) {
    const tokA = tokensA[i];
    const tokB = tokensB[i];
    if (!tokA && tokB) return -1;
    if (!tokB && tokA) return 1;
    if (!tokA && !tokB) return 0;

    if (tokA.isNumber && tokB.isNumber) {
      if (tokA.number !== tokB.number) {
        return tokA.number - tokB.number;
      }
      continue;
    }

    if (tokA.isNumber !== tokB.isNumber) {
      // Numbers sort before letters.
      return tokA.isNumber ? -1 : 1;
    }

    const cmp = tokA.text.localeCompare(tokB.text);
    if (cmp !== 0) return cmp;
  }

  return 0;
}

function normalizeNotebookRelativePath(inputPath) {
  if (!inputPath) return '';
  let cleaned = String(inputPath).replace(/\\/g, '/').trim();
  cleaned = cleaned.replace(/^\/+/, '');
  cleaned = cleaned.replace(/^Notebook\//i, '');
  cleaned = path.normalize(cleaned).replace(/^(\.\.(\/|\\|$))+/, '');
  return cleaned;
}

function toNotebookAssetUrl(relativePath) {
  const parts = String(relativePath)
    .split(/[\\/]+/)
    .filter(Boolean)
    .map(encodeURIComponent);
  return `/Notebook/${parts.join('/')}`;
}

async function findDirectoryImage(directoryFullPath, directoryRelativePath) {
  for (const candidate of DIRECTORY_IMAGE_CANDIDATES) {
    const candidateFullPath = path.join(directoryFullPath, candidate);
    try {
      await fs.access(candidateFullPath);
      const rel = directoryRelativePath
        ? `${directoryRelativePath.split(path.sep).join('/')}/${candidate}`
        : candidate;
      return {
        directoryImageName: candidate,
        directoryImageUrl: toNotebookAssetUrl(rel),
      };
    } catch {
      // Try next candidate.
    }
  }

  return {
    directoryImageName: null,
    directoryImageUrl: null,
  };
}

async function readDirectory(baseNotebookPath, dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const result = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(baseNotebookPath, fullPath);
    if (entry.isDirectory()) {
      const imageInfo = await findDirectoryImage(fullPath, relativePath);
      return {
        name: entry.name,
        path: relativePath,
        isDirectory: true,
        ...imageInfo,
      };
    }

    return {
      name: entry.name,
      path: relativePath,
      isDirectory: false,
    };
  }));
  return result.sort(compareEntriesNatural);
}

export default function createFilesRouter(ctx = BASE_CONTEXT) {
  const router = express.Router();
  const notebookBasePath = ctx.notebookDir;

  const handleFileBinary = async (req, res) => {
    const filePath = normalizeNotebookRelativePath(req.query.path);
    if (!filePath) {
      return res.status(400).json({ error: 'File path is required' });
    }

    const fullPath = path.join(notebookBasePath, filePath);

    try {
      const stat = await fs.stat(fullPath);
      if (stat.isDirectory()) {
        return res.status(400).json({ error: `The path ${filePath} is a directory, not a file` });
      }

      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.bmp': 'image/bmp',
        '.ico': 'image/x-icon',
      };

      const data = await fs.readFile(fullPath);
      res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
      res.setHeader('Cache-Control', 'no-store');
      res.send(data);
    } catch (err) {
      console.error(`Error reading binary file ${filePath}:`, err);
      if (err.code === 'ENOENT') {
        res.status(404).json({ error: `File ${filePath} not found` });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  };

  router.get('/api/files', async (req, res) => {
    const dir = req.query.path
      ? path.join(notebookBasePath, req.query.path)
      : notebookBasePath;

    try {
      const structure = await readDirectory(notebookBasePath, dir);
      res.json(structure);
    } catch (error) {
      console.error('Error reading directory structure:', error);
      res.status(500).json({ error: 'Error reading directory structure' });
    }
  });

  router.get('/api/file', async (req, res) => {
    const filePath = normalizeNotebookRelativePath(req.query.path);
    if (!filePath) {
      return res.status(400).json({ error: 'File path is required' });
    }

    const fullPath = path.join(notebookBasePath, filePath);

    try {
      const stat = await fs.stat(fullPath);

      if (stat.isDirectory()) {
        return res.status(400).json({ error: `The path ${filePath} is a directory, not a file` });
      }

      const data = await fs.readFile(fullPath, 'utf8');
      res.json({ content: data });
    } catch (err) {
      console.error(`Error reading file ${filePath}:`, err);

      if (err.code === 'ENOENT') {
        res.status(404).json({ error: `File ${filePath} not found` });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  });

  router.get('/file-binary', handleFileBinary);
  router.get('/api/file-binary', handleFileBinary);

  return router;
}
