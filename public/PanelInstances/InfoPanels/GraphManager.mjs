//Nodevision/public/PanelInstances/InfoPanels/GraphManager.mjs
//This file sets up the info panel for for the Nodevision Graph view, which takes the user's node and edge data stored in Nodevision/public/data to generate a cytoscape.js graph
// Nodevision/public/PanelInstances/InfoPanels/GraphManager.mjs
export async function setupPanel(panelElem, panelVars = {}) {
  console.log("Initializing GraphManager panel...", panelVars);

  panelElem.innerHTML = `
    <div class="graph-manager" style="display:flex; flex-direction:column; height:100%;">
      <h3 style="margin:0 0 8px 0;">Graph View</h3>
      <div class="loading" style="display:block; margin-bottom:4px;">Loading graph...</div>
      <div class="graph-error" style="color:red;"></div>
      <div class="cy-container" style="flex:1; width:100%; border:1px solid #ccc;"></div>
    </div>
  `;

  const loadingElem = panelElem.querySelector(".loading");
  const errorElem = panelElem.querySelector(".graph-error");
  const container = panelElem.querySelector(".cy-container");

  try {
    // Load Cytoscape via ESM dynamically
    const cytoscape = await import('/vendor/cytoscape/dist/cytoscape.esm.mjs');
    if (!cytoscape) throw new Error("Cytoscape failed to load");

    console.log("Cytoscape loaded:", cytoscape);

    // Destroy previous instance if any
    if (panelVars.cyInstance) {
      panelVars.cyInstance.destroy();
      panelVars.cyInstance = null;
    }

    // Import generated graph data
    const { generatedNodes } = await import('/data/GeneratedNodes.js');
    const { generatedEdges } = await import('/data/GeneratedEdges.js');

    // Only show top-level nodes
    const topLevelNodes = generatedNodes.filter(n => !n.parent || n.parent.endsWith("_root"));
    const topLevelNodeIds = new Set(topLevelNodes.map(n => n.id));
    const topLevelEdges = generatedEdges.filter(e => topLevelNodeIds.has(e.source) && topLevelNodeIds.has(e.target));

    const elements = [
      ...topLevelNodes.map(n => ({ data: n })),
      ...topLevelEdges.map(e => ({ data: e }))
    ];

    // Initialize Cytoscape
    panelVars.cyInstance = cytoscape.default({
      container,
      elements,
      style: [
        { selector: 'node[type="region"]', style: { 'background-color': '#f0f0f0', 'shape': 'roundrectangle', 'label': 'data(label)', 'text-valign': 'center', 'text-halign': 'center', 'font-weight': 'bold', 'border-width': 2, 'border-color': '#ccc' } },
        { selector: 'node', style: { 'background-color': '#0074D9', 'label': 'data(label)', 'text-valign': 'center', 'color': '#fff', 'text-outline-width': 2, 'text-outline-color': '#0074D9' } },
        { selector: 'edge', style: { 'width': 2, 'line-color': '#ccc', 'target-arrow-color': '#ccc', 'target-arrow-shape': 'triangle', 'curve-style': 'bezier' } }
      ],
      layout: { name: 'breadthfirst', animate: true, directed: true, padding: 10 }
    });

    // Event listeners
    const debouncedUpdate = debounce(updateGraphDatabase, 500);
    panelVars.cyInstance.on('add remove data drag free', debouncedUpdate);
    panelVars.cyInstance.on('click', 'node, edge', evt => {
      if (typeof updateInfoPanel === 'function') updateInfoPanel(evt.target);
    });

    console.log("GraphManager Cytoscape initialized");
  } catch (err) {
    console.error("GraphManager error:", err);
    errorElem.textContent = "Failed to load graph: " + err.message;
  } finally {
    loadingElem.style.display = "none";
  }

  function updateGraphDatabase() {
    if (!panelVars.cyInstance) return;

    const graphData = panelVars.cyInstance.json().elements;

    fetch('/api/updateGraph', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ elements: graphData })
    })
      .then(res => res.ok ? res.json() : Promise.reject(`Server error: ${res.statusText}`))
      .then(result => console.log("Graph database updated:", result))
      .catch(err => console.error("Failed to update graph database:", err));
  }

  function debounce(fn, delay) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn(...args), delay);
    };
  }
}
