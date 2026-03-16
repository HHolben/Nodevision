// Nodevision/ApplicationSystem/Graph/entry-cytoscape.js
// This file defines the entry cytoscape module for the Nodevision ApplicationSystem. It provides helper logic and exports functionality for other modules.
// Graph/entry-cytoscape.js
// Purpose: TODO: Add description of module purpose
import cytoscape from 'cytoscape';
import fcose from 'cytoscape-fcose';

cytoscape.use(fcose);
window.cytoscape = cytoscape;
