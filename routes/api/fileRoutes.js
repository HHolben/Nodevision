const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();

// Define the base directory for the Notebook
const notebookDir = path.resolve(__dirname, '../../Notebook');
const allowedExtensions = ['.html', '.php', '.js', '.py'];

// Helper function to read a directory
async function readDirectory(dir) {
    const result = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            result.push({
                name: entry.name,
                path: path.relative(notebookDir, fullPath),
                isDirectory: true,
            });
        } else if (allowedExtensions.includes(path.extname(entry.name))) {
            result.push({
                name: entry.name,
                path: path.relative(notebookDir, fullPath),
                isDirectory: false,
            });
        }
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

module.exports = router;
