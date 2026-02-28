// routes/api/initialize.js
// Purpose: Application initialization and setup endpoints

import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../..');
const NOTEBOOK_DIR = path.join(ROOT_DIR, 'Notebook');

import fs from 'node:fs/promises';
const router = express.Router();

router.post('/initialize', async (req, res) => {
    const { htmlContent, fileName } = req.body;
    const filePath = path.join(NOTEBOOK_DIR, fileName);

    try {
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, htmlContent);
        console.log(`HTML file "${filePath}" created successfully!`);
        res.status(200).send('HTML file created successfully');
    } catch (error) {
        console.error('Error creating HTML file:', error);
        res.status(500).send('Error creating HTML file.');
    }
});

export default router;
