// Nodevision/ApplicationSystem/public/VectorDrawing/ActivePathVertexSnap.mjs
// This module selects committed vertices from one active path using CSS-pixel distance. Hosts supply the current coordinate transform and vertex visibility, so previews and other objects cannot become candidates.
const same = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) <= 1e-6;
export function canClosePath(points) {
  const distinct = points.filter((p, i) => !points.slice(0, i).some(q => same(p, q)));
  return distinct.length >= 3;
}
export function findActivePathVertex(points, target, matrix, visible = () => true, tolerance = 18) {
  if (!matrix || points.length < 2 || Math.abs(matrix.a * matrix.d - matrix.b * matrix.c) < 1e-12) return null;
  const screen = p => ({ x: matrix.a * p.x + matrix.c * p.y + matrix.e, y: matrix.b * p.x + matrix.d * p.y + matrix.f });
  const cursor = screen(target), last = points.at(-1);
  let best = null, distance = tolerance;
  points.forEach((point, index) => {
    if (same(point, last) || (!index && !canClosePath(points)) || !visible(index)) return;
    const p = screen(point), next = Math.hypot(p.x - cursor.x, p.y - cursor.y);
    // Iteration order breaks ties in favor of the first (starting) vertex.
    if (next <= tolerance && (!best || next < distance - 1e-9)) { best = { index, point: { ...point } }; distance = next; }
  });
  return best;
}
export function isPathVertexVisible(element) {
  if (!element?.isConnected) return false;
  const win = element.ownerDocument.defaultView;
  for (let node = element; node?.nodeType === 1; node = node.parentElement) {
    const style = win.getComputedStyle(node);
    if (node.getAttribute('data-nv-locked') === 'true' || node.hidden || style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse' || Number(style.opacity) === 0) return false;
  }
  return true;
}
