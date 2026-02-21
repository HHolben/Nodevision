export default function svgLayerDeleteActive() {
  const ctx = window.SVGEditorContext;
  if (!ctx?.deleteActiveLayer || !ctx?.getActiveLayer) return;
  const active = ctx.getActiveLayer();
  if (!active) return;
  const name = active.getAttribute("data-layer-name") || active.id || "this layer";
  if (!confirm(`Delete active layer "${name}"?`)) return;
  ctx.deleteActiveLayer();
}
