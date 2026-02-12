// Nodevision/public/panels/workspace.mjs
// Handles workspace, rows, cells, and resizable dividers, with dynamic multi-directory panel loading
// Adds activeCell/activePanel tracking and toolbar-based panel replacement

import { logStatus } from "./../StatusBar.mjs";
import { setStatus } from "./../StatusBar.mjs";



export function ensureWorkspace() {
  let workspace = document.getElementById("workspace");
  if (!workspace) {
    workspace = document.createElement("div");
    workspace.id = "workspace";
    document.body.appendChild(workspace);
  }
  Object.assign(workspace.style, {
    display: "flex",
    flexDirection: "column",
    flex: "1 1 auto",
    minHeight: "0",
    overflow: "hidden",
  });
  return workspace;
}

export function ensureTopRow(workspace) {
  let topRow = workspace.querySelector(".panel-row");
  if (!topRow) {
    topRow = document.createElement("div");
    topRow.className = "panel-row";
    Object.assign(topRow.style, {
      display: "flex",
      gap: "0px",
      marginBottom: "4px",
      borderBottom: "4px solid #ddd",
      overflow: "hidden",
      flex: "1 1 auto",
    });
    workspace.appendChild(topRow);
  }
  return topRow;
}

export function createCell(row) {
  const cell = document.createElement("div");
  cell.className = "panel-cell";
  Object.assign(cell.style, {
    border: "1px solid #bbb",
    background: "#fafafa",
    overflow: "auto",
    flex: "1 1 0",
    display: "flex",
    flexDirection: "column",
    position: "relative",
    userSelect: "none",
  });

  // Active panel tracking is now handled globally by setupActivePanelTracking()

  row.appendChild(cell);

  // Add divider between cells
  if (row.children.length > 1) {
    const divider = createDivider(row.children[row.children.length - 2], cell);
    row.insertBefore(divider, cell);
  }

  return cell;
}

function createDivider(leftCell, rightCell) {
  const divider = document.createElement("div");
  divider.className = "divider";
  Object.assign(divider.style, {
    width: "8px",
    cursor: "col-resize",
    background: "#aaa",
    zIndex: "10",
  });

  let startX, startLeftWidth, startRightWidth, totalWidth;

  divider.addEventListener("mousedown", (e) => {
    e.preventDefault();
    startX = e.clientX;

    const row = divider.parentElement;
    const leftRect = leftCell.getBoundingClientRect();
    const rightRect = rightCell.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();

    startLeftWidth = leftRect.width;
    startRightWidth = rightRect.width;
    totalWidth = rowRect.width;

    leftCell.style.transition = "none";
    rightCell.style.transition = "none";

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  });

  function onMouseMove(e) {
    const dx = e.clientX - startX;
    let newLeftWidth = startLeftWidth + dx;
    let newRightWidth = startRightWidth - dx;
    const min = 5;
    if (newLeftWidth < min) newLeftWidth = min;
    if (newRightWidth < min) newRightWidth = min;
    const leftPercent = (newLeftWidth / totalWidth) * 100;
    const rightPercent = (newRightWidth / totalWidth) * 100;
    leftCell.style.flex = `0 0 ${leftPercent}%`;
    rightCell.style.flex = `0 0 ${rightPercent}%`;
  }

  function onMouseUp() {
    leftCell.style.transition = "";
    rightCell.style.transition = "";
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  }

  return divider;
}

export async function loadDefaultLayout() {
  try {
    const res = await fetch("/UserSettings/DefaultLayout.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const raw = await res.text();
    console.log("Fetched layout file (raw):", raw);

    const json = JSON.parse(raw);
    const layout = json.workspace || json.layout || json;
    console.log("Parsed layout object:", layout);

    return layout;
  } catch (err) {
    console.warn("Failed to load DefaultLayout.json:", err);
    return null;
  }
}

export function renderLayout(node, parent) {
  const isContainer = node.direction || node.type === "row" || node.type === "vertical";
  
  if (isContainer && node.children) {
    const container = document.createElement("div");
    container.className = "panel-row";
    const direction = node.direction === "column" || node.type === "vertical" ? "column" : "row";
    const isVertical = direction === "column";
    Object.assign(container.style, {
      display: "flex",
      flexDirection: direction,
      overflow: "hidden",
      flex: node.flex ? `${node.flex} 1 0` : "1 1 auto",
      alignItems: "stretch", // Ensures dividers stretch to fill height/width
      minHeight: "0",
      minWidth: "0",
    });
    parent.appendChild(container);
    
    // First render all children
    node.children.forEach((child) => {
      renderLayout(child, container);
    });
    
    // Now insert dividers between the children
    const children = Array.from(container.children).filter(c => 
      c.classList.contains("panel-cell") || c.classList.contains("panel-row")
    );
    
    console.log(`📐 Adding dividers: ${children.length} children in ${direction} container`);
    
    // Insert dividers between each pair of children (in reverse to maintain order)
    for (let i = children.length - 1; i > 0; i--) {
      const leftChild = children[i - 1];
      const rightChild = children[i];
      const divider = createLayoutDivider(leftChild, rightChild, isVertical);
      container.insertBefore(divider, rightChild);
      console.log(`📐 Inserted ${isVertical ? 'vertical' : 'horizontal'} divider between children`);
    }
  } else if (node.instanceName || node.type === "cell") {
    const cell = document.createElement("div");
    cell.className = "panel-cell";
    Object.assign(cell.style, {
      border: "1px solid #bbb",
      background: "#fafafa",
      overflow: "auto",
      flex: node.flex ? `${node.flex} 1 0` : "1 1 0",
      display: "flex",
      flexDirection: "column",
      position: "relative",
      minHeight: "0",
      minWidth: "0",
    });
    cell.dataset.id = node.instanceName || node.id;
    cell.dataset.panelClass = node.panelClass || "InfoPanel";
    parent.appendChild(cell);

    window.activeCell = cell;

    const panelType = node.instanceName || (node.module ? node.module.replace(/^\/PanelInstances\//, "").replace(/\.mjs$/, "") : "InfoPanel");
    
    loadPanelIntoCell(panelType, { 
      id: node.instanceName || node.id,
      ...node.panelVars 
    });
  }
}

// Create a resizable divider for layout (horizontal or vertical)
function createLayoutDivider(leftCell, rightCell, isVertical = false) {
  const divider = document.createElement("div");
  divider.className = "layout-divider";
  divider._leftCell = leftCell;
  divider._rightCell = rightCell;
  
  Object.assign(divider.style, {
    flexShrink: "0",
    flexGrow: "0",
    background: "#bbb",
    zIndex: "100",
    transition: "background 0.2s",
    ...(isVertical ? {
      height: "6px",
      minHeight: "6px",
      maxHeight: "6px",
      cursor: "row-resize",
      width: "100%",
      display: "block",
    } : {
      width: "6px",
      minWidth: "6px",
      maxWidth: "6px",
      cursor: "col-resize",
      height: "100%",
      display: "block",
    })
  });
  
  // Hover effect to make divider more visible
  divider.addEventListener("mouseenter", () => {
    divider.style.background = "#0078d7";
  });
  divider.addEventListener("mouseleave", () => {
    divider.style.background = "#666";
  });

  let startPos, startLeftSize, startRightSize, totalSize;

  divider.addEventListener("mousedown", (e) => {
    e.preventDefault();
    const leftEl = divider._leftCell;
    const rightEl = divider._rightCell;
    if (!leftEl || !rightEl) return;

    const container = divider.parentElement;
    const leftRect = leftEl.getBoundingClientRect();
    const rightRect = rightEl.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    if (isVertical) {
      startPos = e.clientY;
      startLeftSize = leftRect.height;
      startRightSize = rightRect.height;
      totalSize = containerRect.height;
    } else {
      startPos = e.clientX;
      startLeftSize = leftRect.width;
      startRightSize = rightRect.width;
      totalSize = containerRect.width;
    }

    leftEl.style.transition = "none";
    rightEl.style.transition = "none";

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  });

  function onMouseMove(e) {
    const leftEl = divider._leftCell;
    const rightEl = divider._rightCell;
    if (!leftEl || !rightEl) return;

    const currentPos = isVertical ? e.clientY : e.clientX;
    const delta = currentPos - startPos;
    
    let newLeftSize = startLeftSize + delta;
    let newRightSize = startRightSize - delta;
    
    const min = 50; // Minimum panel size
    if (newLeftSize < min) newLeftSize = min;
    if (newRightSize < min) newRightSize = min;
    
    const leftPercent = (newLeftSize / totalSize) * 100;
    const rightPercent = (newRightSize / totalSize) * 100;
    
    leftEl.style.flex = `0 0 ${leftPercent}%`;
    rightEl.style.flex = `0 0 ${rightPercent}%`;
  }

  function onMouseUp() {
    const leftEl = divider._leftCell;
    const rightEl = divider._rightCell;
    if (leftEl) leftEl.style.transition = "";
    if (rightEl) rightEl.style.transition = "";
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  }

  return divider;
}


/**
 * Dynamically load a panel based on its id and/or module path.
 * Supports multiple search directories and layout-specified module paths.
 */
export async function loadPanelIntoCell(panelType, panelVars = {}) {
  const cell = window.activeCell;
  if (!cell) {
    console.warn("⚠️ No active cell selected for loading panel:", panelType);
    return;
  }

  console.log("Panel Type:", panelType);

  // Try multiple search paths for panels
const possiblePaths = [
 `/PanelInstances/${panelType}.mjs`,
  `/PanelInstances/EditorPanels/${panelType}.mjs`,
  `/PanelInstances/InfoPanels/${panelType}.mjs`,
  `/PanelInstances/ViewPanels/${panelType}.mjs`,   // ← add this
  `/panels/${panelType}.mjs`,
];

  let module = null;
  for (const path of possiblePaths) {
    try {
      console.log("🔍 Trying to import panel:", path);
      module = await import(path);
      console.log("✅ Successfully imported:", path);
      break;
    } catch (err) {
      // Only log 404s; ignore missing paths
    }
  }

if (!module) {
    console.warn("⚠️ No panel module found for", panelType);
    return;
  }

  cell.innerHTML = "";

  await module.setupPanel(cell, {
    ...panelVars,
    filePath: window.selectedFilePath
  });

  console.log("✅ Loaded panel:", panelType);
}



// 🟣 Listen for toolbar events globally — replaces active cell with selected panel
window.addEventListener("toolbarAction", async (e) => {
  const { id, type, replaceActive } = e.detail;
  const panelClass = type || "InfoPanel";

  // If replaceActive is true, always replace the active cell's content
  if (replaceActive && window.activeCell) {
    const cell = window.activeCell;
    cell.innerHTML = "";
    cell.dataset.id = id;
    cell.dataset.panelClass = panelClass;
    
    // Update all active panel tracking
    window.activePanel = id;
    window.activePanelClass = panelClass;
    if (window.NodevisionState) {
      window.NodevisionState.activePanelType = panelClass;
    }
    
    await loadPanelIntoCell(id, { id, displayName: id });
    highlightActiveCell(cell);
    
    console.log(`🔄 Replaced active panel with "${id}" (${panelClass})`);
    return;
  }

  // Default behavior: check if this panel already exists in the layout
  const existingCell = document.querySelector(`[data-id="${id}"]`);
  if (existingCell) {
    // Panel already exists - just make it visible and active
    existingCell.style.display = "flex";
    window.activeCell = existingCell;
    window.activePanel = id;
    window.activePanelClass = existingCell.dataset.panelClass || panelClass;
    if (window.NodevisionState) {
      window.NodevisionState.activePanelType = existingCell.dataset.panelClass || panelClass;
    }
    highlightActiveCell(existingCell);
    console.log(`📌 Panel "${id}" already exists, activated.`);
    return;
  }

  // Otherwise, load into active cell
  if (!window.activeCell) {
    console.warn("No active cell selected to replace with toolbar panel.");
    return;
  }

  const cell = window.activeCell;
  cell.innerHTML = "";
  cell.dataset.id = id;
  window.activePanel = id;
  await loadPanelIntoCell(id, { id, displayName: id });
});

// Helper to highlight the active cell
function highlightActiveCell(cell) {
  document.querySelectorAll(".panel-cell").forEach((c) => {
    c.style.outline = "";
  });
  if (cell) {
    cell.style.outline = "2px solid #0078d7";
  }
}

// Setup global click handler for active panel tracking (run once)
function setupActivePanelTracking() {
  if (window._activePanelTrackingSetup) return;
  window._activePanelTrackingSetup = true;
  
  document.addEventListener("click", (e) => {
    const cell = e.target.closest(".panel-cell");
    if (!cell) return;

    window.activeCell = cell;
    const panelId = cell.dataset.id || "Unknown";
    const panelClass = cell.dataset.panelClass || "InfoPanel";
    window.activePanel = panelId;
    window.activePanelClass = panelClass;

    logStatus(`🎯 Active panel: ${panelId} (${panelClass})`);
    setStatus("🎯 Active panel", `${panelId} (${panelClass})`);
    
    highlightActiveCell(cell);

    // Update NodevisionState for toolbar
    if (window.NodevisionState) {
      window.NodevisionState.activePanelType = panelClass;
    }

    // Dispatch event for other listeners
    window.dispatchEvent(
      new CustomEvent("activePanelChanged", {
        detail: { panel: panelId, cell, panelClass }
      })
    );
  }, true); // Use capture phase to catch clicks before panels handle them
}

// Initialize tracking when module loads
setupActivePanelTracking();
