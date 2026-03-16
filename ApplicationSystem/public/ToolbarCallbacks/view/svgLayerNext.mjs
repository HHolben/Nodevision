// Nodevision/ApplicationSystem/public/ToolbarCallbacks/view/svgLayerNext.mjs
// This file defines browser-side svg Layer Next logic for the Nodevision UI. It renders interface components and handles user interactions.
export default function svgLayerNext() {
  window.SVGEditorContext?.stepActiveLayer?.(1);
}
