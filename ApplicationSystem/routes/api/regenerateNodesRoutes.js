// Nodevision/ApplicationSystem/routes/api/regenerateNodesRoutes.js
// This file defines the regenerate Nodes Routes API route handler for the Nodevision server. It validates requests and sends responses for regenerate Nodes Routes operations.
// routes/api/regenerateNodesRoutes.js
// Regenerates Node definitions

import express from 'express';
import path from 'node:path';
import fs from 'node:fs/promises';
import { createServerContext } from '../../shared/serverContext.mjs';

const BASE_CONTEXT = createServerContext();

const generateAllNodes = () => {
  return [{ id: 'node1', label: 'Node1' }, { id: 'node2', label: 'Node2' }];
};

export default function createRegenerateNodesRouter(ctx = BASE_CONTEXT) {
  const router = express.Router();
  const notebookDir = ctx.notebookDir;
  const outputPath = path.join(ctx.publicDir, 'AllNodes.js');

  router.get('/regenerateAllNodes', async (req, res) => {
    try {
      const allNodes = generateAllNodes(notebookDir);
      const allNodesOutput = `// AllNodes.js\nconst allNodes = [\n${allNodes.map(node => JSON.stringify(node, null, 2)).join(',\n')}\n];`;
      await fs.writeFile(outputPath, allNodesOutput, 'utf8');
      res.status(200).send('All nodes regenerated successfully.');
    } catch (err) {
      console.error('Error generating all nodes:', err);
      res.status(500).send('Failed to regenerate all nodes.');
    }
  });

  return router;
}
