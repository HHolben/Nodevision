//Nodevision/public/PanelInstances/InfoPanels/GraphManager.mjs
//This file sets up the info panel for for the Nodevision Graph view, which takes the user's node and edge data stored in Nodevision/public/data to generate a cytoscape.js graph


export async function setupPanel(panelElem, panelVars = {}) {
  console.log("Initializing GraphManager panel...", panelVars);

  // Panel structure
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
    const { default: cytoscape } = await import("/vendor/cytoscape/cytoscape.esm.js");

    // Helper: fetch JSON files
    async function fetchJson(path) {
      const res = await fetch(path);
      if (!res.ok) throw new Error(`Failed to fetch ${path}`);
      return res.json();
    }

    // Fetch Node files progressively by first character
    const nodeChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_'.split('');
    let allNodes = [];
    let allEdges = [];

    // Initialize Cytoscape early with empty elements
    const cy = cytoscape({
      container,
      elements: [],
      style: [
        { selector: 'node', style: { 'background-color': '#1976d2', 'label': 'data(name)', 'text-valign': 'center', 'color': '#fff', 'font-size': '10px' } },
        { selector: 'node[type="directory"]', style: { 'shape': 'rectangle', 'background-color': '#4caf50' } },
        { selector: 'edge', style: { 'width': 1, 'line-color': '#888', 'target-arrow-color': '#888', 'target-arrow-shape': 'triangle' } }
      ],
      layout: { name: 'breadthfirst', directed: true, padding: 10, spacingFactor: 1.5 }
    });

    // Function to progressively load a single character batch
    async function loadBatch(char) {
      try {
        const nodeFile = `/data/Nodes/Nodes_${char}.json`;
        const nodes = await fetchJson(nodeFile);
        const cyNodes = nodes.map(n => ({ data: { id: n.id, name: n.name, type: n.type } }));
        cy.add(cyNodes);
        allNodes.push(...cyNodes);
      } catch {
        // Missing node file is fine
      }

      try {
        const edgesFromFile = `/data/Edges/EdgesFrom_${char}.json`;
        const edgesToFile = `/data/Edges/EdgesTo_${char}.json`;
        const edgesFrom = await fetchJson(edgesFromFile).catch(() => []);
        const edgesTo = await fetchJson(edgesToFile).catch(() => []);
        const cyEdges = [...edgesFrom, ...edgesTo].map(e => ({ data: { source: e.source, target: e.target } }));
        cy.add(cyEdges);
        allEdges.push(...cyEdges);
      } catch (err) {
        console.warn(`Edges for ${char} missing:`, err);
      }
    }

    // Progressive loading loop
    for (const char of nodeChars) {
      await loadBatch(char);
      // Optional: re-run layout after each batch for visible updates
      cy.layout({ name: 'breadthfirst', directed: true, padding: 10, spacingFactor: 1.5 }).run();
    }

    console.log("Graph fully loaded:", { nodes: allNodes.length, edges: allEdges.length });

    // Node selection event
    cy.on('tap', 'node', event => {
      const node = event.target;
      console.log("Node selected:", node.data());
      // Optional: send selection info to other panels or highlight
      cy.elements().removeClass('highlighted');
      node.addClass('highlighted');
    });

    // Node highlighting style
    cy.style().selector('.highlighted').style({ 'border-width': 2, 'border-color': '#ff9800' }).update();

  } catch (err) {
    console.error("GraphManager error:", err);
    errorElem.textContent = "Failed to load graph: " + err.message;
  } finally {
    loadingElem.style.display = "none";
  }
}
