// Nodevision/public/Graph.js
// Purpose: TODO: Add description of module purpose
// Dependencies available via window from loaded vendor scripts
// Plugins auto-register themselves when loaded after cytoscape

function createCytoscapeGraph(elements) {
  // Guard against missing dependencies
  if (!window.cytoscape || !window.cytoscape.prototype || typeof window.cytoscape.prototype.expandCollapse !== 'function') {
    console.warn('Graph dependencies missing; skipping graph initialization');
    return;
  }
  window.originalEdges = {};
  window.truncatedEdges = {};

  window.cy = window.cytoscape({
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

  window.cy.on('tap', 'node, edge', function(evt) {
    const element = evt.target;
    updateInfoPanel(element);
  });

  window.cy.on('tap', function(event) {
    if (event.target === window.cy) {
      const infoEl = document.getElementById('element-info');
      const frame = document.getElementById('content-frame');
      infoEl.innerHTML = 'Click on a node, edge, or region to see details.';
      if (frame) frame.src = '';
    }
  });

  const api = window.cy.expandCollapse({ undoable: true });
  window.cy.on('tap', 'node[type="region"]', function(evt) {
    const node = evt.target;
    if (api.isCollapsible(node)) api.collapse(node);
    else if (api.isExpandable(node)) api.expand(node);
  });
}

// Utility to dynamically import all submodules for a given prefix
async function importAllModules(directory, prefix, suffixes) {
  const imports = [];
  for (const suffix of suffixes) {
    const path = `./${directory}/${prefix}${suffix}.js`;
    try {
      imports.push(import(path));
    } catch (e) {
      console.warn(`Skipped missing file: ${path}`);
    }
  }
  return Promise.all(imports);
}

async function loadGeneratedDataAndRender() {
  try {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('');
    const symbols = ['Symbol'];

    const nodeFiles = [...letters, ...symbols].map(c => `./data/nodes/${c}.js`);
    const edgeOriginFiles = [...letters, ...symbols].map(c => `./data/edges/origin/${c}.js`);
    const edgeDestFiles = [...letters, ...symbols].map(c => `./data/edges/dest/${c}.js`);

    // Dynamically load all node modules
    const nodeModules = await Promise.all(
      nodeFiles.map(path => import(path).catch(() => null))
    );

    const edgeOriginModules = await Promise.all(
      edgeOriginFiles.map(path => import(path).catch(() => null))
    );

    const edgeDestModules = await Promise.all(
      edgeDestFiles.map(path => import(path).catch(() => null))
    );

    // Flatten and deduplicate edges
    const generatedNodes = nodeModules.flatMap(mod => (mod?.generatedNodes || []));
    const originEdges = edgeOriginModules.flatMap(mod => (mod?.generatedEdges || []));
    const destEdges = edgeDestModules.flatMap(mod => (mod?.generatedEdges || []));

    const edgeSet = new Set();
    const uniqueEdges = [];

    for (const edge of [...originEdges, ...destEdges]) {
      const key = `${edge.source}->${edge.target}`;
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        uniqueEdges.push(edge);
      }
    }

    const elements = [
      ...generatedNodes.map(n => ({ data: n, classes: n.type })),
      ...uniqueEdges.map(e => ({ data: e }))
    ];

    createCytoscapeGraph(elements);
  } catch (err) {
    console.error('Error loading graph data:', err);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadGeneratedDataAndRender);
} else {
  loadGeneratedDataAndRender();
}
