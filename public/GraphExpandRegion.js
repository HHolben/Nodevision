// GraphExpandRegion.js
// Purpose: TODO: Add description of module purpose

// Dummy functions for loading indicator
function showLoadingIndicator() {
    // Implement your loading indicator logic here
    console.log("Loading...");
  }
  
  function hideLoadingIndicator() {
    // Implement your logic to hide the loading indicator here
    console.log("Loading complete.");
  }
  
  // Helper function for fetching data with error handling
  async function fetchNodeData(url) {
    try {
      const response = await fetch(url);
      const text = await response.text();  // Get the raw response text
      try {
        return JSON.parse(text); // Attempt to parse it as JSON
      } catch (parseError) {
        console.error("Error parsing JSON:", parseError, "Response text:", text);
        return null;
      }
    } catch (error) {
      console.error(`Failed to fetch data from ${url}:`, error);
      return null;
    }
  }
  
  
  // Placeholder for hyperlink extraction logic
  // Assume this function is defined elsewhere in your codebase.
  function extractHyperlinks(fileContent) {
    // Extract hyperlinks from fileContent and return them as an array
    // For example purposes, we'll return an empty array.
    return [];
  }
  
  // Placeholder for adding an edge to the graph
  // Assume this function creates and adds an edge between two nodes.
  function AddEdgeToGraph(sourceId, targetId) {
    // Example: create a new edge with a unique id
    const edgeId = `edge-${sourceId}-${targetId}`;
    cy.add({
      group: 'edges',
      data: {
        id: edgeId,
        source: sourceId,
        target: targetId,
      }
    });
  }
  
  // Placeholder for processing node links from new elements
  function extractNodeLinks(newElements) {
    // Implement any additional processing on the new nodes here.
    console.log("Extracting links from new elements:", newElements);
  }
  
  // Main function to expand a region node
  function expandRegion(regionElement) {
    const regionId = regionElement.id();
    console.log(`Expanding region: ${regionId}`);
  
    // Show loading indicator
    showLoadingIndicator();
  
    // Fetch sub-nodes for the region from your API
    fetch(`/api/getSubNodes?path=${encodeURIComponent(regionId)}`)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(subNodes => {
        console.log(`Fetched sub-nodes for region ${regionId}:`, subNodes);
  
        // Map sub-nodes to Cytoscape elements
        const newElements = subNodes.map(node => ({
          group: 'nodes',
          data: {
            id: node.id,
            label: node.label,
            parent: regionId, // Set the region as the parent for compound structure
            type: node.isDirectory ? 'region' : 'node', // Differentiate types
            imageUrl: node.imageUrl,
          }
        }));
  
        console.log("New elements to be added:", newElements);
  
        // Store the original edges connected to the region before expansion.
        // We store the complete edge data so that we can re-add them later.
        window.originalEdges = window.originalEdges || {};
        window.originalEdges[regionId] = cy.edges()
          .filter(edge => edge.target().id() === regionId)
          .map(edge => edge.json().data);
        console.log(`Original edges stored for region ${regionId}:`, window.originalEdges[regionId]);
  
        // Build a map of hyperlinks for each source node in these edges.
        const sourceNodeLinksMap = {};
        const originalEdges = window.originalEdges[regionId] || [];
  
        // Filter and fetch file content only for nodes of type 'node'
        const fetchPromises = originalEdges
          .filter(edgeData => {
            const sourceElement = cy.getElementById(edgeData.source);
            return sourceElement && sourceElement.data('type') === 'node';
          })
          .map(edgeData =>
            fetchNodeData(`/api/file?path=${encodeURIComponent(edgeData.source)}`)
              .then(fileData => {
                if (fileData) {
                  const fileContent = fileData.content;
                  const links = extractHyperlinks(fileContent);
                  sourceNodeLinksMap[edgeData.source] = links;
                }
              })
              .catch(error => {
                console.error(`Error fetching file content for node ${edgeData.source}:`, error);
              })
          );
  
        // Wait for all file fetches to complete
        return Promise.all(fetchPromises).then(() => ({
          subNodes,
          newElements,
          sourceNodeLinksMap
        }));
      })
      .then(({ subNodes, newElements, sourceNodeLinksMap }) => {
        // Instead of removing the region, mark it as expanded and convert it to a compound node.
        regionElement.data('expanded', true);
        regionElement.addClass('compound');
  
        // Add the sub-nodes as children of the region (using the parent field)
        cy.add(newElements);
  
        // Re-create the original edges if both endpoints exist.
        const originalEdges = window.originalEdges[regionId] || [];
        originalEdges.forEach(edgeData => {
          const sourceElement = cy.getElementById(edgeData.source);
          const targetElement = cy.getElementById(edgeData.target);
          if (sourceElement.nonempty() && targetElement.nonempty()) {
            AddEdgeToGraph(sourceElement.id(), targetElement.id());
          }
        });
  
        // Optionally process the new nodes (e.g., to extract and set up links)
        extractNodeLinks(newElements);
  
        // Update the graph layout with animation and fitting options.
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
        // Hide the loading indicator when complete.
        hideLoadingIndicator();
      });
  }
  