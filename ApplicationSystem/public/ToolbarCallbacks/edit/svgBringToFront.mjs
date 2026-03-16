// Nodevision/ApplicationSystem/public/ToolbarCallbacks/edit/svgBringToFront.mjs
// This file defines browser-side svg Bring To Front logic for the Nodevision UI. It renders interface components and handles user interactions.
export default function svgBringToFront() {
  window.SVGEditorContext?.arrangeSelection?.("front");
}
