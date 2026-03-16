// Nodevision/ApplicationSystem/public/ToolbarCallbacks/view/svgLayerPrev.mjs
// This file defines browser-side svg Layer Prev logic for the Nodevision UI. It renders interface components and handles user interactions.
export default function svgLayerPrev() {
  window.SVGEditorContext?.stepActiveLayer?.(-1);
}
