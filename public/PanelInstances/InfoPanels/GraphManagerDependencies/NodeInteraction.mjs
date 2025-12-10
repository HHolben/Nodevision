// Nodevision/public/PanelInstances/InfoPanels/GraphManagerDependencies/NodeInteraction.mjs

import { recomputeEdges } from './EdgeManagement.mjs';
import { listDirectory } from './APIFunctions.mjs';
import { SELECTED_COLOR, UNSELECTED_COLOR } from './CytoscapeStyling.mjs';

// --- Selection Logic ---
let lastSelected = null;

/** Clears the highlight from the previously selected node. */
export function clearSelection() {
  if (lastSelected) {
    lastSelected.style("border-color", UNSELECTED_COLOR);
    lastSelected.style("border-width", 2);
  }
  lastSelected = null;
}

/**
 * Highlights a node and sets the global selected path.
 * @param {object} node - The Cytoscape node element.
 */
export function highlight(node) {
  clearSelection();
  lastSelected = node;

  node.style("border-color", SELECTED_COLOR);
  node.style("border-width", 4);

  const id = node.id();
  console.log("[NodeInteraction] Selected:", id);

  // Make it available for toolbar actions
  window.selectedFilePath = id;
}


// --- Directory Management Functions ---

/**
 * Adds a single directory node to Cytoscape.
 * @param {object} cy - The Cytoscape instance.
 * @param {string} pathId - The full path ID.
 * @param {string} [parentId=null] - The parent path ID.
 */
function addDirectoryNode(cy, pathId, parentId = null) {
  if (cy.getElementById(pathId).length) return;
  const shortName = pathId.split("/").pop();
  cy.add({
    data: {
      id: pathId,
      label: shortName || pathId,
      type: "directory",
      parent: parentId || null
    }
  });
}

/**
 * Adds a single file node to Cytoscape.
 * @param {object} cy - The Cytoscape instance.
 * @param {string} id - The full path ID.
 * @param {string} [parentId=null] - The parent path ID.
 */
function addFileNode(cy, id, parentId) {
  if (cy.getElementById(id).length) return;
  const shortName = id.split("/").pop();
  cy.add({
    data: {
      id,
      label: shortName,
      type: "file",
      parent: parentId || null
    }
  });
}

/**
 * Expands a directory: loads its children if necessary, makes them visible, and recomputes edges.
 * @param {object} params
 * @param {object} params.cy - The Cytoscape instance.
 * @param {HTMLElement} params.status - The status element.
 * @param {object} params.directoryState - The state object.
 * @param {string} pathId - ID of the directory to expand.
 */
export async function expandDirectory({ cy, status, directoryState }, pathId) {
  console.log("[NodeInteraction] expandDirectory:", pathId);
  const state = (directoryState[pathId] = directoryState[pathId] || { expanded: false, childrenLoaded: false });

  if (!state.childrenLoaded) {
    const data = await listDirectory(pathId, status);
    
    cy.batch(() => {
        // Add subdirectories and files
        for (const d of data.directories || []) {
            const childId = `${pathId}/${d}`;
            addDirectoryNode(cy, childId, pathId);
            directoryState[childId] = directoryState[childId] || { expanded: false, childrenLoaded: false };
        }
        for (const f of data.files || []) {
            const fileId = `${pathId}/${f}`;
            addFileNode(cy, fileId, pathId);
        }
    });

    state.childrenLoaded = true;
  }
  
  state.expanded = true;
  
  // Make children visible
  cy.nodes().filter(n => n.data('parent') === pathId).style("display", "element");
  
  // Don't animate: faster
  cy.layout({ name: "grid", avoidOverlap: true, fit: false }).run();
  await recomputeEdges({ cy, status });
}

/**
 * Collapses a directory: removes its descendant nodes and recomputes edges.
 * @param {object} params
 * @param {object} params.cy - The Cytoscape instance.
 * @param {HTMLElement} params.status - The status element.
 * @param {object} params.directoryState - The state object.
 * @param {string} pathId - ID of the directory to collapse.
 */
export async function collapseDirectory({ cy, status, directoryState }, pathId) {
  console.log("[NodeInteraction] collapseDirectory:", pathId);
  
  // Get all descendants (recursively, by prefix)
  const descendants = cy.nodes().filter(n => {
    const nid = n.id();
    return nid !== pathId && nid.startsWith(pathId + "/");
  });
  
  console.log("[NodeInteraction] hiding descendants:", descendants.length);
  cy.batch(() => {
    descendants.style("display", "none");
  });

  // Mark as collapsed and update state for descendants
  if (directoryState[pathId]) directoryState[pathId].expanded = false;
  descendants.forEach(n => {
    if (directoryState[n.id()]) directoryState[n.id()].expanded = false;
  });

  // Recompute edges (so edges attach to directory-level again)
  await recomputeEdges({ cy, status });
  cy.layout({ name: "grid", avoidOverlap: true, fit: false }).run();
}


/**
 * Sets up the main tap handler for all nodes (selection and double-tap actions).
 * @param {object} params
 * @param {object} params.cy - The Cytoscape instance.
 * @param {HTMLElement} params.status - The status element.
 * @param {object} params.directoryState - The state object.
 */
export function setupInteractionHandlers(params) {
    let lastTapTime = 0;
    
    // Use a single tap handler for all actions
    params.cy.on("tap", "node", async (evt) => {
        const now = Date.now();
        const node = evt.target;
        const id = node.id();
        const type = node.data("type");
        
        // 1. Always highlight/select on tap
        highlight(node); 
        
        if (now - lastTapTime < 250) {
            // 2. Double-tap detected (within 250ms)
            console.log("[NodeInteraction] Double-tap on:", id);

            if (type === "directory") {
                // Double-tap on Directory: Toggle Expand/Collapse
                const state = params.directoryState[id] || { expanded: false, childrenLoaded: false };
                if (!state.expanded) {
                    await expandDirectory(params, id);
                } else {
                    await collapseDirectory(params, id);
                }
            } else if (type === "file") {
                // Double-tap on File: Open in new window
                console.log("[NodeInteraction] Opening file:", id);
                window.selectedFilePath = id;
                window.open(`/Notebook/${id}`, "_blank");
            }
        }
        
        lastTapTime = now;
    });
    
    // NOTE: Keep this separate for file view selection/opening
    params.cy.on("tap", "node[type='file']", (evt) => {
        const id = evt.target.id();
        // notify fileSelected so FileView can open it (single-tap opens/selects in file view)
        window.selectedFilePath = id; // project-relative id
        window.dispatchEvent(new CustomEvent("fileSelected", { detail: { path: id } }));
    });
}

/**
 * Initial load function for the root directory.
 * @param {object} params
 * @param {object} params.cy - The Cytoscape instance.
 * @param {HTMLElement} params.status - The status element.
 * @param {object} params.directoryState - The state object.
 * @param {string} NODE_ROOT - The root path ID.
 */
export async function loadRoot(params, NODE_ROOT) {
  const { cy, status, directoryState } = params;
  console.log("[NodeInteraction] loadRoot");
  directoryState[NODE_ROOT] = directoryState[NODE_ROOT] || { expanded: false, childrenLoaded: false };

  // Fetch children of root
  if (!directoryState[NODE_ROOT].childrenLoaded) {
    const data = await listDirectory(NODE_ROOT, status);
    
    cy.batch(() => {
        // Add children as direct children of NODE_ROOT
        for (const d of data.directories || []) {
            const id = `${NODE_ROOT}/${d}`;
            addDirectoryNode(cy, id, NODE_ROOT);
            directoryState[id] = directoryState[id] || { expanded: false, childrenLoaded: false };
        }
        for (const f of data.files || []) {
            const id = `${NODE_ROOT}/${f}`;
            addFileNode(cy, id, NODE_ROOT);
        }
    });

    directoryState[NODE_ROOT].childrenLoaded = true;
  }
  
  await cy.layout({ name: "grid", avoidOverlap: true, fit: true }).run();
  status.textContent = `Ready — ${cy.nodes().length} nodes`;
  await recomputeEdges(params);
}