//Function to add a node to the graph
function AddNode(node)
{
  const newElements = subNodes.map(node => (
  {
    group: 'nodes',
      data: 
      {
        id: node.id,
        label: node.label,
        parent: regionId,
        type: node.isDirectory ? 'region' : 'node',
        imageUrl: node.imageUrl
      }
    }));

  // Add the sub-nodes within the compound node
  cy.add(newElements);

}//Ends AddNode Function

  
    // Function to add an edge to the graph
    function AddEdgeToGraph(nodeId, link)
    {
      cy.add({
        group: 'edges',
        data: 
        {
          id: `${nodeId}_to_${link}`,
          source: nodeId,
          target: link,
        }
    });
    console.log("Adding Edge: "+`${nodeId}->${link}`);

  }// Ends AddEdgeToGraph()
  
  
  //Function to add a region  to the graph as compound node
  function AddRegionToGraph(regionElement)
  {
    const regionId = regionElement.id();

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
  }//Ends AddRegionToGraph()



  async function fetchStyles(jsonUrl) {
    try {
        const response = await fetch(jsonUrl);
       // //console.log(response);
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        return await response.json();
    } catch (error) {
      //  console.error('Error fetching styles:', error);
        return null;
    }
}




  
  
  function applyBezierEdgeStyles(cy) {
    cy.style()
        .selector('edge')
        .style({
            'curve-style': 'unbundled-bezier',      // Set to unbundled bezier curve
            'control-point-distances': [20, -20],   // Distance of control points from midpoint
            'control-point-weights': [0.25, 0.75], // Positions of control points on the edge
            'width': 3,
            'line-color': '#ccc',
            'target-arrow-color': '#ccc',
            'target-arrow-shape': 'triangle'
        })
        .update();  // Apply the updated styles immediately
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
  
  function combineURLs(baseURL, additionalPath) {
    // Remove everything after the last "/" in baseURL to get the base directory path
    let basePath = baseURL.substring(0, baseURL.lastIndexOf('/') + 1);
    const baseSegments = basePath.split('/').filter(Boolean);
    const additionalSegments = additionalPath.split('/');

    // Build the combined URL path by handling relative path segments ("../" and "./")
    additionalSegments.forEach(segment => {
        if (segment === "..") {
            baseSegments.pop(); // Go up one directory level
        } else if (segment !== "." && segment !== "") {
            baseSegments.push(segment); // Add valid segments
        }
    });

    // Construct the final combined path
    let resolvedPath = baseSegments.join('/');

    // Check if this resolved path exists as a node in Cytoscape
    if (!cy.getElementById(resolvedPath).length) {
        // If not found, iteratively search upwards for the nearest loaded directory node
        while (baseSegments.length > 0) {
            // Move up to the next higher directory level
            baseSegments.pop();
            const parentPath = baseSegments.join('/');
            
            // Check if this parent path exists in the graph as a collapsed region
            const parentNode = cy.getElementById(parentPath);
            if (parentNode && parentNode.data('type') === 'region') {
                return parentPath; // Return the path to the nearest collapsed region
            }
        }

        // If no parent region is found, fallback to the base URL itself
        return baseURL;
    }

    return resolvedPath; // Return the resolved path if found as a node
}



async function generateEdgesForLinks() {
  const allNodeIds = cy.nodes().map(node => node.id());


   // Define valid extensions
   const validExtensions = ['.php', '.html', '.js', '.ipyn'];

    for (let nodeId of allNodeIds) 
    {
       try 
       {

          if (nodeId !== "defaultNode" && validExtensions.some(ext => nodeId.endsWith(ext))) 
          {

            const response = await fetch(`/api/file?path=${nodeId}`);
            const data = await response.json();
            const fileContent = data.content;
            const links = extractHyperlinks(fileContent);
            // //console.log("Extracted Links:", links);

            links.forEach(link => 
            {
              if (allNodeIds.includes(link)) 
              {
                AddEdgeToGraph(nodeId, link);
              }
            });
          }
        }
        catch (error) 
        {
          console.error('Error fetching file content:', error);
        }
    }

  
cy.add(edges);
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
      ////console.log('ActiveNode set to:', window.ActiveNode);

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




// Function to resolve relative links based on the current file's path
function resolveLinkPath(basePath, link) {
  // If the link is already an absolute path, return it directly
  if (!link.startsWith("../")) {
      return link;
  }

  const result = combineURLs(basePath, link);
 // //console.log(result);

  // Split the base path into its components
  const basePathParts = basePath.split("/");
  basePathParts.pop(); // Remove the last part, which is the current file name

  // Split the relative link into its components
  const linkParts = link.split("/");

  // Process each part of the relative link
  for (let part of linkParts) {
      if (part === "..") {
          // Move up one directory in the base path
          basePathParts.pop();
      } else {
          // Add the current part of the link to the path
          basePathParts.push(part);
      }
  }

  // Join the parts to form the resolved path
  return basePathParts.join("/");
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
        window.originalEdges[regionId] = cy.edges().filter(edge => edge.target().id() === regionId).map(edge => ({
            source: edge.source().id(),
            target: edge.target().id()

        }));

      // Fetch hyperlinks from the file content of each original source node
      const originalEdges = window.originalEdges[regionId];
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
          ////console.log("Extracted Links:", links);

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
      //console.log("Extracted Links:", links);


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


  async function collapseRegion(regionElement) {
    const regionId = regionElement.id();
    //console.log(regionId);
const lastSlashIndex = regionId.lastIndexOf('/');
const parentNodeId = lastSlashIndex !== -1 ? regionId.substring(0, lastSlashIndex) : regionId;

//console.log(parentNodeId);

    const children = cy.nodes(`[parent="${regionId}"]`);
    cy.remove(children);

    cy.remove(cy.getElementById(regionId));



    

    cy.add({
      group: 'nodes',
      data: {
        id: regionId,
        label: regionElement.data('label'),
        parent: parentNodeId, // Specify the parent node ID here
        type: 'region',
        imageUrl: regionElement.data('imageUrl') || 'DefaultRegionImage.png'
      }
    });


    cy.remove(cy.edges().filter(edge => edge.source().id() === regionId || edge.target().id() === regionId));

const originalEdges = window.originalEdges[regionId] || [];
originalEdges.forEach(edge => {








  AddEdgeToGraph(edge.source, edge.target)



  
   
});
cy.layout({
  name: 'cose', // 'cose' is a force-directed layout that can compact nodes
  animate: true, // Animate the layout process
  fit: true, // Adjust the viewport to fit the new layout
  padding: 30, // Add some padding around the edges
  nodeRepulsion: 8000, // Adjust node repulsion for more compact layout
  idealEdgeLength: 50 // Control the ideal length of edges to make them shorter
}).run();


cy.fit();

  }
}



fetchStyles("./GraphStyles.js");