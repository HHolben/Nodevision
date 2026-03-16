// Nodevision/ApplicationSystem/public/ToolbarCallbacks/edit/svgCropToSelection.mjs
// This file defines browser-side svg Crop To Selection logic for the Nodevision UI. It renders interface components and handles user interactions.
// Crop SVG canvas to the currently selected element.

export default function svgCropToSelection() {
  const ctx = window.SVGEditorContext;
  if (!ctx?.cropToSelection) return;
  ctx.cropToSelection(8);
}
