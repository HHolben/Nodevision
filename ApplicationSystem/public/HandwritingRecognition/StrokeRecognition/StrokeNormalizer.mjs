// Nodevision/ApplicationSystem/public/HandwritingRecognition/StrokeRecognition/StrokeNormalizer.mjs
// Canvas-independent normalization for experimental isolated-character stroke glyphs.

import {
  STROKE_GLYPH_SCHEMA,
  boundsForStrokePointGroups,
  clamp,
  coerceStrokeGlyph,
  finiteNumber,
} from "./StrokeGlyphModel.mjs";
import {
  filterNearDuplicatePoints,
  pathLength,
  simplifyStrokePoints,
} from "./StrokeResampler.mjs";

export const DEFAULT_STROKE_NORMALIZER_OPTIONS = Object.freeze({
  padding: 0.08,
  minSpan: 1e-6,
  minRawPointDistance: 1.25,
  minNormalizedPointDistance: 0.004,
  simplifyEpsilon: 0.004,
});

function normalizePoint(point, bounds, scale, offsetX, offsetY, startTime, padding) {
  const drawable = Math.max(0.01, 1 - padding * 2);
  return {
    x: clamp(padding + (((point.x - bounds.minX) / scale) + offsetX) * drawable, 0, 1),
    y: clamp(padding + (((point.y - bounds.minY) / scale) + offsetY) * drawable, 0, 1),
    t: Math.max(0, finiteNumber(point.t, startTime) - startTime),
    pressure: clamp(point.pressure ?? 0.5, 0, 1),
    tiltX: finiteNumber(point.tiltX, 0),
    tiltY: finiteNumber(point.tiltY, 0),
  };
}

function directionForEndpoints(points = []) {
  if (points.length < 2) return { x: 0, y: 0, valid: false };
  const first = points[0];
  const last = points[points.length - 1];
  const dx = last.x - first.x;
  const dy = last.y - first.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  if (!Number.isFinite(length) || length <= 1e-12) return { x: 0, y: 0, valid: false };
  return { x: dx / length, y: dy / length, valid: true };
}

export function normalizeStrokeGlyph(rawGlyph = {}, options = {}) {
  const config = { ...DEFAULT_STROKE_NORMALIZER_OPTIONS, ...options };
  const glyph = coerceStrokeGlyph(rawGlyph, config);
  const rawBounds = boundsForStrokePointGroups(glyph.strokes);
  if (!rawBounds) {
    return {
      schema: STROKE_GLYPH_SCHEMA,
      strokes: [],
      bounds: null,
      originalBounds: null,
      duration: 0,
      pointerType: glyph.pointerType || "unknown",
      canvas: glyph.canvas || null,
      metadata: { strokeCount: 0, pointCount: 0, aspectRatio: 1, pathLength: 0, rawPathLength: 0 },
      rawGlyph: glyph,
    };
  }

  const allRawPoints = glyph.strokes.flatMap((stroke) => stroke.points);
  const startTime = Math.min(...allRawPoints.map((point) => finiteNumber(point.t, 0)));
  const endTime = Math.max(...allRawPoints.map((point) => finiteNumber(point.t, startTime)));
  const rawMaxSpan = Math.max(rawBounds.width, rawBounds.height);
  const rawDistance = rawMaxSpan <= 2 ? config.minNormalizedPointDistance : config.minRawPointDistance;
  const filteredRaw = glyph.strokes
    .map((stroke) => ({ points: filterNearDuplicatePoints(stroke.points, rawDistance) }))
    .filter((stroke) => stroke.points.length);
  const filteredBounds = boundsForStrokePointGroups(filteredRaw) || rawBounds;
  const width = Math.max(0, filteredBounds.width);
  const height = Math.max(0, filteredBounds.height);
  const scale = Math.max(width, height, finiteNumber(config.minSpan, DEFAULT_STROKE_NORMALIZER_OPTIONS.minSpan));
  const offsetX = scale > 1e-12 ? (1 - width / scale) / 2 : 0;
  const offsetY = scale > 1e-12 ? (1 - height / scale) / 2 : 0;
  const padding = clamp(config.padding, 0, 0.35);

  const normalizedStrokes = filteredRaw.map((stroke) => {
    const normalized = scale <= config.minSpan * 2
      ? stroke.points.map((point) => ({
        x: 0.5,
        y: 0.5,
        t: Math.max(0, finiteNumber(point.t, startTime) - startTime),
        pressure: clamp(point.pressure ?? 0.5, 0, 1),
        tiltX: finiteNumber(point.tiltX, 0),
        tiltY: finiteNumber(point.tiltY, 0),
      }))
      : stroke.points.map((point) => normalizePoint(point, filteredBounds, scale, offsetX, offsetY, startTime, padding));
    return { points: simplifyStrokePoints(normalized, config.simplifyEpsilon) };
  }).filter((stroke) => stroke.points.length);

  const normalizedBounds = boundsForStrokePointGroups(normalizedStrokes);
  const flat = normalizedStrokes.flatMap((stroke) => stroke.points);
  const rawPathLength = filteredRaw.reduce((total, stroke) => total + pathLength(stroke.points), 0);
  const normalizedPathLength = normalizedStrokes.reduce((total, stroke) => total + pathLength(stroke.points), 0);
  const aspectRatio = width <= config.minSpan && height <= config.minSpan
    ? 1
    : clamp(width / Math.max(height, config.minSpan), 0.0001, 10000);

  return {
    schema: STROKE_GLYPH_SCHEMA,
    strokes: normalizedStrokes,
    bounds: normalizedBounds,
    originalBounds: { ...filteredBounds },
    duration: Math.max(0, endTime - startTime),
    pointerType: glyph.pointerType || "unknown",
    canvas: glyph.canvas || null,
    metadata: {
      ...(glyph.metadata || {}),
      strokeCount: normalizedStrokes.length,
      pointCount: flat.length,
      rawPointCount: allRawPoints.length,
      aspectRatio,
      pathLength: normalizedPathLength,
      rawPathLength,
      startDirection: directionForEndpoints(flat.slice(0, Math.min(4, flat.length))),
      endDirection: directionForEndpoints(flat.slice(Math.max(0, flat.length - 4))),
      originalBounds: { ...filteredBounds },
      normalizedBounds: normalizedBounds ? { ...normalizedBounds } : null,
    },
    rawGlyph: glyph,
  };
}

export function normalizedGlyphFromTemplateStrokes(strokes = [], options = {}) {
  const raw = {
    schema: STROKE_GLYPH_SCHEMA,
    strokes: (Array.isArray(strokes) ? strokes : []).map((stroke) => ({
      points: (Array.isArray(stroke) ? stroke : []).map((point, index) => ({
        x: Array.isArray(point) ? point[0] : point?.x,
        y: Array.isArray(point) ? point[1] : point?.y,
        t: index * 16,
        pressure: 0.5,
        tiltX: 0,
        tiltY: 0,
      })),
    })),
    pointerType: "template",
    canvas: { width: 1, height: 1 },
  };
  return normalizeStrokeGlyph(raw, { minRawPointDistance: 0.002, ...options });
}
