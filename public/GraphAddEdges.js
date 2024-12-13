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
  