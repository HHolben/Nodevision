document.addEventListener('DOMContentLoaded', function() {
  // Assuming GeneratedNodes.js, GeneratedEdges.js, and GeneratedRegions.js define `nodes`, `edges`, and `regions` respectively

  // Merge nodes and regions into one elements array
  var elements = [...regions, ...nodes, ...edges];

  console.log(elements);

  var cy = cytoscape({
    container: document.getElementById('cy'),
    elements: elements,
  
    style: [
      // Node styles
      {
        selector: 'node',
        style: {
          'background-color': '#66ccff',
          'label': 'data(label)',
          'text-valign': 'center',
          'color': '#000',
          'text-outline-width': 2,
          'text-outline-color': '#fff'
        }
      },
      // Parent node styles
      {
        selector: ':parent',
        style: {
          'background-color': '#d3d3d3',
          'border-color': '#000',
          'border-width': 2,
          'padding': '10px'
        }
      },
      {
        selector: 'edge[type="direct"]',
        style: {
          'line-color': '#337AB7',
          'target-arrow-color': '#337AB7',
          'target-arrow-shape': 'triangle',
          'target-arrow-fill': 'filled',
          'width': 4,
          'curve-style': 'bezier'
        }
      },
      {
        selector: 'edge[type="indirect"]',
        style: {
          'line-color': '#F0AD4E',
          'target-arrow-color': '#F0AD4E',
          'target-arrow-shape': 'vee',
          'target-arrow-fill': 'filled',
          'width': 2,
          'curve-style': 'bezier'
        }
      },
    ],
    layout: {
      name: 'cose', // You can use other layouts like grid, circle, etc.
      padding: 10
    }
  });
});
