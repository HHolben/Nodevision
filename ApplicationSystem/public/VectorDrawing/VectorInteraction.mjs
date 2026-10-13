// Nodevision/ApplicationSystem/public/VectorDrawing/VectorInteraction.mjs
// This controller manages vector gestures independently of the DOM. Render and commit callbacks allow the SVG editor and image analysis to share cancellation, validation, and multi-click behavior.
import { createGeometry } from './VectorGeometry.mjs';
export function createVectorInteraction({ preview, commit, status = () => {} }) {
  let kind = null, points = [], cursor = null, pointer = null, sweep = 1;
  const cancel = () => { points = []; cursor = null; pointer = null; preview(null); };
  const geometry = () => createGeometry(kind, points, { sweep });
  function render() {
    const next = cursor ? [...points, cursor] : points;
    const shape = createGeometry(kind, next, { sweep });
    preview(shape, next, kind);
  }
  function finish() {
    if (!points.length) return false;
    const shape = geometry();
    if (!shape) { status('Place a nonzero shape; polygons need three distinct, non-collinear vertices.'); return false; }
    cancel(); commit(shape); return true;
  }
  return {
    get active() { return points.length > 0; }, get points() { return points; }, get pointerId() { return pointer; },
    setTool(value) { if (value !== kind) { cancel(); kind = value; } }, cancel, finish,
    down(point, event = {}) {
      if (pointer !== null) return;
      cursor = null; sweep = event.shiftKey ? 0 : 1;
      if (['line', 'polygon'].includes(kind)) {
        if (event.detail >= 2) { finish(); return; }
        if (!points.length || Math.hypot(point.x - points.at(-1).x, point.y - points.at(-1).y) > 1e-6) points.push({ x: point.x, y: point.y });
        status('Click vertices; Enter or double-click finishes, Backspace removes a vertex, Escape cancels.');
      } else if (kind === 'arc') {
        if (points.length === 1 && !createGeometry('circle', [points[0], point])) return;
        points.push({ x: point.x, y: point.y });
        if (points.length === 3) { if (!finish()) points.pop(); return; }
        status(points.length === 1 ? 'Arc: choose radius and start angle.' : 'Arc: choose end angle; Shift draws counterclockwise.');
      } else { points = [{ x: point.x, y: point.y }]; pointer = event.pointerId ?? 1; }
      render();
    },
    move(point, event = {}) {
      if (!points.length || (pointer !== null && event.pointerId !== undefined && pointer !== event.pointerId)) return;
      if (kind === 'freehand') {
        const last = points.at(-1);
        if (Math.hypot(point.x - last.x, point.y - last.y) > 1e-6) points.push({ x: point.x, y: point.y });
        cursor = null; render(); return;
      }
      cursor = { x: point.x, y: point.y }; sweep = event.shiftKey ? 0 : 1; render();
    },
    up(point, event = {}) {
      if (pointer === null || (event.pointerId !== undefined && pointer !== event.pointerId)) return;
      points.push({ x: point.x, y: point.y }); if (!finish()) cancel();
    },
    key(key) {
      if (!points.length) return false;
      if (key === 'Escape') cancel();
      else if (key === 'Enter' && ['line', 'polygon'].includes(kind)) finish();
      else if (key === 'Backspace' && ['line', 'polygon'].includes(kind)) { points.pop(); render(); }
      else return false;
      return true;
    }
  };
}
