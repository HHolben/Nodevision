// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/tableToolsParts/MergeCellOrigins.mjs
// This module implements merge Cell Origins behavior for the tableTools feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { collectOriginsInRect, originIsInsideRect, sortOriginsByVisualPosition, appendMergedCellContent, setCellSpan, buildTableGrid, selectedOriginsInTable, makeEmptyCellLike } from "./ReadCellSpan.mjs";
import { getTableEditorRoot } from "./IsEditableTableRoot.mjs";
import { readEditorHtml, recordTableEditorMutation } from "../TableProgrammaticHistory.mjs";
import { focusCell, getActiveTableCell } from "./ExpandRectToWholeCellSpans.mjs";

// Merge Cell Origins operations.
export function mergeCellOrigins(model, origins, {
  requireExactSet = true
} = {}) {
  const unique = [];
  const selected = new Set();
  origins.forEach(origin => {
    if (!origin?.cell || selected.has(origin.cell)) return;
    selected.add(origin.cell);
    unique.push(origin);
  });
  if (unique.length < 2) return false;
  const top = Math.min(...unique.map(origin => origin.rowIndex));
  const left = Math.min(...unique.map(origin => origin.colIndex));
  const bottom = Math.max(...unique.map(origin => origin.rowIndex + origin.rowSpan));
  const right = Math.max(...unique.map(origin => origin.colIndex + origin.colSpan));
  const rectOrigins = collectOriginsInRect(model, top, left, bottom, right);
  if (!rectOrigins) return false;
  if (!rectOrigins.every(origin => originIsInsideRect(origin, top, left, bottom, right))) return false;
  if (new Set(rectOrigins.map(origin => origin.row?.parentElement || null)).size > 1) return false;
  if (requireExactSet && (rectOrigins.length !== unique.length || rectOrigins.some(origin => !selected.has(origin.cell)))) return false;
  const wysiwyg = getTableEditorRoot();
  const beforeHtml = readEditorHtml(wysiwyg);
  const sorted = sortOriginsByVisualPosition(rectOrigins);
  const anchor = sorted.find(origin => origin.rowIndex === top && origin.colIndex === left) || sorted[0];
  const anchorCell = anchor.cell;
  sorted.forEach(origin => {
    if (origin.cell !== anchorCell) appendMergedCellContent(anchorCell, origin.cell);
  });
  sorted.forEach(origin => {
    if (origin.cell !== anchorCell) origin.cell.remove();
  });
  setCellSpan(anchorCell, "rowspan", bottom - top);
  setCellSpan(anchorCell, "colspan", right - left);
  focusCell(anchorCell);
  recordTableEditorMutation(wysiwyg, beforeHtml);
  return true;
}

export function adjacentOriginForMerge(origin, direction, model) {
  if (direction === "down") {
    const candidate = model.grid[origin.rowIndex + origin.rowSpan]?.[origin.colIndex] || null;
    return candidate && candidate.cell !== origin.cell ? candidate : null;
  }
  const candidate = model.grid[origin.rowIndex]?.[origin.colIndex + origin.colSpan] || null;
  return candidate && candidate.cell !== origin.cell ? candidate : null;
}

export function firstActualCellAtOrAfter(model, row, minCol) {
  return Array.from(row?.cells || []).find(cell => {
    const origin = model.origins.get(cell);
    return origin && origin.row === row && origin.colIndex >= minCol;
  }) || null;
}

export function mergeActiveTableCell(direction = "right") {
  const cell = getActiveTableCell();
  const table = cell?.closest("table");
  if (!cell || !table) return false;
  const model = buildTableGrid(table);
  const origin = model.origins.get(cell);
  if (!origin) return false;
  const target = adjacentOriginForMerge(origin, direction, model);
  if (!target) return false;
  return mergeCellOrigins(model, [origin, target], {
    requireExactSet: true
  });
}

export function mergeSelectedTableCells() {
  const cell = getActiveTableCell();
  const table = cell?.closest("table");
  if (!cell || !table) return false;
  const model = buildTableGrid(table);
  const selectedOrigins = selectedOriginsInTable(table, model);
  if (selectedOrigins.length > 1) return mergeCellOrigins(model, selectedOrigins, {
    requireExactSet: true
  });
  return mergeActiveTableCell("right") || mergeActiveTableCell("down");
}

export function splitMergedTableCell(cell, origin, model) {
  setCellSpan(cell, "rowspan", 1);
  setCellSpan(cell, "colspan", 1);
  let insertAfter = cell;
  for (let colOffset = 1; colOffset < origin.colSpan; colOffset += 1) {
    const newCell = makeEmptyCellLike(cell);
    origin.row.insertBefore(newCell, insertAfter.nextSibling);
    insertAfter = newCell;
  }
  for (let rowOffset = 1; rowOffset < origin.rowSpan; rowOffset += 1) {
    const row = model.rows[origin.rowIndex + rowOffset];
    if (!row) continue;
    const refCell = firstActualCellAtOrAfter(model, row, origin.colIndex + origin.colSpan);
    for (let colOffset = 0; colOffset < origin.colSpan; colOffset += 1) {
      row.insertBefore(makeEmptyCellLike(cell), refCell);
    }
  }
  return true;
}

export function expandPeerCellsForColumnSplit(model, origin, extraColumns) {
  const adjusted = new Set([origin.cell]);
  model.grid.forEach((rowGrid, rowIndex) => {
    if (rowIndex === origin.rowIndex) return;
    const peer = rowGrid?.[origin.colIndex] || null;
    if (!peer || adjusted.has(peer.cell)) return;
    setCellSpan(peer.cell, "colspan", peer.colSpan + extraColumns);
    adjusted.add(peer.cell);
  });
}

export function expandPeerCellsForRowSplit(model, origin, extraRows) {
  const adjusted = new Set([origin.cell]);
  const rowGrid = model.grid[origin.rowIndex] || [];
  rowGrid.forEach((peer, colIndex) => {
    const insideSplitCell = colIndex >= origin.colIndex && colIndex < origin.colIndex + origin.colSpan;
    if (insideSplitCell || !peer || adjusted.has(peer.cell)) return;
    setCellSpan(peer.cell, "rowspan", peer.rowSpan + extraRows);
    adjusted.add(peer.cell);
  });
}
