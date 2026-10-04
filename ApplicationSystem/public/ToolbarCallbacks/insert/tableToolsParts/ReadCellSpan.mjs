// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/tableToolsParts/ReadCellSpan.mjs
// This module implements read Cell Span behavior for the tableTools feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { createForEachHandler } from "./CreateForEachHandler.mjs";
import { copyCellStyle } from "./SplitOrdinaryTableCell.mjs";
import { getSelectedTableCells } from "./IsEditableTableRoot.mjs";

// Read Cell Span operations.
export function readCellSpan(cell, attrName, rowIndex = 0, rowCount = 0) {
  const raw = Number.parseInt(cell?.getAttribute?.(attrName) || "", 10);
  if (attrName === "rowspan" && raw === 0) return Math.max(1, rowCount - rowIndex);
  if (Number.isFinite(raw) && raw > 1) return raw;
  const propertyName = attrName === "rowspan" ? "rowSpan" : "colSpan";
  const propertyValue = Number.parseInt(cell?.[propertyName] || 1, 10);
  return Number.isFinite(propertyValue) && propertyValue > 1 ? propertyValue : 1;
}

export function setCellSpan(cell, attrName, value) {
  const span = Math.max(1, Number.parseInt(value, 10) || 1);
  if (span > 1) cell.setAttribute(attrName, String(span));else cell.removeAttribute(attrName);
}

export function buildTableGrid(table) {
  const rows = Array.from(table?.rows || []);
  const grid = [];
  const origins = new Map();
  rows.forEach(createForEachHandler({
    get grid() {
      return grid;
    },
    get rows() {
      return rows;
    },
    get origins() {
      return origins;
    }
  }));
  return {
    table,
    rows,
    grid,
    origins
  };
}

export function originIsInsideRect(origin, top, left, bottom, right) {
  return origin.rowIndex >= top && origin.colIndex >= left && origin.rowIndex + origin.rowSpan <= bottom && origin.colIndex + origin.colSpan <= right;
}

export function collectOriginsInRect(model, top, left, bottom, right) {
  const seen = new Set();
  const origins = [];
  for (let rowIndex = top; rowIndex < bottom; rowIndex += 1) {
    for (let colIndex = left; colIndex < right; colIndex += 1) {
      const origin = model.grid[rowIndex]?.[colIndex] || null;
      if (!origin) return null;
      if (!seen.has(origin.cell)) {
        seen.add(origin.cell);
        origins.push(origin);
      }
    }
  }
  return origins;
}

export function collectExistingOriginsInRect(model, top, left, bottom, right) {
  const seen = new Set();
  const origins = [];
  for (let rowIndex = top; rowIndex < bottom; rowIndex += 1) {
    for (let colIndex = left; colIndex < right; colIndex += 1) {
      const origin = model.grid[rowIndex]?.[colIndex] || null;
      if (!origin || seen.has(origin.cell)) continue;
      seen.add(origin.cell);
      origins.push(origin);
    }
  }
  return origins;
}

export function sortOriginsByVisualPosition(origins = []) {
  return [...origins].sort((a, b) => a.rowIndex - b.rowIndex || a.colIndex - b.colIndex || Array.from(a.row?.cells || []).indexOf(a.cell) - Array.from(b.row?.cells || []).indexOf(b.cell));
}

export function tableCellHasContent(cell) {
  for (const node of Array.from(cell?.childNodes || [])) {
    if (node.nodeType === Node.TEXT_NODE && String(node.nodeValue || "").trim()) return true;
    if (node.nodeType === Node.ELEMENT_NODE && node.tagName !== "BR") return true;
  }
  return false;
}

export function appendMergedCellContent(anchor, source) {
  const anchorHasContent = tableCellHasContent(anchor);
  const sourceHasContent = tableCellHasContent(source);
  if (anchorHasContent && sourceHasContent) anchor.appendChild(document.createElement("br"));
  while (source.firstChild) anchor.appendChild(source.firstChild);
}

export function makeEmptyCellLike(source) {
  const cell = document.createElement(source?.tagName || "TD");
  copyCellStyle(cell, source);
  if (!cell.childNodes.length) cell.appendChild(document.createElement("br"));
  return cell;
}

export function rangeIntersectsNode(range, node) {
  try {
    return range.intersectsNode(node);
  } catch {
    return false;
  }
}

export function selectedOriginsInTable(table, model) {
  const selectedCells = getSelectedTableCells(table);
  if (selectedCells.length) {
    const seen = new Set();
    const origins = [];
    for (const cell of selectedCells) {
      const origin = model.origins.get(cell);
      if (!origin || seen.has(origin.cell)) continue;
      seen.add(origin.cell);
      origins.push(origin);
    }
    return origins;
  }
  const selection = window.getSelection?.();
  if (!selection || selection.isCollapsed || selection.rangeCount < 1) return [];
  const seen = new Set();
  const origins = [];
  const cells = Array.from(table.querySelectorAll("td, th"));
  for (let rangeIndex = 0; rangeIndex < selection.rangeCount; rangeIndex += 1) {
    const range = selection.getRangeAt(rangeIndex);
    cells.forEach(cell => {
      if (seen.has(cell) || !rangeIntersectsNode(range, cell)) return;
      const origin = model.origins.get(cell);
      if (!origin) return;
      seen.add(cell);
      origins.push(origin);
    });
  }
  return origins;
}
