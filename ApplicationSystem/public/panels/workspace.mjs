// Nodevision/public/panels/workspace.mjs
// Handles workspace, rows, cells, and resizable dividers, with dynamic multi-directory panel loading
// Adds activeCell/activePanel tracking and toolbar-based panel replacement

import { logStatus } from "./../StatusBar.mjs";
import { setStatus } from "./../StatusBar.mjs";

function collectPanelCells(root) {
  if (!root) return [];
  if (root.classList?.contains("panel-cell")) return [root];
  return Array.from(root.querySelectorAll?.(".panel-cell") || []);
}

function placeholderColorForCell(cell, index) {
  const key = `${cell.dataset?.id || "panel"}:${index}`;
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = ((hash << 5) - hash) + key.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 45% 55% / 0.78)`;
}

function startResizePlaceholderMode(elements) {
  const uniqueCells = new Set();
  for (const element of elements) {
    for (const cell of collectPanelCells(element)) uniqueCells.add(cell);
  }

  const states = [];
  let idx = 0;
  for (const cell of uniqueCells) {
    const visibilityEntries = [];
    for (const child of Array.from(cell.children)) {
      visibilityEntries.push([child, child.style.visibility]);
      child.style.visibility = "hidden";
    }

    const placeholder = document.createElement("div");
    placeholder.className = "panel-resize-placeholder";
    Object.assign(placeholder.style, {
      position: "absolute",
      inset: "0",
      background: placeholderColorForCell(cell, idx),
      border: "1px solid rgba(20, 20, 20, 0.18)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "rgba(255, 255, 255, 0.95)",
      fontSize: "12px",
      fontFamily: "monospace",
      letterSpacing: "0.02em",
      pointerEvents: "none",
      userSelect: "none",
      zIndex: "999",
      opacity: "0",
      transition: "opacity 140ms ease"
    });
    placeholder.textContent = cell.dataset?.id || "Panel";

    const prevPosition = cell.style.position;
    if (!prevPosition) cell.style.position = "relative";
    cell.appendChild(placeholder);
    requestAnimationFrame(() => {
      placeholder.style.opacity = "1";
    });

    states.push({ cell, visibilityEntries, placeholder, prevPosition });
    idx += 1;
  }

  return () => {
    for (const state of states) {
      const { cell, visibilityEntries, placeholder, prevPosition } = state;
      placeholder.style.opacity = "0";
      for (const [child, vis] of visibilityEntries) {
        child.style.visibility = vis;
      }
      setTimeout(() => {
        if (placeholder.parentNode === cell) {
          cell.removeChild(placeholder);
        }
      }, 140);
      cell.style.position = prevPosition;
    }
  };
}


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
  let stopPlaceholderMode = null;

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
    stopPlaceholderMode = startResizePlaceholderMode([leftCell, rightCell]);

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
    if (stopPlaceholderMode) {
      stopPlaceholderMode();
      stopPlaceholderMode = null;
    }
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
  let stopPlaceholderMode = null;

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
    stopPlaceholderMode = startResizePlaceholderMode([leftEl, rightEl]);

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
    if (stopPlaceholderMode) {
      stopPlaceholderMode();
      stopPlaceholderMode = null;
    }
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

  if (typeof cell.cleanup === "function") {
    try {
      cell.cleanup();
    } catch (err) {
      console.warn("Panel cleanup failed before reload:", err);
    }
  }
  cell.cleanup = null;
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
    if (typeof cell.cleanup === "function") {
      try {
        cell.cleanup();
      } catch (err) {
        console.warn("Panel cleanup failed before replaceActive:", err);
      }
    }
    cell.cleanup = null;
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
  if (typeof cell.cleanup === "function") {
    try {
      cell.cleanup();
    } catch (err) {
      console.warn("Panel cleanup failed before toolbar load:", err);
    }
  }
  cell.cleanup = null;
  cell.innerHTML = "";
  cell.dataset.id = id;
  window.activePanel = id;
  await loadPanelIntoCell(id, { id, displayName: id });
});

// Helper to highlight the active cell
function highlightActiveCell(cell) {
  document.querySelectorAll(".panel-cell").forEach((c) => {
    c.classList.remove("active-panel");
    c.style.outline = "";
  });
  if (cell) {
    classListAdd(cell, "active-panel");
  }
}

function classListAdd(el, className) {
  if (!el || !className) return;
  el.classList.add(className);
}

window.highlightActiveCell = highlightActiveCell;

// Setup global click handler for active panel tracking (run once)
function setupActivePanelTracking() {
  if (window._activePanelTrackingSetup) return;
  window._activePanelTrackingSetup = true;

  function handlePanelActivation(cell) {
    if (!cell) return;

    window.activeCell = cell;
    const panelId = cell.dataset.id || "Unknown";
    const panelClass = cell.dataset.panelClass || "InfoPanel";
    window.activePanel = panelId;
    window.activePanelClass = panelClass;

    logStatus(`🎯 Active panel: ${panelId} (${panelClass})`);
    setStatus("🎯 Active panel", `${panelId} (${panelClass})`);

    highlightActiveCell(cell);

    if (window.NodevisionState) {
      window.NodevisionState.activePanelType = panelClass;
    }

    window.dispatchEvent(
      new CustomEvent("activePanelChanged", {
        detail: { panel: panelId, cell, panelClass }
      })
    );
  }

  const activateHandler = (event) => {
    const cell = event?.target?.closest?.(".panel-cell");
    if (!cell) return;
    handlePanelActivation(cell);
  };

  document.addEventListener("click", activateHandler, true);
}

// Initialize tracking when module loads
setupActivePanelTracking();
