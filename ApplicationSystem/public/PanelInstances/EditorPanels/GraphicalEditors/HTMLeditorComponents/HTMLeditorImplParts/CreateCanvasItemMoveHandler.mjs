// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/CreateCanvasItemMoveHandler.mjs
// This module implements create Canvas Item Move Handler behavior for the HTMLeditorImpl feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { getTableCellFromEditorTarget } from "./MarkHtmlEditorNativeInputDirty.mjs";
import { resolveTableDividerResizeHit } from "./MeasureTableRowHeight.mjs";
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
    #wysiwyg.nv-table-cell-moving { cursor: move; }
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
    const state = owner.resizeState;
    if (!state || moveEvent.pointerId !== owner.pointerId) return;
    const delta = state.kind === "column"
      ? (moveEvent.clientX - owner.startX) * state.scale
      : (moveEvent.clientY - owner.startY) * state.scale;
    owner.preview(() => state.apply(delta));
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
    owner.dragState = {
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
    if (event.altKey) owner.beginSelection(event);
    owner.removeWindowListeners();
    window.addEventListener("pointermove", owner.onPointerMove);
    window.addEventListener("pointerup", owner.onPointerEnd);
    window.addEventListener("pointercancel", owner.onPointerEnd);
  };
}
