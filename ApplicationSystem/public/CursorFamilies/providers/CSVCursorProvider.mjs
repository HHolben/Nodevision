// Nodevision/ApplicationSystem/public/CursorFamilies/providers/CSVCursorProvider.mjs
// This module supplies CSV selection tools and the shared cursor vocabulary for live grid interactions. Pointer gestures reuse these states without resolving toolbar providers during movement.
import { notifyContextualCursorFamilyChanged } from "../ContextualCursorFamilyRegistry.mjs";

const VALID = new Set(["cell-select", "rectangle-select"]);

// The effective cursor follows operations, independently of toolbar tool labels.
export const CSV_CURSOR_STYLES = Object.freeze({
  default: "default",
  "cell-select": "cell",
  "range-selecting": "crosshair",
  "text-edit": "text",
  "selection-movable": "grab",
  "selection-dragging": "grabbing",
});

export function resolveCsvCursorState({ dragMode, overCell, editing, movable }) {
  if (dragMode === "move") return "selection-dragging";
  if (dragMode === "select") return "range-selecting";
  if (!overCell) return "default";
  if (editing) return "text-edit";
  return movable ? "selection-movable" : "cell-select";
}

// ModuleMap continues to discover and activate the existing selection tools.
export function createCursorFamilyProvider() {
  return {
    id: "csv-cursor-tools",
    withContext(context) {
      return { ...this, context };
    },
    getTools() {
      return [
        { id: "cell-select", label: "Cell Select", glyph: "CELL", description: "Select one CSV grid cell." },
        { id: "rectangle-select", label: "Range Select", glyph: "RECT", description: "Select a rectangular CSV cell range." },
      ];
    },
    getActiveToolId() {
      const remembered = window.NodevisionState?.csvSelectionTool || "cell-select";
      return VALID.has(remembered) ? remembered : "cell-select";
    },
    getFallbackToolId() {
      return "cell-select";
    },
    activateTool(toolId) {
      const id = VALID.has(toolId) ? toolId : "cell-select";
      window.NodevisionState = window.NodevisionState || {};
      window.NodevisionState.csvSelectionTool = id;
      notifyContextualCursorFamilyChanged({ providerId: "csv-cursor-tools", toolId: id });
      return true;
    },
  };
}
