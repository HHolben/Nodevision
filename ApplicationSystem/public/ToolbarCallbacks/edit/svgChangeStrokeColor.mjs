// Nodevision/ApplicationSystem/public/ToolbarCallbacks/edit/svgChangeStrokeColor.mjs
// This file defines browser-side svg Change Stroke Color logic for the Nodevision UI. It renders interface components and handles user interactions.
// Change stroke color for selected SVG element and current defaults.

export default function svgChangeStrokeColor() {
  const ctx = window.SVGEditorContext;
  if (!ctx) return;

  const selected = ctx.getSelectedElement?.() || window.selectedSVGElement || null;
  const defaults = ctx.getCurrentStyleDefaults?.() || {};
  const initial = selected?.getAttribute("stroke") || defaults.stroke || "#000000";
  const value = prompt("Enter stroke color:", initial);
  if (!value) return;
  ctx.setStrokeColor?.(value);
}
