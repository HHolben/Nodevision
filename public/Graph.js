// Ensure DOM is fully loaded before executing Graph.js
document.addEventListener('DOMContentLoaded', function() {
  // Fetch styles from GraphStyles.json
  fetch('GraphStyles.json')
    .then(response => response.json())
    .then(styles => {
      // Assuming GeneratedNodes.js, GeneratedEdges.js, and GeneratedRegions.js define `nodes`, `edges`, and `regions` respectively
      // Merge nodes and regions into one elements array
      var elements = [...regions, ...nodes, ...edges];

      // Call the function to create the Cytoscape graph
      createCytoscapeGraph(elements, styles);
    })
    .catch(error => console.error('Error fetching styles:', error));
});

function createCytoscapeGraph(elements, styles) {
  const cy = cytoscape({
    container: document.getElementById('cy'), // container to render in
    elements: elements,
    style: [
      {
        selector: 'node',
        style: {
          'background-image': 'data(imageUrl)', // Use the imageUrl data field
          'background-fit': 'cover',
          'background-clip': 'node',
          'width': '50px',
          'height': '50px',
          'label': 'data(label)'
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
      },
    ]
  });


  // Event listeners for selecting nodes, edges, and regions
  cy.on('click', 'node, edge', function(evt) {
    var element = evt.target;
    updateInfoPanel(element);
  });

  cy.on('tap', function(event){
    if(event.target === cy){
      document.getElementById('element-info').innerHTML = 'Click on a node, edge, or region to see details.';
      document.getElementById('content-frame').src = ''; // Clear the iframe when clicking on the background
      selectedElement = null;
    }
  });
}
