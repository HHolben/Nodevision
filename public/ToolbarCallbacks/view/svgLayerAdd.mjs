export default function svgLayerAdd() {
  const ctx = window.SVGEditorContext;
  if (!ctx?.createLayer) return;
  const name = prompt("Layer name (optional):", "");
  if (name === null) return;
  ctx.createLayer(name.trim() || null);
}
