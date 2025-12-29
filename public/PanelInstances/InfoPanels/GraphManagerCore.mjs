// Nodevision/public/PanelInstances/InfoPanels/GraphManagerCore.mjs
// Core logic for GraphManager with full FileManager parity
// Provides: selection, creation, modification, deletion, refresh, and toolbar integration

import { updateToolbarState } from '/panels/createToolbar.mjs';

let currentCyInstance = null;
let currentParams = null;

export function setCyInstance(cy, params) {
  currentCyInstance = cy;
  currentParams = params;
  window.graphManagerCy = cy;
  window.graphManagerParams = params;
}

export function getCyInstance() {
  return currentCyInstance || window.graphManagerCy;
}

export function getParams() {
  return currentParams || window.graphManagerParams;
}

export function getSelectedNodes() {
  const cy = getCyInstance();
  if (!cy) return [];
  return cy.nodes(':selected').map(n => ({
    id: n.id(),
    label: n.data('label'),
    type: n.data('type'),
    parent: n.data('parent')
  }));
}

export function getSelectedNodeIds() {
  const cy = getCyInstance();
  if (!cy) return [];
  return cy.nodes(':selected').map(n => n.id());
}

export function selectNode(nodeId) {
  const cy = getCyInstance();
  if (!cy) return;
  
  cy.nodes().unselect();
  const node = cy.getElementById(nodeId);
  if (node.length) {
    node.select();
    window.selectedFilePath = getCleanPath(nodeId);
    updateToolbarState({ selectedFile: window.selectedFilePath });
  }
}

export function selectMultipleNodes(nodeIds) {
  const cy = getCyInstance();
  if (!cy) return;
  
  cy.nodes().unselect();
  nodeIds.forEach(id => {
    const node = cy.getElementById(id);
    if (node.length) node.select();
  });
}

export function clearSelection() {
  const cy = getCyInstance();
  if (!cy) return;
  cy.nodes().unselect();
  window.selectedFilePath = null;
  updateToolbarState({ selectedFile: null });
}

function getCleanPath(id) {
  if (id === "Notebook") return "";
  return id.startsWith("Notebook/") ? id.replace("Notebook/", "") : id;
}

function getFullPath(cleanPath) {
  return cleanPath.startsWith("Notebook/") ? cleanPath : `Notebook/${cleanPath}`;
}

export async function createNewFile(fileName, parentPath = '') {
  if (!fileName) throw new Error("File name is required");

  const cleanParent = parentPath.replace(/^Notebook\/?/, '').replace(/^\/+/, '');
  const fullPath = cleanParent ? `${cleanParent}/${fileName}` : fileName;

  const res = await fetch("/api/files/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: fullPath }),
  });

  if (!res.ok) throw new Error(`Failed to create file: ${fileName}`);
  const result = await res.json();
  console.log("[GraphManagerCore] Created new file:", result);

  await refreshGraph();
  return result;
}

export async function createNewDirectory(dirName, parentPath = '') {
  if (!dirName) throw new Error("Directory name is required");

  const cleanParent = parentPath.replace(/^Notebook\/?/, '').replace(/^\/+/, '');
  const fullPath = cleanParent ? `${cleanParent}/${dirName}` : dirName;

  const res = await fetch("/api/folders/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: fullPath }),
  });

  if (!res.ok) throw new Error(`Failed to create directory: ${dirName}`);
  const result = await res.json();
  console.log("[GraphManagerCore] Created new directory:", result);

  await refreshGraph();
  return result;
}

export async function deleteNode(nodePath) {
  if (!nodePath) throw new Error("Node path is required");

  const cleanPath = getCleanPath(nodePath);
  
  const res = await fetch("/api/files/delete", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: cleanPath }),
  });

  if (!res.ok) throw new Error(`Failed to delete: ${cleanPath}`);
  const result = await res.json();
  console.log("[GraphManagerCore] Deleted:", result);

  const cy = getCyInstance();
  if (cy) {
    const node = cy.getElementById(nodePath);
    if (node.length) {
      const descendants = cy.nodes().filter(n => n.id().startsWith(nodePath + "/"));
      cy.batch(() => {
        descendants.remove();
        node.remove();
      });
    }
  }

  await refreshGraph();
  return result;
}

export async function renameNode(oldPath, newName) {
  if (!oldPath || !newName) throw new Error("Path and new name are required");

  const cleanOldPath = getCleanPath(oldPath);
  const pathParts = cleanOldPath.split("/");
  pathParts.pop();
  const newPath = pathParts.length ? `${pathParts.join("/")}/${newName}` : newName;

  const res = await fetch("/api/files/rename", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ oldPath: cleanOldPath, newPath }),
  });

  if (!res.ok) throw new Error(`Failed to rename: ${cleanOldPath}`);
  const result = await res.json();
  console.log("[GraphManagerCore] Renamed:", result);

  await refreshGraph();
  return result;
}

export async function moveNode(srcPath, destPath) {
  const cleanSrc = getCleanPath(srcPath);
  const cleanDest = getCleanPath(destPath);

  const res = await fetch("/api/files/move", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ src: cleanSrc, dest: cleanDest }),
  });

  if (!res.ok) throw new Error(`Failed to move: ${cleanSrc}`);
  const result = await res.json();
  console.log("[GraphManagerCore] Moved:", result);

  await refreshGraph();
  return result;
}

export async function refreshGraph() {
  const params = getParams();
  if (!params) {
    console.warn("[GraphManagerCore] No params available for refresh");
    return;
  }

  const { cy, status, directoryState } = params;
  
  try {
    status.textContent = "Refreshing...";
    
    const { recomputeEdges } = await import('./GraphManagerDependencies/EdgeManagement.mjs');
    const { loadRoot } = await import('./GraphManagerDependencies/NodeInteraction.mjs');
    
    Object.keys(directoryState).forEach(key => {
      directoryState[key].childrenLoaded = false;
    });
    
    cy.nodes().remove();
    cy.edges().remove();
    
    await loadRoot(params, "Notebook");
    await recomputeEdges(params);
    
    status.textContent = `Ready — ${cy.nodes().length} nodes`;
  } catch (err) {
    console.error("[GraphManagerCore] Refresh error:", err);
    status.textContent = "Refresh failed (see console)";
  }
}

export function focusOnNode(nodeId) {
  const cy = getCyInstance();
  if (!cy) return;

  const node = cy.getElementById(nodeId);
  if (node.length) {
    cy.animate({
      center: { eles: node },
      zoom: 1.5
    }, { duration: 300 });
    selectNode(nodeId);
  }
}

export function getNodeMetadata(nodeId) {
  const cy = getCyInstance();
  if (!cy) return null;

  const node = cy.getElementById(nodeId);
  if (!node.length) return null;

  const incomingEdges = cy.edges().filter(e => e.target().id() === nodeId);
  const outgoingEdges = cy.edges().filter(e => e.source().id() === nodeId);

  return {
    id: node.id(),
    label: node.data('label'),
    type: node.data('type'),
    parent: node.data('parent'),
    path: getCleanPath(node.id()),
    incomingEdges: incomingEdges.map(e => ({ source: e.source().id(), id: e.id() })),
    outgoingEdges: outgoingEdges.map(e => ({ target: e.target().id(), id: e.id() })),
    childCount: cy.nodes().filter(n => n.data('parent') === nodeId).length
  };
}

export function highlightRelatedNodes(nodeId) {
  const cy = getCyInstance();
  if (!cy) return;

  cy.nodes().removeClass('highlighted related');
  cy.edges().removeClass('highlighted');

  const node = cy.getElementById(nodeId);
  if (!node.length) return;

  node.addClass('highlighted');

  const connectedEdges = node.connectedEdges();
  connectedEdges.addClass('highlighted');

  const neighbors = node.neighborhood('node');
  neighbors.addClass('related');
}

export function setVisibilityFilter(options = {}) {
  const cy = getCyInstance();
  if (!cy) return;

  const { showFiles = true, showDirectories = true, fileTypes = null } = options;

  cy.batch(() => {
    cy.nodes().forEach(node => {
      const type = node.data('type');
      let visible = true;

      if (type === 'file' && !showFiles) visible = false;
      if (type === 'directory' && !showDirectories) visible = false;

      if (fileTypes && type === 'file') {
        const ext = node.data('label').split('.').pop().toLowerCase();
        if (!fileTypes.includes(ext)) visible = false;
      }

      node.style('display', visible ? 'element' : 'none');
    });
  });
}

export async function handleGraphManagerAction(actionKey) {
  console.log(`[GraphManagerCore] Handling toolbar action: ${actionKey}`);

  const selectedNodes = getSelectedNodeIds();
  const selectedPath = selectedNodes[0] || null;

  try {
    switch (actionKey) {
      case 'NewFile': {
        const fileName = prompt("Enter new file name:");
        if (fileName) {
          const parentPath = selectedPath && getCyInstance()?.getElementById(selectedPath)?.data('type') === 'directory'
            ? selectedPath
            : 'Notebook';
          await createNewFile(fileName, parentPath);
        }
        break;
      }

      case 'NewDirectory': {
        const dirName = prompt("Enter new directory name:");
        if (dirName) {
          const parentPath = selectedPath && getCyInstance()?.getElementById(selectedPath)?.data('type') === 'directory'
            ? selectedPath
            : 'Notebook';
          await createNewDirectory(dirName, parentPath);
        }
        break;
      }

      case 'DeleteFile': {
        if (!selectedPath) {
          alert("Please select a node to delete.");
          return;
        }
        if (confirm(`Delete "${getCleanPath(selectedPath)}"?`)) {
          await deleteNode(selectedPath);
        }
        break;
      }

      case 'renameFile': {
        if (!selectedPath) {
          alert("Please select a node to rename.");
          return;
        }
        const currentName = selectedPath.split('/').pop();
        const newName = prompt("Enter new name:", currentName);
        if (newName && newName !== currentName) {
          await renameNode(selectedPath, newName);
        }
        break;
      }

      case 'copyFile': {
        if (!selectedPath) {
          alert("Please select a node to copy.");
          return;
        }
        window.clipboardPath = selectedPath;
        window.clipboardOperation = 'copy';
        console.log("[GraphManagerCore] Copied to clipboard:", selectedPath);
        break;
      }

      case 'cutFile': {
        if (!selectedPath) {
          alert("Please select a node to cut.");
          return;
        }
        window.clipboardPath = selectedPath;
        window.clipboardOperation = 'cut';
        console.log("[GraphManagerCore] Cut to clipboard:", selectedPath);
        break;
      }

      case 'pasteFile': {
        if (!window.clipboardPath) {
          alert("Nothing to paste. Copy or cut a file first.");
          return;
        }
        const destPath = selectedPath && getCyInstance()?.getElementById(selectedPath)?.data('type') === 'directory'
          ? selectedPath
          : 'Notebook';
        
        const cleanDestPath = getCleanPath(destPath);
        const fileName = window.clipboardPath.split('/').pop();
        const fullDestPath = cleanDestPath ? `${cleanDestPath}/${fileName}` : fileName;
        
        if (window.clipboardOperation === 'cut') {
          await moveNode(window.clipboardPath, fullDestPath);
          window.clipboardPath = null;
          window.clipboardOperation = null;
        } else {
          const res = await fetch("/api/files/copy", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              src: getCleanPath(window.clipboardPath),
              dest: fullDestPath
            }),
          });
          if (!res.ok) throw new Error("Copy failed");
          await refreshGraph();
        }
        break;
      }

      case 'UpdateEdges': {
        await refreshGraph();
        break;
      }

      default:
        console.warn(`[GraphManagerCore] Unknown action: ${actionKey}`);
    }
  } catch (err) {
    console.error(`[GraphManagerCore] Error executing action ${actionKey}:`, err);
    alert(`Error: ${err.message}`);
  }
}

window.handleGraphManagerAction = handleGraphManagerAction;
window.refreshGraphManager = refreshGraph;
