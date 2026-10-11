// Nodevision/ApplicationSystem/public/ToolbarCallbacks/draw/svgModePolygon.mjs
// This command activates the shared polygon gesture in the current SVG editor through the standard toolbar context.
export default function svgModePolygon() {
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.svgDrawTool = "polygon";
  window.SVGEditorContext?.setMode?.("polygon");
}
