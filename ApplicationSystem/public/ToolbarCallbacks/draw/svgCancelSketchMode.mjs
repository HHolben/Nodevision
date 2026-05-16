// Nodevision/ApplicationSystem/public/ToolbarCallbacks/draw/svgCancelSketchMode.mjs
// This file defines browser-side svg Cancel Sketch Mode logic for the Nodevision UI. It renders interface components and handles user interactions.
export default function svgCancelSketchMode() {
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.svgDrawTool = "select";
  if (window.SVGEditorContext?.cancelSketchMode) {
    window.SVGEditorContext.cancelSketchMode();
    return;
  }
  window.SVGEditorContext?.setMode?.("select");
}
