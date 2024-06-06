document.addEventListener('DOMContentLoaded', function() {
    var cy = cytoscape({
      container: document.getElementById('cy'),
      elements: [
        ...nodes,
        ...edges
      ],
      style: [
        {
          selector: 'node',
          style: {
            'background-color': '#666',
            'label': 'data(label)',
            'text-valign': 'center',
            'text-halign': 'center'
          }
        },
        {
          selector: 'edge',
          style: {
            'width': 3,
            'line-color': '#ccc',
            'target-arrow-color': '#ccc',
            'target-arrow-shape': 'triangle'
          }
        }
      ]
    });
  
    // Additional functionality can be added here
  });
  