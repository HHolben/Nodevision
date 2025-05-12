// routes/api/fileSaveRoutes.js
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();

// Change this to wherever your Notebook folder lives on disk
const NOTEBOOK_ROOT = path.resolve(__dirname, '../../Notebook');

// Helper to sanitize and resolve user paths under NOTEBOOK_ROOT
function resolveNotebookPath(relativePath) {
  // Prevent absolute paths or back-references
  const safeRelative = relativePath.replace(/^\/*/, '').replace(/\.\.(\/|\\)/g, '');
  return path.join(NOTEBOOK_ROOT, safeRelative);
}

// Endpoint to save file content
router.post('/save', async (req, res) => {
  const { path: relativePath, content } = req.body;
  if (!relativePath || typeof content !== 'string') {
    return res.status(400).send('File path and content are required');
  }

  const filePath = resolveNotebookPath(relativePath);
  try {
    await fs.writeFile(filePath, content, 'utf8');
    res.send({ success: true, path: relativePath });
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
    // Ensure directory exists
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    // Create the file with empty content if it doesn't already exist
    await fs.writeFile(filePath, '', { flag: 'wx' });
    res.send({ success: true, path: relativePath });
  } catch (err) {
    if (err.code === 'EEXIST') {
      return res.status(409).send('File already exists');
    }
    console.error('Error creating file:', err);
    res.status(500).send('Error creating file');
  }
});

module.exports = router;
