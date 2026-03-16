// Nodevision/ApplicationSystem/routes/api/updateGraph.js
// This file defines the update Graph API route handler for the Nodevision server. It validates requests and sends responses for update Graph operations.
import express from "express";
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServerContext } from '../../shared/serverContext.mjs';

const BASE_CONTEXT = createServerContext();

export default function createUpdateGraphRouter(ctx = BASE_CONTEXT) {
  const router = express.Router();
  const dataDir = ctx.sharedDataDir;
  const edgesDir = path.join(dataDir, 'edges');

  router.post('/updateGraph', async (req, res) => {
    console.log("📥 Received request at /api/updateGraph");
    const { shardName, edges, elements } = req.body;

    try {
      if (shardName && Array.isArray(edges)) {
        await fs.mkdir(edgesDir, { recursive: true });
        const filePath = path.join(edgesDir, shardName);
        await fs.writeFile(filePath, JSON.stringify(edges, null, 2), 'utf8');
        console.log(`✅ Shard saved: ${shardName}`);
        return res.json({ success: true, message: `Shard ${shardName} updated.` });
      }

      if (elements && Array.isArray(elements)) {
        const nodes = [];
        const edgesList = [];

        elements.forEach(el => {
          if (el.data?.source && el.data?.target) edgesList.push(el.data);
          else if (el.data) nodes.push(el.data);
        });

        await fs.mkdir(dataDir, { recursive: true });
        await fs.writeFile(path.join(dataDir, 'GeneratedNodes.js'), `export const generatedNodes = ${JSON.stringify(nodes, null, 2)};`, 'utf8');
        await fs.writeFile(path.join(dataDir, 'GeneratedEdges.js'), `export const generatedEdges = ${JSON.stringify(edgesList, null, 2)};`, 'utf8');

        console.log("✅ Legacy graph files updated.");
        return res.json({ success: true, message: 'Legacy graph files updated.' });
      }

      console.warn("⚠️ updateGraph received invalid body structure");
      return res.status(400).json({ error: 'Invalid request format. Expected shardName/edges or elements.' });
    } catch (error) {
      console.error('❌ Error in updateGraph route:', error);
      return res.status(500).json({ error: 'Internal server error while updating graph.' });
    }
  });

  return router;
}
