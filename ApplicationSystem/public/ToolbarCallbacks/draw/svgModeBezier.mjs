// Nodevision/ApplicationSystem/public/ToolbarCallbacks/draw/svgModeBezier.mjs
// This file defines browser-side svg Mode Bezier logic for the Nodevision UI. It renders interface components and handles user interactions.
export default function svgModeBezier() {
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.svgDrawTool = "bezier";
  window.SVGEditorContext?.setMode?.("bezier");
}
