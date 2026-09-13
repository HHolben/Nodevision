// Nodevision/ApplicationSystem/public/panels/workspaceParts/workspaceAdjacentPanel.mjs
// This module finds or creates adjacent Nodevision workspace cells for companion panels such as inspectors and overlays.

import { panelCellLooksLikeEditor } from "./workspaceActiveFile.mjs";
import { ensurePanelEdgeSplitHandles } from "./workspaceEdgeHandles.mjs";
import { normalizePanelIdentifier, resolvePanelCell, setCellIdentity } from "./workspacePrimitives.mjs";
import { splitPanelCellFromEdge } from "./workspaceSplitActions.mjs";

function adjacentSiblingPanelCell(cell, edge = "right") {
  const parent = cell?.parentElement;
  if (!parent?.classList?.contains?.("panel-row")) return null;
  const direction = parent.dataset?.direction || (parent.dataset?.isVertical === "1" ? "column" : "row");
  const horizontal = edge === "left" || edge === "right";
  if ((horizontal && direction !== "row") || (!horizontal && direction !== "column")) return null;
  const cells = Array.from(parent.children).filter((child) => child.classList?.contains?.("panel-cell"));
  const index = cells.indexOf(cell);
  const offset = edge === "left" || edge === "top" ? -1 : 1;
  return index < 0 ? null : cells[index + offset] || null;
}

function cellContainsPanelTab(cell, panelType) {
  const normalizedType = normalizePanelIdentifier(panelType) || panelType;
  if (!cell || !normalizedType) return false;
  if (normalizePanelIdentifier(cell.dataset?.id || cell.dataset?.panelId) === normalizedType) return true;
  return Array.from(cell.__nvPanelTabs?.tabs || []).some((tab) => (normalizePanelIdentifier(tab.panelType || tab.panelId || tab.id) || tab.panelType || tab.panelId || tab.id) === normalizedType);
}

function findWorkspacePanelCell(panelType, excludeCell = null) {
  const normalizedType = normalizePanelIdentifier(panelType) || panelType;
  if (!normalizedType) return null;
  return Array.from(document.querySelectorAll(".panel-cell")).find((cell) => cell !== excludeCell && !cell.contains?.(excludeCell) && cellContainsPanelTab(cell, normalizedType)) || null;
}

export function ensureAdjacentPanelCell({ originCell = null, panelId = "InfoPanel", panelClass = "InfoPanel", edge = "right", splitPercent = 68, reuseExistingPanel = true, reuseAdjacentSibling = true } = {}) {
  const origin = resolvePanelCell(originCell || window.activeCell);
  if (!origin) return null;
  const normalizedPanelId = normalizePanelIdentifier(panelId) || panelId;
  if (reuseExistingPanel) {
    const existingPanelCell = findWorkspacePanelCell(normalizedPanelId, origin);
    if (existingPanelCell) {
      existingPanelCell.style.display = existingPanelCell.style.display || "flex";
      ensurePanelEdgeSplitHandles(existingPanelCell);
      return { cell: existingPanelCell, originCell: origin, didCreate: false, reused: "existing-panel" };
    }
  }
  if (reuseAdjacentSibling) {
    const sibling = adjacentSiblingPanelCell(origin, edge);
    if (sibling && !panelCellLooksLikeEditor(sibling)) {
      sibling.style.display = sibling.style.display || "flex";
      ensurePanelEdgeSplitHandles(sibling);
      return { cell: sibling, originCell: origin, didCreate: false, reused: "adjacent-sibling" };
    }
  }
  const split = splitPanelCellFromEdge(origin, edge, splitPercent);
  const cell = split?.newCell || null;
  if (!cell) return null;
  setCellIdentity(cell, { id: normalizedPanelId, panelClass, flex: cell.style.flex || null });
  ensurePanelEdgeSplitHandles(cell);
  return { cell, originCell: origin, didCreate: true, reused: "split", container: split.container || null };
}
