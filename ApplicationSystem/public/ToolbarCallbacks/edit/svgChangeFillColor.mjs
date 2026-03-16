// Nodevision/ApplicationSystem/public/ToolbarCallbacks/edit/svgChangeFillColor.mjs
// This file defines browser-side svg Change Fill Color logic for the Nodevision UI. It renders interface components and handles user interactions.
// Change fill color for selected SVG element and current defaults.

export default function svgChangeFillColor() {
  const ctx = window.SVGEditorContext;
  if (!ctx) return;

  const selected = ctx.getSelectedElement?.() || window.selectedSVGElement || null;
  const defaults = ctx.getCurrentStyleDefaults?.() || {};
  const initial = selected?.getAttribute("fill") || defaults.fill || "#000000";
  const value = prompt("Enter fill color:", initial);
  if (!value) return;
  ctx.setFillColor?.(value);
}
