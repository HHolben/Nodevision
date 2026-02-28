// public/GraphManagement/GraphCollapseRegion.js
// Purpose: TODO: Add description of module purpose


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
