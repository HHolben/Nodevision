// Nodevision/routes/api/fileSaveRoutes.js
// This module declares the server routes needed to save files.
import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Change this to wherever your Notebook folder lives on disk
const NOTEBOOK_ROOT = path.resolve(__dirname, '../../Notebook');

// Helper to sanitize and resolve user paths under NOTEBOOK_ROOT
function resolveNotebookPath(relativePath) {
  let safeRelative = path.normalize(relativePath);

  // Prevent absolute paths or back-references
  safeRelative = safeRelative.replace(/^(\/*)/, '')              // strip leading slashes
                             .replace(/\.\.(\/|\\)/g, '');       // strip “..” segments

  // Remove a leading "Notebook/"
  const nbPrefix = `Notebook${path.sep}`;
  if (safeRelative.startsWith(nbPrefix)) {
    safeRelative = safeRelative.slice(nbPrefix.length);
  }

  return path.join(NOTEBOOK_ROOT, safeRelative);
}

/* ========= Existing routes ========= */

// Save (update or overwrite file)
router.post('/save', async (req, res) => {
  const { path: relativePath, content, encoding, mimeType } = req.body;
  if (!relativePath || typeof content !== 'string') {
    return res.status(400).send('File path and content are required');
  }

  const filePath = resolveNotebookPath(relativePath);
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    if (encoding === 'base64') {
      const buffer = Buffer.from(content, 'base64');
      await fs.writeFile(filePath, buffer);
      console.log(`Saved binary file: ${relativePath} (${mimeType || 'unknown type'})`);
    } else {
      await fs.writeFile(filePath, content, 'utf8');
      console.log(`Saved text file: ${relativePath}`);
    }

    res.json({ success: true, path: relativePath });
  } catch (err) {
    console.error('Error saving file:', err);
    res.status(500).send('Error saving file');
  }
});

// Create new file
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

// Create new directory
router.post('/create-directory', async (req, res) => {
  const { path: relativePath } = req.body;
  if (!relativePath) return res.status(400).json({ error: 'Directory path is required' });

  const targetPath = resolveNotebookPath(relativePath);
  try {
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.mkdir(targetPath);
    res.json({ success: true, path: relativePath });
  } catch (err) {
    if (err.code === 'EEXIST') {
      return res.status(409).json({ error: 'Directory already exists' });
    }
    console.error('Error creating directory:', err);
    res.status(500).json({ error: 'Error creating directory' });
  }
});

/* ========= New CRUD routes ========= */

// Move file or directory to Trash inside Notebook
router.post('/delete', async (req, res) => {
  const { path: relativePath } = req.body;
  if (!relativePath) return res.status(400).send('Path is required');

  const targetPath = resolveNotebookPath(relativePath);
  const trashDir = resolveNotebookPath('Trash'); // inside Notebook

  try {
    // Ensure the trash folder exists
    await fs.mkdir(trashDir, { recursive: true });

    // Preserve folder structure in trash
    const safeRelative = relativePath.replace(/^\/+/, ''); // remove leading slashes
    const trashPath = path.join(trashDir, `${Date.now()}_${safeRelative}`);

    // Make sure parent directories exist
    await fs.mkdir(path.dirname(trashPath), { recursive: true });

    // Move the file or directory
    await fs.rename(targetPath, trashPath);

    res.json({ success: true, originalPath: relativePath, trashedPath: trashPath });
  } catch (err) {
    console.error('Error moving to trash:', err);
    res.status(500).send('Error moving to trash');
  }
});


// Rename (or move)
router.post('/rename', async (req, res) => {
  const { oldPath, newPath } = req.body;
  if (!oldPath || !newPath) return res.status(400).send('Both oldPath and newPath are required');

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

// Copy
router.post('/copy', async (req, res) => {
  const { source, destination } = req.body;
  if (!source || !destination) return res.status(400).send('Both source and destination are required');

  const src = resolveNotebookPath(source);
  const dest = resolveNotebookPath(destination);

  try {
    await fs.mkdir(path.dirname(dest), { recursive: true });

    // If directory, copy recursively
    const stat = await fs.stat(src);
    if (stat.isDirectory()) {
      await fs.cp(src, dest, { recursive: true, errorOnExist: false });
    } else {
      await fs.copyFile(src, dest);
    }
    res.json({ success: true, source, destination });
  } catch (err) {
    console.error('Error copying:', err);
    res.status(500).send('Error copying');
  }
});

// Cut (move to new location)
router.post('/cut', async (req, res) => {
  const { source, destination } = req.body;
  if (!source || !destination) return res.status(400).send('Both source and destination are required');

  const src = resolveNotebookPath(source);
  const dest = resolveNotebookPath(destination);

  try {
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.rename(src, dest); // move
    res.json({ success: true, source, destination });
  } catch (err) {
    console.error('Error cutting/moving:', err);
    res.status(500).send('Error cutting/moving');
  }
});

export default router;
