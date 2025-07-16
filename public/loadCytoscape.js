// public/loadCytoscape.js
import cytoscape from '/node_modules/cytoscape/dist/cytoscape.esm.min.js';
import fcose from '/node_modules/cytoscape-fcose/cytoscape-fcose.js';

cytoscape.use(fcose);
window.cytoscape = cytoscape;
