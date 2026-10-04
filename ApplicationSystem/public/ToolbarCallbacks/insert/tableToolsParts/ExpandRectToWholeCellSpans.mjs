// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/tableToolsParts/ExpandRectToWholeCellSpans.mjs
// This module implements expand Rect To Whole Cell Spans behavior for the tableTools feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { buildTableGrid, collectExistingOriginsInRect, sortOriginsByVisualPosition } from "./ReadCellSpan.mjs";
import { maxGridColumnCount, setSelectedTableCells, getTableEditorRoot, isCellInEditor, currentSelectionCell, setActiveTableCell, clearTableCellSelection } from "./IsEditableTableRoot.mjs";
import { updateToolbarState } from "/panels/createToolbar.mjs";

// Expand Rect To Whole Cell Spans operations.
export function expandRectToWholeCellSpans(model, rect) {
  let next = {
    ...rect
  };
  let changed = true;
  while (changed) {
    changed = false;
    for (let rowIndex = next.top; rowIndex < next.bottom; rowIndex += 1) {
      for (let colIndex = next.left; colIndex < next.right; colIndex += 1) {
        const origin = model.grid[rowIndex]?.[colIndex] || null;
        if (!origin) continue;
        const top = Math.min(next.top, origin.rowIndex);
        const left = Math.min(next.left, origin.colIndex);
        const bottom = Math.max(next.bottom, origin.rowIndex + origin.rowSpan);
        const right = Math.max(next.right, origin.colIndex + origin.colSpan);
        if (top !== next.top || left !== next.left || bottom !== next.bottom || right !== next.right) {
          next = {
            top,
            left,
            bottom,
            right
          };
          changed = true;
        }
      }
    }
  }
  return next;
}

export function selectTableCellRange(anchorCell, focusCell, options = {}) {
  const table = anchorCell?.closest?.("table") || null;
  if (!table || focusCell?.closest?.("table") !== table) return [];
  const model = buildTableGrid(table);
  const anchor = model.origins.get(anchorCell);
  const focus = model.origins.get(focusCell);
  if (!anchor || !focus) return [];
  const mode = options.mode || "cells";
  const maxColumns = maxGridColumnCount(model);
  let rect;
  if (mode === "rows") {
    rect = {
      top: Math.min(anchor.rowIndex, focus.rowIndex),
      left: 0,
      bottom: Math.max(anchor.rowIndex + anchor.rowSpan, focus.rowIndex + focus.rowSpan),
      right: maxColumns
    };
  } else if (mode === "columns") {
    rect = {
      top: 0,
      left: Math.min(anchor.colIndex, focus.colIndex),
      bottom: model.grid.length,
      right: Math.max(anchor.colIndex + anchor.colSpan, focus.colIndex + focus.colSpan)
    };
  } else {
    rect = {
      top: Math.min(anchor.rowIndex, focus.rowIndex),
      left: Math.min(anchor.colIndex, focus.colIndex),
      bottom: Math.max(anchor.rowIndex + anchor.rowSpan, focus.rowIndex + focus.rowSpan),
      right: Math.max(anchor.colIndex + anchor.colSpan, focus.colIndex + focus.colSpan)
    };
  }
  rect = expandRectToWholeCellSpans(model, rect);
  const origins = collectExistingOriginsInRect(model, rect.top, rect.left, rect.bottom, rect.right);
  const selectedCells = sortOriginsByVisualPosition(origins).map(origin => origin.cell);
  return setSelectedTableCells(selectedCells, {
    activeCell: focusCell,
    anchorCell,
    mode
  });
}

export function getActiveTableCell() {
  const wysiwyg = getTableEditorRoot();
  const saved = window.__nvHtmlTableActiveCell;
  if (isCellInEditor(saved, wysiwyg)) return saved;
  const selected = currentSelectionCell();
  if (selected) return setActiveTableCell(selected);
  return null;
}

export function focusTableCell(cell, {
  atEnd = false
} = {}) {
  if (!cell) return false;
  clearTableCellSelection({
    keepActive: true
  });
  const sel = window.getSelection?.();
  if (!sel) return false;
  const range = document.createRange();
  range.selectNodeContents(cell);
  range.collapse(!atEnd);
  sel.removeAllRanges();
  sel.addRange(range);
  try {
    cell.focus?.({
      preventScroll: true
    });
  } catch {
    cell.focus?.();
  }
  cell.scrollIntoView?.({
    block: "nearest",
    inline: "nearest"
  });
  setActiveTableCell(cell);
  updateToolbarState({
    htmlTableSelected: true
  });
  return true;
}

export function focusCell(cell) {
  return focusTableCell(cell);
}

export function notifyTableEditorInput(root) {
  if (!root) return;
  try {
    root.dispatchEvent(new Event("input", {
      bubbles: true
    }));
    return;
  } catch {}
  try {
    const event = document.createEvent("Event");
    event.initEvent("input", true, false);
    root.dispatchEvent(event);
  } catch {}
}
