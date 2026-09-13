// Nodevision/ApplicationSystem/public/panels/workspaceParts/workspaceActiveTracking.mjs
// This module installs global pointer and click tracking for active panels and modifier-key panel splitting.

import { activatePanelCell, clearActivePanelSelection } from "./workspaceActivePanels.mjs";
import {
  PANEL_EDGE_SPLIT_HANDLE_CLASS,
  WORKSPACE_EDGE_SPLIT_HANDLE_CLASS,
  findWorkspaceOuterEdgeSplitTarget,
  getPanelEdgeFromPointer,
  installPanelSplitModifierTracking,
  isPanelSplitGesture,
  updatePanelSplitModifierClass,
} from "./workspaceEdgeHandles.mjs";
import { startPanelSplitDrag } from "./workspaceSplitActions.mjs";

export function setupActivePanelTracking() {
  if (window._activePanelTrackingSetup) return;
  window._activePanelTrackingSetup = true;
  installPanelSplitModifierTracking();
  const activateHandler = (event) => {
    const target = event?.target?.nodeType === 1 ? event.target : null;
    const cell = target?.closest?.(".panel-cell");
    if (cell) return activatePanelCell(cell);
    if (target?.closest?.("#workspace")) clearActivePanelSelection();
  };
  const splitGestureHandler = (event) => {
    updatePanelSplitModifierClass(event);
    if (!isPanelSplitGesture(event)) return;
    if (event?.target?.closest?.(".layout-divider, .divider")) return;
    const workspaceHandle = event?.target?.closest?.(`.${WORKSPACE_EDGE_SPLIT_HANDLE_CLASS}`);
    if (workspaceHandle) {
      const target = findWorkspaceOuterEdgeSplitTarget(event, workspaceHandle.dataset?.edge);
      if (target) startPanelSplitDrag(target.cell, target.edge, event);
      return;
    }
    const handle = event?.target?.closest?.(`.${PANEL_EDGE_SPLIT_HANDLE_CLASS}`);
    const handleCell = handle?.closest?.(".panel-cell");
    if (handleCell) {
      const edge = handle.dataset?.edge;
      if (edge) startPanelSplitDrag(handleCell, edge, event);
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
