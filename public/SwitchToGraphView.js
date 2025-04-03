// SwitchToGraphView.js

(function() {
  // Grab the containers for the graph view and file view.
  const cyContainer = document.getElementById("cy");
  const fileViewContainer = document.getElementById("file-view");

  if (!cyContainer || !fileViewContainer) {
    console.error("Graph or file view container not found.");
    return;
  }

  // Immediately switch to Graph View.
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

      // Create edges based on file links.
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

      // Update NodevisionDB once after initializing the graph.
      updateGraphDatabase();

      // Listen for graph changes: add, remove, and move events.
      window.cyInstance.on('add remove data drag free', () => {
        updateGraphDatabase();
      });

      // When a node or edge is clicked, update the info panel.
      window.cyInstance.on('click', 'node, edge', function(evt) {
        if (typeof updateInfoPanel === 'function') {
          updateInfoPanel(evt.target);
        }
      });
    })
    .catch(err => console.error("Error fetching files:", err));

  /**
   * Gathers the current graph state and sends it to the backend to update NodevisionDB.
   */
  function updateGraphDatabase() {
    if (!window.cyInstance) return;

    // Get the current graph data.
    const graphData = window.cyInstance.json().elements;

    // Post the updated graph data to the backend.
    fetch('/api/updateGraph', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ elements: graphData })
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`Server error: ${response.statusText}`);
        }
        return response.json();
      })
      .then(result => {
        console.log("Graph database updated successfully:", result);
      })
      .catch(err => console.error("Failed to update graph database:", err));
  }
})();
