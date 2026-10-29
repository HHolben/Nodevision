// Lossless document-coordinate sampling: discard duplicates and straight-through
// collinear samples only. Corners, reversals and arbitrarily small curves survive.
export function appendFreehandPoint(points, point) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
  const b = points.at(-1), a = points.at(-2);
  if (b && b.x === point.x && b.y === point.y) return;
  if (a && (b.x - a.x) * (point.y - b.y) === (b.y - a.y) * (point.x - b.x)
      && (b.x - a.x) * (point.x - b.x) + (b.y - a.y) * (point.y - b.y) >= 0) points.pop();
  points.push({ x: point.x, y: point.y });
}
export function pointerSamples(event) {
  let samples = [];
  try { samples = Array.from(event.getCoalescedEvents?.() || []); } catch { /* Unsupported input source. */ }
  // The dispatched endpoint may be newer than the last coalesced sample.
  return [...samples, event];
}
