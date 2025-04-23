(function () {
  const cyContainer = document.getElementById("cy");
  const fileViewContainer = document.getElementById("file-view");

  if (!cyContainer || !fileViewContainer) {
    console.error("Graph or file view container not found.");
    return;
  }

  // Switch view
  fileViewContainer.style.display = "none";
  cyContainer.style.display = "block";

  // Destroy previous instance if needed
  if (window.cyInstance) {
    window.cyInstance.destroy();
    window.cyInstance = null;
  }

  // Fetch files and build graph
  fetch('/api/files')
    .then(res => res.json())
    .then(data => {
      const files = data.filter(item => !item.isDirectory);
      const elements = buildElementsFromFiles(files);
      initializeCytoscape(elements);
    })
    .catch(err => console.error("Error fetching files:", err));

  /**
   * Builds Cytoscape elements (nodes & edges) from files.
   */
  function buildElementsFromFiles(files) {
    const nodes = files.map(file => ({
      data: {
        id: file.path,         // Use path for unique ID
        label: file.name,
        path: file.path
      }
    }));

    const edges = [];

    files.forEach(file => {
      if (Array.isArray(file.links)) {
        file.links.forEach(linkPath => {
          if (typeof linkPath === 'string') {
            const targetFile = files.find(f => f.path === linkPath);
            if (targetFile) {
              edges.push({
                data: {
                  source: file.path,
                  target: targetFile.path
                }
              });
            }
          }
        });
      }
    });

    return [...nodes, ...edges];
  }

  /**
   * Initializes Cytoscape with elements and sets up events.
   */
  function initializeCytoscape(elements) {
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

    // Initial update
    updateGraphDatabase();

    // Graph change listeners (debounced)
    const debouncedUpdate = debounce(updateGraphDatabase, 500);
    window.cyInstance.on('add remove data drag free', debouncedUpdate);

    // Click listener
    window.cyInstance.on('click', 'node, edge', evt => {
      if (typeof updateInfoPanel === 'function') {
        updateInfoPanel(evt.target);
      }
    });
  }

  /**
   * Sends the current graph state to the backend.
   */
  function updateGraphDatabase() {
    if (!window.cyInstance) return;

    const graphData = window.cyInstance.json().elements;

    fetch('/api/updateGraph', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ elements: graphData })
    })
      .then(response => {
        if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
        return response.json();
      })
      .then(result => {
        console.log("Graph database updated successfully:", result);
      })
      .catch(err => console.error("Failed to update graph database:", err));
  }

  /**
   * Utility: debounce a function call.
   */
  function debounce(fn, delay) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn(...args), delay);
    };
  }
})();
