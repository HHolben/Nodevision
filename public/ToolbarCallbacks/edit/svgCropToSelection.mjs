// Crop SVG canvas to the currently selected element.

export default function svgCropToSelection() {
  const ctx = window.SVGEditorContext;
  if (!ctx?.cropToSelection) return;
  ctx.cropToSelection(8);
}
