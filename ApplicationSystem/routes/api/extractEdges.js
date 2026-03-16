// Nodevision/ApplicationSystem/routes/api/extractEdges.js
// This file defines the extract Edges API route handler for the Nodevision server. It validates requests and sends responses for extract Edges operations.

import express from 'express';
import path from 'node:path';

import { extractEdgesBatch, extractEdgesForFile } from "./extractEdges/extractHtmlEdges.js";

const router = express.Router();
const notebookDir = path.join(process.cwd(), 'Notebook');

router.get('/extractEdges', async (req, res) => {
  const filePath = req.query.path;
  if (!filePath)
    return res.status(400).json({ error: 'File path required' });

  try {
    const edges = await extractEdgesForFile({ filePath, notebookDir });
    console.log(`📌 [extractEdges] Detected ${edges.length} edges for ${filePath}:`, edges);
    res.json({ edges });

  } catch (err) {
    console.error('[extractEdges] ERROR:', err);
    res.status(500).json({ error: 'Failed to extract edges' });
  }
});

router.post('/extractEdgesBatch', async (req, res) => {
  const { files } = req.body;
  if (!files || !Array.isArray(files)) {
    return res.status(400).json({ error: 'files array required' });
  }

  const results = await extractEdgesBatch({ files, notebookDir });
  console.log(`📌 [extractEdgesBatch] Processed ${files.length} files, found edges in ${Object.keys(results).length}`);
  res.json({ edgeMap: results });
});

export default router;
