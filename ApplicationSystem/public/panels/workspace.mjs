// Nodevision/ApplicationSystem/public/panels/workspace.mjs
// This module manages workspace rows, cells, resizable dividers, active panel tracking, and toolbar-based panel replacement.

import { logStatus } from "./../StatusBar.mjs";
import { setStatus } from "./../StatusBar.mjs";
import {
  activatePanelTab,
  closePanelTabsInCell,
  findPanelTabMatch,
  getActivePanelTab,
  openPanelTabInCell,
  serializePanelTabsForCell,
} from "./panelTabs.mjs";
import "/EditorSwitchGuard.mjs";

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
const PANEL_EDGE_SPLIT_HANDLE_CLASS = "panel-edge-split-handle";
const WORKSPACE_EDGE_SPLIT_HANDLE_CLASS = "workspace-edge-split-handle";
const PANEL_EDGE_SPLIT_MODIFIER_CLASS = "nv-panel-split-modifier-active";

function ensurePanelEdgeSplitHandleStyles() {
  if (document.getElementById("nv-panel-edge-split-handle-styles")) return;
  const style = document.createElement("style");
  style.id = "nv-panel-edge-split-handle-styles";
  style.textContent = `
    .panel-cell > .${PANEL_EDGE_SPLIT_HANDLE_CLASS},
    #workspace > .${WORKSPACE_EDGE_SPLIT_HANDLE_CLASS} {
      position: absolute;
      z-index: 120;
      pointer-events: none;
      background: transparent;
      opacity: 0;
      transition: opacity 120ms ease, background 120ms ease;
    }
    body.${PANEL_EDGE_SPLIT_MODIFIER_CLASS} .panel-cell > .${PANEL_EDGE_SPLIT_HANDLE_CLASS},
    body.${PANEL_EDGE_SPLIT_MODIFIER_CLASS} #workspace > .${WORKSPACE_EDGE_SPLIT_HANDLE_CLASS} {
      pointer-events: auto;
    }
    body.${PANEL_EDGE_SPLIT_MODIFIER_CLASS} .panel-cell > .${PANEL_EDGE_SPLIT_HANDLE_CLASS}:hover,
    body.${PANEL_EDGE_SPLIT_MODIFIER_CLASS} #workspace > .${WORKSPACE_EDGE_SPLIT_HANDLE_CLASS}:hover {
      opacity: 1;
      background: rgba(74, 144, 226, 0.16);
    }
    .panel-cell > .${PANEL_EDGE_SPLIT_HANDLE_CLASS}[data-edge="left"],
    .panel-cell > .${PANEL_EDGE_SPLIT_HANDLE_CLASS}[data-edge="right"],
    #workspace > .${WORKSPACE_EDGE_SPLIT_HANDLE_CLASS}[data-edge="left"],
    #workspace > .${WORKSPACE_EDGE_SPLIT_HANDLE_CLASS}[data-edge="right"] {
      top: 0;
      bottom: 0;
      width: ${PANEL_EDGE_SPLIT_HOTZONE_PX}px;
      cursor: col-resize;
    }
    .panel-cell > .${PANEL_EDGE_SPLIT_HANDLE_CLASS}[data-edge="left"],
    #workspace > .${WORKSPACE_EDGE_SPLIT_HANDLE_CLASS}[data-edge="left"] { left: 0; }
    .panel-cell > .${PANEL_EDGE_SPLIT_HANDLE_CLASS}[data-edge="right"],
    #workspace > .${WORKSPACE_EDGE_SPLIT_HANDLE_CLASS}[data-edge="right"] { right: 0; }
    .panel-cell > .${PANEL_EDGE_SPLIT_HANDLE_CLASS}[data-edge="top"],
    .panel-cell > .${PANEL_EDGE_SPLIT_HANDLE_CLASS}[data-edge="bottom"],
    #workspace > .${WORKSPACE_EDGE_SPLIT_HANDLE_CLASS}[data-edge="top"],
    #workspace > .${WORKSPACE_EDGE_SPLIT_HANDLE_CLASS}[data-edge="bottom"] {
      left: 0;
      right: 0;
      height: ${PANEL_EDGE_SPLIT_HOTZONE_PX}px;
      cursor: row-resize;
    }
    .panel-cell > .${PANEL_EDGE_SPLIT_HANDLE_CLASS}[data-edge="top"],
    #workspace > .${WORKSPACE_EDGE_SPLIT_HANDLE_CLASS}[data-edge="top"] { top: 0; }
    .panel-cell > .${PANEL_EDGE_SPLIT_HANDLE_CLASS}[data-edge="bottom"],
    #workspace > .${WORKSPACE_EDGE_SPLIT_HANDLE_CLASS}[data-edge="bottom"] { bottom: 0; }
  `;
  document.head.appendChild(style);
}

function ensurePanelEdgeSplitHandles(cell) {
  if (!cell?.classList?.contains?.("panel-cell")) return;
  ensurePanelEdgeSplitHandleStyles();
  if (!cell.style.position) cell.style.position = "relative";

  for (const edge of ["left", "right", "top", "bottom"]) {
    let handle = Array.from(cell.children).find((child) =>
      child.classList?.contains(PANEL_EDGE_SPLIT_HANDLE_CLASS) && child.dataset?.edge === edge
    );
    if (!handle) {
      handle = document.createElement("div");
      handle.className = PANEL_EDGE_SPLIT_HANDLE_CLASS;
      handle.dataset.edge = edge;
      handle.setAttribute("aria-hidden", "true");
      cell.appendChild(handle);
    }
  }
}

function ensureWorkspaceEdgeSplitHandles(workspace) {
  if (!workspace) return;
  ensurePanelEdgeSplitHandleStyles();
  if (!workspace.style.position) workspace.style.position = "relative";

  for (const edge of ["left", "right", "top", "bottom"]) {
    let handle = Array.from(workspace.children).find((child) =>
      child.classList?.contains(WORKSPACE_EDGE_SPLIT_HANDLE_CLASS) && child.dataset?.edge === edge
    );
    if (!handle) {
      handle = document.createElement("div");
      handle.className = WORKSPACE_EDGE_SPLIT_HANDLE_CLASS;
      handle.dataset.edge = edge;
      handle.setAttribute("aria-hidden", "true");
      workspace.appendChild(handle);
    }
  }
}

function showLayoutControlsToolbar() {
  window.dispatchEvent(new CustomEvent("nv-show-subtoolbar", {
    detail: { heading: "Layout Controls", force: true, toggle: false },
  }));
}

function pickLayoutControlsCell(...elements) {
  const candidates = elements.flatMap((element) => collectPanelCells(element));
  const activeCell = resolvePanelCell(window.activeCell);
  if (activeCell && candidates.includes(activeCell)) return activeCell;
  return candidates[0] || null;
}

function focusLayoutControlsForPanels(...elements) {
  const cell = pickLayoutControlsCell(...elements);
  if (cell) activatePanelCell(cell, { announce: false });
  showLayoutControlsToolbar();
  return cell;
}

function updatePanelSplitModifierClass(event = null) {
  const active = Boolean(event?.ctrlKey || event?.metaKey);
  document.body?.classList?.toggle(PANEL_EDGE_SPLIT_MODIFIER_CLASS, active);
}

function installPanelSplitModifierTracking() {
  if (window.__nvPanelSplitModifierTrackingInstalled) return;
  window.__nvPanelSplitModifierTrackingInstalled = true;
  window.addEventListener("keydown", updatePanelSplitModifierClass, true);
  window.addEventListener("keyup", updatePanelSplitModifierClass, true);
  window.addEventListener("blur", () => document.body?.classList?.remove(PANEL_EDGE_SPLIT_MODIFIER_CLASS));
}

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

function pointWithinRect(rect, x, y, padding = 0) {
  return x >= rect.left - padding &&
    x <= rect.right + padding &&
    y >= rect.top - padding &&
    y <= rect.bottom + padding;
}

function findWorkspaceOuterEdgeSplitTarget(event, forcedEdge = null) {
  const workspace = document.getElementById("workspace");
  if (!workspace || !event) return null;

  const x = Number(event.clientX);
  const y = Number(event.clientY);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  const workspaceRect = workspace.getBoundingClientRect();
  if (!pointWithinRect(workspaceRect, x, y, PANEL_EDGE_SPLIT_HOTZONE_PX)) return null;

  const distances = {
    left: Math.abs(x - workspaceRect.left),
    right: Math.abs(workspaceRect.right - x),
    top: Math.abs(y - workspaceRect.top),
    bottom: Math.abs(workspaceRect.bottom - y),
  };
  const [nearestEdge, nearestDistance] = Object.entries(distances).sort((a, b) => a[1] - b[1])[0] || [];
  const edge = forcedEdge || nearestEdge;
  if (!edge || (!forcedEdge && nearestDistance > PANEL_EDGE_SPLIT_HOTZONE_PX)) return null;

  const records = collectPanelCells(workspace)
    .map((cell) => ({ cell, rect: cell.getBoundingClientRect() }))
    .filter(({ rect }) => rect.width > 0 && rect.height > 0);

  let candidates = [];
  if (edge === "left" || edge === "right") {
    candidates = records.filter(({ rect }) => y >= rect.top && y <= rect.bottom);
    candidates.sort((a, b) => edge === "left" ? a.rect.left - b.rect.left : b.rect.right - a.rect.right);
  } else {
    candidates = records.filter(({ rect }) => x >= rect.left && x <= rect.right);
    candidates.sort((a, b) => edge === "top" ? a.rect.top - b.rect.top : b.rect.bottom - a.rect.bottom);
  }

  return candidates[0] ? { cell: candidates[0].cell, edge } : null;
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
  ensurePanelEdgeSplitHandles(cell);
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
  activatePanelCell(newCell, { announce: false });
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
  focusLayoutControlsForPanels(cell);
  const direction = edge === "top" || edge === "bottom" ? "column" : "row";
  const startX = event.clientX;
  const startY = event.clientY;
  const rect = cell.getBoundingClientRect();
  const ghost = createSplitGhost(direction);
  const isPointerEvent = event.pointerId !== undefined;
  const activePointerId = isPointerEvent ? event.pointerId : null;
  const moveEventName = isPointerEvent ? "pointermove" : "mousemove";
  const upEventName = isPointerEvent ? "pointerup" : "mouseup";
  const cancelEventName = isPointerEvent ? "pointercancel" : null;
  positionSplitGhost(ghost, cell, direction, event);

  try {
    if (isPointerEvent) cell.setPointerCapture?.(event.pointerId);
  } catch {
    // Pointer capture can fail if the original target is already detached.
  }

  const onMove = (moveEvent) => {
    if (activePointerId !== null && moveEvent.pointerId !== activePointerId) return;
    positionSplitGhost(ghost, cell, direction, moveEvent);
  };

  const finish = (upEvent) => {
    if (activePointerId !== null && upEvent?.pointerId !== undefined && upEvent.pointerId !== activePointerId) return;
    ghost.remove();
    document.removeEventListener(moveEventName, onMove, true);
    document.removeEventListener(upEventName, finish, true);
    if (cancelEventName) document.removeEventListener(cancelEventName, finish, true);
    try {
      if (activePointerId !== null) cell.releasePointerCapture?.(activePointerId);
    } catch {
      // The pointer may already have been released by the browser.
    }

    const endX = Number(upEvent?.clientX);
    const endY = Number(upEvent?.clientY);
    if (upEvent?.type === "pointercancel" || !Number.isFinite(endX) || !Number.isFinite(endY)) return;

    const moved = Math.hypot(endX - startX, endY - startY);
    if (moved < PANEL_EDGE_SPLIT_MIN_DRAG_PX) return;
    const rawPercent = direction === "column"
      ? ((endY - rect.top) / Math.max(rect.height, 1)) * 100
      : ((endX - rect.left) / Math.max(rect.width, 1)) * 100;
    splitPanelCellFromEdge(cell, edge, rawPercent);
  };

  document.addEventListener(moveEventName, onMove, true);
  document.addEventListener(upEventName, finish, true);
  if (cancelEventName) document.addEventListener(cancelEventName, finish, true);
}

const PANEL_ALIASES = Object.freeze({
  ViewPanel: "FileView",
  FileViewer: "FileView",
  FileViewerPanel: "FileView",
  CodeEditorPanel: "CodeEditor",
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
    position: "relative",
  });
  ensureWorkspaceEdgeSplitHandles(workspace);
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
  ensurePanelEdgeSplitHandles(cell);

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
    focusLayoutControlsForPanels(leftCell, rightCell);
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
    if (node.tabOrientation || node.tabsOrientation) {
      cell.dataset.nvTabOrientation = node.tabOrientation || node.tabsOrientation;
    }
    parent.appendChild(cell);
    ensurePanelEdgeSplitHandles(cell);

    window.activeCell = cell;

    const requestedPanelType = node.panelType || node.instanceName || (node.module ? String(node.module).split("/").pop().replace(/\.mjs$/, "") : "InfoPanel");
    const panelType = normalizePanelIdentifier(requestedPanelType) || requestedPanelType;

    if (Array.isArray(node.tabs) && node.tabs.length) {
      restorePanelTabsForCell(cell, node).catch((err) => console.warn("Failed to restore panel tabs:", err));
      return;
    }

    if (node.deferLoad !== true) {
      loadPanelIntoCell(panelType, {
        id: normalizedCellId || requestedCellId,
        displayName: node.displayName || normalizedCellId || requestedCellId,
        tabOrientation: node.tabOrientation || node.tabsOrientation || "top",
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
    focusLayoutControlsForPanels(leftEl, rightEl);

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
  ensurePanelEdgeSplitHandles(cell);
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
    return await loadPanelIntoCell(panelType, panelVars);
  } finally {
    window.activeCell = previousActiveCell;
  }
}

async function restorePanelTabsForCell(cell, node = {}) {
  const tabs = Array.isArray(node.tabs) ? node.tabs : [];
  if (!cell || !tabs.length) return;
  const activeTabId = node.activeTabId || tabs[0]?.tabId || "";
  for (let index = 0; index < tabs.length; index += 1) {
    const tab = tabs[index] || {};
    const tabPanelType = normalizePanelIdentifier(tab.panelType || tab.panelId || tab.id) || tab.panelType || tab.panelId || tab.id;
    if (!tabPanelType) continue;
    await loadPanelIntoSpecificCell(cell, tabPanelType, {
      ...(tab.panelVars || {}),
      id: tabPanelType,
      displayName: tab.displayName || tabPanelType,
      panelClass: tab.panelClass || node.panelClass || "InfoPanel",
      tabOrientation: node.tabOrientation || node.tabsOrientation || "top",
      allowDuplicateTab: true,
      __nvTabId: tab.tabId,
      __nvTabIndex: index,
    });
  }
  if (activeTabId) activatePanelTab(cell, activeTabId, { announce: false });
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



function activatePanelCell(cell, { announce = true } = {}) {
  if (!cell) return null;
  const activeTab = getActivePanelTab(cell);
  if (activeTab) {
    activatePanelTab(cell, activeTab.tabId, { announce });
    return cell;
  }

  window.activeCell = cell;
  const panelId = cell.dataset.id || cell.dataset.panelId || "Unknown";
  const panelClass = cell.dataset.panelClass || "InfoPanel";
  window.activePanel = panelId;
  window.activePanelClass = panelClass;

  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.activePanelType = panelClass;

  if (announce) {
    logStatus("Active panel: " + panelId + " (" + panelClass + ")");
    setStatus("Active panel", panelId + " (" + panelClass + ")");
  }

  highlightActiveCell(cell);
  window.dispatchEvent(new CustomEvent("activePanelChanged", {
    detail: { panel: panelId, cell, panelClass },
  }));
  return cell;
}

function panelCellContentChildren(cell) {
  return Array.from(cell?.children || []).filter((child) =>
    !child.classList?.contains(PANEL_EDGE_SPLIT_HANDLE_CLASS) &&
    !child.classList?.contains("nv-panel-tab-shell")
  );
}

function isEmptyOrPlaceholderPanelCell(cell) {
  const children = panelCellContentChildren(cell);
  if (children.length === 0) return true;
  return children.every((child) =>
    child.classList?.contains("panel-split-placeholder") ||
    child.classList?.contains("panel-resize-placeholder")
  );
}

async function replacePanelInCell(cell, panelId, panelClass = "InfoPanel", panelVars = {}) {
  if (!cell || !panelId) return null;
  setCellIdentity(cell, { id: panelId, panelClass });
  activatePanelCell(cell, { announce: false });
  await loadPanelIntoCell(panelId, { id: panelId, displayName: panelId, panelClass, ...panelVars });
  ensurePanelEdgeSplitHandles(cell);
  highlightActiveCell(cell);
  return cell;
}

function cleanupPanelCells(root) {
  const cells = Array.from(root?.querySelectorAll?.(".panel-cell") || []);
  for (const cell of cells) {
    closePanelTabsInCell(cell, { force: true });
    if (typeof cell.cleanup === "function") {
      try {
        cell.cleanup();
      } catch (err) {
        console.warn("Panel cleanup failed before workspace replacement:", err);
      }
    }
    cell.cleanup = null;
  }
}

export async function replaceWorkspaceWithPanel(panelType, panelVars = {}) {
  const workspace = ensureWorkspace();
  const requestedPanelType = String(panelType || "").trim();
  const normalizedPanelType = normalizePanelIdentifier(requestedPanelType) || requestedPanelType;
  if (!normalizedPanelType) return null;

  const {
    panelClass = "InfoPanel",
    displayName = normalizedPanelType,
    ...remainingPanelVars
  } = panelVars || {};

  cleanupPanelCells(workspace);
  workspace.innerHTML = "";
  ensureWorkspaceEdgeSplitHandles(workspace);

  const row = createPanelRow("row", "1 1 auto");
  workspace.appendChild(row);

  const cell = makePanelCell("1 1 auto");
  setCellIdentity(cell, {
    id: normalizedPanelType,
    panelClass,
    flex: "1 1 auto",
  });
  row.appendChild(cell);

  window.activeCell = cell;
  window.activePanel = normalizedPanelType;
  window.activePanelClass = panelClass;
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.activePanelType = panelClass;

  await loadPanelIntoCell(normalizedPanelType, {
    id: normalizedPanelType,
    displayName,
    ...remainingPanelVars,
  });

  rebuildLayoutDividersForContainer(row, false);
  highlightActiveCell(cell);
  return cell;
}


function panelModuleSearchPaths(panelType, panelClassValue = "") {
  const panelClass = String(panelClassValue || "").toLowerCase();
  const preferredFolder = {
    editorpanel: "EditorPanels",
    infopanel: "InfoPanels",
    viewpanel: "ViewPanels",
    controlpanel: "ControlPanels",
  }[panelClass];
  const candidatePaths = [
    preferredFolder ? "/PanelInstances/" + preferredFolder + "/" + panelType + ".mjs" : null,
    "/PanelInstances/" + panelType + ".mjs",
    "/PanelInstances/EditorPanels/" + panelType + ".mjs",
    "/PanelInstances/InfoPanels/" + panelType + ".mjs",
    "/PanelInstances/ViewPanels/" + panelType + ".mjs",
    "/PanelInstances/ControlPanels/" + panelType + ".mjs",
    "/panels/" + panelType + ".mjs",
  ].filter(Boolean);
  return [...new Set(candidatePaths)];
}

async function resolvePanelModule(panelType, panelClassValue = "") {
  for (const path of panelModuleSearchPaths(panelType, panelClassValue)) {
    try {
      console.log("🔍 Trying to import panel:", path);
      if (!window.__nvModuleCacheBust) window.__nvModuleCacheBust = Date.now();
      const importPath = path + (path.includes("?") ? "&" : "?") + "v=" + window.__nvModuleCacheBust;
      const candidateModule = await import(importPath);
      if (typeof candidateModule.setupPanel !== "function") {
        console.warn("⚠️ Panel module has no setupPanel(), trying next candidate:", path);
        continue;
      }
      console.log("✅ Successfully imported:", path);
      return candidateModule;
    } catch (err) {
      // Missing candidate paths are expected while probing panel families.
    }
  }
  console.warn("⚠️ No panel module with setupPanel found for", panelType);
  return null;
}

async function mountPanelModuleIntoElement(host, panelType, panelVars = {}, panelClassValue = "InfoPanel") {
  const module = await resolvePanelModule(panelType, panelClassValue);
  if (!module) {
    host.innerHTML = "<div class=\"panel-loading\">Panel module unavailable.</div>";
    return null;
  }

  const resolvedFilePath = resolveActiveFilePath(panelVars.filePath);
  if (resolvedFilePath) host.dataset.currentFilePath = resolvedFilePath;
  else delete host.dataset.currentFilePath;

  const cleanup = await module.setupPanel(host, {
    ...panelVars,
    filePath: resolvedFilePath || null,
  });
  if (typeof cleanup === "function") host.cleanup = cleanup;
  return cleanup;
}

export async function loadPanelIntoCell(panelType, panelVars = {}) {
  const cell = resolvePanelCell(window.activeCell) || window.activeCell;
  if (!cell?.classList?.contains?.("panel-cell")) {
    console.warn("⚠️ No active cell selected for loading panel:", panelType);
    return null;
  }

  const requestedPanelType = panelType;
  const normalizedPanelType = normalizePanelIdentifier(panelType) || panelType;
  console.log("Panel Type:", requestedPanelType);
  if (requestedPanelType !== normalizedPanelType) {
    console.log("🔁 Normalized panel type: " + requestedPanelType + " → " + normalizedPanelType);
  }

  const panelClass = panelVars.panelClass || cell.dataset.panelClass || "InfoPanel";
  const tab = await openPanelTabInCell(cell, {
    panelType: normalizedPanelType,
    panelClass,
    panelVars: { ...panelVars, panelClass },
    tabOrientation: panelVars.tabOrientation || cell.dataset.nvTabOrientation || "top",
    allowDuplicate: panelVars.allowDuplicateTab === true,
    tabId: panelVars.__nvTabId || panelVars.tabId || null,
    index: panelVars.__nvTabIndex,
  }, (host, vars) => mountPanelModuleIntoElement(host, normalizedPanelType, vars, panelClass));

  ensurePanelEdgeSplitHandles(cell);
  console.log("✅ Loaded panel tab:", normalizedPanelType);
  return tab;
}

window.__nvOpenPanelTab = (cell, panelType, panelClass = "InfoPanel", panelVars = {}) => {
  const targetCell = resolvePanelCell(cell) || cell;
  if (!targetCell?.classList?.contains?.("panel-cell")) return null;
  const previousActiveCell = window.activeCell;
  window.activeCell = targetCell;
  const openPromise = loadPanelIntoCell(panelType, { ...panelVars, panelClass });
  return Promise.resolve(openPromise).finally(() => {
    if (!window.activeCell || window.activeCell === targetCell) window.activeCell = targetCell;
    else window.activeCell = previousActiveCell || targetCell;
  });
};

function shouldGuardToolbarEditorSwitch(detail, panelId, panelClass) {
  if (detail?.__nvGuardedEditorSwitch) return false;
  if (String(panelClass || "").toLowerCase() !== "editorpanel") return false;
  if (typeof window.__nvGuardEditorSwitch !== "function") return false;

  const currentId = normalizePanelIdentifier(window.activeCell?.dataset?.id || window.activePanel || "") || "";
  const activeTab = getActivePanelTab(resolvePanelCell(window.activeCell));
  const nextPath = normalizeNotebookPath(detail?.panelVars?.filePath || detail?.filePath || "");
  const currentPath = normalizeNotebookPath(activeTab?.resourcePath || window.__nvCodeEditorActivePath || window.currentActiveFilePath || "");
  if (currentId === panelId && (!nextPath || nextPath === currentPath)) return false;
  return Boolean(window.NodevisionState?.fileIsDirty || window.__nvCodeEditorDirty);
}

function replayGuardedToolbarAction(detail = {}) {
  window.dispatchEvent(new CustomEvent("toolbarAction", {
    detail: { ...detail, __nvGuardedEditorSwitch: true },
  }));
}

// 🟣 Listen for toolbar events globally — replaces active cell with selected panel
window.addEventListener("toolbarAction", async (e) => {
  const { id, type, replaceActive, panelVars = {} } = e.detail || {};
  const normalizedId = normalizePanelIdentifier(id) || id;
  if (normalizedId !== id) {
    console.log(`🔁 toolbarAction alias: ${id} -> ${normalizedId}`);
  }
  const panelClass = type || "InfoPanel";
  if (shouldGuardToolbarEditorSwitch(e.detail, normalizedId, panelClass)) {
    const nextPath = resolveActiveFilePath(e.detail?.panelVars?.filePath || e.detail?.filePath);
    window.__nvGuardEditorSwitch(nextPath, () => replayGuardedToolbarAction(e.detail));
    return;
  }

  const activeCell = resolvePanelCell(window.activeCell);
  if (activeCell && (replaceActive || isEmptyOrPlaceholderPanelCell(activeCell))) {
    await replacePanelInCell(activeCell, normalizedId, panelClass, panelVars);
    console.log(`Replaced active panel with "${normalizedId}" (${panelClass})`);
    return;
  }

  // Default behavior: activate an exact tab identity match, or a legacy whole-cell panel.
  const existingMatch = findPanelTabMatch({ panelType: normalizedId, panelClass, panelVars });
  if (existingMatch) {
    existingMatch.cell.style.display = "flex";
    activatePanelTab(existingMatch.cell, existingMatch.tab.tabId, { announce: false });
    console.log("📌 Panel tab already exists, activated:", normalizedId);
    return;
  }

  const existingCell = document.querySelector("[data-id=\"" + normalizedId + "\"]");
  if (existingCell && !existingCell.__nvPanelTabs) {
    existingCell.style.display = "flex";
    activatePanelCell(existingCell, { announce: false });
    console.log("📌 Panel already exists, activated:", normalizedId);
    return;
  }

  // Otherwise, load into active cell
  if (!activeCell) {
    console.warn("No active cell selected to replace with toolbar panel.");
    return;
  }

  await replacePanelInCell(activeCell, normalizedId, panelClass, panelVars);
});

function serializableLayoutChildren(node) {
  return Array.from(node?.children || []).filter((child) =>
    child.classList?.contains("panel-row") || child.classList?.contains("panel-cell")
  );
}

function serializeWorkspaceNode(node) {
  if (!node) return null;
  if (node.classList?.contains("panel-row")) {
    const direction = node.dataset.direction || (node.dataset.isVertical === "1" ? "column" : "row");
    return {
      type: direction === "column" ? "vertical" : "row",
      direction,
      flex: node.style.flex || "",
      children: serializableLayoutChildren(node).map(serializeWorkspaceNode).filter(Boolean),
    };
  }
  if (node.classList?.contains("panel-cell")) {
    const tabState = serializePanelTabsForCell(node);
    const activeTab = getActivePanelTab(node);
    return {
      type: "cell",
      id: node.dataset.panelId || node.dataset.id || "Panel",
      panelType: activeTab?.panelType || node.dataset.id || node.dataset.panelId || "Panel",
      panelClass: activeTab?.panelClass || node.dataset.panelClass || "InfoPanel",
      flex: node.style.flex || "",
      tabOrientation: tabState?.tabOrientation || node.dataset.nvTabOrientation || "top",
      ...(tabState || {}),
    };
  }
  return null;
}

export function serializeWorkspace(workspace) {
  const children = serializableLayoutChildren(workspace);
  if (children.length === 1) return serializeWorkspaceNode(children[0]);
  return {
    type: "row",
    direction: "column",
    children: children.map(serializeWorkspaceNode).filter(Boolean),
  };
}

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
  installPanelSplitModifierTracking();

  const activateHandler = (event) => {
    const cell = event?.target?.closest?.(".panel-cell");
    if (!cell) return;
    activatePanelCell(cell);
  };

  const splitGestureHandler = (event) => {
    updatePanelSplitModifierClass(event);
    if (!isPanelSplitGesture(event)) return;

    const divider = event?.target?.closest?.(".layout-divider, .divider");
    if (divider) return;

    const workspaceHandle = event?.target?.closest?.(`.${WORKSPACE_EDGE_SPLIT_HANDLE_CLASS}`);
    if (workspaceHandle) {
      const target = findWorkspaceOuterEdgeSplitTarget(event, workspaceHandle.dataset?.edge);
      if (!target) return;
      startPanelSplitDrag(target.cell, target.edge, event);
      return;
    }

    const handle = event?.target?.closest?.(`.${PANEL_EDGE_SPLIT_HANDLE_CLASS}`);
    const handleCell = handle?.closest?.(".panel-cell");
    if (handleCell) {
      const edge = handle.dataset?.edge;
      if (!edge) return;
      startPanelSplitDrag(handleCell, edge, event);
      return;
    }

    let cell = event?.target?.closest?.(".panel-cell");
    let edge = cell ? getPanelEdgeFromPointer(cell, event) : null;
    if (!cell || !edge) {
      const target = findWorkspaceOuterEdgeSplitTarget(event);
      if (!target) return;
      cell = target.cell;
      edge = target.edge;
    }
    startPanelSplitDrag(cell, edge, event);
  };

  document.addEventListener("pointerdown", splitGestureHandler, true);
  document.addEventListener("mousedown", (event) => {
    if (typeof PointerEvent === "function") return;
    splitGestureHandler(event);
  }, true);
  document.addEventListener("click", activateHandler, true);
}

// Initialize tracking when module loads
setupActivePanelTracking();
