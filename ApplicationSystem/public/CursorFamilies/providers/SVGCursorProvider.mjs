// Nodevision/ApplicationSystem/public/CursorFamilies/providers/SVGCursorProvider.mjs
// SVG contextual selection/drawing tool provider.
import { notifyContextualCursorFamilyChanged } from "../ContextualCursorFamilyRegistry.mjs";

const TOOL_TO_MODE = {
  "object-select": "select",
  "rectangle-select": "select",
  "freehand-draw": "freehand",
  "line-draw": "line",
  "circle-draw": "circle",
  "arc-draw": "arc",
  "bezier-draw": "bezier",
  "sketch-draw": "sketch",
  "eyedropper": "eyedropper",
  "eraser": "eraser",
};
const MODE_TO_TOOL = Object.fromEntries(Object.entries(TOOL_TO_MODE).map(([tool, mode]) => [mode, tool]));

export function createCursorFamilyProvider() {
  return {
    id: "svg-cursor-tools",
    withContext(context) {
      return { ...this, context };
    },
    getTools() {
      return [
        { id: "object-select", label: "Object Select", glyph: "P", description: "Select and transform SVG objects." },
        { id: "rectangle-select", label: "Rectangle Select", glyph: "RECT", description: "Use the SVG editor's existing marquee selection." },
        { id: "line-draw", label: "Line", glyph: "LINE", kind: "drawing" },
        { id: "circle-draw", label: "Circle", glyph: "CIRC", kind: "drawing" },
        { id: "arc-draw", label: "Arc", glyph: "ARC", kind: "drawing" },
        { id: "freehand-draw", label: "Freehand Draw", glyph: "DRAW", kind: "drawing" },
        { id: "bezier-draw", label: "Bezier Path", glyph: "PATH", kind: "drawing" },
        { id: "sketch-draw", label: "Pencil Sketch", glyph: "PEN", kind: "drawing" },
        { id: "eyedropper", label: "Eyedropper", glyph: "PICK", kind: "drawing" },
        { id: "eraser", label: "Eraser", glyph: "ERASE", kind: "drawing" },
      ];
    },
    getActiveToolId() {
      const mode = window.SVGEditorContext?.getMode?.() || window.NodevisionState?.svgDrawTool || "select";
      return MODE_TO_TOOL[mode] || "object-select";
    },
    getFallbackToolId() {
      return "object-select";
    },
    activateTool(toolId) {
      const mode = TOOL_TO_MODE[toolId] || "select";
      window.NodevisionState = window.NodevisionState || {};
      window.NodevisionState.svgDrawTool = mode;
      window.SVGEditorContext?.setMode?.(mode);
      notifyContextualCursorFamilyChanged({ providerId: "svg-cursor-tools", toolId, mode });
      return true;
    },
  };
}
