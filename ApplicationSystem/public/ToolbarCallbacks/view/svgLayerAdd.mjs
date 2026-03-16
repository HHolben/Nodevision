// Nodevision/ApplicationSystem/public/ToolbarCallbacks/view/svgLayerAdd.mjs
// This file defines browser-side svg Layer Add logic for the Nodevision UI. It renders interface components and handles user interactions.
export default function svgLayerAdd() {
  const ctx = window.SVGEditorContext;
  if (!ctx?.createLayer) return;
  const name = prompt("Layer name (optional):", "");
  if (name === null) return;
  ctx.createLayer(name.trim() || null);
}
