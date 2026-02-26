export default function svgModeLine() {
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.svgDrawTool = "line";
  window.SVGEditorContext?.setMode?.("line");
}
