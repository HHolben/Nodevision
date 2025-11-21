// Nodevision/public/PanelInstances/InfoPanels/GraphManager.mjs
// Graph view for Notebook directory - files as nodes, links as edges, directories as compound nodes

export async function setupPanel(panelElem, panelVars = {}) {
  console.log("Initializing GraphManager panel...", panelVars);

  panelElem.innerHTML = `
    <div class="graph-manager" style="display:flex; flex-direction:column; height:100%;">
      <h3 style="margin:0 0 8px 0;">Graph View</h3>
      <div class="graph-info" style="font-size:12px; margin-bottom:4px; color:#666;">
        Double-click directories to expand/collapse
      </div>
      <div class="loading" style="display:block; margin-bottom:4px;">Loading Notebook files...</div>
      <div class="graph-error" style="color:red;"></div>
      <div class="cy-container" style="flex:1; width:100%; border:1px solid #ccc;"></div>
    </div>
  `;

  const loadingElem = panelElem.querySelector(".loading");
  const errorElem = panelElem.querySelector(".graph-error");
  const container = panelElem.querySelector(".cy-container");

  // Track expanded directories
  const expandedDirs = new Set();

  try {
    // Load Cytoscape via ESM dynamically
    const cytoscape = await import('/vendor/cytoscape/dist/cytoscape.esm.mjs');
    if (!cytoscape) throw new Error("Cytoscape failed to load");

    console.log("Cytoscape loaded successfully");

    // Destroy previous instance if any
    if (panelVars.cyInstance) {
      panelVars.cyInstance.destroy();
      panelVars.cyInstance = null;
    }

    // Fetch initial graph data from Notebook directory
    const response = await fetch('/api/scanNotebook');
    if (!response.ok) throw new Error(`Failed to fetch notebook data: ${response.statusText}`);
    
    const graphData = await response.json();
    console.log("Loaded graph data:", graphData);

    const elements = [
      ...graphData.nodes.map(n => ({ data: n })),
      ...graphData.edges.map(e => ({ data: e }))
    ];

    // Initialize Cytoscape
    panelVars.cyInstance = cytoscape.default({
      container,
      elements,
      style: [
        // Directory nodes (compound nodes)
        { 
          selector: 'node[type="directory"]', 
          style: { 
            'background-color': '#f9f9f9',
            'shape': 'roundrectangle',
            'label': 'data(label)',
            'text-valign': 'center',
            'text-halign': 'center',
            'font-weight': 'bold',
            'border-width': 3,
            'border-color': '#999',
            'color': '#333',
            'font-size': '14px',
            'text-outline-width': 0,
            'padding': '10px',
            'width': 'label',
            'height': 'label'
          } 
        },
        // File nodes
        { 
          selector: 'node[type="file"]', 
          style: { 
            'background-color': '#0074D9',
            'shape': 'ellipse',
            'label': 'data(label)',
            'text-valign': 'center',
            'text-halign': 'center',
            'color': '#fff',
            'text-outline-width': 2,
            'text-outline-color': '#0074D9',
            'font-size': '12px',
            'width': '60px',
            'height': '60px'
          } 
        },
        // Expanded directory highlighting
        { 
          selector: 'node[type="directory"][expanded="true"]', 
          style: { 
            'border-color': '#0074D9',
            'background-color': '#e6f2ff'
          } 
        },
        // Edges
        { 
          selector: 'edge', 
          style: { 
            'width': 2,
            'line-color': '#999',
            'target-arrow-color': '#999',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'arrow-scale': 1.5
          } 
        }
      ],
      layout: { 
        name: 'breadthfirst',
        animate: true,
        directed: true,
        padding: 30,
        spacingFactor: 1.5
      }
    });

    // Handle double-click on directory nodes for expansion
    panelVars.cyInstance.on('dblclick', 'node[type="directory"]', async (evt) => {
      const node = evt.target;
      const dirPath = node.data('path');
      const isExpanded = expandedDirs.has(dirPath);

      if (isExpanded) {
        // Collapse: remove child nodes
        collapseDirectory(dirPath);
      } else {
        // Expand: fetch and add child nodes
        await expandDirectory(dirPath);
      }
    });

    // Handle single click for selection
    panelVars.cyInstance.on('click', 'node', (evt) => {
      const node = evt.target;
      console.log('Node clicked:', node.data());
      
      // If it's a file, dispatch event to update FileView panel
      if (node.data('type') === 'file') {
        const filePath = `Notebook/${node.data('path')}`;
        window.selectedFilePath = filePath;
        window.dispatchEvent(new CustomEvent('fileSelected', { 
          detail: { path: filePath } 
        }));
      }
    });

    console.log("GraphManager initialized with", graphData.nodes.length, "nodes and", graphData.edges.length, "edges");
    loadingElem.style.display = "none";

    // Expand directory function
    async function expandDirectory(dirPath) {
      try {
        loadingElem.style.display = "block";
        loadingElem.textContent = `Loading ${dirPath}...`;

        const response = await fetch(`/api/scanNotebook?directory=${encodeURIComponent(dirPath)}`);
        if (!response.ok) throw new Error(`Failed to fetch directory: ${response.statusText}`);

        const dirData = await response.json();
        console.log(`Expanding ${dirPath}:`, dirData);

        // Add new nodes and edges
        const newElements = [
          ...dirData.nodes.map(n => ({ data: { ...n, parent: dirPath } })),
          ...dirData.edges.map(e => ({ data: e }))
        ];

        panelVars.cyInstance.add(newElements);

        // Mark directory as expanded
        expandedDirs.add(dirPath);
        const dirNode = panelVars.cyInstance.getElementById(dirPath);
        dirNode.data('expanded', true);

        // Re-layout
        panelVars.cyInstance.layout({
          name: 'breadthfirst',
          animate: true,
          directed: true,
          padding: 30,
          spacingFactor: 1.5
        }).run();

        loadingElem.style.display = "none";
      } catch (err) {
        console.error('Error expanding directory:', err);
        errorElem.textContent = `Error expanding ${dirPath}: ${err.message}`;
        loadingElem.style.display = "none";
      }
    }

    // Collapse directory function
    function collapseDirectory(dirPath) {
      // Find all nodes that are children of this directory
      const childNodes = panelVars.cyInstance.nodes().filter(node => {
        const nodePath = node.data('path');
        return nodePath && nodePath.startsWith(dirPath + '/');
      });

      // Find edges connected to these nodes
      const childEdges = panelVars.cyInstance.edges().filter(edge => {
        const sourceId = edge.data('source');
        const targetId = edge.data('target');
        return childNodes.some(n => n.id() === sourceId || n.id() === targetId);
      });

      // Remove nodes and edges
      panelVars.cyInstance.remove(childNodes);
      panelVars.cyInstance.remove(childEdges);

      // Mark directory as collapsed
      expandedDirs.delete(dirPath);
      const dirNode = panelVars.cyInstance.getElementById(dirPath);
      dirNode.data('expanded', false);

      // Re-layout
      panelVars.cyInstance.layout({
        name: 'breadthfirst',
        animate: true,
        directed: true,
        padding: 30,
        spacingFactor: 1.5
      }).run();
    }

  } catch (err) {
    console.error("GraphManager error:", err);
    errorElem.textContent = "Failed to load graph: " + err.message;
    loadingElem.style.display = "none";
  }
}
