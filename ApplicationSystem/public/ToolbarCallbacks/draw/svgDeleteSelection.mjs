// Nodevision/ApplicationSystem/public/ToolbarCallbacks/draw/svgDeleteSelection.mjs
// This file defines browser-side svg Delete Selection logic for the Nodevision UI. It renders interface components and handles user interactions.
export default function svgDeleteSelection() {
  window.SVGEditorContext?.deleteSelection?.();
}
