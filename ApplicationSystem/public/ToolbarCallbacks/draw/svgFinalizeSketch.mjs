// Nodevision/ApplicationSystem/public/ToolbarCallbacks/draw/svgFinalizeSketch.mjs
// This file defines browser-side svg Finalize Sketch logic for the Nodevision UI. It renders interface components and handles user interactions.
export default function svgFinalizeSketch() {
  window.SVGEditorContext?.finalizeSketch?.();
}
