// Nodevision/ApplicationSystem/public/ToolbarCallbacks/draw/svgModeEllipse.mjs
// This command activates the shared ellipse gesture in the current SVG editor through the standard toolbar context.
export default function svgModeEllipse() {
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.svgDrawTool = "ellipse";
  window.SVGEditorContext?.setMode?.("ellipse");
}
