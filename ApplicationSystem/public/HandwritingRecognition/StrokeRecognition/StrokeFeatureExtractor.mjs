// Nodevision/ApplicationSystem/public/HandwritingRecognition/StrokeRecognition/StrokeFeatureExtractor.mjs
// Shared feature extraction and geometry metrics for experimental stroke recognition.

import { clamp, finiteNumber } from "./StrokeGlyphModel.mjs";
import { pathLength, pointDistance, resampleStrokePoints } from "./StrokeResampler.mjs";

export function flattenStrokePoints(glyph = {}) {
  return (Array.isArray(glyph?.strokes) ? glyph.strokes : []).flatMap((stroke) => (
    Array.isArray(stroke?.points) ? stroke.points : []
  ));
}

export function glyphPathLength(glyph = {}) {
  return (Array.isArray(glyph?.strokes) ? glyph.strokes : []).reduce((total, stroke) => total + pathLength(stroke.points || []), 0);
}

export function vectorAt(points = [], index = 0) {
  if (!points.length) return { x: 0, y: 0, valid: false };
  const previous = points[Math.max(0, index - 1)] || points[0];
  const next = points[Math.min(points.length - 1, index + 1)] || points[points.length - 1];
  const dx = finiteNumber(next.x) - finiteNumber(previous.x);
  const dy = finiteNumber(next.y) - finiteNumber(previous.y);
  const length = Math.sqrt(dx * dx + dy * dy);
  if (!Number.isFinite(length) || length <= 1e-12) return { x: 0, y: 0, valid: false };
  return { x: dx / length, y: dy / length, valid: true };
}

export function meanNearestPointDistance(fromPoints = [], toPoints = []) {
  if (!fromPoints.length || !toPoints.length) return 1;
  let total = 0;
  for (const point of fromPoints) {
    let best = Infinity;
    for (const target of toPoints) {
      const d = pointDistance(point, target);
      if (d < best) best = d;
    }
    total += best;
  }
  return total / fromPoints.length;
}

export function bidirectionalNearestDistance(aPoints = [], bPoints = []) {
  if (!aPoints.length || !bPoints.length) return 1;
  return meanNearestPointDistance(aPoints, bPoints) * 0.5 + meanNearestPointDistance(bPoints, aPoints) * 0.5;
}

export function resampledGlyphPath(glyph = {}, pointsPerStroke = 24) {
  return (Array.isArray(glyph?.strokes) ? glyph.strokes : [])
    .flatMap((stroke) => resampleStrokePoints(stroke.points || [], pointsPerStroke));
}

export function rasterizeGlyphOccupancy(glyph = {}, grid = 12) {
  const size = Math.max(2, Math.round(finiteNumber(grid, 12)));
  const cells = new Set();
  const mark = (x, y) => {
    const gx = clamp(Math.round(x * (size - 1)), 0, size - 1);
    const gy = clamp(Math.round(y * (size - 1)), 0, size - 1);
    cells.add(`${gx},${gy}`);
  };
  for (const stroke of Array.isArray(glyph?.strokes) ? glyph.strokes : []) {
    const points = Array.isArray(stroke?.points) ? stroke.points : [];
    if (points.length === 1) {
      mark(points[0].x, points[0].y);
      continue;
    }
    for (let index = 1; index < points.length; index += 1) {
      const a = points[index - 1];
      const b = points[index];
      const steps = Math.max(1, Math.ceil(pointDistance(a, b) * size * 2));
      for (let step = 0; step <= steps; step += 1) {
        const t = step / steps;
        mark(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
      }
    }
  }
  return cells;
}

export function occupancySimilarity(aCells, bCells) {
  const a = aCells instanceof Set ? aCells : new Set(aCells || []);
  const b = bCells instanceof Set ? bCells : new Set(bCells || []);
  if (!a.size && !b.size) return 1;
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const cell of a) if (b.has(cell)) intersection += 1;
  const union = a.size + b.size - intersection;
  return union > 0 ? intersection / union : 0;
}

export function ratioCompatibility(a, b, neutral = 0.85) {
  const av = finiteNumber(a, NaN);
  const bv = finiteNumber(b, NaN);
  if (!Number.isFinite(av) || !Number.isFinite(bv) || av <= 0 || bv <= 0) return neutral;
  const diff = Math.abs(Math.log(av / bv));
  return clamp(1 - diff / Math.log(5), 0, 1);
}

export function extractStrokeFeatures(glyph = {}, options = {}) {
  const pointsPerStroke = Math.max(4, Math.round(finiteNumber(options.pointsPerStroke, 24)));
  const flat = flattenStrokePoints(glyph);
  const pathPoints = resampledGlyphPath(glyph, pointsPerStroke);
  return {
    strokeCount: Array.isArray(glyph?.strokes) ? glyph.strokes.length : 0,
    pointCount: flat.length,
    pathLength: glyphPathLength(glyph),
    resampledPath: pathPoints,
    aspectRatio: finiteNumber(glyph?.metadata?.aspectRatio, 1),
    bounds: glyph?.bounds || null,
    occupancy: rasterizeGlyphOccupancy(glyph, options.grid || 12),
  };
}
