// SwitchToGraphView.js

(function() {
  // Get the DOM elements for the graph and file views.
  const cyContainer = document.getElementById("cy");
  const fileViewContainer = document.getElementById("file-view");

  if (!cyContainer || !fileViewContainer) {
    console.error("Graph or file view container not found.");
    return;
  }

  // Immediately switch to the Graph View.
  fileViewContainer.style.display = "none";
  cyContainer.style.display = "block";

  // If there's an existing Cytoscape instance, destroy it.
  if (window.cyInstance) {
    window.cyInstance.destroy();
    window.cyInstance = null;
  }

  // Fetch file data from the Notebook directory.
  fetch('/api/files')
    .then(response => response.json())
    .then(data => {
      // Filter out directories; we want only files.
      const files = data.filter(item => !item.isDirectory);

      // Create a node for each file.
      const nodes = files.map(file => ({
        data: {
          id: file.name,       // assuming file names are unique
          label: file.name,
          path: file.path
        }
      }));

      // Create edges based on the file links.
      const edges = [];
      files.forEach(file => {
        if (file.links && Array.isArray(file.links)) {
          file.links.forEach(linkPath => {
            // Find the target file by matching the path.
            const targetFile = files.find(f => f.path === linkPath);
            if (targetFile) {
              edges.push({
                data: {
                  source: file.name,
                  target: targetFile.name
                }
              });
            }
          });
        }
      });

      // Combine nodes and edges.
      const elements = [...nodes, ...edges];

      // Initialize Cytoscape.
      window.cyInstance = cytoscape({


        
        container: cyContainer,
        elements: elements,
        style: [
          {
            selector: 'node',
            style: {
              'content': 'data(label)',
              'text-valign': 'center',
              'color': '#fff',
              'background-color': '#0074D9',
              'text-outline-width': 2,
              'text-outline-color': '#0074D9'
            }
          },
          {
            selector: 'edge',
            style: {
              'width': 2,
              'line-color': '#ccc',
              'target-arrow-color': '#ccc',
              'target-arrow-shape': 'triangle'
            }
          }
        ],
        layout: {
          name: 'grid',
          rows: 1
        }
      });

      window.cyInstance.on('click', 'node, edge', function(evt) {
        updateInfoPanel(evt.target);
      });
      
    })
    .catch(err => console.error("Error fetching files:", err));
})();


