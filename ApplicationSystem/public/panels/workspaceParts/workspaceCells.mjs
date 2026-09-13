// Nodevision/ApplicationSystem/public/panels/workspaceParts/workspaceCells.mjs
// This module creates Nodevision workspace cells and top-level rows while applying shared panel styling and edge split handles.

import { ensurePanelEdgeSplitHandles, ensureWorkspaceEdgeSplitHandles } from "./workspaceEdgeHandles.mjs";
import { createDivider } from "./workspaceDividers.mjs";

export function makePanelCell(flexValue = "1 1 0") {
  const cell = document.createElement("div");
  cell.className = "panel-cell";
  Object.assign(cell.style, {
    border: "1px solid #bbb", background: "#fafafa", overflow: "auto", flex: flexValue,
    display: "flex", flexDirection: "column", position: "relative", minHeight: "0", minWidth: "0",
  });
  ensurePanelEdgeSplitHandles(cell);
  return cell;
}

export function ensureWorkspace() {
  let workspace = document.getElementById("workspace");
  if (!workspace) {
    workspace = document.createElement("div");
    workspace.id = "workspace";
    document.body.appendChild(workspace);
  }
  Object.assign(workspace.style, { display: "flex", flexDirection: "column", flex: "1 1 auto", minHeight: "0", overflow: "hidden", position: "relative" });
  ensureWorkspaceEdgeSplitHandles(workspace);
  return workspace;
}

export function ensureTopRow(workspace) {
  let topRow = workspace.querySelector(".panel-row");
  if (!topRow) {
    topRow = document.createElement("div");
    topRow.className = "panel-row";
    Object.assign(topRow.style, { display: "flex", gap: "0px", marginBottom: "4px", borderBottom: "4px solid #ddd", overflow: "hidden", flex: "1 1 auto" });
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
    border: "1px solid #bbb", background: "#fafafa", overflow: "auto", flex: "1 1 0",
    display: "flex", flexDirection: "column", position: "relative", userSelect: "none",
  });
  row.appendChild(cell);
  ensurePanelEdgeSplitHandles(cell);
  if (row.children.length > 1) {
    const divider = createDivider(row.children[row.children.length - 2], cell);
    row.insertBefore(divider, cell);
  }
  return cell;
}
