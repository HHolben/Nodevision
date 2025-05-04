const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();

// Define the base directory for the Notebook
tmp = path.resolve(__dirname, '../../Notebook'); // temporary ref
const notebookDir = tmp; // rename for clarity

// Ensure the Notebook directory exists on startup
(async () => {
  try {
    await fs.mkdir(notebookDir, { recursive: true });
    console.log(`Notebook directory verified at ${notebookDir}`);
  } catch (err) {
    console.error('Failed to create Notebook directory on startup:', err);
  }
})();

// Helper function to read a directory
async function readDirectory(dir) {
    let entries;
    try {
        entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (error) {
        if (error.code === 'ENOENT') {
            // If directory doesn't exist, return empty list
            return [];
        }
        throw error;
    }

    const result = [];
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        result.push({
            name: entry.name,
            path: path.relative(notebookDir, fullPath),
            isDirectory: entry.isDirectory(),
        });
    }
    return result;
}

// Endpoint to create a new directory within the Notebook directory
router.post('/create-directory', async (req, res) => {
    const { folderName, parentPath } = req.body;

    if (!folderName || typeof folderName !== 'string') {
        return res.status(400).json({ error: 'A valid folder name is required.' });
    }

    const newDirPath = path.join(notebookDir, parentPath || '', folderName);

    try {
        await fs.mkdir(newDirPath, { recursive: true });
        res.status(200).json({
            message: `Directory "${folderName}" created successfully at "${path.relative(
                notebookDir,
                newDirPath
            )}".`,
        });
    } catch (error) {
        console.error('Error creating directory:', error);
        res.status(500).json({ error: 'Failed to create directory.' });
    }
});

// Endpoint to list available files in a directory
router.get('/files', async (req, res) => {
    const dir = req.query.path ? path.join(notebookDir, req.query.path) : notebookDir;

    try {
        const structure = await readDirectory(dir);
        res.json(structure);
    } catch (error) {
        console.error('Error reading directory structure:', error);

        if (error.code === 'ENOENT') {
            res.status(404).json({ error: 'Directory not found.' });
        } else {
            res.status(500).json({ error: 'Error reading directory structure.' });
        }
    }
});

// Endpoint to move files or directories within the Notebook directory
router.post('/move', async (req, res) => {
    const { source, destination } = req.body;
    
    if (!source || typeof source !== 'string' || destination === undefined) {
      return res.status(400).json({ error: 'Source and destination are required.' });
    }
    
    // If destination is an empty string, treat that as Notebook root.
    // Reject only if the source is already at the Notebook root.
    const sourceDir = path.dirname(source);
    if (destination === "" && (sourceDir === "" || sourceDir === ".")) {
      return res.status(400).json({ error: 'Cannot move further up. Already at root.' });
    }
    
    const sourceFullPath = path.join(notebookDir, source);
    const destDir = path.join(notebookDir, destination);
    const destinationFullPath = path.join(destDir, path.basename(source));
    
    console.log(`Moving from "${sourceFullPath}" to "${destinationFullPath}"`);
    
    try {
      // Ensure destination directory exists
      await fs.mkdir(destDir, { recursive: true });
      await fs.rename(sourceFullPath, destinationFullPath);
      res.status(200).json({ message: `Moved "${source}" to "${destination}".` });
    } catch (error) {
      console.error('Error moving file or directory:', error);
      res.status(500).json({ error: 'Failed to move file or directory.', details: error.message });
    }
});

module.exports = router;
