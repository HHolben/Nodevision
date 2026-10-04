// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/tableToolsParts/InsertTableAtCaret.mjs
// This module implements insert Table At Caret behavior for the tableTools feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { getTableEditorRoot, getActiveGridTableContext, setActiveTableCell } from "./IsEditableTableRoot.mjs";
import { readEditorHtml, recordTableEditorMutation } from "../TableProgrammaticHistory.mjs";
import { copyCellStyle } from "./SplitOrdinaryTableCell.mjs";
import { focusCell, getActiveTableCell } from "./ExpandRectToWholeCellSpans.mjs";
import { updateToolbarState } from "/panels/createToolbar.mjs";

// Insert Table At Caret operations.
export function insertTableAtCaret(rows = 3, cols = 3) {
  const wysiwyg = getTableEditorRoot();
  if (!wysiwyg) {
    alert("Open an HTML document to insert a table.");
    return false;
  }
  const rowCount = Math.max(1, Number.parseInt(rows, 10) || 3);
  const colCount = Math.max(1, Number.parseInt(cols, 10) || 3);
  const beforeHtml = readEditorHtml(wysiwyg);
  const table = document.createElement("table");
  table.style.borderCollapse = "collapse";
  table.style.margin = "8px 0";
  table.style.width = "auto";
  for (let r = 0; r < rowCount; r += 1) {
    const tr = document.createElement("tr");
    for (let c = 0; c < colCount; c += 1) {
      const cell = document.createElement("td");
      copyCellStyle(cell, null);
      tr.appendChild(cell);
    }
    table.appendChild(tr);
  }
  const sel = window.getSelection?.();
  const range = sel?.rangeCount ? sel.getRangeAt(0) : null;
  if (range && wysiwyg.contains(range.commonAncestorContainer)) {
    range.deleteContents();
    range.insertNode(table);
  } else {
    wysiwyg.appendChild(table);
  }
  focusCell(table.querySelector("td, th"));
  recordTableEditorMutation(wysiwyg, beforeHtml);
  return true;
}

export function insertTableRow(direction) {
  const gridContext = getActiveGridTableContext();
  if (gridContext?.insertRow?.(direction)) return true;
  const cell = getActiveTableCell();
  const row = cell?.parentElement;
  if (!cell || !row) return false;
  const refIndex = cell.cellIndex;
  const wysiwyg = getTableEditorRoot();
  const beforeHtml = readEditorHtml(wysiwyg);
  const newRow = document.createElement("tr");
  const sourceCells = Array.from(row.cells);
  const columnCount = Math.max(1, sourceCells.length);
  for (let i = 0; i < columnCount; i += 1) {
    const source = sourceCells[i];
    const newCell = document.createElement(source?.tagName || "TD");
    copyCellStyle(newCell, source);
    newRow.appendChild(newCell);
  }
  if (direction === "above") row.before(newRow);else row.after(newRow);
  focusCell(newRow.cells[Math.max(0, refIndex)] || newRow.cells[0]);
  recordTableEditorMutation(wysiwyg, beforeHtml);
  return true;
}

export function deleteCurrentTableRow() {
  const gridContext = getActiveGridTableContext();
  if (gridContext?.deleteRow?.()) return true;
  const cell = getActiveTableCell();
  const row = cell?.parentElement;
  const table = cell?.closest("table");
  if (!cell || !row || !table) return false;
  const rowIndex = row.rowIndex;
  const wysiwyg = getTableEditorRoot();
  const beforeHtml = readEditorHtml(wysiwyg);
  row.remove();
  const nextRow = table.rows[Math.min(rowIndex, table.rows.length - 1)] || null;
  const nextCell = nextRow?.cells[Math.min(cell.cellIndex, Math.max(0, nextRow.cells.length - 1))] || null;
  if (nextCell) focusCell(nextCell);else {
    setActiveTableCell(null);
    updateToolbarState({
      htmlTableSelected: false
    });
  }
  recordTableEditorMutation(wysiwyg, beforeHtml);
  return true;
}

export function deleteCurrentTableColumn() {
  const gridContext = getActiveGridTableContext();
  if (gridContext?.deleteColumn?.()) return true;
  const cell = getActiveTableCell();
  const table = cell?.closest("table");
  if (!cell || !table) return false;
  const colIndex = cell.cellIndex;
  const wysiwyg = getTableEditorRoot();
  const beforeHtml = readEditorHtml(wysiwyg);
  let nextCell = null;
  for (const row of Array.from(table.rows)) {
    const removed = row.cells[colIndex];
    if (!removed) continue;
    const candidate = row === cell.parentElement ? row.cells[colIndex + 1] || row.cells[colIndex - 1] || null : null;
    removed.remove();
    if (candidate && candidate.isConnected) nextCell = candidate;
    if (!nextCell && row === cell.parentElement) {
      nextCell = row.cells[Math.min(colIndex, Math.max(0, row.cells.length - 1))] || null;
    }
  }
  if (nextCell) focusCell(nextCell);else {
    setActiveTableCell(null);
    updateToolbarState({
      htmlTableSelected: false
    });
  }
  recordTableEditorMutation(wysiwyg, beforeHtml);
  return true;
}

export function insertTableColumn(direction) {
  const gridContext = getActiveGridTableContext();
  if (gridContext?.insertColumn?.(direction)) return true;
  const cell = getActiveTableCell();
  const table = cell?.closest("table");
  if (!cell || !table) return false;
  const colIndex = cell.cellIndex;
  const wysiwyg = getTableEditorRoot();
  const beforeHtml = readEditorHtml(wysiwyg);
  for (const row of table.rows) {
    const refCell = row.cells[colIndex] || row.cells[row.cells.length - 1] || null;
    const newCell = document.createElement(refCell?.tagName || "TD");
    copyCellStyle(newCell, refCell);
    if (direction === "left") row.insertBefore(newCell, refCell);else row.insertBefore(newCell, refCell?.nextSibling || null);
    if (row === cell.parentElement) setActiveTableCell(newCell);
  }
  focusCell(getActiveTableCell());
  recordTableEditorMutation(wysiwyg, beforeHtml);
  return true;
}
