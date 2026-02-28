// routes/api/graphData.js
// API endpoints for serving pre-generated graph data

import express from 'express';
import { getNodesByCharacter, getEdgesByDestinationCharacter, getEdgesPointingToNode, getNode, generateGraph } from '../../public/Graph/GraphManager.mjs';

const router = express.Router();

// GET /api/graph/nodes/:char - Get all nodes starting with character
router.get('/nodes/:char', async (req, res) => {
  try {
    const { char } = req.params;
    const nodes = await getNodesByCharacter(char);
    res.json(nodes);
  } catch (err) {
    console.error('[graphData] Error fetching nodes:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/graph/edges/by-destination/:char - Get all edges with destination starting with char
router.get('/edges/by-destination/:char', async (req, res) => {
  try {
    const { char } = req.params;
    const edges = await getEdgesByDestinationCharacter(char);
    res.json(edges);
  } catch (err) {
    console.error('[graphData] Error fetching edges:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/graph/node/:nodeId - Get a specific node
router.get('/node/:nodeId', async (req, res) => {
  try {
    const { nodeId } = req.params;
    const node = await getNode(nodeId);
    if (!node) {
      return res.status(404).json({ error: 'Node not found' });
    }
    res.json(node);
  } catch (err) {
    console.error('[graphData] Error fetching node:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/graph/edges-to/:nodeId - Get all edges pointing to a node
router.get('/edges-to/:nodeId', async (req, res) => {
  try {
    const { nodeId } = req.params;
    const edges = await getEdgesPointingToNode(nodeId);
    res.json(edges);
  } catch (err) {
    console.error('[graphData] Error fetching edges:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/graph/regenerate - Trigger full graph regeneration
router.post('/regenerate', async (req, res) => {
  try {
    const result = await generateGraph();
    res.json({ 
      success: true, 
      message: 'Graph regenerated successfully',
      ...result 
    });
  } catch (err) {
    console.error('[graphData] Error regenerating graph:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
