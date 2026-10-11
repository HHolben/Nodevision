// Nodevision/ApplicationSystem/public/ToolbarCallbacks/draw/svgModeRectangle.mjs
// This command activates the shared rectangle gesture in the current SVG editor through the standard toolbar context.
export default function svgModeRectangle() {
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.svgDrawTool = "rectangle";
  window.SVGEditorContext?.setMode?.("rectangle");
}
