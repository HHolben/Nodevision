// Nodevision/ApplicationSystem/public/CursorFamilies/providers/HTMLCursorProvider.mjs
// HTML contextual selection tool provider. Drawing tools intentionally stay absent.
import { notifyContextualCursorFamilyChanged } from "../ContextualCursorFamilyRegistry.mjs";

const VALID = new Set(["text-select", "object-select"]);

export function createCursorFamilyProvider() {
  return {
    id: "html-cursor-tools",
    withContext(context) {
      return { ...this, context };
    },
    getTools() {
      return [
        { id: "text-select", label: "Text Select", glyph: "T", description: "Use normal browser/editor text selection." },
        { id: "object-select", label: "Object Select", glyph: "P", description: "Select editable HTML objects and embedded content." },
      ];
    },
    getActiveToolId() {
      const remembered = window.NodevisionState?.htmlSelectionTool || "text-select";
      return VALID.has(remembered) ? remembered : "text-select";
    },
    getFallbackToolId() {
      return "text-select";
    },
    activateTool(toolId) {
      const id = VALID.has(toolId) ? toolId : "text-select";
      window.NodevisionState = window.NodevisionState || {};
      window.NodevisionState.htmlSelectionTool = id;
      notifyContextualCursorFamilyChanged({ providerId: "html-cursor-tools", toolId: id });
      return true;
    },
  };
}
