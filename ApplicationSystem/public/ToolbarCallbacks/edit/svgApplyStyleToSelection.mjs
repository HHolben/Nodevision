// Nodevision/ApplicationSystem/public/ToolbarCallbacks/edit/svgApplyStyleToSelection.mjs
// This file defines browser-side svg Apply Style To Selection logic for the Nodevision UI. It renders interface components and handles user interactions.
// Apply the current SVG style defaults to the selected element.

export default function svgApplyStyleToSelection() {
  const ctx = window.SVGEditorContext;
  if (!ctx?.applyCurrentStyleToSelection) {
    console.warn("svgApplyStyleToSelection: SVG editor context is not available.");
    return;
  }

  const ok = ctx.applyCurrentStyleToSelection();
  if (!ok) {
    const msg = document.getElementById("svg-message");
    if (msg) msg.textContent = "No shape selected";
  }
}
