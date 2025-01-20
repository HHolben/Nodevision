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