// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/CSVInteractionCursor.mjs
// This module projects the CSV editor's existing gesture state into a single effective cursor. It shares move eligibility with pointer-down handling, caches hovered-cell geometry, and restores temporary document cursors when an operation ends.

import { rangeContains } from "./CSVRangeModel.mjs";
import { CSV_CURSOR_STYLES, resolveCsvCursorState } from "/CursorFamilies/providers/CSVCursorProvider.mjs";

// The single-cell edge rule and multi-cell move rule must match the real gesture.
export function canMoveCsvSelection(range, point, edge, shiftKey) {
  return !shiftKey && rangeContains(range, point)
    && (range.top !== range.bottom || range.left !== range.right || edge);
}

export function createCsvInteractionCursor({ wrapper, cellFor, getState, getSelection }) {
  const doc = wrapper.ownerDocument, root = doc.documentElement;
  let hover = null, rect = null, range = getSelection().range, state = null;
  let previousDragCursor = "", ownsDragCursor = false, disposed = false;
  function setState(next, dragging) {
    if (disposed) return;
    const css = CSV_CURSOR_STYLES[next];
    if (state !== next) {
      state = next;
      wrapper.dataset.nvCsvCursor = next;
      wrapper.style.setProperty("--nv-csv-cursor", css);
    }
    if (dragging && !ownsDragCursor) {
      previousDragCursor = root.style.getPropertyValue("--nv-csv-active-cursor");
      root.classList.add("nv-csv-pointer-operation");
      ownsDragCursor = true;
    }
    if (dragging && root.style.getPropertyValue("--nv-csv-active-cursor") !== css) root.style.setProperty("--nv-csv-active-cursor", css);
    if (!dragging && ownsDragCursor) {
      root.classList.remove("nv-csv-pointer-operation");
      if (previousDragCursor) root.style.setProperty("--nv-csv-active-cursor", previousDragCursor);
      else root.style.removeProperty("--nv-csv-active-cursor");
      ownsDragCursor = false;
    }
  }
  function movable() {
    if (!hover?.cell?.isConnected) return false;
    const point = { row: Number(hover.cell.dataset.row), col: Number(hover.cell.dataset.col) };
    if (hover.shiftKey || !rangeContains(range, point)) return false;
    const multi = range.top !== range.bottom || range.left !== range.right;
    if (!multi && !rect) rect = hover.cell.getBoundingClientRect();
    const edge = !multi && Math.min(hover.x - rect.left, rect.right - hover.x, hover.y - rect.top, rect.bottom - hover.y) <= 6;
    return canMoveCsvSelection(range, point, edge, hover.shiftKey);
  }
  function refresh() {
    if (disposed) return;
    const { drag, editing } = getState();
    const overCell = Boolean(hover?.cell?.isConnected);
    setState(resolveCsvCursorState({ dragMode: drag?.mode, overCell,
      editing: overCell && editing === hover.cell,
      movable: !drag && overCell && editing !== hover.cell && movable() }), Boolean(drag));
  }
  function hoverAt(event, hitTest = false) {
    const cell = cellFor(hitTest ? doc.elementFromPoint(event.clientX, event.clientY) : event.target);
    if (cell !== hover?.cell) rect = null;
    hover = { cell, x: event.clientX, y: event.clientY, shiftKey: event.shiftKey };
    refresh();
  }
  function invalidate() { rect = null; }
  function layoutChanged() {
    invalidate();
    if (hover) hover.cell = cellFor(doc.elementFromPoint(hover.x, hover.y));
    refresh();
  }
  function selectionChanged() {
    range = getSelection().range;
    if (hover && !hover.cell?.isConnected) {
      hover.cell = cellFor(doc.elementFromPoint(hover.x, hover.y));
      rect = null;
    }
    refresh();
  }
  const cursor = {
    hoverAt, refresh, invalidate, selectionChanged, layoutChanged,
    leave() { hover = null; rect = null; refresh(); },
    shiftChanged(event) { if (hover) { hover.shiftKey = event.shiftKey; refresh(); } },
    dispose() {
      setState("default", false);
      disposed = true;
      delete wrapper.dataset.nvCsvCursor;
      wrapper.style.removeProperty("--nv-csv-cursor");
    },
  };
  refresh();
  return cursor;
}
