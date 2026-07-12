// Nodevision/ApplicationSystem/public/ToolbarCallbacks/draw/svgModeEraser.mjs
// Toolbar callback for the SVG eraser tool.
export default function svgModeEraser() {
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.svgDrawTool = "eraser";
  window.SVGEditorContext?.setMode?.("eraser");
}
