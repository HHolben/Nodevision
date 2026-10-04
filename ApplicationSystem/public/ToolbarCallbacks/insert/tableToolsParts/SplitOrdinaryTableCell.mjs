// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/tableToolsParts/SplitOrdinaryTableCell.mjs
// This module implements split Ordinary Table Cell behavior for the tableTools feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { expandPeerCellsForRowSplit, expandPeerCellsForColumnSplit, splitMergedTableCell } from "./MergeCellOrigins.mjs";
import { makeEmptyCellLike, buildTableGrid } from "./ReadCellSpan.mjs";
import { getActiveTableCell, focusCell, notifyTableEditorInput, focusTableCell } from "./ExpandRectToWholeCellSpans.mjs";
import { getSelectedTableCells, getTableEditorRoot, closestCell, isCellInEditor, setActiveTableCell, getActiveGridTableContext } from "./IsEditableTableRoot.mjs";
import { readEditorHtml, recordTableEditorMutation } from "../TableProgrammaticHistory.mjs";

// Split Ordinary Table Cell operations.
export function splitOrdinaryTableCell(cell, origin, model, options = {}) {
  const direction = String(options.direction || options.mode || "columns").toLowerCase();
  const parts = Math.max(2, Math.min(12, Number.parseInt(options.parts || 2, 10) || 2));
  const extra = parts - 1;
  if (direction === "rows" || direction === "vertical") {
    expandPeerCellsForRowSplit(model, origin, extra);
    let insertAfter = origin.row;
    for (let index = 0; index < extra; index += 1) {
      const row = document.createElement("tr");
      row.appendChild(makeEmptyCellLike(cell));
      origin.row.parentElement.insertBefore(row, insertAfter.nextSibling);
      insertAfter = row;
    }
    return true;
  }
  expandPeerCellsForColumnSplit(model, origin, extra);
  let insertAfter = cell;
  for (let index = 0; index < extra; index += 1) {
    const newCell = makeEmptyCellLike(cell);
    origin.row.insertBefore(newCell, insertAfter.nextSibling);
    insertAfter = newCell;
  }
  return true;
}

export function splitCurrentTableCell(options = {}) {
  const cell = getActiveTableCell() || getSelectedTableCells()[0] || null;
  const table = cell?.closest("table");
  if (!cell || !table) return false;
  const model = buildTableGrid(table);
  const origin = model.origins.get(cell);
  if (!origin) return false;
  const wysiwyg = getTableEditorRoot();
  const beforeHtml = readEditorHtml(wysiwyg);
  const changed = origin.rowSpan === 1 && origin.colSpan === 1 ? splitOrdinaryTableCell(cell, origin, model, options) : splitMergedTableCell(cell, origin, model);
  if (!changed) return false;
  focusCell(cell);
  recordTableEditorMutation(wysiwyg, beforeHtml);
  notifyTableEditorInput(wysiwyg);
  return true;
}

export function cellFromKeyboardEvent(event) {
  const target = event?.target;
  if (target?.closest?.("input, textarea, select, button, a")) return null;
  const eventCell = closestCell(target);
  if (eventCell && isCellInEditor(eventCell)) return setActiveTableCell(eventCell);
  return getActiveTableCell();
}

export function adjacentCell(cell, direction) {
  const table = cell?.closest?.("table");
  if (!cell || !table) return null;
  const model = buildTableGrid(table);
  const origin = model.origins.get(cell);
  if (!origin) return null;
  if (direction === "left") {
    for (let colIndex = origin.colIndex - 1; colIndex >= 0; colIndex -= 1) {
      const candidate = model.grid[origin.rowIndex]?.[colIndex] || null;
      if (candidate && candidate.cell !== cell) return candidate.cell;
    }
    return null;
  }
  if (direction === "right") {
    const candidate = model.grid[origin.rowIndex]?.[origin.colIndex + origin.colSpan] || null;
    return candidate?.cell && candidate.cell !== cell ? candidate.cell : null;
  }
  if (direction === "up") {
    const candidate = model.grid[origin.rowIndex - 1]?.[origin.colIndex] || null;
    return candidate?.cell && candidate.cell !== cell ? candidate.cell : null;
  }
  if (direction === "down") {
    const candidate = model.grid[origin.rowIndex + origin.rowSpan]?.[origin.colIndex] || null;
    return candidate?.cell && candidate.cell !== cell ? candidate.cell : null;
  }
  return null;
}

export function moveActiveTableCell(direction, options = {}) {
  const gridContext = getActiveGridTableContext();
  if (gridContext?.moveActiveCell?.(direction, options)) return true;
  const cell = options.cell || getActiveTableCell();
  const target = adjacentCell(cell, direction);
  if (!target) return false;
  return focusTableCell(target, {
    atEnd: direction === "left"
  });
}

export function handleTableArrowKeyNavigation(event) {
  const keyToDirection = {
    ArrowLeft: "left",
    ArrowRight: "right",
    ArrowUp: "up",
    ArrowDown: "down"
  };
  const direction = keyToDirection[event?.key];
  if (!direction) return false;
  if (event.defaultPrevented || event.isComposing) return false;
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return false;
  const cell = cellFromKeyboardEvent(event);
  if (!cell) return false;
  if (!moveActiveTableCell(direction, {
    cell
  })) return false;
  event.preventDefault();
  return true;
}

export function copyCellStyle(target, source) {
  if (source?.getAttribute?.("style")) {
    target.setAttribute("style", source.getAttribute("style"));
  } else {
    target.style.border = "1px solid #444";
    target.style.padding = "6px 8px";
  }
  if (source?.isContentEditable || source?.getAttribute?.("contenteditable") === "true") {
    target.contentEditable = "true";
  }
  target.textContent = "";
}
