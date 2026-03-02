// Nodevision/public/PanelInstances/InfoPanels/GraphManagerDependencies/NodeInteraction.mjs

import { recomputeEdges } from './EdgeManagement.mjs';
import { listDirectory } from './APIFunctions.mjs';
import { SELECTED_COLOR, UNSELECTED_COLOR } from './CytoscapeStyling.mjs';

// --- Selection Logic ---
let lastSelected = null;

function getCleanPath(id) {
  return id.startsWith("Notebook/") ? id.replace("Notebook/", "") : id;
}

export function clearSelection() {
  if (lastSelected) {
    lastSelected.style("border-color", UNSELECTED_COLOR);
    lastSelected.style("border-width", 2);
  }
  lastSelected = null;
}

export async function highlight(node) {
  clearSelection();
  lastSelected = node;

  node.style("border-color", SELECTED_COLOR);
  node.style("border-width", 4);

  const rawId = node.id();
  const cleanPath = rawId.startsWith("Notebook/") ? rawId.replace("Notebook/", "") : rawId;
  
  console.log("[NodeInteraction] Selected node:", cleanPath);

  // Set global path - FileView's reactive watcher will handle rendering
  window.selectedFilePath = cleanPath;

  // Highlight the FileView panel
  const viewCell = document.querySelector('[data-id="FileView"]');
  if (viewCell) {
    if (window.highlightActiveCell) {
      window.highlightActiveCell(viewCell);
    } else {
      document.querySelectorAll(".panel-cell").forEach(c => c.style.outline = "");
      viewCell.style.outline = "2px solid #0078d7";
    }
  }
}

// --- Directory Management Functions ---

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

export async function expandDirectory({ cy, status, directoryState }, pathId) {
  const state = (directoryState[pathId] = directoryState[pathId] || { expanded: false, childrenLoaded: false });

  if (!state.childrenLoaded) {
    const data = await listDirectory(pathId, status);
    cy.batch(() => {
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
  cy.nodes().filter(n => n.data('parent') === pathId).style("display", "element");
  cy.layout({ name: "grid", avoidOverlap: true, fit: false }).run();
  await recomputeEdges({ cy, status });
}

export async function collapseDirectory({ cy, status, directoryState }, pathId) {
  const descendants = cy.nodes().filter(n => n.id() !== pathId && n.id().startsWith(pathId + "/"));
  cy.batch(() => { descendants.style("display", "none"); });
  if (directoryState[pathId]) directoryState[pathId].expanded = false;
  descendants.forEach(n => { if (directoryState[n.id()]) directoryState[n.id()].expanded = false; });
  await recomputeEdges({ cy, status });
  cy.layout({ name: "grid", avoidOverlap: true, fit: false }).run();
}

export function setupInteractionHandlers(params) {
    let lastTapTime = 0;
    
    params.cy.on("tap", "node", async (evt) => {
        const now = Date.now();
        const node = evt.target;
        highlight(node); // This now triggers the View Panel update
        
        if (now - lastTapTime < 250) {
            const id = node.id();
            if (node.data("type") === "directory") {
                const state = params.directoryState[id] || { expanded: false, childrenLoaded: false };
                state.expanded ? await collapseDirectory(params, id) : await expandDirectory(params, id);
            } else if (node.data("type") === "file") {
                window.open(`/Notebook/${getCleanPath(id)}`, "_blank");
            }
        }
        lastTapTime = now;
    });
}

export async function loadRoot(params, NODE_ROOT) {
  const { cy, status, directoryState } = params;
  directoryState[NODE_ROOT] = directoryState[NODE_ROOT] || { expanded: false, childrenLoaded: false };

  if (!directoryState[NODE_ROOT].childrenLoaded) {
    const data = await listDirectory(NODE_ROOT, status);
    cy.batch(() => {
        for (const d of data.directories || []) {
            const id = `${NODE_ROOT}/${d}`;
            addDirectoryNode(cy, id, NODE_ROOT);
        }
        for (const f of data.files || []) {
            const id = `${NODE_ROOT}/${f}`;
            addFileNode(cy, id, NODE_ROOT);
        }
    });
    directoryState[NODE_ROOT].childrenLoaded = true;
  }
  
  await cy.layout({ name: "grid", avoidOverlap: true, fit: true }).run();
  status.textContent = `Ready`;
  await recomputeEdges(params);
}
