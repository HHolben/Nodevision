// Nodevision/ApplicationSystem/public/ToolbarCallbacks/draw/svgModeSketch.mjs
// This file defines browser-side svg Mode Sketch logic for the Nodevision UI. It renders interface components and handles user interactions.
export default function svgModeSketch() {
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.svgDrawTool = "sketch";
  window.SVGEditorContext?.setMode?.("sketch");
}
