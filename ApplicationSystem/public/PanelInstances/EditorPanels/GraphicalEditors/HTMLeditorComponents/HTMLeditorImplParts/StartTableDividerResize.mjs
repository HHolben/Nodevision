// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/StartTableDividerResize.mjs
// This module implements start Table Divider Resize behavior for the HTMLeditorImpl feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { setActiveTableCell } from "/ToolbarCallbacks/insert/tableTools.mjs";
import { updateToolbarState } from "../../../../../panels/createToolbar.mjs";
import { setTableDividerResizeCursor, getTableColumnDividerClientX, getClientToLayoutScale, measureTableRowHeight, getTableRowDividerClientY, resolveTableDividerResizeHit } from "./MeasureTableRowHeight.mjs";
import { freezeTableColumnWidths, getTableColumnCount, measureTableColumnWidth } from "./MarkHtmlEditorNativeInputDirty.mjs";
import { HTML_TABLE_MIN_COLUMN_WIDTH, HTML_TABLE_MIN_ROW_HEIGHT, markHtmlEditorDirty, HTML_TABLE_SELECTION_EDGE_PX } from "./EnsureHTMLLayoutStyles.mjs";
import { createCanvasItemMoveHandler } from "./CreateCanvasItemMoveHandler.mjs";

// Start Table Divider Resize operations.
export function startTableDividerResize(wysiwyg, filePath, hit, startEvent) {
  if (!hit?.table || !wysiwyg) return;
  const table = hit.table;
  const rows = Array.from(table.rows || []);
  const startX = startEvent.clientX;
  const startY = startEvent.clientY;
  const tableStartRect = table.getBoundingClientRect?.();
  const previousUserSelect = document.body.style.userSelect;
  let moved = false;
  setActiveTableCell(hit.cell);
  updateToolbarState({
    htmlTableSelected: true
  });
  setTableDividerResizeCursor(wysiwyg, hit, true);
  document.body.style.userSelect = "none";
  let resizeState = null;
  if (hit.kind === "column") {
    freezeTableColumnWidths(table);
    const columnCount = getTableColumnCount(table);
    const leftIndex = Math.max(0, Math.min(hit.index, columnCount - 1));
    const rightIndex = leftIndex + 1 < columnCount ? leftIndex + 1 : null;
    const leftStart = measureTableColumnWidth(table, leftIndex);
    const rightStart = rightIndex !== null ? measureTableColumnWidth(table, rightIndex) : 0;
    resizeState = {
      kind: "column",
      leftIndex,
      rightIndex,
      leftStart,
      rightStart,
      total: leftStart + rightStart,
      tableStartWidth: Math.max(HTML_TABLE_MIN_COLUMN_WIDTH, Math.round(table.offsetWidth || tableStartRect?.width || leftStart)),
      dividerStartClientX: getTableColumnDividerClientX(table, leftIndex, hit.edgeClientX ?? startX),
      clientToLayoutX: getClientToLayoutScale(table, "x")
    };
  } else {
    const topIndex = Math.max(0, Math.min(hit.index, rows.length - 1));
    const bottomIndex = topIndex + 1 < rows.length ? topIndex + 1 : null;
    const topRow = rows[topIndex] || null;
    const bottomRow = bottomIndex !== null ? rows[bottomIndex] : null;
    const topStart = measureTableRowHeight(topRow);
    const bottomStart = bottomRow ? measureTableRowHeight(bottomRow) : 0;
    resizeState = {
      kind: "row",
      topRow,
      bottomRow,
      topStart,
      bottomStart,
      total: topStart + bottomStart,
      tableStartHeight: Math.max(HTML_TABLE_MIN_ROW_HEIGHT, Math.round(table.offsetHeight || tableStartRect?.height || topStart)),
      dividerStartClientY: getTableRowDividerClientY(rows, topIndex, hit.edgeClientY ?? startY),
      clientToLayoutY: getClientToLayoutScale(table, "y")
    };
  }
  const onMove = createCanvasItemMoveHandler({
    get resizeState() {
      return resizeState;
    },
    set resizeState(value) {
      resizeState = value;
    },
    get startX() {
      return startX;
    },
    get startY() {
      return startY;
    },
    get table() {
      return table;
    }
  });
  const finish = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", finish);
    window.removeEventListener("pointercancel", finish);
    document.body.style.userSelect = previousUserSelect;
    setTableDividerResizeCursor(wysiwyg, null);
    if (moved) markHtmlEditorDirty(wysiwyg, filePath);
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", finish);
  window.addEventListener("pointercancel", finish);
}

export function registerTableDividerResizing(wysiwyg, filePath = "") {
  if (!wysiwyg) return () => {};
  const onPointerMove = event => {
    setTableDividerResizeCursor(wysiwyg, resolveTableDividerResizeHit(wysiwyg, event));
  };
  const onPointerLeave = () => setTableDividerResizeCursor(wysiwyg, null);
  const onPointerDown = event => {
    if (event.button !== 0) return;
    const hit = resolveTableDividerResizeHit(wysiwyg, event);
    if (!hit) return;
    event.preventDefault();
    event.stopPropagation();
    startTableDividerResize(wysiwyg, filePath, hit, event);
  };
  wysiwyg.addEventListener("pointermove", onPointerMove);
  wysiwyg.addEventListener("pointerleave", onPointerLeave);
  wysiwyg.addEventListener("pointerdown", onPointerDown, true);
  return () => {
    wysiwyg.removeEventListener("pointermove", onPointerMove);
    wysiwyg.removeEventListener("pointerleave", onPointerLeave);
    wysiwyg.removeEventListener("pointerdown", onPointerDown, true);
    setTableDividerResizeCursor(wysiwyg, null);
  };
}

export function tableDragSelectionClassForMode(mode) {
  if (mode === "columns") return "nv-table-column-selecting";
  if (mode === "rows") return "nv-table-row-selecting";
  return "nv-table-cell-selecting";
}

export function clearTableDragSelectionClass(wysiwyg) {
  wysiwyg?.classList?.remove?.("nv-table-cell-selecting", "nv-table-column-selecting", "nv-table-row-selecting");
}

export function resolveTableDragSelectionMode(wysiwyg, cell, event) {
  const table = cell?.closest?.("table") || null;
  const row = cell?.parentElement || null;
  if (!wysiwyg || !table || !row || !event) return "cells";
  const firstRow = table.rows?.[0] || null;
  const firstCellInRow = row.cells?.[0] || null;
  const cellRect = cell.getBoundingClientRect?.();
  const firstCellRect = firstCellInRow?.getBoundingClientRect?.();
  const inFirstColumnEdge = cell === firstCellInRow && firstCellRect && event.clientX >= firstCellRect.left && event.clientX - firstCellRect.left <= HTML_TABLE_SELECTION_EDGE_PX;
  if (inFirstColumnEdge) return "rows";
  const inFirstRowEdge = row === firstRow && cellRect && event.clientY >= cellRect.top && event.clientY - cellRect.top <= HTML_TABLE_SELECTION_EDGE_PX;
  if (inFirstRowEdge) return "columns";
  return "cells";
}
