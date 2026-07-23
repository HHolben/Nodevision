// Nodevision/ApplicationSystem/public/panels/workspace.mjs
// Handles workspace, rows, cells, and resizable dividers, with dynamic multi-directory panel loading
// Adds activeCell/activePanel tracking and toolbar-based panel replacement

import { logStatus } from "./../StatusBar.mjs";
import { setStatus } from "./../StatusBar.mjs";

function normalizeNotebookPath(value) {
  let cleaned = String(value || "").trim();
  if (!cleaned) return "";

  try {
    const parsed = new URL(cleaned, window.location.origin);
    cleaned = parsed.pathname || cleaned;
  } catch {
    // Keep raw path-like values when not a URL.
  }

  cleaned = cleaned
    .replace(/\\/g, "/")
    .replace(/[?#].*$/, "")
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/^\/+/, "");

  if (cleaned.toLowerCase().startsWith("notebook/")) {
    cleaned = cleaned.slice("Notebook/".length);
  }

  return cleaned.trim();
}

function resolveActiveFilePath(preferredPath = null) {
  const candidates = [
    preferredPath,
    window.currentActiveFilePath,
    window.NodevisionState?.activeEditorFilePath,
    window.selectedFilePath,
    window.NodevisionState?.selectedFile,
    window.ActiveNode,
    window.filePath,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeNotebookPath(candidate);
    if (normalized) return normalized;
  }
  return "";
}


const PANEL_EDGE_SPLIT_HOTZONE_PX = 12;
const PANEL_EDGE_SPLIT_MIN_DRAG_PX = 18;
const PANEL_SPLIT_MIN_PERCENT = 10;
const PANEL_SPLIT_MAX_PERCENT = 90;

function isPanelSplitGesture(event) {
  return Boolean(event?.ctrlKey || event?.metaKey);
}

function clampPanelSplitPercent(value) {
  return Math.max(PANEL_SPLIT_MIN_PERCENT, Math.min(PANEL_SPLIT_MAX_PERCENT, value));
}

function getPanelEdgeFromPointer(cell, event) {
  if (!cell || !event) return null;
  const rect = cell.getBoundingClientRect();
  const distances = {
    left: Math.abs(event.clientX - rect.left),
    right: Math.abs(rect.right - event.clientX),
    top: Math.abs(event.clientY - rect.top),
    bottom: Math.abs(rect.bottom - event.clientY),
  };
  const [edge, distance] = Object.entries(distances).sort((a, b) => a[1] - b[1])[0] || [];
  return distance <= PANEL_EDGE_SPLIT_HOTZONE_PX ? edge : null;
}

function buildSplitCell(sourceCell, flex = "1 1 0") {
  const cell = makePanelCell(flex);
  const sourceId = sourceCell?.dataset?.id || sourceCell?.dataset?.panelId || "Panel";
  setCellIdentity(cell, {
    id: `${sourceId}Split`,
    panelClass: sourceCell?.dataset?.panelClass || "InfoPanel",
  });
  const placeholder = document.createElement("div");
  placeholder.className = "panel-split-placeholder";
  placeholder.textContent = "New panel";
  Object.assign(placeholder.style, {
    margin: "auto",
    padding: "0.65rem 0.9rem",
    border: "1px dashed rgba(0, 0, 0, 0.28)",
    borderRadius: "8px",
    color: "rgba(0, 0, 0, 0.58)",
    font: "13px system-ui, sans-serif",
    pointerEvents: "none",
    userSelect: "none",
  });
  cell.appendChild(placeholder);
  return cell;
}

function insertSplitCellInParent(cell, newCell, direction, edge, splitPercent) {
  const parent = cell?.parentElement;
  if (!parent) return null;

  const placeBefore = edge === "left" || edge === "top";
  const newPercent = placeBefore ? splitPercent : 100 - splitPercent;
  const existingPercent = 100 - newPercent;
  const targetFlex = `0 0 ${existingPercent}%`;
  const splitFlex = `0 0 ${newPercent}%`;

  if (parent.classList?.contains?.("panel-row") && parent.dataset?.direction === direction) {
    cell.style.flex = targetFlex;
    newCell.style.flex = splitFlex;
    if (placeBefore) parent.insertBefore(newCell, cell);
    else parent.insertBefore(newCell, cell.nextSibling);
    rebuildLayoutDividersForContainer(parent, direction === "column");
    return parent;
  }

  const originalFlex = cell.style.flex || "1 1 0";
  const wrapper = createPanelRow(direction, originalFlex);
  parent.replaceChild(wrapper, cell);
  cell.style.flex = targetFlex;
  newCell.style.flex = splitFlex;
  if (placeBefore) {
    wrapper.appendChild(newCell);
    wrapper.appendChild(cell);
  } else {
    wrapper.appendChild(cell);
    wrapper.appendChild(newCell);
  }
  rebuildLayoutDividersForContainer(wrapper, direction === "column");
  rebuildLayoutDividersForContainer(parent);
  return wrapper;
}

function splitPanelCellFromEdge(cell, edge, splitPercent = 50) {
  if (!cell || !edge) return null;
  const direction = edge === "top" || edge === "bottom" ? "column" : "row";
  const newCell = buildSplitCell(cell);
  const container = insertSplitCellInParent(cell, newCell, direction, edge, clampPanelSplitPercent(splitPercent));
  window.activeCell = newCell;
  highlightActiveCell(newCell);
  setStatus("Panel split", `Created ${edge} panel`);
  return { container, newCell };
}

function createSplitGhost(direction) {
  const ghost = document.createElement("div");
  ghost.className = "panel-split-ghost-divider";
  Object.assign(ghost.style, {
    position: "fixed",
    pointerEvents: "none",
    zIndex: "10000",
    background: "rgba(74, 144, 226, 0.92)",
    boxShadow: "0 0 0 2px rgba(255, 255, 255, 0.85), 0 0 12px rgba(74, 144, 226, 0.55)",
    ...(direction === "column" ? { height: "6px" } : { width: "6px" }),
  });
  document.body.appendChild(ghost);
  return ghost;
}

function positionSplitGhost(ghost, cell, direction, event) {
  const rect = cell.getBoundingClientRect();
  if (direction === "column") {
    ghost.style.left = `${rect.left}px`;
    ghost.style.width = `${rect.width}px`;
    ghost.style.top = `${Math.max(rect.top, Math.min(rect.bottom, event.clientY)) - 3}px`;
  } else {
    ghost.style.top = `${rect.top}px`;
    ghost.style.height = `${rect.height}px`;
    ghost.style.left = `${Math.max(rect.left, Math.min(rect.right, event.clientX)) - 3}px`;
  }
}

function startPanelSplitDrag(cell, edge, event) {
  if (!cell || !edge) return;
  event.preventDefault();
  event.stopPropagation();
  const direction = edge === "top" || edge === "bottom" ? "column" : "row";
  const startX = event.clientX;
  const startY = event.clientY;
  const rect = cell.getBoundingClientRect();
  const ghost = createSplitGhost(direction);
  positionSplitGhost(ghost, cell, direction, event);

  const onMouseMove = (moveEvent) => {
    positionSplitGhost(ghost, cell, direction, moveEvent);
  };

  const onMouseUp = (upEvent) => {
    ghost.remove();
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
    const moved = Math.hypot(upEvent.clientX - startX, upEvent.clientY - startY);
    if (moved < PANEL_EDGE_SPLIT_MIN_DRAG_PX) return;
    const rawPercent = direction === "column"
      ? ((upEvent.clientY - rect.top) / Math.max(rect.height, 1)) * 100
      : ((upEvent.clientX - rect.left) / Math.max(rect.width, 1)) * 100;
    splitPanelCellFromEdge(cell, edge, rawPercent);
  };

  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup", onMouseUp);
}

const PANEL_ALIASES = Object.freeze({
  ViewPanel: "FileView",
  FileViewer: "FileView",
  FileViewerPanel: "FileView",
});

function normalizePanelIdentifier(value) {
  const raw = String(value || "").trim();
  if (!raw) return raw;
  return PANEL_ALIASES[raw] || raw;
}

function toPanelCssSlug(value) {
  return String(value || "panel")
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "panel";
}

function toFlexValue(value) {
  if (value === undefined || value === null || value === "") return "";
  const raw = String(value).trim();
  if (!raw) return "";
  return /\s/.test(raw) ? raw : `${raw} 1 0`;
}

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
    topRow.dataset.direction = "row";
    topRow.dataset.isVertical = "0";
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
    width: "10px",
    cursor: "col-resize",
    background: "#aaa",
    zIndex: "10",
    touchAction: "none",
    userSelect: "none",
  });

  let startX, startLeftWidth, startRightWidth, totalWidth;
  let stopPlaceholderMode = null;
  let activePointerId = null;

  divider.addEventListener("pointerdown", (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    if (activePointerId !== null) return;
    if (isPanelSplitGesture(e)) {
      startPanelSplitDrag(rightCell || leftCell, "left", e);
      return;
    }

    e.preventDefault();
    activePointerId = e.pointerId ?? "mouse";
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
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    stopPlaceholderMode = startResizePlaceholderMode([leftCell, rightCell]);

    divider.setPointerCapture?.(e.pointerId);
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointercancel", onPointerUp);
  });

  function onPointerMove(e) {
    if (activePointerId !== (e.pointerId ?? "mouse")) return;
    e.preventDefault();
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

  function onPointerUp(e) {
    if (activePointerId !== null && e?.pointerId !== undefined && activePointerId !== e.pointerId) return;
    activePointerId = null;
    leftCell.style.transition = "";
    rightCell.style.transition = "";
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    if (stopPlaceholderMode) {
      stopPlaceholderMode();
      stopPlaceholderMode = null;
    }
    if (e?.pointerId !== undefined) divider.releasePointerCapture?.(e.pointerId);
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", onPointerUp);
    document.removeEventListener("pointercancel", onPointerUp);
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
    container.dataset.direction = direction;
    container.dataset.isVertical = isVertical ? "1" : "0";
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

    const inserted = rebuildLayoutDividersForContainer(container, isVertical);
    if (inserted > 0) {
      console.log(`📐 Inserted ${isVertical ? 'vertical' : 'horizontal'} divider(s) for ${children.length} children`);
    }
  } else if (node.instanceName || node.type === "cell") {
    const requestedCellId = node.instanceName || node.id;
    const normalizedCellId = normalizePanelIdentifier(requestedCellId);
    const panelCssSlug = toPanelCssSlug(normalizedCellId || requestedCellId);
    const cell = document.createElement("div");
    cell.className = `panel-cell panel-cell--${panelCssSlug}`;
    cell.dataset.panelId = normalizedCellId || requestedCellId;
    cell.dataset.panelSlug = panelCssSlug;
    const cellStyles = {
      border: "1px solid #bbb",
      background: "#fafafa",
      overflow: "auto",
      display: "flex",
      flexDirection: "column",
      position: "relative",
      minHeight: "0",
      minWidth: "0",
    };
    const explicitFlex = toFlexValue(node.flex);
    if (explicitFlex) cellStyles.flex = explicitFlex;
    Object.assign(cell.style, cellStyles);
    cell.dataset.id = normalizedCellId || requestedCellId;
    cell.dataset.panelClass = node.panelClass || "InfoPanel";
    parent.appendChild(cell);

    window.activeCell = cell;

    const requestedPanelType = node.panelType || node.instanceName || (node.module ? node.module.replace(/^\/PanelInstances\//, "").replace(/\.mjs$/, "") : "InfoPanel");
    const panelType = normalizePanelIdentifier(requestedPanelType) || requestedPanelType;

    if (node.deferLoad !== true) {
      loadPanelIntoCell(panelType, {
        id: normalizedCellId || requestedCellId,
        displayName: node.displayName || normalizedCellId || requestedCellId,
        ...node.panelVars
      });
    }
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
    zIndex: "100",
    transition: "background 0.2s",
    touchAction: "none",
    userSelect: "none",
    ...(isVertical ? {
      height: "10px",
      minHeight: "10px",
      maxHeight: "10px",
      cursor: "row-resize",
      width: "100%",
      display: "block",
    } : {
      width: "10px",
      minWidth: "10px",
      maxWidth: "10px",
      cursor: "col-resize",
      height: "100%",
      display: "block",
    })
  });

  let startPos, startLeftSize, startRightSize, totalSize;
  let stopPlaceholderMode = null;
  let activePointerId = null;

  divider.addEventListener("pointerdown", (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    if (activePointerId !== null) return;
    const leftEl = divider._leftCell;
    const rightEl = divider._rightCell;
    if (!leftEl || !rightEl) return;

    if (isPanelSplitGesture(e)) {
      const splitTarget = rightEl || leftEl;
      startPanelSplitDrag(splitTarget, isVertical ? "top" : "left", e);
      return;
    }

    e.preventDefault();
    activePointerId = e.pointerId ?? "mouse";

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
    document.body.style.cursor = isVertical ? "row-resize" : "col-resize";
    document.body.style.userSelect = "none";
    stopPlaceholderMode = startResizePlaceholderMode([leftEl, rightEl]);

    divider.setPointerCapture?.(e.pointerId);
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointercancel", onPointerUp);
  });

  function onPointerMove(e) {
    if (activePointerId !== (e.pointerId ?? "mouse")) return;
    const leftEl = divider._leftCell;
    const rightEl = divider._rightCell;
    if (!leftEl || !rightEl) return;
    e.preventDefault();

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

  function onPointerUp(e) {
    if (activePointerId !== null && e?.pointerId !== undefined && activePointerId !== e.pointerId) return;
    activePointerId = null;
    const leftEl = divider._leftCell;
    const rightEl = divider._rightCell;
    if (leftEl) leftEl.style.transition = "";
    if (rightEl) rightEl.style.transition = "";
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    if (stopPlaceholderMode) {
      stopPlaceholderMode();
      stopPlaceholderMode = null;
    }
    if (e?.pointerId !== undefined) divider.releasePointerCapture?.(e.pointerId);
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", onPointerUp);
    document.removeEventListener("pointercancel", onPointerUp);
  }

  return divider;
}

export function rebuildLayoutDividersForContainer(container, isVerticalOverride) {
  if (!container) return 0;

  const isVerticalFlag = container.dataset?.isVertical?.toLowerCase?.();
  const isVertical = typeof isVerticalOverride === "boolean"
    ? isVerticalOverride
    : (isVerticalFlag === "1" || isVerticalFlag === "true" || container.dataset?.direction === "column");

  const existingChildren = Array.from(container.children);
  existingChildren
    .filter((child) => child.classList?.contains("layout-divider") || child.classList?.contains("divider"))
    .forEach((divider) => divider.remove());

  const panels = Array.from(container.children).filter((child) =>
    child.classList?.contains("panel-cell") || child.classList?.contains("panel-row")
  );

  if (panels.length < 2) return 0;

  for (let i = panels.length - 1; i > 0; i -= 1) {
    const leftChild = panels[i - 1];
    const rightChild = panels[i];
    const divider = createLayoutDivider(leftChild, rightChild, isVertical);
    container.insertBefore(divider, rightChild);
  }

  return panels.length - 1;
}

function makePanelCell(flexValue = "1 1 0") {
  const cell = document.createElement("div");
  cell.className = "panel-cell";
  Object.assign(cell.style, {
    border: "1px solid #bbb",
    background: "#fafafa",
    overflow: "auto",
    flex: flexValue,
    display: "flex",
    flexDirection: "column",
    position: "relative",
    minHeight: "0",
    minWidth: "0",
  });
  return cell;
}

function resolvePanelCell(candidate) {
  if (candidate?.classList?.contains?.("panel-cell")) return candidate;
  const closest = candidate?.closest?.(".panel-cell");
  if (closest) return closest;
  return null;
}

function hasTwoCellRowWithLayers(container, layersPanelId) {
  if (!container?.classList?.contains?.("panel-row")) return false;
  const direction = container.dataset?.direction || "";
  if (direction !== "row") return false;
  const cells = Array.from(container.children).filter((child) =>
    child.classList?.contains?.("panel-cell")
  );
  if (cells.length !== 2) return false;
  return cells.some((cell) => cell.dataset?.id === layersPanelId);
}

function setCellIdentity(cell, { id, panelClass = "InfoPanel", flex = null } = {}) {
  if (!cell) return cell;
  const normalizedId = normalizePanelIdentifier(id) || id;
  if (normalizedId) {
    cell.dataset.id = normalizedId;
    cell.dataset.panelId = normalizedId;
    cell.dataset.panelSlug = toPanelCssSlug(normalizedId);
  }
  cell.dataset.panelClass = panelClass || "InfoPanel";
  if (flex) cell.style.flex = toFlexValue(flex) || flex;
  cell.style.minHeight = "0";
  cell.style.minWidth = "0";
  return cell;
}

function createPanelRow(direction = "row", flex = "1 1 auto") {
  const row = document.createElement("div");
  const isVertical = direction === "column";
  row.className = "panel-row";
  Object.assign(row.style, {
    display: "flex",
    flexDirection: direction,
    overflow: "hidden",
    flex: toFlexValue(flex) || flex || "1 1 auto",
    alignItems: "stretch",
    minHeight: "0",
    minWidth: "0",
  });
  row.dataset.direction = direction;
  row.dataset.isVertical = isVertical ? "1" : "0";
  return row;
}

function findExistingModeCell(id, excludeCell = null) {
  const normalizedId = normalizePanelIdentifier(id) || id;
  if (!normalizedId) return null;
  const candidates = Array.from(document.querySelectorAll(".panel-cell"));
  return candidates.find((cell) =>
    cell !== excludeCell &&
    !cell.contains(excludeCell) &&
    (cell.dataset?.id === normalizedId || cell.dataset?.panelId === normalizedId)
  ) || null;
}

function findReplacementContainer(editorCell) {
  const parent = editorCell?.parentElement;
  if (!parent) return null;
  const modeRoot = editorCell.closest?.(".panel-row[data-nv-mode-layout-id]");
  if (modeRoot) return modeRoot;
  if (parent.classList?.contains?.("panel-row") && parent.dataset?.nvModeLayoutId) return parent;
  const rowWithFileManager = editorCell.closest?.(".panel-row") || parent;
  if (rowWithFileManager?.classList?.contains?.("panel-row")) return rowWithFileManager;
  return editorCell;
}

async function loadPanelIntoSpecificCell(cell, panelType, panelVars = {}) {
  if (!cell || !panelType) return;
  const previousActiveCell = window.activeCell;
  window.activeCell = cell;
  try {
    await loadPanelIntoCell(panelType, panelVars);
  } finally {
    window.activeCell = previousActiveCell;
  }
}

async function importModeLayout({ userModulePath, defaultModulePath, fallbackModulePaths = [] }) {
  const cacheBust = Date.now();
  const candidates = [userModulePath, defaultModulePath, ...fallbackModulePaths].filter(Boolean);
  let lastError = null;
  for (const candidate of candidates) {
    try {
      const importPath = `${candidate}${candidate.includes("?") ? "&" : "?"}v=${cacheBust}`;
      const mod = await import(importPath);
      const layout = mod.default
        || mod.layout
        || mod.SVG_EDITOR_MODE_LAYOUT
        || mod.MID_EDITOR_MODE_LAYOUT
        || mod.HANDWRITING_OCR_MODE_LAYOUT
        || mod.GIF_EDITOR_MODE_LAYOUT;
      if (layout) return layout;
    } catch (err) {
      lastError = err;
      console.warn(`Mode layout import failed: ${candidate}`, err);
    }
  }
  if (lastError) throw lastError;
  return null;
}

async function materializeModeLayoutNode(node, { editorCell, cellsById, panelsToLoad }) {
  if (!node) return null;
  const direction = node.direction || (node.type === "column" || node.type === "vertical" ? "column" : null);
  const isContainer = direction || node.type === "row" || node.type === "vertical" || node.children;

  if (isContainer && node.children) {
    const row = createPanelRow(direction === "column" ? "column" : "row", node.flex || "1 1 auto");
    if (node.id) row.dataset.id = node.id;
    for (const child of node.children) {
      const childEl = await materializeModeLayoutNode(child, { editorCell, cellsById, panelsToLoad });
      if (childEl) row.appendChild(childEl);
    }
    rebuildLayoutDividersForContainer(row, row.dataset.direction === "column");
    return row;
  }

  if (node.role === "activeEditor") {
    setCellIdentity(editorCell, {
      id: node.id || editorCell.dataset?.id || "GraphicalEditor",
      panelClass: node.panelClass || "EditorPanel",
      flex: node.flex || "1 1 auto",
    });
    return editorCell;
  }

  const id = normalizePanelIdentifier(node.id || node.panelType || node.instanceName) || node.id || node.panelType || node.instanceName;
  let cell = cellsById.get(id) || findExistingModeCell(id, editorCell) || makePanelCell(node.flex || "1 1 0");
  cellsById.set(id, cell);
  setCellIdentity(cell, {
    id,
    panelClass: node.panelClass || "InfoPanel",
    flex: node.flex || "1 1 0",
  });
  const panelType = normalizePanelIdentifier(node.panelType || node.instanceName || id) || node.panelType || node.instanceName || id;
  if (!cell.isConnected || node.forceReload || !cell.childElementCount) {
    panelsToLoad.push({
      cell,
      panelType,
      panelVars: {
        id,
        displayName: node.displayName || id,
        ...(node.panelVars || {}),
      },
    });
  }
  return cell;
}

function cloneModeLayoutWithPanelVars(layout, panelId, panelVars = {}) {
  const normalizedTarget = normalizePanelIdentifier(panelId) || panelId;
  const hasPanelVars = panelVars && Object.keys(panelVars).length > 0;
  if (!layout || !hasPanelVars) return layout;

  const cloneNode = (node) => {
    if (!node || typeof node !== "object") return node;
    const clone = { ...node };
    if (Array.isArray(node.children)) {
      clone.children = node.children.map(cloneNode);
    }

    const nodeId = normalizePanelIdentifier(node.id || node.panelType || node.instanceName)
      || node.id
      || node.panelType
      || node.instanceName;
    const nodePanelType = normalizePanelIdentifier(node.panelType || node.instanceName)
      || node.panelType
      || node.instanceName;
    if (nodeId === normalizedTarget || nodePanelType === normalizedTarget) {
      clone.forceReload = true;
      clone.panelVars = {
        ...(node.panelVars || {}),
        ...panelVars,
      };
    }
    return clone;
  };

  return cloneNode(layout);
}

export async function ensureEditorModeLayout({
  editorCell,
  layout,
  modeId = layout?.id || "EditorMode",
  preserveExistingPanelIds = [],
} = {}) {
  const cell = resolvePanelCell(editorCell || window.activeCell);
  if (!cell || !layout?.children?.length) return null;

  const replacementTarget = findReplacementContainer(cell);
  const targetParent = replacementTarget?.parentElement;
  if (!replacementTarget || !targetParent) return null;

  const existingCells = new Map();
  Array.from(document.querySelectorAll(".panel-cell")).forEach((candidate) => {
    const id = candidate.dataset?.id || candidate.dataset?.panelId;
    if (id && candidate !== cell && !candidate.contains(cell)) existingCells.set(id, candidate);
  });

  const panelsToLoad = [];
  const root = await materializeModeLayoutNode(layout, { editorCell: cell, cellsById: existingCells, panelsToLoad });
  if (!root) return null;
  root.dataset.nvModeLayoutId = modeId;

  const preserveIds = new Set((preserveExistingPanelIds || [])
    .map((id) => normalizePanelIdentifier(id) || id)
    .filter(Boolean));
  const preservedCells = preserveIds.size
    ? Array.from(replacementTarget.querySelectorAll?.(".panel-cell") || []).filter((candidate) => {
      const candidateId = normalizePanelIdentifier(candidate.dataset?.id || candidate.dataset?.panelId) || candidate.dataset?.id || candidate.dataset?.panelId;
      return candidateId && preserveIds.has(candidateId) && candidate !== cell && !root.contains(candidate);
    })
    : [];
  let rootToInsert = root;
  if (preservedCells.length) {
    const wrapper = createPanelRow("row", replacementTarget.style?.flex || root.style.flex || "1 1 auto");
    wrapper.dataset.nvModeLayoutId = modeId;
    delete root.dataset.nvModeLayoutId;
    preservedCells.forEach((preservedCell) => wrapper.appendChild(preservedCell));
    wrapper.appendChild(root);
    rebuildLayoutDividersForContainer(wrapper, false);
    rootToInsert = wrapper;
  }

  if (replacementTarget === cell) {
    const marker = document.createComment(`Nodevision ${modeId} insertion point`);
    targetParent.replaceChild(marker, cell);
    targetParent.replaceChild(rootToInsert, marker);
  } else {
    targetParent.replaceChild(rootToInsert, replacementTarget);
  }

  rebuildLayoutDividersForContainer(root, root.dataset.direction === "column");
  rebuildLayoutDividersForContainer(rootToInsert, rootToInsert.dataset.direction === "column");
  rebuildLayoutDividersForContainer(targetParent);

  for (const panel of panelsToLoad) {
    await loadPanelIntoSpecificCell(panel.cell, panel.panelType, panel.panelVars);
  }

  window.activeCell = cell;
  window.highlightActiveCell?.(cell);

  return {
    root,
    editorCell: cell,
    cellsById: existingCells,
  };
}

export async function ensureSvgEditorModeLayout({ editorCell } = {}) {
  const layout = await importModeLayout({
    userModulePath: "/UserSettings/ModeLayouts/SVGEditorMode.mjs",
    defaultModulePath: "/Layouts/ModeLayouts/DefualtSVGEditorMode.mjs",
  });
  return ensureEditorModeLayout({
    editorCell,
    layout,
    modeId: layout?.id || "SVGEditorMode",
  });
}


export async function ensureMidEditorModeLayout({ editorCell } = {}) {
  const layout = await importModeLayout({
    userModulePath: "/UserSettings/ModeLayouts/MidEditorMode.mjs",
    defaultModulePath: "/Layouts/ModeLayouts/MidEditorMode.mjs",
  });
  return ensureEditorModeLayout({
    editorCell,
    layout,
    modeId: layout?.id || "MidEditorMode",
  });
}

export async function ensureHandwritingOcrModeLayout({ editorCell, panelVars = {} } = {}) {
  const layout = await importModeLayout({
    userModulePath: "/UserSettings/ModeLayouts/HandwritingOcrMode.mjs",
    defaultModulePath: "/Layouts/ModeLayouts/HandwritingOcrMode.mjs",
  });
  const layoutWithVars = cloneModeLayoutWithPanelVars(layout, "HandwritingOcrPanel", panelVars);
  return ensureEditorModeLayout({
    editorCell,
    layout: layoutWithVars,
    modeId: layoutWithVars?.id || "HandwritingOcrMode",
  });
}

export async function ensureScadEditorModeLayout({ editorCell } = {}) {
  const layout = await importModeLayout({
    userModulePath: "/UserSettings/ModeLayouts/ScadEditorMode.mjs",
    defaultModulePath: "/Layouts/ModeLayouts/ScadEditorMode.mjs",
  });
  return ensureEditorModeLayout({
    editorCell,
    layout,
    modeId: layout?.id || "ScadEditorMode",
    preserveExistingPanelIds: ["FileManager"],
  });
}

export async function ensureGifEditorModeLayout({ editorCell } = {}) {
  const layout = await importModeLayout({
    userModulePath: "/UserSettings/ModeLayouts/GifEditorMode.mjs",
    defaultModulePath: "/Layouts/ModeLayouts/GifEditorMode.mjs",
  });
  return ensureEditorModeLayout({
    editorCell,
    layout,
    modeId: layout?.id || "GifEditorMode",
    preserveExistingPanelIds: ["FileManager"],
  });
}

export async function ensureKMLViewerModeLayout({ viewerCell } = {}) {
  const layout = await importModeLayout({
    userModulePath: "/UserSettings/ModeLayouts/KMLviewerMode.mjs",
    defaultModulePath: "/Layouts/ModeLayouts/KMLviewerMode.mjs",
  });
  return ensureEditorModeLayout({
    editorCell: viewerCell,
    layout,
    modeId: layout?.id || "KMLviewerMode",
  });
}

export async function ensureKMLEditingModeLayout({ editorCell } = {}) {
  const layout = await importModeLayout({
    userModulePath: "/UserSettings/ModeLayouts/KMLeditorMode.mjs",
    defaultModulePath: "/Layouts/ModeLayouts/KMLeditorMode.mjs",
    fallbackModulePaths: ["/UserSettings/ModeLayouts/KMLeditingMode.mjs"],
  });
  return ensureEditorModeLayout({
    editorCell,
    layout,
    modeId: layout?.id || "KMLeditorMode",
  });
}

export async function ensureKMLEditorModeLayout(options = {}) {
  return ensureKMLEditingModeLayout(options);
}

export function ensureSvgEditingSplit({
  editorCell,
  layersPanelId = "SVGLayersPanel",
  layersPanelClass = "InfoPanel",
  editorFlex = "0 0 72%",
  layersFlex = "0 0 28%",
} = {}) {
  const cell = resolvePanelCell(editorCell || window.activeCell);
  if (!cell) return null;

  const parent = cell.parentElement;
  if (!parent) return null;

  if (parent.dataset?.nvSvgEditingSplit === "1" || hasTwoCellRowWithLayers(parent, layersPanelId)) {
    const existingLayersCell = Array.from(parent.children)
      .filter((child) => child.classList?.contains?.("panel-cell"))
      .find((child) => child.dataset?.id === layersPanelId);
    if (existingLayersCell) {
      return { splitContainer: parent, editorCell: cell, layersCell: existingLayersCell, didCreate: false };
    }
  }

  const originalFlex = cell.style.flex || "1 1 0";
  const splitContainer = document.createElement("div");
  splitContainer.className = "panel-row";
  Object.assign(splitContainer.style, {
    display: "flex",
    flexDirection: "row",
    overflow: "hidden",
    flex: originalFlex,
    alignItems: "stretch",
    minHeight: "0",
    minWidth: "0",
  });
  splitContainer.dataset.direction = "row";
  splitContainer.dataset.isVertical = "0";
  splitContainer.dataset.nvSvgEditingSplit = "1";

  parent.replaceChild(splitContainer, cell);

  Object.assign(cell.style, {
    flex: editorFlex,
    minHeight: "0",
    minWidth: "0",
  });
  splitContainer.appendChild(cell);

  const layersCell = makePanelCell(layersFlex);
  layersCell.dataset.id = layersPanelId;
  layersCell.dataset.panelClass = layersPanelClass;
  splitContainer.appendChild(layersCell);

  rebuildLayoutDividersForContainer(splitContainer, false);
  rebuildLayoutDividersForContainer(parent);

  window.activeCell = cell;
  window.highlightActiveCell?.(cell);

  return { splitContainer, editorCell: cell, layersCell, didCreate: true };
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

  const requestedPanelType = panelType;
  panelType = normalizePanelIdentifier(panelType) || panelType;
  console.log("Panel Type:", requestedPanelType);
  if (requestedPanelType !== panelType) {
    console.log(`🔁 Normalized panel type: ${requestedPanelType} → ${panelType}`);
  }

  // Try multiple search paths for panels, honoring the target cell class first.
  const panelClass = String(cell.dataset.panelClass || "").toLowerCase();
  const preferredFolder = {
    editorpanel: "EditorPanels",
    infopanel: "InfoPanels",
    viewpanel: "ViewPanels",
    controlpanel: "ControlPanels",
  }[panelClass];
  const candidatePaths = [
    preferredFolder ? `/PanelInstances/${preferredFolder}/${panelType}.mjs` : null,
    `/PanelInstances/${panelType}.mjs`,
    `/PanelInstances/EditorPanels/${panelType}.mjs`,
    `/PanelInstances/InfoPanels/${panelType}.mjs`,
    `/PanelInstances/ViewPanels/${panelType}.mjs`,
    `/PanelInstances/ControlPanels/${panelType}.mjs`,
    `/panels/${panelType}.mjs`,
  ].filter(Boolean);
  const possiblePaths = [...new Set(candidatePaths)];

  let module = null;
  for (const path of possiblePaths) {
    try {
      console.log("🔍 Trying to import panel:", path);
      if (!window.__nvModuleCacheBust) {
        window.__nvModuleCacheBust = Date.now();
      }
      const importPath = `${path}${path.includes("?") ? "&" : "?"}v=${window.__nvModuleCacheBust}`;
      const candidateModule = await import(importPath);
      if (typeof candidateModule.setupPanel !== "function") {
        console.warn("⚠️ Panel module has no setupPanel(), trying next candidate:", path);
        continue;
      }
      module = candidateModule;
      console.log("✅ Successfully imported:", path);
      break;
    } catch (err) {
      // Only log 404s; ignore missing paths
    }
  }

  if (!module) {
    console.warn("⚠️ No panel module with setupPanel found for", panelType);
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

  const resolvedFilePath = resolveActiveFilePath(panelVars.filePath);
  if (resolvedFilePath) {
    cell.dataset.currentFilePath = resolvedFilePath;
  } else {
    delete cell.dataset.currentFilePath;
  }
  const cleanup = await module.setupPanel(cell, {
    ...panelVars,
    filePath: resolvedFilePath || null,
  });
  if (typeof cleanup === "function") cell.cleanup = cleanup;

  console.log("✅ Loaded panel:", panelType);
}



// 🟣 Listen for toolbar events globally — replaces active cell with selected panel
window.addEventListener("toolbarAction", async (e) => {
  const { id, type, replaceActive } = e.detail;
  const normalizedId = normalizePanelIdentifier(id) || id;
  if (normalizedId !== id) {
    console.log(`🔁 toolbarAction alias: ${id} -> ${normalizedId}`);
  }
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
    cell.dataset.id = normalizedId;
    cell.dataset.panelClass = panelClass;

    // Update all active panel tracking
    window.activePanel = normalizedId;
    window.activePanelClass = panelClass;
    if (window.NodevisionState) {
      window.NodevisionState.activePanelType = panelClass;
    }

    await loadPanelIntoCell(normalizedId, { id: normalizedId, displayName: normalizedId });
    highlightActiveCell(cell);

    console.log(`🔄 Replaced active panel with "${normalizedId}" (${panelClass})`);
    return;
  }

  // Default behavior: check if this panel already exists in the layout
  const existingCell = document.querySelector(`[data-id="${normalizedId}"]`);
  if (existingCell) {
    // Panel already exists - just make it visible and active
    existingCell.style.display = "flex";
    window.activeCell = existingCell;
    window.activePanel = normalizedId;
    window.activePanelClass = existingCell.dataset.panelClass || panelClass;
    if (window.NodevisionState) {
      window.NodevisionState.activePanelType = existingCell.dataset.panelClass || panelClass;
    }
    highlightActiveCell(existingCell);
    if (normalizedId === "FileView" && typeof window.updateViewPanel === "function") {
      const activePath = resolveActiveFilePath();
      if (activePath) {
        window.updateViewPanel(activePath, { force: true }).catch((err) => {
          console.error("❌ FileView reactivation failed:", err);
        });
      } else {
        setStatus("File Viewer", "No active file selected");
      }
    }
    console.log(`📌 Panel "${normalizedId}" already exists, activated.`);
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
  cell.dataset.id = normalizedId;
  window.activePanel = normalizedId;
  await loadPanelIntoCell(normalizedId, { id: normalizedId, displayName: normalizedId });
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

  const splitGestureHandler = (event) => {
    if (!isPanelSplitGesture(event)) return;
    const cell = event?.target?.closest?.(".panel-cell");
    if (!cell) return;
    const edge = getPanelEdgeFromPointer(cell, event);
    if (!edge) return;
    handlePanelActivation(cell);
    startPanelSplitDrag(cell, edge, event);
  };

  document.addEventListener("mousedown", splitGestureHandler, true);
  document.addEventListener("click", activateHandler, true);
}

// Initialize tracking when module loads
setupActivePanelTracking();
