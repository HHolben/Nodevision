export default function svgModeSelect() {
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.svgDrawTool = "select";
  window.SVGEditorContext?.setMode?.("select");
}
