// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/CSVRangeModel.mjs
// This module defines rectangular CSV operations while preserving the distinction between declared empty fields and virtual cells.
import { cloneCsvRows, parseDelimitedText, serializeDelimitedRows } from "./CSVGridModel.mjs";

export function csvRange(anchor, active = anchor) {
  return { top: Math.min(anchor.row, active.row), left: Math.min(anchor.col, active.col),
    bottom: Math.max(anchor.row, active.row), right: Math.max(anchor.col, active.col) };
}
export function rangeContains(range, point) {
  return point.row >= range.top && point.row <= range.bottom && point.col >= range.left && point.col <= range.right;
}
export function captureCsvRange(rows, range) {
  return Array.from({ length: range.bottom - range.top + 1 }, (_, r) =>
    Array.from({ length: range.right - range.left + 1 }, (_, c) => rows[range.top + r]?.[range.left + c]));
}
export function copyCsvRange(rows, range) {
  return serializeDelimitedRows(captureCsvRange(rows, range), "\t");
}
export function clearCsvRange(rows, range) {
  const next = cloneCsvRows(rows);
  for (let r = range.top; r <= Math.min(range.bottom, next.length - 1); r++) {
    for (let c = range.left; c <= Math.min(range.right, next[r].length - 1); c++) next[r][c] = "";
  }
  return next;
}
export function writeCsvBlock(rows, origin, block) {
  const next = cloneCsvRows(rows);
  block.forEach((row, r) => row.forEach((value, c) => {
    const y = origin.row + r, x = origin.col + c;
    // Virtual source cells clear existing destinations but never declare new fields.
    if (value === undefined) {
      if (next[y] && x < next[y].length) next[y][x] = "";
      return;
    }
    while (next.length <= y) next.push([]);
    while (next[y].length <= x) next[y].push("");
    next[y][x] = value;
  }));
  return next;
}
export function moveCsvRange(rows, range, origin) {
  const captured = captureCsvRange(rows, range);
  return writeCsvBlock(clearCsvRange(rows, range), origin, captured);
}
export function parseCsvClipboard(text) {
  const rows = parseDelimitedText(text, "\t");
  const width = Math.max(...rows.map(row => row.length));
  // Explicit trailing tabs are declared fields. Ragged input is padded to a block.
  return rows.map(row => [...row, ...Array(width - row.length).fill("")]);
}
