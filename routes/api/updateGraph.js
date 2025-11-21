import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = express.Router();

router.post('/api/updateGraph', async (req, res) => {
  const elements = req.body.elements;

  if (!elements || !Array.isArray(elements)) {
    return res.status(400).json({ error: 'No graph elements provided or invalid format.' });
  }

  try {
    const nodes = [];
    const edges = [];

    elements.forEach(element => {
      if (element.data) {
        const data = element.data;
        if (data.source && data.target) {
          edges.push(data);
        } else {
          nodes.push(data);
        }
      }
    });

    const dataDir = path.resolve(__dirname, '../../public/data');
    await fs.mkdir(dataDir, { recursive: true });

    const nodesContent = `export const generatedNodes = ${JSON.stringify(nodes, null, 2)};\n`;
    const edgesContent = `export const generatedEdges = ${JSON.stringify(edges, null, 2)};\n`;

    await fs.writeFile(path.join(dataDir, 'GeneratedNodes.js'), nodesContent, 'utf8');
    await fs.writeFile(path.join(dataDir, 'GeneratedEdges.js'), edgesContent, 'utf8');

    res.json({ success: true, message: 'Graph updated successfully.' });
  } catch (error) {
    console.error('Error updating graph:', error);
    res.status(500).json({ error: 'Failed to update graph.' });
  }
});

export default router;
