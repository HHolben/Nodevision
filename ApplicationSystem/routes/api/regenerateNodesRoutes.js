// routes/api/regenerateNodesRoutes.js
// Purpose: TODO: Add description of module purpose
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../..');
const NOTEBOOK_DIR = path.join(ROOT_DIR, 'Notebook');

import fs from 'node:fs/promises';

const router = express.Router();

const notebookDir = NOTEBOOK_DIR;

// Function to generate all nodes (just an example, you should replace it with your actual implementation)
const generateAllNodes = (dir) => {
    // Logic to generate all nodes (replace with your real implementation)
    return [{ id: 'node1', label: 'Node 1' }, { id: 'node2', label: 'Node 2' }];
};

// Endpoint to regenerate all nodes
router.get('/regenerateAllNodes', async (req, res) => {
    try {
        const allNodes = generateAllNodes(notebookDir);
        const allNodesOutput = `// AllNodes.js\nconst allNodes = [\n${allNodes.map(node => JSON.stringify(node, null, 2)).join(',\n')}\n];`;
        const generatedAllNodesPath = path.join(__dirname, '../../public', 'AllNodes.js');
        await fs.writeFile(generatedAllNodesPath, allNodesOutput, 'utf8');
        res.status(200).send('All nodes regenerated successfully.');
    } catch (err) {
        console.error('Error generating all nodes:', err);
        res.status(500).send('Failed to regenerate all nodes.');
    }
});

export default router;
