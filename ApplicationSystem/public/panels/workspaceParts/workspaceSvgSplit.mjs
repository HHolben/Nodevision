// Nodevision/ApplicationSystem/public/panels/workspaceParts/workspaceSvgSplit.mjs
// This module creates the specialized side-by-side SVG editor and layers-panel workspace split.

import { highlightActiveCell } from "./workspaceActivePanels.mjs";
import { makePanelCell } from "./workspaceCells.mjs";
import { rebuildLayoutDividersForContainer } from "./workspaceDividers.mjs";
import { createPanelRow, resolvePanelCell } from "./workspacePrimitives.mjs";

export function ensureSvgEditingSplit({ editorCell, layersPanelId = "SVGLayersPanel", layersPanelClass = "InfoPanel", editorFlex = "0 0 72%", layersFlex = "0 0 28%" } = {}) {
  const cell = resolvePanelCell(editorCell || window.activeCell);
  if (!cell || !cell.parentElement) return null;
  const parent = cell.parentElement;
  const hasExistingLayersSplit = parent.dataset?.nvSvgEditingSplit === "1" || Array.from(parent.children).filter((child) => child.classList?.contains?.("panel-cell")).some((child) => child.dataset?.id === layersPanelId);
  if (hasExistingLayersSplit) {
    const existingLayersCell = Array.from(parent.children).find((child) => child.classList?.contains?.("panel-cell") && child.dataset?.id === layersPanelId);
    if (existingLayersCell) return { splitContainer: parent, editorCell: cell, layersCell: existingLayersCell, didCreate: false };
  }
  const splitContainer = createPanelRow("row", cell.style.flex || "1 1 0");
  splitContainer.dataset.nvSvgEditingSplit = "1";
  parent.replaceChild(splitContainer, cell);
  Object.assign(cell.style, { flex: editorFlex, minHeight: "0", minWidth: "0" });
  splitContainer.appendChild(cell);
  const layersCell = makePanelCell(layersFlex);
  layersCell.dataset.id = layersPanelId;
  layersCell.dataset.panelClass = layersPanelClass;
  splitContainer.appendChild(layersCell);
  rebuildLayoutDividersForContainer(splitContainer, false);
  rebuildLayoutDividersForContainer(parent);
  window.activeCell = cell;
  highlightActiveCell(cell);
  return { splitContainer, editorCell: cell, layersCell, didCreate: true };
}
