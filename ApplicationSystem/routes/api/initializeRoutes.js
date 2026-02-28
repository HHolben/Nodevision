// routes/api/initializeRoutes.js
// Purpose: TODO: Add description of module purpose
import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../..');
const NOTEBOOK_DIR = path.join(ROOT_DIR, 'Notebook');

const router = express.Router();

// Endpoint to initialize HTML file and regenerate graph
router.post('/initialize', async (req, res) => {
    const { htmlContent, fileName } = req.body;

    if (!htmlContent || !fileName) {
        return res.status(400).send('HTML content and file name are required.');
    }

    const filePath = path.join(NOTEBOOK_DIR, fileName);

    try {
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, htmlContent);
        console.log(`HTML file "${filePath}" created successfully!`);
        res.status(200).send('HTML file created successfully.');
    } catch (error) {
        console.error('Error creating HTML file:', error);
        res.status(500).send('Error creating HTML file.');
    }
});

export default router;
