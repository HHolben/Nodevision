// Nodevision/public/Graph.js

/**
 * Dynamically loads generated graph data and initializes Cytoscape graph.
 * Uses dynamic imports (Option B) to fetch GeneratedNodes.js and GeneratedEdges.js.
 */

// Import Cytoscape and extensions
import cytoscape from 'cytoscape';
import fcose from 'cytoscape-fcose';
import expandCollapse from 'cytoscape-expand-collapse';

// Register extensions
cytoscape.use(fcose);
cytoscape.use(expandCollapse);

/**
 * Creates and configures the Cytoscape instance with provided elements and styles.
 * @param {Array} elements - Combined array of node and edge elements.
 */
function createCytoscapeGraph(elements) {
  window.originalEdges = {};
  window.truncatedEdges = {};

  window.cy = cytoscape({
    container: document.getElementById('cy'),
    elements: elements,
    style: [
      {
        selector: 'node[imageUrl]',
        style: {
          'background-image': 'data(imageUrl)',
          'background-fit': 'contain',
          'background-clip': 'node',
          'width': '80px',
          'height': '80px',
          'label': 'data(label)',
          'shape': 'rectangle'
        }
      },
      {
        selector: 'node[type="region"]',
        style: {
          'background-image': 'data(imageUrl)',
          'background-fit': 'contain',
          'background-clip': 'node',
          'width': '50px',
          'height': '50px',
          'label': 'data(label)',
          'background-color': '#f0f0f0',
          'shape': 'roundrectangle'
        }
      },
      {
        selector: 'edge',
        style: {
          'width': 3,
          'line-color': '#ccc',
          'target-arrow-color': '#ccc',
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier'
        }
      }
    ],
    layout: { name: 'fcose', animate: true }
  });

  // Node and edge click interactions
  window.cy.on('tap', 'node, edge', function(evt) {
    const element = evt.target;
    updateInfoPanel(element);
  });

  // Click background to clear info panel
  window.cy.on('tap', function(event) {
    if (event.target === window.cy) {
      const infoEl = document.getElementById('element-info');
      const frame = document.getElementById('content-frame');
      infoEl.innerHTML = 'Click on a node, edge, or region to see details.';
      if (frame) frame.src = '';
    }
  });

  // Setup expand-collapse API for compound (region) nodes
  const api = window.cy.expandCollapse({ undoable: true });
  window.cy.on('tap', 'node[type="region"]', function(evt) {
    const node = evt.target;
    if (api.isCollapsible(node)) api.collapse(node);
    else if (api.isExpandable(node)) api.expand(node);
  });
}

/**
 * Loads generatedNodes and generatedEdges dynamically and renders the graph.
 */
async function loadGeneratedDataAndRender() {
  try {
    const [{ generatedNodes }, { generatedEdges }] = await Promise.all([
      import('./data/GeneratedNodes.js'),
      import('./data/GeneratedEdges.js')
    ]);

    const elements = [
      ...generatedNodes.map(n => ({ data: n, classes: n.type })),
      ...generatedEdges.map(e => ({ data: e }))
    ];

    createCytoscapeGraph(elements);

  } catch (err) {
    console.error('Error loading graph data:', err);
  }
}

// Kick off on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadGeneratedDataAndRender);
} else {
  loadGeneratedDataAndRender();
}
