export default function svgModeFreehand() {
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.svgDrawTool = "freehand";
  window.SVGEditorContext?.setMode?.("freehand");
}
