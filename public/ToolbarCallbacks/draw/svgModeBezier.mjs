export default function svgModeBezier() {
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.svgDrawTool = "bezier";
  window.SVGEditorContext?.setMode?.("bezier");
}
