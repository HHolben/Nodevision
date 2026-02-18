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
const USER_SETTINGS_ROOT = path.resolve(__dirname, '../../UserSettings');

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

function resolveUserSettingsPath(relativePath) {
  if (!relativePath) throw new Error("Missing path");

  let cleaned = relativePath.replace(/^\/+/, '');
  cleaned = path.normalize(cleaned);
  cleaned = cleaned.replace(/\.\.(\/|\\)/g, '');

  return path.join(USER_SETTINGS_ROOT, cleaned);
}

// =========================================================
// ===============   SAVE / UPDATE FILE   ==================
// =========================================================

router.post('/save', async (req, res) => {
  const {
    path: relativePath,
    content,
    encoding = 'utf8',
    mimeType,
    bom = false
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
      // Text encodings
      const enc = String(encoding).toLowerCase();

      if (enc === 'utf8' || enc === 'utf-8') {
        const textBuf = Buffer.from(content, 'utf8');
        const out = bom ? Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), textBuf]) : textBuf;
        await fs.writeFile(filePath, out);
        console.log(`Saved text file: ${relativePath} (utf8${bom ? '+bom' : ''})`);
      } else if (enc === 'utf16le' || enc === 'utf-16le') {
        const textBuf = Buffer.from(content, 'utf16le');
        const out = bom ? Buffer.concat([Buffer.from([0xff, 0xfe]), textBuf]) : textBuf;
        await fs.writeFile(filePath, out);
        console.log(`Saved text file: ${relativePath} (utf16le${bom ? '+bom' : ''})`);
      } else if (enc === 'utf16be' || enc === 'utf-16be') {
        const textBuf = Buffer.from(content, 'utf16le');
        textBuf.swap16();
        const out = bom ? Buffer.concat([Buffer.from([0xfe, 0xff]), textBuf]) : textBuf;
        await fs.writeFile(filePath, out);
        console.log(`Saved text file: ${relativePath} (utf16be${bom ? '+bom' : ''})`);
      } else if (enc === 'latin1' || enc === 'iso-8859-1') {
        const textBuf = Buffer.from(content, 'latin1');
        await fs.writeFile(filePath, textBuf);
        console.log(`Saved text file: ${relativePath} (latin1)`);
      } else {
        return res.status(400).json({ error: `Unsupported encoding: ${encoding}` });
      }
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
  const legacyTrashDir = resolveNotebookPath('Trash');
  const trashDir = resolveUserSettingsPath('Trash');

  try {
    try {
      await fs.access(legacyTrashDir);
      await fs.access(trashDir);
    } catch {
      try {
        await fs.rename(legacyTrashDir, trashDir);
      } catch {
        // Best-effort migration only.
      }
    }

    await fs.mkdir(trashDir, { recursive: true });

    const safeRelativePath = path.relative(NOTEBOOK_ROOT, targetPath).split(path.sep).join('/');
    const stamped = `${Date.now()}_${safeRelativePath}`;
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
