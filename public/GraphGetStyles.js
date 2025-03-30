async function fetchStyles(jsonUrl) {
    try {
        const response = await fetch(jsonUrl);
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        return await response.json();
    } catch (error) {
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



function initializeTheGraphStyles()
{
document.addEventListener('DOMContentLoaded', async function() {
  try {
    const response = await fetch('GraphStyles.json');
    const styles = await response.json();
    const elements = [...regions, ...nodes];
    createCytoscapeGraph(elements, styles);
    await generateEdgesForLinks();
  } 
  
  catch (error) {
    console.error('Error during graph initialization:', error);
  }
});

}


