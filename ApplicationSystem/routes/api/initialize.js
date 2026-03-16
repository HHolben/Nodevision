// Nodevision/ApplicationSystem/routes/api/initialize.js
// This file defines the initialize API route handler for the Nodevision server. It validates requests and sends responses for initialize operations.
// routes/api/initialize.js
// Application initialization and setup endpoint

import express from 'express';
import path from 'node:path';
import fs from 'node:fs/promises';
import { createServerContext } from '../../shared/serverContext.mjs';

const BASE_CONTEXT = createServerContext();

export default function createInitializeRouter(ctx = BASE_CONTEXT) {
  const router = express.Router();
  const NOTEBOOK_DIR = ctx.notebookDir;

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

  return router;
}
