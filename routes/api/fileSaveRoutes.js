// Nodevision/routes/api/fileSaveRoutes.js
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();

// Change this to wherever your Notebook folder lives on disk
const NOTEBOOK_ROOT = path.resolve(__dirname, '../../Notebook');

// Helper to sanitize and resolve user paths under NOTEBOOK_ROOT
function resolveNotebookPath(relativePath) {
  // Normalize slashes
  let safeRelative = path.normalize(relativePath);

  // Prevent absolute paths or back-references
  safeRelative = safeRelative.replace(/^(\/*)/, '')              // strip leading slashes
                             .replace(/\.\.(\/|\\)/g, '');       // strip any “..” segments

  // Remove a leading "Notebook/" or "Notebook\"
  const nbPrefix = `Notebook${path.sep}`;
  if (safeRelative.startsWith(nbPrefix)) {
    safeRelative = safeRelative.slice(nbPrefix.length);
  }

  return path.join(NOTEBOOK_ROOT, safeRelative);
}

// Endpoint to save file content
router.post('/save', async (req, res) => {
  const { path: relativePath, content, encoding, mimeType } = req.body;
  if (!relativePath || typeof content !== 'string') {
    return res.status(400).send('File path and content are required');
  }

  const filePath = resolveNotebookPath(relativePath);
  try {
    // Ensure the directory tree exists
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    // Handle different encodings
    if (encoding === 'base64') {
      // For base64 image data, decode and write as binary
      const buffer = Buffer.from(content, 'base64');
      await fs.writeFile(filePath, buffer);
      console.log(`Saved binary file: ${relativePath} (${mimeType || 'unknown type'})`);
    } else {
      // Default: write as UTF-8 text file
      await fs.writeFile(filePath, content, 'utf8');
      console.log(`Saved text file: ${relativePath}`);
    }

    res.json({ success: true, path: relativePath });
  } catch (err) {
    console.error('Error saving file:', err);
    res.status(500).send('Error saving file');
  }
});

// Endpoint to create a new (empty) file
router.post('/create', async (req, res) => {
  const { path: relativePath } = req.body;
  if (!relativePath) {
    return res.status(400).send('File path is required');
  }

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

// Endpoint to create a new directory
router.post('/create-directory', async (req, res) => {
  const { path: relativePath } = req.body;
  if (!relativePath) {
    return res.status(400).json({ error: 'Directory path is required' });
  }

  const targetPath = resolveNotebookPath(relativePath);

  try {
    // Create parent dirs, then the target directory itself
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

module.exports = router;