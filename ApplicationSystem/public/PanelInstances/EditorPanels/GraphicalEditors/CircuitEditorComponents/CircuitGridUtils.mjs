// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/CircuitEditorComponents/CircuitGridUtils.mjs
// This file defines grid math utilities for the circuit editor. This file keeps snapping and orthogonal helpers lightweight for reuse.

export function snapPoint(point, gridSize = 20, enabled = true) {
  if (!enabled) return { ...point };
  return {
    x: Math.round(point.x / gridSize) * gridSize,
    y: Math.round(point.y / gridSize) * gridSize,
  };
}

export function orthogonalStep(from, to) {
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);
  if (dx >= dy) {
    return { x: to.x, y: from.y };
  }
  return { x: from.x, y: to.y };
}

export function rectFromPoints(a, b) {
  const x1 = Math.min(a.x, b.x);
  const x2 = Math.max(a.x, b.x);
  const y1 = Math.min(a.y, b.y);
  const y2 = Math.max(a.y, b.y);
  return { x1, y1, x2, y2, width: x2 - x1, height: y2 - y1 };
}

export function pointInRect(pt, rect) {
  return pt.x >= rect.x1 && pt.x <= rect.x2 && pt.y >= rect.y1 && pt.y <= rect.y2;
}
