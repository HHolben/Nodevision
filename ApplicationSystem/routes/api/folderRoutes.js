// routes/api/folderRoutes.js
// This file declares the backends for creation and management operations

import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, '../../..');
const NOTEBOOK_DIR = path.join(ROOT_DIR, 'Notebook');
const USER_SETTINGS_DIR = path.join(ROOT_DIR, 'UserSettings');

const router = express.Router();

// Define the base directory for the Notebook
const notebookDir = NOTEBOOK_DIR;
const userSettingsDir = USER_SETTINGS_DIR;
const userTrashRelative = 'Trash';

// Ensure the Notebook directory exists on startup
(async () => {
  try {
    await fs.mkdir(notebookDir, { recursive: true });
    console.log(`Notebook directory verified at ${notebookDir}`);
  } catch (err) {
    console.error('Failed to create Notebook directory on startup:', err);
  }
})();

function normalizeClientPath(inputPath) {
    if (!inputPath) return '';
    return String(inputPath)
        .replace(/\\/g, '/')
        .replace(/^\/+/, '')
        .replace(/\/+/g, '/')
        .trim();
}

function resolveScopedDirectory(clientPath = '') {
    const normalized = normalizeClientPath(clientPath);
    const isUserSettings = normalized === 'UserSettings' || normalized.startsWith('UserSettings/');

    if (isUserSettings) {
        const relativeUnderUserSettings = normalized.slice('UserSettings'.length).replace(/^\/+/, '');
        const resolved = path.resolve(userSettingsDir, relativeUnderUserSettings || '.');
        const rel = path.relative(userSettingsDir, resolved);
        if (rel.startsWith('..') || path.isAbsolute(rel)) {
            throw new Error('Access denied');
        }
        return {
            fullPath: resolved,
            rootType: 'userSettings',
            rootBase: userSettingsDir,
            rootPrefix: 'UserSettings'
        };
    }

    const resolved = path.resolve(notebookDir, normalized || '.');
    const rel = path.relative(notebookDir, resolved);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
        throw new Error('Access denied');
    }
    return {
        fullPath: resolved,
        rootType: 'notebook',
        rootBase: notebookDir,
        rootPrefix: ''
    };
}

// Helper function to read a directory
async function readDirectory(dir, { rootBase, rootPrefix } = {}) {
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
        const relFromRoot = path.relative(rootBase || notebookDir, fullPath).split(path.sep).join('/');
        const prefixedPath = rootPrefix ? `${rootPrefix}/${relFromRoot}` : relFromRoot;
        result.push({
            name: entry.name,
            path: prefixedPath,
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
    try {
        const requestedPath = req.query.path || '';
        const scoped = resolveScopedDirectory(requestedPath);

        // Ensure the trash directory exists on first open.
        if (normalizeClientPath(requestedPath).toLowerCase() === 'usersettings/trash') {
            await fs.mkdir(path.join(userSettingsDir, userTrashRelative), { recursive: true });
        }

        const structure = await readDirectory(scoped.fullPath, {
            rootBase: scoped.rootBase,
            rootPrefix: scoped.rootPrefix
        });
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


// Define the base directory for Toolbar JSON files
const toolbarDir = path.resolve(__dirname, '../../public/ToolbarJSONfiles');

// Endpoint to list toolbar JSON files
router.get('/toolbar-files', async (req, res) => {
  try {
    const entries = await fs.readdir(toolbarDir, { withFileTypes: true });
    const jsonFiles = entries
      .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
      .map(entry => entry.name);

    res.json(jsonFiles);
  } catch (err) {
    console.error('Error listing toolbar JSON files:', err);
    res.status(500).json({ error: 'Failed to list toolbar files' });
  }
});

export default router;
