// Nodevision/ApplicationSystem/public/GraphManagement/Graph.js
// This file defines browser-side Graph logic for the Nodevision UI. It renders interface components and handles user interactions.
// public/GraphManagement/Graph.js
// Purpose: TODO: Add description of module purpose

function createCytoscapeGraph(elements, styles) 
{
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
          'curve-style': 'unbundled-bezier',
          'control-point-distances': [20, -20],
          'control-point-weights': [0.25, 0.75]
        }
      },
      {
        selector: 'edge:hover',
        style: {
          'width': 4,
          'line-color': '#4a90e2',
          'target-arrow-color': '#4a90e2',
          'arrow-scale': 1.3
        }
      },
      {
        selector: 'edge.edge-clicked',
        style: {
          'width': 6,
          'line-color': '#ff9800',
          'target-arrow-color': '#ff9800',
          'arrow-scale': 1.6,
          'opacity': 1,
          'z-index': 999
        }
      }
    ]
  });

  let lastClickedEdge = null;

  // Node and edge interactions
  window.cy.on('click', 'node, edge', function(evt) {
    const element = evt.target;
    updateInfoPanel(element);
  });

  window.cy.on('tap', 'edge', function(evt) {
    const edge = evt.target;
    if (lastClickedEdge && lastClickedEdge !== edge) {
      lastClickedEdge.removeClass('edge-clicked');
    }
    edge.addClass('edge-clicked');
    lastClickedEdge = edge;
  });

  window.cy.on('tap', function(event) {
    if (event.target === window.cy) {
      document.getElementById('element-info').innerHTML = 'Click on a node, edge, or region to see details.';
      document.getElementById('content-frame').src = ''; // Clear the iframe when clicking on the background
      if (lastClickedEdge) {
        lastClickedEdge.removeClass('edge-clicked');
        lastClickedEdge = null;
      }
    }







  });



}



initializeTheGraphStyles();





fetchStyles("./GraphStyles.js");
