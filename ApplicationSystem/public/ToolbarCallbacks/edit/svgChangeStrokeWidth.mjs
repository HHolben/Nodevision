// Change stroke width for selected SVG element and current defaults.

export default function svgChangeStrokeWidth() {
  const ctx = window.SVGEditorContext;
  if (!ctx) return;

  const selected = ctx.getSelectedElement?.() || window.selectedSVGElement || null;
  const defaults = ctx.getCurrentStyleDefaults?.() || {};
  const initial = selected?.getAttribute("stroke-width") || defaults.strokeWidth || "2";
  const value = prompt("Enter stroke width:", initial);
  if (value === null) return;
  const parsed = Number.parseFloat(String(value).trim());
  if (!Number.isFinite(parsed) || parsed < 0) {
    alert("Please enter a valid non-negative number.");
    return;
  }
  ctx.setStrokeWidth?.(String(parsed));
}
