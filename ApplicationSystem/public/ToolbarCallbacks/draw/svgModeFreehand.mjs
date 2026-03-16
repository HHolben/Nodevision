// Nodevision/ApplicationSystem/public/ToolbarCallbacks/draw/svgModeFreehand.mjs
// This file defines browser-side svg Mode Freehand logic for the Nodevision UI. It renders interface components and handles user interactions.
export default function svgModeFreehand() {
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.svgDrawTool = "freehand";
  window.SVGEditorContext?.setMode?.("freehand");
}
