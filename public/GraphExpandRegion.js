// Dummy functions for loading indicator
function showLoadingIndicator() {
    // Implement your loading indicator logic here
    //console.log("Loading...");
}

function hideLoadingIndicator() {
    // Implement your logic to hide the loading indicator here
    //console.log("Loading complete.");
}


function expandRegion(regionElement) {
    const regionId = regionElement.id();
    console.log(`Expanding region: ${regionId}`);
  
    // Show loading indicator
    showLoadingIndicator();
  
    // Fetch sub-nodes for the region
    fetch(`/api/getSubNodes?path=${regionId}`)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(subNodes => {
        console.log(`Fetched sub-nodes for region ${regionId}:`, subNodes);
  
        const newElements = subNodes.map(node => ({
          group: 'nodes',
          data: {
            id: node.id,
            label: node.label,
            parent: regionId,
            type: node.isDirectory ? 'region' : 'node',
            imageUrl: node.imageUrl,
          },
        }));
  
        // Store the original edges connected to the region before expansion
        window.originalEdges = window.originalEdges || {};
        window.originalEdges[regionId] = cy.edges()
          .filter(edge => edge.target().id() === regionId)
          .map(edge => ({
            source: edge.source().id(),
            target: edge.target().id(),
          }));
  
        console.log(`Original edges stored for region ${regionId}:`, window.originalEdges[regionId]);
  
        // Fetch hyperlinks for each source node
        const sourceNodeLinksMap = {};
        const originalEdges = window.originalEdges[regionId];
  
        const fetchPromises = originalEdges.map(edge =>
          fetch(`/api/file?path=${edge.source}`)
            .then(fileResponse => {
              if (!fileResponse.ok) {
                throw new Error(`HTTP error fetching file for node ${edge.source}: ${fileResponse.status}`);
              }
              return fileResponse.json();
            })
            .then(fileData => {
              const fileContent = fileData.content;
              const links = extractHyperlinks(fileContent);
              sourceNodeLinksMap[edge.source] = links;
            })
            .catch(error => {
              console.error(`Error fetching file content for node ${edge.source}:`, error);
            })
        );
  
        // Wait for all fetch promises to resolve
        return Promise.all(fetchPromises).then(() => ({ subNodes, newElements, sourceNodeLinksMap }));
      })
      .then(({ subNodes, newElements, sourceNodeLinksMap }) => {
        // Remove the original region node
        cy.remove(regionElement);
  
        // Add the parent region as a compound node
        AddRegionToGraph(regionElement);
  
        // Add the sub-nodes within the compound node
        cy.add(newElements);
  
        // Re-create edges pointing to sub-nodes inside the expanded region
        const originalEdges = window.originalEdges[regionId];
        originalEdges.forEach(edge => {
          const sourceNode = edge.source;
          const links = sourceNodeLinksMap[sourceNode] || [];
          subNodes.forEach(subNode => {
            if (links.includes(subNode.id)) {
              AddEdgeToGraph(sourceNode, subNode.id);
            }
          });
        });
  
        extractNodeLinks(newElements);
  
        // Update the graph layout
        cy.layout({
          name: 'cose', // Force-directed layout
          animate: true,
          fit: true,
          padding: 30,
          nodeRepulsion: 8000,
          idealEdgeLength: 50,
        }).run();
  
        cy.fit();
        console.log(`Region ${regionId} expanded successfully.`);
      })
      .catch(error => {
        console.error(`Error expanding region ${regionId}:`, error);
      })
      .finally(() => {
        // Hide loading indicator
        hideLoadingIndicator();
      });
  }
  
  
