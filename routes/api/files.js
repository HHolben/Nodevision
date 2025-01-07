const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();
const allowedExtensions = ['.html', '.js', '.css']; // Define your allowed extensions here

// Base directory for the Notebook
const notebookBasePath = path.resolve(__dirname, '../../Notebook');

// Helper function to read directory contents
async function readDirectory(dir) {
    const result = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            result.push({
                name: entry.name,
                path: path.relative(notebookBasePath, fullPath),
                isDirectory: true,
            });
        } else if (allowedExtensions.includes(path.extname(entry.name))) {
            result.push({
                name: entry.name,
                path: path.relative(notebookBasePath, fullPath),
                isDirectory: false,
            });
        }
    }
    return result;
}

// Endpoint to get directory structure for FileView mode
router.get('/api/files', async (req, res) => {
    const dir = req.query.path
        ? path.join(notebookBasePath, req.query.path)
        : notebookBasePath;

    try {
        const structure = await readDirectory(dir);
        res.json(structure);
    } catch (error) {
        console.error('Error reading directory structure:', error);
        res.status(500).json({ error: 'Error reading directory structure' });
    }
});

// Endpoint to read file content
router.get('/api/file', async (req, res) => {
    const filePath = req.query.path;
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



module.exports = router;
