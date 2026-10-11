// Nodevision/ApplicationSystem/public/ToolbarCallbacks/draw/svgModeArc.mjs
// This command activates the shared arc gesture in the current SVG editor through the standard toolbar context.
export default function svgModeArc() {
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.svgDrawTool = "arc";
  window.SVGEditorContext?.setMode?.("arc");
}
