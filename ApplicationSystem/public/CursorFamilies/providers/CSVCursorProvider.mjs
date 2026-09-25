// Nodevision/ApplicationSystem/public/CursorFamilies/providers/CSVCursorProvider.mjs
// CSV contextual grid-selection tool provider. Geometric drawing tools intentionally stay absent.
import { notifyContextualCursorFamilyChanged } from "../ContextualCursorFamilyRegistry.mjs";

const VALID = new Set(["cell-select", "rectangle-select"]);

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
