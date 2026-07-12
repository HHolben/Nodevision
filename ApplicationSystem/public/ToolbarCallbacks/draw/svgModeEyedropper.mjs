// Nodevision/ApplicationSystem/public/ToolbarCallbacks/draw/svgModeEyedropper.mjs
// Toolbar callback for the SVG eyedropper tool.
export default function svgModeEyedropper() {
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.svgDrawTool = "eyedropper";
  window.SVGEditorContext?.setMode?.("eyedropper");
}
