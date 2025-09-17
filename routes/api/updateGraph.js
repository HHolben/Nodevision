// api/updateGraph.js
// Purpose: TODO: Add description of module purpose

const express = require('express');
const router = express.Router();
const NodevisionDB = require('nodevisiondb'); // Ensure this package is installed

// Initialize the Nodevision graph database.
const db = NodevisionDB.createGraphDB();

/**
 * POST /api/updateGraph
 * Expects a JSON body with a property "elements" that is an array of Cytoscape elements.
 * Each element should have a "data" property. For nodes, it includes an "id" and "label" (and optionally "path").
 * For edges, it includes "source" and "target".
 */
router.post('/updateGraph', (req, res) => {
  const elements = req.body.elements;

  if (!elements || !Array.isArray(elements)) {
    return res.status(400).json({ error: 'No graph elements provided or invalid format.' });
  }

  try {
    // Clear the existing graph.
    if (typeof db.clearGraph === 'function') {
      db.clearGraph();
    }

    // Process each element.
    elements.forEach(element => {
      if (element.data) {
        const data = element.data;
        // If it has both source and target, treat it as an edge.
        if (data.source && data.target) {
          db.createEdge(data.source, data.target);
        } else {
          // Otherwise, treat it as a node.
          // Use id and label; optionally pass the path if available.
          db.createNode(data.id, data.label, data.path || '');
        }
      }
    });

    // Save the updated graph.
    if (typeof db.saveGraph === 'function') {
      db.saveGraph();
    }

    res.json({ success: true, message: 'Graph updated successfully.' });
  } catch (error) {
    console.error('Error updating graph:', error);
    res.status(500).json({ error: 'Failed to update graph.' });
  }
});

module.exports = router;
