// Nodevision/ApplicationSystem/Desktop/DesktopOpenHandler.mjs
// Handles secure local-file arguments passed by desktop launchers and exposes pending open/import requests to the browser UI.

import fs from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import path from 'node:path';

function isLikelyFileArg(value = '') {
  const text = String(value || '').trim();
  if (!text || text.startsWith('-')) return false;
  if (/^([a-z]+:)?\/\//i.test(text)) return false;
  return path.isAbsolute(text) || text.includes(path.sep) || text.includes('/');
}

export function parseDesktopOpenArgs(argv = process.argv.slice(2)) {
  const passthroughIndex = argv.indexOf('--');
  const args = passthroughIndex >= 0 ? argv.slice(passthroughIndex + 1) : argv;
  return args.filter(isLikelyFileArg);
}

async function realpathOrNull(filePath) {
  try {
    return await fs.realpath(path.resolve(filePath));
  } catch {
    return null;
  }
}

function isContainedWithin(parentRealPath, childRealPath) {
  const rel = path.relative(parentRealPath, childRealPath);
  return rel === '' || (rel && !rel.startsWith('..') && !path.isAbsolute(rel));
}

function toNotebookRelative(notebookRealPath, fileRealPath) {
  return path.relative(notebookRealPath, fileRealPath).split(path.sep).join('/');
}

function safeDisplayPath(value = '') {
  return String(value || '');
}

export async function createDesktopOpenState({ notebookDir, argv = process.argv.slice(2) } = {}) {
  const notebookRealPath = await realpathOrNull(notebookDir);
  const rawArgs = parseDesktopOpenArgs(argv);
  const queue = [];

  if (!notebookRealPath) {
    console.warn('[desktop-open] Notebook directory does not exist:', notebookDir);
    return { queue, notebookRealPath: null };
  }

  for (const arg of rawArgs) {
    const resolvedInputPath = path.resolve(arg);
    const fileRealPath = await realpathOrNull(resolvedInputPath);
    if (!fileRealPath) {
      queue.push({ kind: 'rejected', reason: 'File not found.', originalPath: safeDisplayPath(arg) });
      continue;
    }

    let stat;
    try {
      stat = await fs.stat(fileRealPath);
    } catch {
      queue.push({ kind: 'rejected', reason: 'Unable to inspect file.', originalPath: safeDisplayPath(arg) });
      continue;
    }

    if (!stat.isFile()) {
      queue.push({ kind: 'rejected', reason: 'Directories are not supported yet.', originalPath: safeDisplayPath(arg), realPath: fileRealPath });
      continue;
    }

    if (isContainedWithin(notebookRealPath, fileRealPath)) {
      queue.push({
        kind: 'inside',
        originalPath: safeDisplayPath(arg),
        realPath: fileRealPath,
        notebookRelativePath: toNotebookRelative(notebookRealPath, fileRealPath),
      });
      continue;
    }

    queue.push({ kind: 'outside', originalPath: safeDisplayPath(arg), realPath: fileRealPath, basename: path.basename(fileRealPath) });
  }

  return { queue, notebookRealPath };
}

function publicEntry(entry) {
  if (!entry) return null;
  const { kind, reason, originalPath, basename, notebookRelativePath } = entry;
  return { kind, reason, originalPath, basename, notebookRelativePath };
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function chooseNonOverwritingDestination(notebookRealPath, basename) {
  const parsed = path.parse(path.basename(basename || 'Imported file'));
  const baseName = parsed.name || 'Imported file';
  const ext = parsed.ext || '';

  for (let index = 0; index < 10000; index += 1) {
    const candidateName = index === 0 ? `${baseName}${ext}` : `${baseName} copy ${index}${ext}`;
    const candidatePath = path.resolve(notebookRealPath, candidateName);
    const rel = path.relative(notebookRealPath, candidatePath);
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel) || rel.includes(path.sep)) {
      throw new Error('Invalid import destination.');
    }
    if (!(await pathExists(candidatePath))) return { candidatePath, relativePath: candidateName };
  }

  throw new Error('Unable to choose a non-overwriting import filename.');
}

export function registerDesktopOpenRoutes(app, ctx, state) {
  const desktopOpenState = state || { queue: [], notebookRealPath: null };

  app.get('/api/desktop-open/pending', (_req, res) => {
    res.json({ pending: publicEntry(desktopOpenState.queue[0] || null), count: desktopOpenState.queue.length });
  });

  app.post('/api/desktop-open/cancel', (_req, res) => {
    if (desktopOpenState.queue.length > 0) desktopOpenState.queue.shift();
    res.json({ success: true, pending: publicEntry(desktopOpenState.queue[0] || null), count: desktopOpenState.queue.length });
  });

  app.post('/api/desktop-open/import', async (_req, res) => {
    const entry = desktopOpenState.queue[0];
    if (!entry || entry.kind !== 'outside') return res.status(400).json({ error: 'No outside-Notebook import is pending.' });

    try {
      const notebookRealPath = desktopOpenState.notebookRealPath || await realpathOrNull(ctx.notebookDir);
      const sourceRealPath = await realpathOrNull(entry.realPath);
      if (!notebookRealPath || !sourceRealPath) throw new Error('Unable to resolve source or Notebook path.');

      const stat = await fs.stat(sourceRealPath);
      if (!stat.isFile()) throw new Error('Only files can be imported.');
      if (isContainedWithin(notebookRealPath, sourceRealPath)) throw new Error('Source is already inside the Notebook.');

      const { candidatePath, relativePath } = await chooseNonOverwritingDestination(notebookRealPath, entry.basename || path.basename(sourceRealPath));
      await fs.copyFile(sourceRealPath, candidatePath, fsConstants.COPYFILE_EXCL);
      desktopOpenState.queue.shift();
      res.json({ success: true, notebookRelativePath: relativePath, pending: publicEntry(desktopOpenState.queue[0] || null), count: desktopOpenState.queue.length });
    } catch (err) {
      res.status(400).json({ error: err?.message || 'Failed to import file.' });
    }
  });
}
