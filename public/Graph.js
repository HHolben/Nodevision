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
          'curve-style': 'bezier'
        }
      }
    ]
  });

  // Node and edge interactions
  window.cy.on('click', 'node, edge', function(evt) {
    const element = evt.target;
    updateInfoPanel(element);
  });

  window.cy.on('tap', function(event) {
    if (event.target === window.cy) {
      document.getElementById('element-info').innerHTML = 'Click on a node, edge, or region to see details.';
      document.getElementById('content-frame').src = ''; // Clear the iframe when clicking on the background
    }







  });



}



initializeTheGraphStyles();





fetchStyles("./GraphStyles.js");