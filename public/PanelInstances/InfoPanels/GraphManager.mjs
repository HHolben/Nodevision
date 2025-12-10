// Nodevision/public/PanelInstances/InfoPanels/GraphManager.mjs
// Graph-styled file manager with lazy directory loading and collapsed-edge behavior

/* eslint-disable no-undef */

import { GRAPH_STYLE } from './GraphManagerDependencies/CytoscapeStyling.mjs';
import { loadRoot, setupInteractionHandlers } from './GraphManagerDependencies/NodeInteraction.mjs';
// Note: recomputeEdges and other functions are now internally imported by NodeInteraction/EdgeManagement

export async function setupPanel(panelElem, panelVars = {}) {
  console.log("[GraphManager] setupPanel", panelVars);

  panelElem.innerHTML = `
    <div class="graph-manager" style="display:flex; flex-direction:column; height:100%;">
      <div style="display:flex;align-items:center;gap:12px;padding:8px;border-bottom:1px solid #ddd;">
        <strong>Graph View (file manager)</strong>
        <span id="gm-status" style="font-size:12px;color:#666;">Initializing...</span>
      </div>
      <div class="cy-container" style="flex:1; width:100%;"></div>
    </div>
  `;

  const status = panelElem.querySelector("#gm-status");
  const container = panelElem.querySelector(".cy-container");

  const NODE_ROOT = "Notebook"; // project-relative root id
  const directoryState = {}; // { id: { expanded, childrenLoaded } }
  let cy = null;

  // init cytoscape
  try {
    status.textContent = "Loading cytoscape...";
    const cytoscapeMod = await import("/vendor/cytoscape/dist/cytoscape.esm.mjs");
    if (!cytoscapeMod) throw new Error("Failed to import cytoscape");

    const cytoscape = cytoscapeMod.default || cytoscapeMod;
    console.log("[GraphManager] cytoscape loaded", cytoscape);

    // destroy previous instance if exists
    if (panelVars.cyInstance) {
      console.log("[GraphManager] destroying previous cy instance");
      panelVars.cyInstance.destroy();
      panelVars.cyInstance = null;
    }

    cy = cytoscape({
      container,
      elements: [],
      style: GRAPH_STYLE, // Imported style
      layout: { name: "grid", avoidOverlap: true, fit: true },
      userZoomingEnabled: true,
      boxSelectionEnabled: false
    });

    panelVars.cyInstance = cy;
    console.log("[GraphManager] cytoscape instance created");

    // Params object to pass state and Cytoscape instance to handlers
    const params = { cy, status, directoryState };

    // Setup tap handlers (selection, open file, toggle directory)
    setupInteractionHandlers(params);

    // Load root on start
    await loadRoot(params, NODE_ROOT);

    status.textContent = `Ready — ${cy.nodes().length} nodes`;
  } catch (err) {
    console.error("[GraphManager] error during setup", err);
    const status = panelElem.querySelector("#gm-status");
    if (status) status.textContent = "Error initializing GraphManager (see console)";
  }
}