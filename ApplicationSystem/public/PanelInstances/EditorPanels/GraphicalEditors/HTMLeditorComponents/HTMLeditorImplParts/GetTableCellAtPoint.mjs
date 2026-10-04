// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/GetTableCellAtPoint.mjs
// This module implements get Table Cell At Point behavior for the HTMLeditorImpl feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { getTableCellFromEditorTarget } from "./MarkHtmlEditorNativeInputDirty.mjs";
import { clearTableDragSelectionClass, tableDragSelectionClassForMode } from "./StartTableDividerResize.mjs";
import { selectTableCellRange, clearTableCellSelection } from "/ToolbarCallbacks/insert/tableTools.mjs";
import { HTML_TABLE_SELECTION_DRAG_THRESHOLD_PX } from "./EnsureHTMLLayoutStyles.mjs";
import { createOnPointerDownHandler } from "./CreateCanvasItemMoveHandler.mjs";

// Get Table Cell At Point operations.
export function getTableCellAtPoint(wysiwyg, table, clientX, clientY) {
  if (!wysiwyg || !table) return null;
  const elementAtPoint = document.elementFromPoint?.(clientX, clientY) || null;
  const pointedCell = getTableCellFromEditorTarget(wysiwyg, elementAtPoint);
  if (pointedCell?.closest?.("table") === table) return pointedCell;
  const tableRect = table.getBoundingClientRect?.();
  if (!tableRect || clientX < tableRect.left || clientX > tableRect.right || clientY < tableRect.top || clientY > tableRect.bottom) {
    return null;
  }
  let nearest = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const cell of Array.from(table.querySelectorAll("td, th"))) {
    const rect = cell.getBoundingClientRect?.();
    if (!rect) continue;
    const x = Math.max(rect.left, Math.min(clientX, rect.right));
    const y = Math.max(rect.top, Math.min(clientY, rect.bottom));
    const distance = Math.hypot(clientX - x, clientY - y);
    if (distance < nearestDistance) {
      nearest = cell;
      nearestDistance = distance;
    }
  }
  return nearest;
}

export function registerTableDragSelection(wysiwyg) {
  if (!wysiwyg) return () => {};
  let dragState = null;
  const removeWindowListeners = () => {
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerEnd);
    window.removeEventListener("pointercancel", onPointerEnd);
  };
  const beginSelection = event => {
    if (!dragState || dragState.selecting) return;
    dragState.selecting = true;
    dragState.previousBodyUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    window.__nvHtmlTableDragSelecting = true;
    clearTableDragSelectionClass(wysiwyg);
    wysiwyg.classList.add(tableDragSelectionClassForMode(dragState.mode));
    window.getSelection?.()?.removeAllRanges?.();
    selectTableCellRange(dragState.anchorCell, dragState.lastCell, {
      activeCell: dragState.lastCell,
      mode: dragState.mode
    });
    event.preventDefault();
    event.stopPropagation();
  };
  const updateSelection = event => {
    if (!dragState) return;
    const nextCell = getTableCellAtPoint(wysiwyg, dragState.table, event.clientX, event.clientY);
    if (nextCell) dragState.lastCell = nextCell;
    selectTableCellRange(dragState.anchorCell, dragState.lastCell, {
      activeCell: dragState.lastCell,
      mode: dragState.mode
    });
  };
  function onPointerMove(event) {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    const nextCell = getTableCellAtPoint(wysiwyg, dragState.table, event.clientX, event.clientY);
    if (nextCell) dragState.lastCell = nextCell;
    const dx = event.clientX - dragState.startX;
    const dy = event.clientY - dragState.startY;
    if (!dragState.selecting) {
      if (Math.hypot(dx, dy) < HTML_TABLE_SELECTION_DRAG_THRESHOLD_PX) return;
      if (dragState.mode === "cells" && dragState.lastCell === dragState.anchorCell) return;
      beginSelection(event);
    }
    updateSelection(event);
    event.preventDefault();
    event.stopPropagation();
  }
  function onPointerEnd(event) {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    const wasSelecting = dragState.selecting;
    const previousBodyUserSelect = dragState.previousBodyUserSelect;
    dragState = null;
    removeWindowListeners();
    clearTableDragSelectionClass(wysiwyg);
    window.__nvHtmlTableDragSelecting = false;
    if (previousBodyUserSelect !== undefined) document.body.style.userSelect = previousBodyUserSelect;
    if (wasSelecting) {
      wysiwyg.__nvSuppressNextTableClickSelection = true;
      window.setTimeout(() => {
        if (wysiwyg.__nvSuppressNextTableClickSelection) wysiwyg.__nvSuppressNextTableClickSelection = false;
      }, 0);
      event.preventDefault();
      event.stopPropagation();
    }
  }
  const onPointerDown = createOnPointerDownHandler({
    get wysiwyg() {
      return wysiwyg;
    },
    get removeWindowListeners() {
      return removeWindowListeners;
    },
    get onPointerMove() {
      return onPointerMove;
    },
    get onPointerEnd() {
      return onPointerEnd;
    }
  });
  wysiwyg.addEventListener("pointerdown", onPointerDown);
  return () => {
    removeWindowListeners();
    clearTableDragSelectionClass(wysiwyg);
    if (window.__nvTableEditorRoot === wysiwyg) clearTableCellSelection({
      keepActive: false
    });
    if (dragState) window.__nvHtmlTableDragSelecting = false;
    dragState = null;
    wysiwyg.removeEventListener("pointerdown", onPointerDown);
  };
}
