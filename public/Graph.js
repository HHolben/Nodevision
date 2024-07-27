document.addEventListener('DOMContentLoaded', function() {
  // Assuming GeneratedNodes.js, GeneratedEdges.js, and GeneratedRegions.js define `nodes`, `edges`, and `regions` respectively

  // Fetch styles from GraphStyles.json
  fetch('GraphStyles.json')
    .then(response => response.json())
    .then(styles => {
      // Merge nodes and regions into one elements array
      var elements = [...regions, ...nodes, ...edges];

      // Call the function to create the Cytoscape graph
      createCytoscapeGraph(elements, styles);
    })
    .catch(error => console.error('Error fetching styles:', error));
});

function createCytoscapeGraph(elements, styles) {
  var cy = cytoscape({
    container: document.getElementById('cy'),
    elements: elements,
    style: [
      {
        selector: 'node',
        style: {
          ...styles.node,
          //'background-image': 'data(imageUrl)', // Set the background image to the imageUrl data attribute
          'background-fit': 'cover', // Adjust background image to cover the node
          'background-clip': 'node' // Clip the image to the node shape
        }
      },
      {
        selector: ':parent',
        style: styles.parentNode
      },
      {
        selector: 'edge[type="direct"]',
        style: styles.edgeDirect
      },
      {
        selector: 'edge[type="indirect"]',
        style: styles.edgeIndirect
      }
    ],
    layout: {
      name: 'cose', // You can use other layouts like grid, circle, etc.
      padding: 10
    }
  });
  let selectedElement = null;

  // Function to update the info panel
  function updateInfoPanel(element) {
    const infoPanel = document.getElementById('element-info');
    const iframe = document.getElementById('content-frame');
    let infoHTML = '';

    if (element.isNode()) {
      infoHTML = `<strong>Node:</strong> ${element.data('label')}<br>`;
      infoHTML += `<strong>ID:</strong> ${element.id()}<br>`;
      if (element.isParent()) {
        infoHTML += `<strong>Type:</strong> Region<br>`;
        iframe.src = ''; // Clear the iframe for regions
      } else {
        infoHTML += `<strong>Type:</strong> Node<br>`;
        iframe.src = `http://localhost:8000/${element.id()}`;
        iframe.onload = function() {
          const scale = 0.5; // Adjust the scale factor as needed
          const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
          const styleElement = iframeDoc.createElement('style');
          styleElement.innerHTML = `body { transform: scale(${scale}); transform-origin: 0 0; width: ${100 / scale}%; height: ${100 / scale}%; }`;
          iframeDoc.head.appendChild(styleElement);
        };
      }
    } else if (element.isEdge()) {
      infoHTML = `<strong>Edge:</strong> ${element.id()}<br>`;
      infoHTML += `<strong>Source:</strong> ${element.source().id()}<br>`;
      infoHTML += `<strong>Target:</strong> ${element.target().id()}<br>`;
      infoHTML += `<strong>Type:</strong> ${element.data('type') || 'Edge'}<br>`;
      iframe.src = ''; // Clear the iframe for edges
    }
    infoPanel.innerHTML = infoHTML;
    selectedElement = element;
  }

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
