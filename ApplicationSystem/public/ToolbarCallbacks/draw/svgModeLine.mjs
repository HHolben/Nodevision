// Nodevision/ApplicationSystem/public/ToolbarCallbacks/draw/svgModeLine.mjs
// This file defines browser-side svg Mode Line logic for the Nodevision UI. It renders interface components and handles user interactions.
export default function svgModeLine() {
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.svgDrawTool = "line";
  window.SVGEditorContext?.setMode?.("line");
}
