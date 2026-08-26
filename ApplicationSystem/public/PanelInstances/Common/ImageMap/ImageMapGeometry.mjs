// Nodevision/ApplicationSystem/public/PanelInstances/Common/ImageMap/ImageMapGeometry.mjs
// This module converts image-map pointer interaction into intrinsic image coordinates that remain stable across display scaling.

import { normalizeArea, normalizeShape } from "./ImageMapModel.mjs";

// ------------------------------
// Coordinate conversion
// ------------------------------
function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeImageSize(size = {}) {
  return {
    width: Math.max(1, Math.round(finiteNumber(size.width, 1))),
    height: Math.max(1, Math.round(finiteNumber(size.height, 1))),
  };
}

export function pointFromDisplay(clientX, clientY, displayRect = {}, imageSize = {}) {
  const size = normalizeImageSize(imageSize);
  const left = finiteNumber(displayRect.left);
  const top = finiteNumber(displayRect.top);
  const width = Math.max(1, finiteNumber(displayRect.width, size.width));
  const height = Math.max(1, finiteNumber(displayRect.height, size.height));
  return {
    x: Math.round(clamp(((clientX - left) / width) * size.width, 0, size.width)),
    y: Math.round(clamp(((clientY - top) / height) * size.height, 0, size.height)),
  };
}

export function pointToDisplay(point = {}, displayRect = {}, imageSize = {}) {
  const size = normalizeImageSize(imageSize);
  const width = Math.max(1, finiteNumber(displayRect.width, size.width));
  const height = Math.max(1, finiteNumber(displayRect.height, size.height));
  return {
    x: finiteNumber(displayRect.left) + (finiteNumber(point.x) / size.width) * width,
    y: finiteNumber(displayRect.top) + (finiteNumber(point.y) / size.height) * height,
  };
}

// ------------------------------
// Shape construction
// ------------------------------
export function rectCoordsFromPoints(start = {}, end = {}) {
  const x1 = Math.round(finiteNumber(start.x));
  const y1 = Math.round(finiteNumber(start.y));
  const x2 = Math.round(finiteNumber(end.x));
  const y2 = Math.round(finiteNumber(end.y));
  return [Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2)];
}

export function circleCoordsFromPoints(center = {}, edge = {}) {
  const cx = Math.round(finiteNumber(center.x));
  const cy = Math.round(finiteNumber(center.y));
  const dx = finiteNumber(edge.x) - cx;
  const dy = finiteNumber(edge.y) - cy;
  return [cx, cy, Math.max(1, Math.round(Math.sqrt((dx * dx) + (dy * dy))))];
}

export function polygonCoordsFromPoints(points = []) {
  return points.flatMap((point) => [
    Math.round(finiteNumber(point.x)),
    Math.round(finiteNumber(point.y)),
  ]);
}

export function areaBounds(area = {}) {
  const normalized = normalizeArea(area);
  const coords = normalized.coords;
  if (normalized.shape === "circle") {
    return { x1: coords[0] - coords[2], y1: coords[1] - coords[2], x2: coords[0] + coords[2], y2: coords[1] + coords[2] };
  }
  if (normalized.shape === "poly") {
    const xs = coords.filter((_, index) => index % 2 === 0);
    const ys = coords.filter((_, index) => index % 2 === 1);
    return { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) };
  }
  return { x1: coords[0], y1: coords[1], x2: coords[2], y2: coords[3] };
}

// ------------------------------
// Editing helpers
// ------------------------------
export function moveAreaBy(area = {}, dx = 0, dy = 0, imageSize = {}) {
  const size = normalizeImageSize(imageSize);
  const moved = normalizeArea(area);
  const deltaX = Math.round(finiteNumber(dx));
  const deltaY = Math.round(finiteNumber(dy));
  if (moved.shape === "circle") {
    moved.coords = [
      clamp(moved.coords[0] + deltaX, 0, size.width),
      clamp(moved.coords[1] + deltaY, 0, size.height),
      moved.coords[2],
    ];
    return moved;
  }
  moved.coords = moved.coords.map((coord, index) => {
    const max = index % 2 === 0 ? size.width : size.height;
    return clamp(coord + (index % 2 === 0 ? deltaX : deltaY), 0, max);
  });
  return moved;
}

export function replacePolygonVertex(area = {}, vertexIndex = 0, point = {}) {
  const moved = normalizeArea({ ...area, shape: "poly" });
  const offset = Math.max(0, Math.round(vertexIndex)) * 2;
  if (offset + 1 >= moved.coords.length) return moved;
  moved.coords[offset] = Math.round(finiteNumber(point.x));
  moved.coords[offset + 1] = Math.round(finiteNumber(point.y));
  return moved;
}

export function reshapeAreaWithPoint(area = {}, handle = "move", point = {}) {
  const next = normalizeArea(area);
  const x = Math.round(finiteNumber(point.x));
  const y = Math.round(finiteNumber(point.y));
  if (normalizeShape(next.shape) === "circle") {
    next.coords = handle === "center" ? [x, y, next.coords[2] || 1] : circleCoordsFromPoints({ x: next.coords[0], y: next.coords[1] }, point);
  } else if (next.shape === "rect") {
    const [x1, y1, x2, y2] = next.coords;
    const pairs = { nw: [x, y, x2, y2], ne: [x1, y, x, y2], sw: [x, y1, x2, y], se: [x1, y1, x, y] };
    next.coords = rectCoordsFromPoints({ x: pairs[handle]?.[0] ?? x1, y: pairs[handle]?.[1] ?? y1 }, { x: pairs[handle]?.[2] ?? x2, y: pairs[handle]?.[3] ?? y2 });
  }
  return next;
}
