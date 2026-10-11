// Nodevision/ApplicationSystem/public/ToolbarCallbacks/draw/svgModeCircle.mjs
// This command activates the shared circle gesture in the current SVG editor through the standard toolbar context.
export default function svgModeCircle() {
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.svgDrawTool = "circle";
  window.SVGEditorContext?.setMode?.("circle");
}
