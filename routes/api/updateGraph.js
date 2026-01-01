// Nodevision/routes/api/updateGraph.js
import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = express.Router();

const EDGES_DIR = path.resolve(__dirname, '../../public/data/edges');

/**
 * Endpoint to update graph shards or legacy files
 * Mounted at /api via server.js, so URL is /api/updateGraph
 */
router.post('/updateGraph', async (req, res) => {
    console.log("📥 Received request at /api/updateGraph");
    const { shardName, edges, elements } = req.body;

    try {
        // 1. Shard Saving Logic
        if (shardName && Array.isArray(edges)) {
            await fs.mkdir(EDGES_DIR, { recursive: true });
            const filePath = path.join(EDGES_DIR, shardName);
            await fs.writeFile(filePath, JSON.stringify(edges, null, 2), 'utf8');
            
            console.log(`✅ Shard saved: ${shardName}`);
            return res.json({ success: true, message: `Shard ${shardName} updated.` });
        }

        // 2. Legacy Full Graph Logic
        if (elements && Array.isArray(elements)) {
            const nodes = [];
            const edgesList = [];

            elements.forEach(el => {
                if (el.data?.source && el.data?.target) edgesList.push(el.data);
                else if (el.data) nodes.push(el.data);
            });

            const dataDir = path.resolve(__dirname, '../../public/data');
            await fs.mkdir(dataDir, { recursive: true });

            await fs.writeFile(path.join(dataDir, 'GeneratedNodes.js'), `export const generatedNodes = ${JSON.stringify(nodes, null, 2)};`, 'utf8');
            await fs.writeFile(path.join(dataDir, 'GeneratedEdges.js'), `export const generatedEdges = ${JSON.stringify(edgesList, null, 2)};`, 'utf8');

            console.log("✅ Legacy graph files updated.");
            return res.json({ success: true, message: 'Legacy graph files updated.' });
        }

        // 3. Fallback if body doesn't match
        console.warn("⚠️ updateGraph received invalid body structure");
        return res.status(400).json({ error: 'Invalid request format. Expected shardName/edges or elements.' });

    } catch (error) {
        console.error('❌ Error in updateGraph route:', error);
        return res.status(500).json({ error: 'Internal server error while updating graph.' });
    }
});

// CRITICAL: Ensure the router is the default export
export default router;