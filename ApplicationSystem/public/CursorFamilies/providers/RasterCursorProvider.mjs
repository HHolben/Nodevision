// Nodevision/ApplicationSystem/public/CursorFamilies/providers/RasterCursorProvider.mjs
// PNG/JPG raster contextual selection/drawing tool provider.
import { notifyContextualCursorFamilyChanged } from "../ContextualCursorFamilyRegistry.mjs";

const TOOL_TO_DRAW_TOOL = {
  "rectangle-select": "rectselect",
  "brush-draw": "brush",
  "eraser": "eraser",
  "fill": "fill",
  "eyedropper": "eyedropper",
  "line-draw": "line",
  "rectangle-draw": "rectangle",
  "ellipse-draw": "circle",
};
const DRAW_TOOL_TO_TOOL = Object.fromEntries(Object.entries(TOOL_TO_DRAW_TOOL).map(([tool, draw]) => [draw, tool]));

export function createCursorFamilyProvider() {
  return {
    id: "raster-cursor-tools",
    withContext(context) {
      return { ...this, context };
    },
    getTools() {
      return [
        { id: "rectangle-select", label: "Rectangle Select", glyph: "RECT", description: "Select a rectangular raster region." },
        { id: "brush-draw", label: "Brush", glyph: "DRAW", kind: "drawing" },
        { id: "eraser", label: "Eraser", glyph: "ERASE", kind: "drawing" },
        { id: "fill", label: "Fill", glyph: "FILL", kind: "drawing" },
        { id: "eyedropper", label: "Eyedropper", glyph: "PICK", kind: "drawing" },
        { id: "line-draw", label: "Line", glyph: "LINE", kind: "drawing" },
        { id: "rectangle-draw", label: "Rectangle", glyph: "RECT", kind: "drawing" },
        { id: "ellipse-draw", label: "Circle", glyph: "CIRC", kind: "drawing" },
      ];
    },
    getActiveToolId() {
      const drawTool = window.NodevisionState?.drawTool || "brush";
      return DRAW_TOOL_TO_TOOL[drawTool] || "brush-draw";
    },
    getFallbackToolId() {
      return "rectangle-select";
    },
    activateTool(toolId) {
      const drawTool = TOOL_TO_DRAW_TOOL[toolId] || "rectselect";
      window.NodevisionState = window.NodevisionState || {};
      window.NodevisionState.drawTool = drawTool;
      window.dispatchEvent?.(new CustomEvent("nv-draw-tool-changed", { detail: { tool: drawTool } }));
      notifyContextualCursorFamilyChanged({ providerId: "raster-cursor-tools", toolId, drawTool });
      return true;
    },
  };
}
