// Nodevision/ApplicationSystem/routes/api/graphStyles.js
// This file defines the graph Styles API route handler for the Nodevision server. It validates requests and sends responses for graph Styles operations.
// routes/api/graphStyles.js
// Purpose: Graph visualization styling

import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServerContext } from '../../shared/serverContext.mjs';

const BASE_CONTEXT = createServerContext();

export default function createGraphStylesRouter(ctx = BASE_CONTEXT) {
  const router = express.Router();
  const stylesFilePath = path.join(ctx.publicDir, 'GraphStyles.js');

  router.post('/updateGraphStyles', async (req, res) => {
    const newStyles = req.body.styles;

    try {
      let currentStyles = await fs.readFile(stylesFilePath, 'utf8');
      currentStyles = currentStyles.replace(/background-color: #66ccff;/g, newStyles);
      await fs.writeFile(stylesFilePath, currentStyles, 'utf8');
      res.status(200).send('Graph styles updated successfully.');
    } catch (error) {
      console.error('Error updating GraphStyles.js:', error);
      res.status(500).send('Failed to update graph styles.');
    }
  });

  return router;
}
