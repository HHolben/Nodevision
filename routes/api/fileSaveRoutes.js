// Nodevision/routes/api/fileSaveRoutes.js
// This module declares the server routes needed to save files.

import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Correct Notebook root path
const NOTEBOOK_ROOT = path.resolve(__dirname, '../../Notebook');

// ---------- Path Sanitizer ----------
function resolveNotebookPath(relativePath) {
  if (!relativePath) throw new Error("Missing path");

  let cleaned = relativePath.replace(/^\/+/, '');   // strip leading slashes
  cleaned = path.normalize(cleaned);                // resolve ../ etc
  cleaned = cleaned.replace(/\.\.(\/|\\)/g, '');    // block directory escape

  // Remove accidental "Notebook/" prefix
  const nbPrefix = `Notebook${path.sep}`;
  if (cleaned.startsWith(nbPrefix)) {
    cleaned = cleaned.slice(nbPrefix.length);
  }

  return path.join(NOTEBOOK_ROOT, cleaned);
}

// =========================================================
// ===============   SAVE / UPDATE FILE   ==================
// =========================================================

router.post('/save', async (req, res) => {
  const {
    path: relativePath,
    content,
    encoding = 'utf8',
    mimeType
  } = req.body;

  if (!relativePath) {
    return res.status(400).json({ error: "File path is required" });
  }
  if (content === undefined) {
    return res.status(400).json({ error: "File content is required" });
  }

  const filePath = resolveNotebookPath(relativePath);

  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    let buffer;

    if (encoding === 'base64') {
      // Correct binary handling for PNG/JPG/etc
      buffer = Buffer.from(content, 'base64');
      await fs.writeFile(filePath, buffer);
      console.log(`Saved binary file: ${relativePath} (${mimeType || 'unknown'})`);
    } else if (encoding === 'binary') {
      // Raw binary (ArrayBuffer passed from frontend)
      buffer = Buffer.from(content, 'binary');
      await fs.writeFile(filePath, buffer);
      console.log(`Saved raw binary: ${relativePath}`);
    } else {
      // UTF-8 text
      await fs.writeFile(filePath, content, 'utf8');
      console.log(`Saved text file: ${relativePath}`);
    }

    res.json({ success: true, path: relativePath });
  } catch (err) {
    console.error("Error saving file:", err);
    res.status(500).json({ error: "Error saving file" });
  }
});

// =========================================================
// ===============      CREATE FILE       ===================
// =========================================================

router.post('/create', async (req, res) => {
  const { path: relativePath } = req.body;
  if (!relativePath) return res.status(400).send('File path is required');

  const filePath = resolveNotebookPath(relativePath);
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, '', { flag: 'wx' });
    res.json({ success: true, path: relativePath });
  } catch (err) {
    if (err.code === 'EEXIST') {
      return res.status(409).send('File already exists');
    }
    console.error('Error creating file:', err);
    res.status(500).send('Error creating file');
  }
});

// =========================================================
// ===============   CREATE DIRECTORY     ===================
// =========================================================

router.post('/create-directory', async (req, res) => {
  const { path: relativePath } = req.body;
  if (!relativePath) return res.status(400).json({ error: 'Directory path is required' });

  const targetPath = resolveNotebookPath(relativePath);
  try {
    await fs.mkdir(targetPath, { recursive: false });
    res.json({ success: true, path: relativePath });
  } catch (err) {
    if (err.code === 'EEXIST') {
      return res.status(409).json({ error: 'Directory already exists' });
    }
    console.error('Error creating directory:', err);
    res.status(500).json({ error: 'Error creating directory' });
  }
});

// =========================================================
// ================       DELETE          ===================
// =========================================================

router.post('/delete', async (req, res) => {
  const { path: relativePath } = req.body;
  if (!relativePath) return res.status(400).send('Path is required');

  const targetPath = resolveNotebookPath(relativePath);
  const trashDir = resolveNotebookPath('Trash');

  try {
    await fs.mkdir(trashDir, { recursive: true });

    const stamped = `${Date.now()}_${relativePath.replace(/^\/+/, '')}`;
    const trashPath = path.join(trashDir, stamped);

    await fs.mkdir(path.dirname(trashPath), { recursive: true });

    await fs.rename(targetPath, trashPath);

    res.json({
      success: true,
      originalPath: relativePath,
      trashedPath: trashPath
    });
  } catch (err) {
    console.error('Error moving to trash:', err);
    res.status(500).send('Error moving to trash');
  }
});

// =========================================================
// ================       RENAME          ===================
// =========================================================

router.post('/rename', async (req, res) => {
  const { oldPath, newPath } = req.body;
  if (!oldPath || !newPath) {
    return res.status(400).send('Both oldPath and newPath are required');
  }

  const src = resolveNotebookPath(oldPath);
  const dest = resolveNotebookPath(newPath);

  try {
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.rename(src, dest);
    res.json({ success: true, oldPath, newPath });
  } catch (err) {
    console.error('Error renaming/moving:', err);
    res.status(500).send('Error renaming/moving');
  }
});

// =========================================================
// ================       COPY            ===================
// =========================================================

router.post('/copy', async (req, res) => {
  const { source, destination } = req.body;
  if (!source || !destination) {
    return res.status(400).send('Both source and destination are required');
  }

  const src = resolveNotebookPath(source);
  const dest = resolveNotebookPath(destination);

  try {
    await fs.mkdir(path.dirname(dest), { recursive: true });

    const stat = await fs.stat(src);
    if (stat.isDirectory()) {
      await fs.cp(src, dest, { recursive: true });
    } else {
      await fs.copyFile(src, dest);
    }

    res.json({ success: true, source, destination });
  } catch (err) {
    console.error('Error copying:', err);
    res.status(500).send('Error copying');
  }
});

// =========================================================
// ================        CUT            ===================
// =========================================================

router.post('/cut', async (req, res) => {
  const { source, destination } = req.body;
  if (!source || !destination) {
    return res.status(400).send('Both source and destination are required');
  }

  const src = resolveNotebookPath(source);
  const dest = resolveNotebookPath(destination);

  try {
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.rename(src, dest);
    res.json({ success: true, source, destination });
  } catch (err) {
    console.error('Error cutting/moving:', err);
    res.status(500).send('Error cutting/moving');
  }
});

export default router;
