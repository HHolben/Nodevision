  
  




// Dummy functions for loading indicator
function showLoadingIndicator() {
    // Implement your loading indicator logic here
    //console.log("Loading...");
}

function hideLoadingIndicator() {
    // Implement your logic to hide the loading indicator here
    //console.log("Loading complete.");
}


// Dummy functions for loading indicator
function showLoadingIndicator() {
    // Implement your loading indicator logic here
    //console.log("Loading...");
}

function hideLoadingIndicator() {
    // Implement your logic to hide the loading indicator here
    //console.log("Loading complete.");
}


async function expandRegion(regionElement) 
  {


    
    const regionId = regionElement.id();
    try {
        // Show loading indicator
        showLoadingIndicator();

        // Fetch sub-nodes for the region
        const response = await fetch(`/api/getSubNodes?path=${regionId}`);
        if (!response.ok) 
        {
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
        window.truncatedEdges = window.truncatedEdges || {};
        window.originalEdges[regionId] = cy.edges().filter(edge => edge.target().id() === regionId).map(edge => ({
            source: edge.source().id(),
            target: edge.target().id()

        }));

      // Fetch hyperlinks from the file content of each original source node
      const originalEdges = window.originalEdges[regionId];
      console.log(originalEdges);
      const sourceNodeLinksMap = {};

      for (let edge of originalEdges) {
        try
        {
          const fileResponse = await fetch(`/api/file?path=${edge.source}`);
          // Check if the response is JSON
          const contentType = fileResponse.headers.get("content-type");

          if (!contentType || !contentType.includes("application/json")) 
          {
            console.warn(`The response for node ${edge.source} is not in JSON format.`);
            continue; // Skip processing this file
          }

          const fileData = await fileResponse.json();
          const fileContent = fileData.content;
          const links = extractHyperlinks(fileContent); // Function to extract hyperlinks from file content

          sourceNodeLinksMap[edge.source] = links;


        } 
        
        catch (error) {
        console.error(`Error fetching file content for node ${edge.source}:`, error);
      }
}
       
        // Remove the original region node
        cy.remove(regionElement);

        // Add the parent region as a compound node
        AddRegionToGraph(regionElement);

        // Add the sub-nodes within the compound node
        cy.add(newElements);


// Fetch and log URLs from the content of each newElement, resolving relative links
for (let element of newElements) {
  try {

      // Check if the file extension is one of the allowed types
      const fileId = element.data.id;
      const allowedExtensions = ['html', 'php', 'js', 'ipyn'];
      const fileExtension = fileId.split('.').pop().toLowerCase();

      if (!allowedExtensions.includes(fileExtension)) {
          console.warn(`Skipping file ${fileId} as it is not an allowed type.`);
          continue; // Skip this file if it doesn't have the allowed extension
      }

      const fileResponse = await fetch(`/api/file?path=${fileId}`);
      
      // Check if the response is JSON
      const contentType = fileResponse.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
          console.warn(`The response for node ${fileId} is not in JSON format.`);
          continue; // Skip processing this file
      }

      const fileData = await fileResponse.json();
      const fileContent = fileData.content;
      const links = extractHyperlinks(fileContent); // Function to extract hyperlinks from file content


      // Log each individual link found in the file, resolving relative paths
      for (let link of links) {
          const resolvedLink = combineURLs(fileId, link);
          

          AddEdgeToGraph(fileId, resolvedLink);
      }
  } catch (error) {
      console.error(`Error fetching file content for node ${element.data.id}:`, error);
  }
}


        








        // Replace the original edges with edges that match the actual hyperlinks
        originalEdges.forEach(edge => {
            const links = sourceNodeLinksMap[edge.source] || [];
            subNodes.forEach(subNode => 
              {
                if (links.includes(subNode.id)) {





                  const nodeId =edge.source;
                  
                 const link=subNode.id;


                  AddEdgeToGraph(nodeId, link);




                }

                
            });


        });

        cy.layout({
          name: 'concentric', // 'cose' is a force-directed layout that can compact nodes
          animate: true, // Animate the layout process
          fit: true, // Adjust the viewport to fit the new layout
          padding: 30, // Add some padding around the edges
          nodeRepulsion: 8000, // Adjust node repulsion for more compact layout
          idealEdgeLength: 50 // Control the ideal length of edges to make them shorter
        }).run();

        cy.fit();






    } catch (error) {
        console.error('Error expanding region:', error);
    } finally {
        // Hide loading indicator
        hideLoadingIndicator();
    }
}


