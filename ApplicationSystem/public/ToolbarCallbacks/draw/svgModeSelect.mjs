// Nodevision/ApplicationSystem/public/ToolbarCallbacks/draw/svgModeSelect.mjs
// This file defines browser-side svg Mode Select logic for the Nodevision UI. It renders interface components and handles user interactions.
export default function svgModeSelect() {
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.svgDrawTool = "select";
  window.SVGEditorContext?.setMode?.("select");
}
