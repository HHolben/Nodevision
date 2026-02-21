// Resize SVG canvas from toolbar controls.

export default function svgResizeCanvas() {
  const ctx = window.SVGEditorContext;
  if (!ctx?.resizeCanvas || !ctx?.getCanvasSize) {
    console.warn("svgResizeCanvas: SVG editor context is not available.");
    return;
  }

  const current = ctx.getCanvasSize();
  const widthInput = prompt("Canvas width:", String(Math.round(current.width)));
  if (widthInput === null) return;
  const heightInput = prompt("Canvas height:", String(Math.round(current.height)));
  if (heightInput === null) return;

  const width = Number.parseFloat(widthInput);
  const height = Number.parseFloat(heightInput);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    alert("Please enter valid positive numbers for width and height.");
    return;
  }

  ctx.resizeCanvas(width, height);
}
