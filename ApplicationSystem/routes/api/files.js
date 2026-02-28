// routes/api/files.js
// Purpose: File and directory management API for notebook structure navigation

import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../..');
const NOTEBOOK_BASE_PATH = path.join(ROOT_DIR, 'Notebook');
const router = express.Router();

// Base directory for the Notebook
const notebookBasePath = NOTEBOOK_BASE_PATH;
const DIRECTORY_IMAGE_CANDIDATES = [
    '.directory.svg',
    '.directory.png',
    'directory.svg',
    'directory.png',
];

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

// Helper function to read directory contents
async function readDirectory(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const result = await Promise.all(entries.map(async (entry) => {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(notebookBasePath, fullPath);
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

// Endpoint to read binary file content (used by raster editors such as PNG)
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

// Support both mounting styles used in this codebase.
router.get('/file-binary', handleFileBinary);
router.get('/api/file-binary', handleFileBinary);



export default router;
