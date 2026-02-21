export default function svgLayerRenameActive() {
  const ctx = window.SVGEditorContext;
  if (!ctx?.renameActiveLayer || !ctx?.getActiveLayer) return;
  const active = ctx.getActiveLayer();
  if (!active) return;
  const current = active.getAttribute("data-layer-name") || active.id || "Layer";
  const next = prompt("Rename active layer:", current);
  if (!next) return;
  ctx.renameActiveLayer(next);
}
