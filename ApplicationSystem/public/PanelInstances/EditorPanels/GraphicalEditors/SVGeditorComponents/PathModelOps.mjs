// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/PathModelOps.mjs
// This module provides small utilities for inserting, deleting, and toggling nodes on a Bezier model. This module computes simple segment hit-testing using straight-line approximations for speed.

import { cloneModel } from "./BezierModel.mjs";

function distanceToSegment(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy || 1e-9;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  const proj = { x: a.x + dx * t, y: a.y + dy * t };
  const ddx = p.x - proj.x;
  const ddy = p.y - proj.y;
  return { dist: Math.hypot(ddx, ddy), point: proj };
}

export function findClosestSegmentPoint(model, point) {
  if (!model || model.nodes.length < 2) return null;
  let best = { dist: Infinity, index: -1, point: null };
  const total = model.nodes.length;
  for (let i = 0; i < total - 1; i++) {
    const a = model.nodes[i];
    const b = model.nodes[i + 1];
    const hit = distanceToSegment(point, a, b);
    if (hit.dist < best.dist) best = { dist: hit.dist, index: i, point: hit.point };
  }
  if (model.closed && total > 2) {
    const a = model.nodes[total - 1];
    const b = model.nodes[0];
    const hit = distanceToSegment(point, a, b);
    if (hit.dist < best.dist) best = { dist: hit.dist, index: total - 1, point: hit.point };
  }
  return best.index >= 0 ? best : null;
}

export function insertNodeAfter(model, index, point) {
  const next = cloneModel(model);
  next.nodes.splice(index + 1, 0, { x: point.x, y: point.y, inHandle: null, outHandle: null, type: "smooth" });
  return next;
}

export function deleteNodeAt(model, index) {
  const next = cloneModel(model);
  if (index < 0 || index >= next.nodes.length) return next;
  next.nodes.splice(index, 1);
  if (next.nodes.length < 2) next.closed = false;
  return next;
}

export function toggleClosed(model) {
  const next = cloneModel(model);
  if (next.nodes.length < 2) { next.closed = false; return next; }
  next.closed = !next.closed;
  return next;
}
