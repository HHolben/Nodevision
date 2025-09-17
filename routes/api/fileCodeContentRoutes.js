// routes/api/fileCodeContentRoutes.js
// Purpose: TODO: Add description of module purpose
import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Ensure the path is correctly resolved relative to the project root
const notebookBasePath = path.resolve(__dirname, '../..');


// Endpoint to get file content
router.get('/fileCodeContent', async (req, res) => {
    const filePath = req.query.path;
    console.log('Requested file path:', filePath);

    if (!filePath) {
        return res.status(400).send('File path is required');
    }

    const absolutePath = path.join(notebookBasePath, filePath);

    try {
        const data = await fs.readFile(absolutePath, 'utf8');
        res.send({ content: data });
    } catch (err) {
        console.error('Error reading file:', err);
        res.status(500).send('Error reading file');
    }
});

export default router;
