// Nodevision/ApplicationSystem/public/loadCytoscape.js
// This file defines browser-side load Cytoscape logic for the Nodevision UI. It renders interface components and handles user interactions.
// public/loadCytoscape.js
// Purpose: TODO: Add description of module purpose
import cytoscape from '/node_modules/cytoscape/dist/cytoscape.esm.min.js';
import fcose from '/node_modules/cytoscape-fcose/cytoscape-fcose.js';

cytoscape.use(fcose);
window.cytoscape = cytoscape;
