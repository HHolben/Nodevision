// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/MeasureTableRowHeight.mjs
// This module implements measure Table Row Height behavior for the HTMLeditorImpl feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { HTML_TABLE_MIN_ROW_HEIGHT, HTML_TABLE_DIVIDER_HIT_PX } from "./EnsureHTMLLayoutStyles.mjs";
import { formatTableCssPixels, getTableColumnCells, getTableCellFromEditorTarget } from "./MarkHtmlEditorNativeInputDirty.mjs";

// Measure Table Row Height operations.
export function measureTableRowHeight(row) {
  const rect = row?.getBoundingClientRect?.();
  return Math.max(HTML_TABLE_MIN_ROW_HEIGHT, Math.round(row?.offsetHeight || rect?.height || HTML_TABLE_MIN_ROW_HEIGHT));
}

export function applyTableRowHeight(row, height) {
  if (!row) return;
  const px = formatTableCssPixels(height, HTML_TABLE_MIN_ROW_HEIGHT);
  row.style.height = px;
  for (const cell of Array.from(row.cells || [])) {
    cell.style.height = px;
    cell.style.boxSizing = "border-box";
  }
}

export function getClientToLayoutScale(element, axis) {
  const rect = element?.getBoundingClientRect?.();
  if (!rect) return 1;
  const rendered = axis === "y" ? rect.height : rect.width;
  const layout = axis === "y" ? element.offsetHeight : element.offsetWidth;
  if (!Number.isFinite(rendered) || rendered <= 0 || !Number.isFinite(layout) || layout <= 0) return 1;
  return layout / rendered;
}

export function getTableColumnDividerClientX(table, columnIndex, fallbackX) {
  const leftCell = getTableColumnCells(table, columnIndex)[0] || null;
  const leftRect = leftCell?.getBoundingClientRect?.();
  if (leftRect && Number.isFinite(leftRect.right)) return leftRect.right;
  const rightCell = getTableColumnCells(table, columnIndex + 1)[0] || null;
  const rightRect = rightCell?.getBoundingClientRect?.();
  if (rightRect && Number.isFinite(rightRect.left)) return rightRect.left;
  return fallbackX;
}

export function getTableRowDividerClientY(rows, rowIndex, fallbackY) {
  const topRect = rows[rowIndex]?.getBoundingClientRect?.();
  if (topRect && Number.isFinite(topRect.bottom)) return topRect.bottom;
  const bottomRect = rows[rowIndex + 1]?.getBoundingClientRect?.();
  if (bottomRect && Number.isFinite(bottomRect.top)) return bottomRect.top;
  return fallbackY;
}

export function resolveTableDividerResizeHit(wysiwyg, event) {
  if (!wysiwyg || !event) return null;
  const cell = getTableCellFromEditorTarget(wysiwyg, event.target);
  const table = cell?.closest?.("table") || null;
  if (!cell || !table || !wysiwyg.contains(table)) return null;
  const rect = cell.getBoundingClientRect?.();
  if (!rect || rect.width <= 0 || rect.height <= 0) return null;
  const rows = Array.from(table.rows || []);
  const row = cell.parentElement;
  const rowIndex = rows.indexOf(row);
  const columnIndex = cell.cellIndex;
  const hits = [];
  const left = Math.abs(event.clientX - rect.left);
  const right = Math.abs(event.clientX - rect.right);
  const top = Math.abs(event.clientY - rect.top);
  const bottom = Math.abs(event.clientY - rect.bottom);
  if (left <= HTML_TABLE_DIVIDER_HIT_PX && columnIndex > 0) {
    hits.push({
      kind: "column",
      index: columnIndex - 1,
      distance: left,
      edgeClientX: rect.left,
      cell,
      table
    });
  }
  if (right <= HTML_TABLE_DIVIDER_HIT_PX && columnIndex >= 0) {
    hits.push({
      kind: "column",
      index: columnIndex,
      distance: right,
      edgeClientX: rect.right,
      cell,
      table
    });
  }
  if (top <= HTML_TABLE_DIVIDER_HIT_PX && rowIndex > 0) {
    hits.push({
      kind: "row",
      index: rowIndex - 1,
      distance: top,
      edgeClientY: rect.top,
      cell,
      table
    });
  }
  if (bottom <= HTML_TABLE_DIVIDER_HIT_PX && rowIndex >= 0) {
    hits.push({
      kind: "row",
      index: rowIndex,
      distance: bottom,
      edgeClientY: rect.bottom,
      cell,
      table
    });
  }
  hits.sort((a, b) => a.distance - b.distance || (a.kind === "column" ? -1 : 1));
  return hits[0] || null;
}

export function setTableDividerResizeCursor(wysiwyg, hit = null, resizing = false) {
  if (!wysiwyg) return;
  wysiwyg.classList.remove("nv-table-divider-resize-col", "nv-table-divider-resize-row", "nv-table-divider-resizing", "nv-table-divider-resizing-col", "nv-table-divider-resizing-row");
  if (!hit) return;
  wysiwyg.classList.add(resizing ? "nv-table-divider-resizing" : `nv-table-divider-resize-${hit.kind === "column" ? "col" : "row"}`);
  if (resizing) wysiwyg.classList.add(`nv-table-divider-resizing-${hit.kind === "column" ? "col" : "row"}`);
}
