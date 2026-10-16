// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/StartTableDividerResize.mjs
// This module implements start Table Divider Resize behavior for the HTMLeditorImpl feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { setActiveTableCell } from "/ToolbarCallbacks/insert/tableTools.mjs";
import { updateToolbarState } from "../../../../../panels/createToolbar.mjs";
import { setTableDividerResizeCursor, resolveTableDividerResizeHit } from "./MeasureTableRowHeight.mjs";
import { createTableResizeState } from "./TableResizeGeometry.mjs";
import { HTML_TABLE_SELECTION_EDGE_PX } from "./EnsureHTMLLayoutStyles.mjs";
import { createCanvasItemMoveHandler } from "./CreateCanvasItemMoveHandler.mjs";

// Start Table Divider Resize operations.
export function startTableDividerResize(wysiwyg, filePath, hit, startEvent) {
  if (!hit?.table || !wysiwyg) return () => {};
  const table = hit.table;
  const view = wysiwyg.ownerDocument.defaultView;
  const body = wysiwyg.ownerDocument.body;
  const pointerId = startEvent.pointerId;
  const previousUserSelect = body.style.userSelect;
  setActiveTableCell(hit.cell);
  updateToolbarState({ htmlTableSelected: true });
  const transactions = wysiwyg.__nvHtmlEditorContext.transactions;
  const transaction = transactions.begin("Resize table " + hit.kind);
  let resizeState;
  let finished = false;
  const onMove = createCanvasItemMoveHandler({
    get resizeState() { return resizeState; },
    startX: startEvent.clientX, startY: startEvent.clientY, pointerId,
    preview(mutate) {
      try {
        transaction.preview(mutate);
      } catch (error) { finish(null, true); throw error; }
    }
  });
  // Initialize lazily: a click on a divider must not rewrite authored sizing.
  const move = event => {
    if (event.pointerId !== pointerId) return;
    if (!table.isConnected || !transactions.pending) { finish(null, true); return; }
    if (!resizeState) {
      const delta = hit.kind === "column" ? event.clientX - startEvent.clientX : event.clientY - startEvent.clientY;
      if (Math.abs(delta) < 0.01) return;
      try { transaction.preview(() => { resizeState = createTableResizeState(table, hit); }); }
      catch (error) { finish(null, true); throw error; }
    }
    onMove(event);
  };
  const finish = (event, cancel = false) => {
    if (finished || (event?.pointerId !== undefined && event.pointerId !== pointerId)) return;
    finished = true;
    view.removeEventListener("pointermove", move, true);
    view.removeEventListener("pointerup", finish, true);
    view.removeEventListener("pointercancel", cancelDrag, true);
    view.removeEventListener("keydown", keydown, true);
    view.removeEventListener("blur", cancelDrag);
    wysiwyg.removeEventListener("lostpointercapture", cancelDrag);
    if (wysiwyg.hasPointerCapture?.(pointerId)) wysiwyg.releasePointerCapture(pointerId);
    body.style.userSelect = previousUserSelect;
    setTableDividerResizeCursor(wysiwyg, null);
    if (transactions.pending) {
      if (cancel) transaction.cancel({ focus: false });
      else transaction.commit();
    }
  };
  const cancelDrag = event => finish(event, true);
  const keydown = event => {
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); finish(null, true); }
  };
  setTableDividerResizeCursor(wysiwyg, hit, true);
  body.style.userSelect = "none";
  view.addEventListener("pointermove", move, true);
  view.addEventListener("pointerup", finish, true);
  view.addEventListener("pointercancel", cancelDrag, true);
  view.addEventListener("keydown", keydown, true);
  view.addEventListener("blur", cancelDrag);
  wysiwyg.addEventListener("lostpointercapture", cancelDrag);
  try { wysiwyg.setPointerCapture(pointerId); } catch { /* Window listeners also support synthetic input. */ }
  return () => finish(null, true);
}

export function registerTableDividerResizing(wysiwyg, filePath = "") {
  if (!wysiwyg) return () => {};
  let cancel = null;
  const active = () => wysiwyg.classList.contains("nv-table-divider-resizing");
  const onPointerMove = event => {
    if (!active()) setTableDividerResizeCursor(wysiwyg, resolveTableDividerResizeHit(wysiwyg, event));
  };
  const onPointerLeave = () => { if (!active()) setTableDividerResizeCursor(wysiwyg, null); };
  const onPointerDown = event => {
    if (event.button !== 0 || active()) return;
    const hit = resolveTableDividerResizeHit(wysiwyg, event);
    if (!hit) return;
    event.preventDefault();
    event.stopPropagation();
    cancel = startTableDividerResize(wysiwyg, filePath, hit, event);
  };
  wysiwyg.addEventListener("pointermove", onPointerMove);
  wysiwyg.addEventListener("pointerleave", onPointerLeave);
  wysiwyg.addEventListener("pointerdown", onPointerDown, true);
  return () => {
    cancel?.();
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
