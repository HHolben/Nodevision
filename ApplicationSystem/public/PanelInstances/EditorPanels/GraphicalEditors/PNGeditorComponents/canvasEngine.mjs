//public/PanelInstances/EditorPanels/GraphicalEditors/PNGeditorComponents/canvasEngine.mjs
//This file provides the Bresenham line draawing algorithm

export function bresenhamLine(x0, y0, x1, y1, callback) {
  let dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
  let dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;

  while (true) {
    callback(x0, y0);
    if (x0 === x1 && y0 === y1) break;
    let e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

export function hexToRGBA(hex, alphaPct) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alphaPct / 100})`;
}