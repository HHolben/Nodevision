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
  window.originalEdges = {};
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




  // Function to extract hyperlinks from HTML content
function extractHyperlinks(htmlContent) {
  // Regular expression to match anchor tags with href attributes
  const anchorTags = htmlContent.match(/<a\s+(?:[^>]*?\s+)?href=(["'])(.*?)\1/gi) || [];
  return anchorTags.map(tag => {
      const match = tag.match(/href=(["'])(.*?)\1/);
      return match ? match[2] : null;
  }).filter(Boolean); // Filter out nulls
}






  
  async function expandRegion(regionElement) {
    const regionId = regionElement.id();
    try {
        // Show loading indicator
        showLoadingIndicator();

        // Fetch sub-nodes for the region
        const response = await fetch(`/api/getSubNodes?path=${regionId}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const subNodes = await response.json();

        // Map sub-nodes to Cytoscape.js node format
        const newElements = subNodes.map(node => ({
            group: 'nodes',
            data: {
                id: node.id,
                label: node.label,
                parent: regionId,
                type: node.isDirectory ? 'region' : 'node',
                imageUrl: node.imageUrl
            }
        }));

        // Store the original edges connected to the region before expansion
        window.originalEdges = window.originalEdges || {};
        window.originalEdges[regionId] = cy.edges().filter(edge => edge.target().id() === regionId).map(edge => ({
            source: edge.source().id(),
            target: edge.target().id()
        }));

        // Fetch hyperlinks from the file content of each original source node
        const originalEdges = window.originalEdges[regionId];
        const sourceNodeLinksMap = {};

        for (let edge of originalEdges) {
            try {
                const fileResponse = await fetch(`/api/file?path=${edge.source}`);
                
                // Check if the response is JSON
                const contentType = fileResponse.headers.get("content-type");
                if (!contentType || !contentType.includes("application/json")) {
                    console.warn(`The response for node ${edge.source} is not in JSON format.`);
                    continue; // Skip processing this file
                }

                const fileData = await fileResponse.json();
                const fileContent = fileData.content;
                const links = extractHyperlinks(fileContent); // Function to extract hyperlinks from file content
                sourceNodeLinksMap[edge.source] = links;
            } catch (error) {
                console.error(`Error fetching file content for node ${edge.source}:`, error);
            }
        }

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
                parent: regionElement.data('parent')
            }
        });

        // Add the sub-nodes within the compound node
        cy.add(newElements);

        // Replace the original edges with edges that match the actual hyperlinks
        originalEdges.forEach(edge => {
            const links = sourceNodeLinksMap[edge.source] || [];
            subNodes.forEach(subNode => {
                if (links.includes(subNode.id)) {
                    // Only add an edge if the sub-node's ID is in the list of links
                    cy.add({
                        group: 'edges',
                        data: {
                            id: `${edge.source}->${subNode.id}`,
                            source: edge.source,
                            target: subNode.id
                        }
                    });
                }
            });
        });

        // Update the layout to fit the new structure
        cy.layout({
            name: 'cose',
            animate: true,
            fit: true,
            padding: 30
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


    cy.remove(cy.edges().filter(edge => edge.source().id() === regionId || edge.target().id() === regionId));

const originalEdges = window.originalEdges[regionId] || [];
originalEdges.forEach(edge => {
    cy.add({
        group: 'edges',
        data: {
            id: `${edge.source}->${edge.target}`,
            source: edge.source,
            target: edge.target
        }
    });
});

  }
}
