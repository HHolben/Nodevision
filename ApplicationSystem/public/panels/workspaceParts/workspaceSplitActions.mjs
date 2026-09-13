// Nodevision/ApplicationSystem/public/panels/workspaceParts/workspaceSplitActions.mjs
// This module performs Nodevision panel edge splitting and split-drag previews for layout-control workflows.

import { setStatus } from "../../StatusBar.mjs";
import { activatePanelCell } from "./workspaceActivePanels.mjs";
import { makePanelCell } from "./workspaceCells.mjs";
import { configureDividerCallbacks, rebuildLayoutDividersForContainer } from "./workspaceDividers.mjs";
import {
  PANEL_EDGE_SPLIT_MIN_DRAG_PX,
  clampPanelSplitPercent,
  ensurePanelEdgeSplitHandles,
} from "./workspaceEdgeHandles.mjs";
import {
  collectPanelCells,
  createPanelRow,
  flexAllocationWeight,
  normalizeSiblingFlexAllocations,
  resolvePanelCell,
  setCellIdentity,
  setProportionalFlex,
} from "./workspacePrimitives.mjs";

function showLayoutControlsToolbar() {
  window.dispatchEvent(new CustomEvent("nv-show-subtoolbar", { detail: { heading: "Layout Controls", force: true, toggle: false } }));
}

function pickLayoutControlsCell(...elements) {
  const candidates = elements.flatMap((element) => collectPanelCells(element));
  const activeCell = resolvePanelCell(window.activeCell);
  return activeCell && candidates.includes(activeCell) ? activeCell : candidates[0] || null;
}

export function focusLayoutControlsForPanels(...elements) {
  const cell = pickLayoutControlsCell(...elements);
  if (cell) activatePanelCell(cell, { announce: false });
  showLayoutControlsToolbar();
  return cell;
}

function buildSplitCell(sourceCell, flex = "1 1 0") {
  const cell = makePanelCell(flex);
  const sourceId = sourceCell?.dataset?.id || sourceCell?.dataset?.panelId || "Panel";
  setCellIdentity(cell, { id: `${sourceId}Split`, panelClass: sourceCell?.dataset?.panelClass || "InfoPanel" });
  const placeholder = document.createElement("div");
  placeholder.className = "panel-split-placeholder";
  placeholder.textContent = "New panel";
  Object.assign(placeholder.style, { margin: "auto", padding: "0.65rem 0.9rem", border: "1px dashed rgba(0, 0, 0, 0.28)", borderRadius: "8px", color: "rgba(0, 0, 0, 0.58)", font: "13px system-ui, sans-serif", pointerEvents: "none", userSelect: "none" });
  cell.appendChild(placeholder);
  ensurePanelEdgeSplitHandles(cell);
  return cell;
}

function insertSplitCellInParent(cell, newCell, direction, edge, splitPercent) {
  const parent = cell?.parentElement;
  if (!parent) return null;
  const placeBefore = edge === "left" || edge === "top";
  const newShare = (placeBefore ? splitPercent : 100 - splitPercent) / 100;
  const existingShare = 1 - newShare;
  const targetWeight = flexAllocationWeight(cell, direction);
  if (parent.classList?.contains?.("panel-row") && parent.dataset?.direction === direction) {
    normalizeSiblingFlexAllocations(parent, direction);
    setProportionalFlex(cell, targetWeight * existingShare);
    setProportionalFlex(newCell, targetWeight * newShare);
    parent.insertBefore(newCell, placeBefore ? cell : cell.nextSibling);
    rebuildLayoutDividersForContainer(parent, direction === "column");
    return parent;
  }
  const originalFlex = cell.style.flex || "1 1 0";
  const wrapper = createPanelRow(direction, originalFlex);
  parent.replaceChild(wrapper, cell);
  setProportionalFlex(cell, existingShare * 100);
  setProportionalFlex(newCell, newShare * 100);
  if (placeBefore) wrapper.append(newCell, cell);
  else wrapper.append(cell, newCell);
  rebuildLayoutDividersForContainer(wrapper, direction === "column");
  rebuildLayoutDividersForContainer(parent);
  return wrapper;
}

export function splitPanelCellFromEdge(cell, edge, splitPercent = 50) {
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
  Object.assign(ghost.style, { position: "fixed", pointerEvents: "none", zIndex: "10000", background: "rgba(74, 144, 226, 0.92)", boxShadow: "0 0 0 2px rgba(255, 255, 255, 0.85), 0 0 12px rgba(74, 144, 226, 0.55)", ...(direction === "column" ? { height: "6px" } : { width: "6px" }) });
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

export function startPanelSplitDrag(cell, edge, event) {
  if (!cell || !edge) return;
  event.preventDefault();
  event.stopPropagation();
  focusLayoutControlsForPanels(cell);
  const direction = edge === "top" || edge === "bottom" ? "column" : "row";
  const startX = event.clientX;
  const startY = event.clientY;
  const rect = cell.getBoundingClientRect();
  const ghost = createSplitGhost(direction);
  const activePointerId = event.pointerId !== undefined ? event.pointerId : null;
  const moveEventName = activePointerId !== null ? "pointermove" : "mousemove";
  const upEventName = activePointerId !== null ? "pointerup" : "mouseup";
  const cancelEventName = activePointerId !== null ? "pointercancel" : null;
  positionSplitGhost(ghost, cell, direction, event);
  try { if (activePointerId !== null) cell.setPointerCapture?.(event.pointerId); } catch {}
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
    try { if (activePointerId !== null) cell.releasePointerCapture?.(activePointerId); } catch {}
    const endX = Number(upEvent?.clientX);
    const endY = Number(upEvent?.clientY);
    if (upEvent?.type === "pointercancel" || !Number.isFinite(endX) || !Number.isFinite(endY)) return;
    if (Math.hypot(endX - startX, endY - startY) < PANEL_EDGE_SPLIT_MIN_DRAG_PX) return;
    const rawPercent = direction === "column" ? ((endY - rect.top) / Math.max(rect.height, 1)) * 100 : ((endX - rect.left) / Math.max(rect.width, 1)) * 100;
    splitPanelCellFromEdge(cell, edge, rawPercent);
  };
  document.addEventListener(moveEventName, onMove, true);
  document.addEventListener(upEventName, finish, true);
  if (cancelEventName) document.addEventListener(cancelEventName, finish, true);
}

configureDividerCallbacks({ focusLayoutControlsForPanels, startPanelSplitDrag });
