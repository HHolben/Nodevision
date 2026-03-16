// Nodevision/ApplicationSystem/public/ToolbarCallbacks/edit/svgSendToBack.mjs
// This file defines browser-side svg Send To Back logic for the Nodevision UI. It renders interface components and handles user interactions.
export default function svgSendToBack() {
  window.SVGEditorContext?.arrangeSelection?.("back");
}
