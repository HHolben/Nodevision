async function generateEdgesForLinks() {
  const allNodeIds = cy.nodes().map(node => node.id());
  console.log(nodes);

  console.log(edges);


  for (let nodeId of allNodeIds) {
    try {
      const response = await fetch(`/api/file?path=${nodeId}`);
      const data = await response.json();
      const fileContent = data.content;
      const links = extractHyperlinks(fileContent);

      links.forEach(link => {
        if (allNodeIds.includes(link)) {
          cy.add({
            group: 'edges',
            data: {
              id: `${nodeId}->${link}`,
              source: nodeId,
              target: link,
            }
          });
        }
      });
    } catch (error) {
      console.error('Error fetching file content:', error);
    }
  }
cy.add(edges);
  // Update the layout once after all edges are added
  cy.layout({ name: 'cose' }).run();
}

document.addEventListener('DOMContentLoaded', async function() {
  try {
    const response = await fetch('GraphStyles.json');
    const styles = await response.json();
    const elements = [...regions, ...nodes];
    createCytoscapeGraph(elements, styles);
    await generateEdgesForLinks();
  } catch (error) {
    console.error('Error during graph initialization:', error);
  }
});

let cyInitialized = false;

function createCytoscapeGraph(elements, styles) {
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


  async function fetchImageFromNode(nodeId, fallbackImageUrl) {
    try {
      const response = await fetch(`/api/file?path=${nodeId}`);
      const data = await response.json();
      const fileContent = data.content;
      const imgTagMatch = fileContent.match(/<img\s+src=['"]([^'"]+)['"]/i);
      return imgTagMatch ? imgTagMatch[1] : fallbackImageUrl;
    } catch {
      return fallbackImageUrl;
    }
  }
  
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





  async function expandRegion(regionElement) {
    const regionId = regionElement.id();
    try {
        // Show loading indicator
        showLoadingIndicator();

        // Fetch subnodes
        const response = await fetch(`/api/getSubNodes?path=${regionId}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const subNodes = await response.json();
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

        // Detect incoming edges to the region node
        const incomingEdges = cy.edges().filter(edge => edge.target().id() === regionId);

        // Log incoming edges for debugging
        console.log(`Incoming edges to region node ${regionId}:`, incomingEdges);

        // Remove the original region node
        cy.remove(regionElement);

        // Add the parent region as a compound node
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
        cy.layout({
            name: 'concentric',  // Change to any other layout type
            concentric: function(node) {
                return node.degree(); // Sort nodes by degree
            },
            levelWidth: function(nodes) {
                return 10; // Determines the spacing between levels
            },
            animate: true
        }).run();

    } catch (error) {
        console.error('Error expanding region:', error);
    } finally {
        // Hide loading indicator
        hideLoadingIndicator();
    }
}

// Dummy functions for loading indicator
function showLoadingIndicator() {
    // Implement your loading indicator logic here
    console.log("Loading...");
}

function hideLoadingIndicator() {
    // Implement your logic to hide the loading indicator here
    console.log("Loading complete.");
}


  async function collapseRegion(regionElement) {
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

  }
}
