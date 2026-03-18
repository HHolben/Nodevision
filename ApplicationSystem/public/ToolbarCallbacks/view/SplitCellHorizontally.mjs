// Nodevision/ApplicationSystem/public/ToolbarCallbacks/view/SplitCellHorizontally.mjs
// This file defines browser-side Split Cell Horizontally logic for the Nodevision UI. It renders interface components and handles user interactions.

import { rebuildLayoutDividersForContainer } from "/panels/workspace.mjs";
import { showInputDialog } from "/ui/modals/InputDialog.mjs";

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

function resolveActiveCell() {
  const candidate = window.activeCell;
  if (candidate?.classList?.contains("panel-cell")) return candidate;
  const fromDom = candidate?.closest?.(".panel-cell");
  if (fromDom) return fromDom;
  return document.querySelector(".panel-cell.active-panel") || null;
}

async function requestSplitCount() {
  const value = await showInputDialog({
    title: "Split cell",
    description: "How many columns?",
    inputType: "number",
    defaultValue: "2",
    placeholder: "2",
    allowEmpty: false,
    emptyMessage: "Enter a number (2 or more).",
    validator: (raw) => {
      const n = Number.parseInt(String(raw || ""), 10);
      if (!Number.isFinite(n) || n < 2) return false;
      if (n > 6) return false;
      return true;
    },
    invalidMessage: "Enter an integer between 2 and 6.",
  });
  if (value == null) return null;
  const n = Number.parseInt(String(value), 10);
  return Number.isFinite(n) ? n : null;
}

export async function splitCellHorizontally() {
  const cell = resolveActiveCell();
  if (!cell) {
    console.warn("No active cell to split.");
    alert("Please click on a cell first.");
    return;
  }

  const num = await requestSplitCount();
  if (!num) return;

  const parent = cell.parentElement;
  if (!parent) return;

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

  parent.replaceChild(splitContainer, cell);

  Object.assign(cell.style, {
    flex: `1 1 ${100 / num}%`,
    minHeight: "0",
    minWidth: "0",
  });
  splitContainer.appendChild(cell);

  for (let i = 1; i < num; i += 1) {
    splitContainer.appendChild(makePanelCell(`1 1 ${100 / num}%`));
  }

  rebuildLayoutDividersForContainer(splitContainer, false);
  rebuildLayoutDividersForContainer(parent);

  window.activeCell = cell;
  window.highlightActiveCell?.(cell);
}

// Default export for toolbar system
export default async function run() {
  await splitCellHorizontally();
}
