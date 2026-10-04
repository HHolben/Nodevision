// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/CreateCanvasItemMoveHandler.mjs
// This module implements create Canvas Item Move Handler behavior for the HTMLeditorImpl feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { HTML_TABLE_MIN_COLUMN_WIDTH, HTML_TABLE_MIN_ROW_HEIGHT } from "./EnsureHTMLLayoutStyles.mjs";
import { applyTableColumnWidth, getTableCellFromEditorTarget } from "./MarkHtmlEditorNativeInputDirty.mjs";
import { applyTableRowHeight, resolveTableDividerResizeHit } from "./MeasureTableRowHeight.mjs";
import { clearTableCellSelection, setActiveTableCell } from "/ToolbarCallbacks/insert/tableTools.mjs";
import { resolveTableDragSelectionMode } from "./StartTableDividerResize.mjs";
import { updateToolbarState } from "../../../../../panels/createToolbar.mjs";

// Create Canvas Item Move Handler operations.
export const HTMLeditorImplStyleSection8 = `    }
    #wysiwyg {
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    #wysiwyg.nv-table-divider-resize-col,
    #wysiwyg.nv-table-divider-resizing-col {
      cursor: col-resize;
    }
    #wysiwyg.nv-table-divider-resize-row,
    #wysiwyg.nv-table-divider-resizing-row {
      cursor: row-resize;
    }
    #wysiwyg.nv-table-divider-resizing {
      user-select: none;
    }
    #wysiwyg.nv-table-cell-selecting {
      cursor: crosshair;
      user-select: none;
    }
    #wysiwyg.nv-table-column-selecting {
      cursor: col-resize;
      user-select: none;
    }
    #wysiwyg.nv-table-row-selecting {
      cursor: row-resize;
      user-select: none;
    }
    #wysiwyg td.nv-html-table-selected-cell,
    #wysiwyg th.nv-html-table-selected-cell {
      background-color: rgba(47, 128, 255, 0.14);
      box-shadow: inset 0 0 0 2px rgba(47, 128, 255, 0.62);
    }
    #wysiwyg td.nv-html-table-selection-anchor,
    #wysiwyg th.nv-html-table-selection-anchor,
    #wysiwyg td.nv-html-table-selection-focus,
    #wysiwyg th.nv-html-table-selection-focus {
      box-shadow: inset 0 0 0 2px rgba(20, 92, 190, 0.9);
    }
    #wysiwyg p,
    #wysiwyg div,
    #wysiwyg li,
    #wysiwyg blockquote,
    #wysiwyg h1,
    #wysiwyg h2,
    #wysiwyg h3,
    #wysiwyg h4,
    #wysiwyg h5,
    #wysiwyg h6,
    #wysiwyg td,
    #wysiwyg th,
    #wysiwyg .nv-item-content {
      max-width: 100%;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
  `;

export function createCanvasItemMoveHandler(owner) {
  return moveEvent => {
    if (!owner.resizeState) return;
    const dx = moveEvent.clientX - owner.startX;
    const dy = moveEvent.clientY - owner.startY;
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) moved = true;
    if (owner.resizeState.kind === "column") {
      const pointerDelta = (moveEvent.clientX - owner.resizeState.dividerStartClientX) * owner.resizeState.clientToLayoutX;
      if (owner.resizeState.rightIndex !== null) {
        const leftWidth = Math.max(HTML_TABLE_MIN_COLUMN_WIDTH, Math.min(owner.resizeState.total - HTML_TABLE_MIN_COLUMN_WIDTH, owner.resizeState.leftStart + pointerDelta));
        if (Math.abs(leftWidth - owner.resizeState.leftStart) > 0.5) moved = true;
        applyTableColumnWidth(owner.table, owner.resizeState.leftIndex, leftWidth);
        applyTableColumnWidth(owner.table, owner.resizeState.rightIndex, owner.resizeState.total - leftWidth);
        owner.table.style.width = owner.resizeState.tableStartWidth + "px";
      } else {
        const nextWidth = Math.max(HTML_TABLE_MIN_COLUMN_WIDTH, owner.resizeState.leftStart + pointerDelta);
        if (Math.abs(nextWidth - owner.resizeState.leftStart) > 0.5) moved = true;
        applyTableColumnWidth(owner.table, owner.resizeState.leftIndex, nextWidth);
        owner.table.style.width = Math.max(HTML_TABLE_MIN_COLUMN_WIDTH, owner.resizeState.tableStartWidth + (nextWidth - owner.resizeState.leftStart)) + "px";
      }
      return;
    }
    const pointerDelta = (moveEvent.clientY - owner.resizeState.dividerStartClientY) * owner.resizeState.clientToLayoutY;
    if (owner.resizeState.bottomRow) {
      const topHeight = Math.max(HTML_TABLE_MIN_ROW_HEIGHT, Math.min(owner.resizeState.total - HTML_TABLE_MIN_ROW_HEIGHT, owner.resizeState.topStart + pointerDelta));
      if (Math.abs(topHeight - owner.resizeState.topStart) > 0.5) moved = true;
      applyTableRowHeight(owner.resizeState.topRow, topHeight);
      applyTableRowHeight(owner.resizeState.bottomRow, owner.resizeState.total - topHeight);
      owner.table.style.height = owner.resizeState.tableStartHeight + "px";
    } else {
      const nextHeight = Math.max(HTML_TABLE_MIN_ROW_HEIGHT, owner.resizeState.topStart + pointerDelta);
      if (Math.abs(nextHeight - owner.resizeState.topStart) > 0.5) moved = true;
      applyTableRowHeight(owner.resizeState.topRow, nextHeight);
      owner.table.style.height = Math.max(HTML_TABLE_MIN_ROW_HEIGHT, owner.resizeState.tableStartHeight + (nextHeight - owner.resizeState.topStart)) + "px";
    }
  };
}

export function createOnPointerDownHandler(owner) {
  return event => {
    if (event.button !== 0 || event.defaultPrevented) return;
    if (event.target?.closest?.("button, input, textarea, select, a")) return;
    const anchorCell = getTableCellFromEditorTarget(owner.wysiwyg, event.target);
    const table = anchorCell?.closest?.("table") || null;
    if (!anchorCell || !table) {
      clearTableCellSelection({
        keepActive: false
      });
      return;
    }
    if (resolveTableDividerResizeHit(owner.wysiwyg, event)) return;
    dragState = {
      anchorCell,
      lastCell: anchorCell,
      mode: resolveTableDragSelectionMode(owner.wysiwyg, anchorCell, event),
      pointerId: event.pointerId,
      previousBodyUserSelect: undefined,
      selecting: false,
      startX: event.clientX,
      startY: event.clientY,
      table
    };
    setActiveTableCell(anchorCell);
    updateToolbarState({
      htmlTableSelected: true
    });
    owner.removeWindowListeners();
    window.addEventListener("pointermove", owner.onPointerMove);
    window.addEventListener("pointerup", owner.onPointerEnd);
    window.addEventListener("pointercancel", owner.onPointerEnd);
  };
}
