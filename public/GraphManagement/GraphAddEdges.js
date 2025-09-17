// public/GraphManagement/GraphAddEdges.js
// Purpose: TODO: Add description of module purpose

async function generateEdgesForLinks() {
    const allNodeIds = cy.nodes().map(node => node.id());
  
    
      for (let nodeId of allNodeIds) 
      {
         try 
         {
  
            if (nodeId !== "defaultNode" ) 
            {
  
              const response = await fetch(`/api/file?path=${nodeId}`);
              const data = await response.json();
              const fileContent = data.content;
              const links = extractHyperlinks(fileContent);
  
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
  