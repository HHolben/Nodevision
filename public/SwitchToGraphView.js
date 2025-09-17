// Nodevision/public/SwitchToGraphView.js
// Purpose: TODO: Add description of module purpose

(async function () {
  const cyContainer = document.getElementById("cy");
  const fileViewContainer = document.getElementById("file-view");

  console.log("SwitchToGraphView.js loaded");

  if (!cyContainer || !fileViewContainer) {
    console.error("Graph or file view container not found.");
    return;
  }

  // Switch view
  fileViewContainer.style.display = "none";
  cyContainer.style.display = "block";
  console.log("Switched to graph view");

  // Destroy previous instance if needed
  if (window.cyInstance) {
    window.cyInstance.destroy();
    window.cyInstance = null;
    console.log("Destroyed existing Cytoscape instance");
  }

  try {
    console.log("Loading graph data modules...");
    const { generatedNodes } = await import("/data/GeneratedNodes.js");
    const { generatedEdges } = await import("/data/GeneratedEdges.js");
    console.log("Graph data modules loaded");

    console.log("Filtering top-level nodes and edges...");
    const topLevelNodes = generatedNodes.filter(node => !node.parent || node.parent.endsWith("_root"));
    const topLevelNodeIds = new Set(topLevelNodes.map(node => node.id));

    const topLevelEdges = generatedEdges.filter(edge =>
      topLevelNodeIds.has(edge.source) && topLevelNodeIds.has(edge.target)
    );

    console.log(`Top-level nodes: ${topLevelNodes.length}, edges: ${topLevelEdges.length}`);

    const elements = [
      ...topLevelNodes.map(node => ({ data: node })),
      ...topLevelEdges.map(edge => ({ data: edge }))
    ];

    console.log("Initializing Cytoscape with elements...");
    initializeCytoscape(elements);
  } catch (err) {
    console.error("Failed to load graph data:", err);
  }

  /**
   * Initializes Cytoscape with elements and sets up events.
   */
  function initializeCytoscape(elements) {
    console.log("Creating Cytoscape instance...");
    window.cyInstance = cytoscape({
      container: cyContainer,
      elements: elements,
      style: [
        {
          selector: 'node[type="region"]',
          style: {
            'background-color': '#f0f0f0',
            'shape': 'roundrectangle',
            'label': 'data(label)',
            'text-valign': 'center',
            'text-halign': 'center',
            'font-weight': 'bold',
            'border-width': 2,
            'border-color': '#ccc'
          }
        },
        {
          selector: 'node',
          style: {
            'background-color': '#0074D9',
            'label': 'data(label)',
            'text-valign': 'center',
            'color': '#fff',
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
        name: 'fcose',
        animate: true
      }
    });

    console.log("Cytoscape instance created");

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
