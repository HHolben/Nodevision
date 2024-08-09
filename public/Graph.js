document.addEventListener('DOMContentLoaded', function() {
  fetch('GraphStyles.json')
    .then(response => response.json())
    .then(styles => {
      var elements = [...regions, ...nodes, ...edges];
      createCytoscapeGraph(elements, styles);
    })
    .catch(error => console.error('Error fetching styles:', error));
});

function createCytoscapeGraph(elements, styles) {
  const cy = cytoscape({
    container: document.getElementById('cy'),
    elements: elements,
    style: [
      {
        selector: 'node[imageUrl]',
        style: {
          'background-image': 'data(imageUrl)',
          'background-fit': 'cover',
          'background-clip': 'node',
          'width': '50px',
          'height': '50px',
          'label': 'data(label)'
        }
      },
      {
        selector: 'node[type="region"]',
        style: {
          'background-image': 'data(imageUrl)',
          'background-fit': 'cover',
          'background-clip': 'node',
          'width': '50px',
          'height': '50px',
          'label': 'data(label)',
          'background-color': '#f0f0f0'
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

  let selectedElement = null;

  function updateInfoPanel(element) {
    const infoPanel = document.getElementById('element-info');
    if (!infoPanel) {
      console.error('Info panel element not found.');
      return;
    }

    const iframe = document.getElementById('content-frame');
    let infoHTML = '';

    if (element.isNode()) {
      infoHTML = `<strong>Node:</strong> ${element.data('label')}<br>`;
      window.ActiveNode = element.id();
      infoHTML += `<strong>ID:</strong> ${window.ActiveNode}<br>`;
      console.log('ActiveNode set to:', window.ActiveNode);
      if (element.data('type') === 'region') {
        infoHTML += `<strong>Type:</strong> Region<br>`;
        iframe.src = ''; // Clear the iframe for regions
        infoHTML += `<button id="expand-btn">Expand</button>`;
        if (element.isParent()) {
          infoHTML += `<button id="collapse-btn">Collapse</button>`;
        }
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

    if (element.data('type') === 'region') {
      document.getElementById('expand-btn').addEventListener('click', () => {
        expandRegion(element);
      });

      if (element.isParent()) {
        document.getElementById('collapse-btn').addEventListener('click', () => {
          collapseRegion(element);
        });
      }
    }
  }

  function fetchImageFromNode(nodeId, fallbackImageUrl) {
    return fetch(`/api/file?path=${nodeId}`)
      .then(response => response.json())
      .then(data => {
        const fileContent = data.content;
        const imgTagMatch = fileContent.match(/<img\s+src=['"]([^'"]+)['"]/i);
        if (imgTagMatch) {
          return imgTagMatch[1]; // Return the first image found in the file
        }
        return fallbackImageUrl; // Use the default image if no image is found
      })
      .catch(() => fallbackImageUrl);
  }


  











  function expandRegion(regionElement) {
    const regionId = regionElement.id();
    fetch(`/api/getSubNodes?path=${regionId}`)
      .then(response => response.json())
      .then(subNodes => {
        const newElements = subNodes.map(node => ({
          group: 'nodes',
          data: {
            id: node.id,
            label: node.label,
            parent: regionId, // Ensures all nodes and subregions are children of the current region
            type: node.isDirectory ? 'region' : 'node',
            imageUrl: node.imageUrl
          }
        }));
        
        // Remove the original region node to replace it with a compound node
        cy.remove(regionElement);
  
        // Re-add the parent region as a compound node
        cy.add({
          group: 'nodes',
          data: {
            id: regionId,
            label: regionElement.data('label'),
            type: 'region',
            imageUrl: regionElement.data('imageUrl'),
            parent: regionElement.data('parent') // Keep the parent of the current region if it has one
          }
        });
  
        // Add the subnodes within the compound node
        cy.add(newElements);
        
        // Update layout to fit the new structure
        cy.layout({ name: 'cose' }).run();
      })
      .catch(error => console.error('Error expanding region:', error));
  }
  

























  function collapseRegion(regionElement) {
    const regionId = regionElement.id();
    const children = cy.nodes(`[parent="${regionId}"]`);
    cy.remove(children);

    cy.add({
      group: 'nodes',
      data: {
        id: regionId,
        label: regionElement.data('label'),
        type: 'region',
        imageUrl: regionElement.data('imageUrl') || 'DefaultRegionImage.png'
      }
    });

    cy.layout({ name: 'cose' }).run();
  }

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
