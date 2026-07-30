// Nodevision/ApplicationSystem/public/HandwritingRecognition/StrokeRecognition/StrokeGlyphModel.mjs
// Pure data-model helpers for experimental isolated-character stroke recognition.

export const STROKE_GLYPH_SCHEMA = "nodevision-stroke-glyph/1";
export const STROKE_TEMPLATE_SCHEMA = "nodevision-stroke-template/1";
export const STROKE_TEMPLATE_FORMAT_VERSION = 1;

export function finiteNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function clamp(value, min, max) {
  const numeric = finiteNumber(value, min);
  return Math.max(min, Math.min(max, numeric));
}

export function firstGrapheme(value = "") {
  return Array.from(String(value || "").trim())[0] || "";
}

export function sanitizeTemplateId(value = "") {
  const clean = String(value || "")
    .trim()
    .replace(/[^A-Za-z0-9._:-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
  return clean || "template";
}

export function pointFromAny(rawPoint, index = 0, options = {}) {
  const p = Array.isArray(rawPoint)
    ? { x: rawPoint[0], y: rawPoint[1], t: rawPoint[2] }
    : (rawPoint && typeof rawPoint === "object" ? rawPoint : {});
  const t = Number.isFinite(Number(p.t ?? p.time ?? p.timestamp ?? p.timeStamp))
    ? Number(p.t ?? p.time ?? p.timestamp ?? p.timeStamp)
    : index * finiteNumber(options.defaultPointIntervalMs, 16);
  return {
    x: finiteNumber(p.x ?? p.clientX ?? p.pageX, NaN),
    y: finiteNumber(p.y ?? p.clientY ?? p.pageY, NaN),
    t,
    pressure: clamp(p.pressure ?? p.force ?? options.defaultPressure ?? 0.5, 0, 1),
    tiltX: finiteNumber(p.tiltX, 0),
    tiltY: finiteNumber(p.tiltY, 0),
  };
}

export function strokePointsFromAny(rawStroke, options = {}) {
  const points = Array.isArray(rawStroke?.points)
    ? rawStroke.points
    : (Array.isArray(rawStroke) ? rawStroke : []);
  return points
    .map((point, index) => pointFromAny(point, index, options))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
}

export function boundsForStrokePointGroups(strokes = []) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let count = 0;

  for (const stroke of Array.isArray(strokes) ? strokes : []) {
    const points = Array.isArray(stroke?.points) ? stroke.points : (Array.isArray(stroke) ? stroke : []);
    for (const point of points) {
      const x = Number(point?.x);
      const y = Number(point?.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      count += 1;
    }
  }

  if (!count) return null;
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY),
  };
}

export function coerceStrokeGlyph(input = {}, options = {}) {
  const raw = Array.isArray(input) ? { strokes: input } : (input && typeof input === "object" ? input : {});
  const strokes = (Array.isArray(raw.strokes) ? raw.strokes : [])
    .map((stroke) => ({ points: strokePointsFromAny(stroke, options) }))
    .filter((stroke) => stroke.points.length);
  const bounds = boundsForStrokePointGroups(strokes);
  const allPoints = strokes.flatMap((stroke) => stroke.points);
  const startTime = allPoints.length ? Math.min(...allPoints.map((point) => finiteNumber(point.t, 0))) : 0;
  const endTime = allPoints.length ? Math.max(...allPoints.map((point) => finiteNumber(point.t, startTime))) : startTime;
  const pointerTypes = new Set();
  if (raw.pointerType) pointerTypes.add(String(raw.pointerType));
  for (const stroke of Array.isArray(raw.strokes) ? raw.strokes : []) {
    if (stroke?.pointerType) pointerTypes.add(String(stroke.pointerType));
  }

  const canvas = raw.canvas && typeof raw.canvas === "object"
    ? { width: finiteNumber(raw.canvas.width, 0), height: finiteNumber(raw.canvas.height, 0) }
    : { width: finiteNumber(raw.canvasWidth ?? options.canvasWidth, 0), height: finiteNumber(raw.canvasHeight ?? options.canvasHeight, 0) };

  return {
    schema: raw.schema || STROKE_GLYPH_SCHEMA,
    strokes,
    bounds,
    duration: Math.max(0, finiteNumber(raw.duration, endTime - startTime)),
    pointerType: Array.from(pointerTypes).join(",") || String(options.pointerType || "unknown"),
    canvas,
    metadata: {
      ...(raw.metadata && typeof raw.metadata === "object" ? raw.metadata : {}),
      pointCount: allPoints.length,
      strokeCount: strokes.length,
      startTime,
      endTime,
    },
  };
}

export function cloneStrokeGlyph(glyph = {}) {
  const source = coerceStrokeGlyph(glyph);
  return {
    ...source,
    bounds: source.bounds ? { ...source.bounds } : null,
    canvas: source.canvas ? { ...source.canvas } : null,
    metadata: { ...(source.metadata || {}) },
    strokes: source.strokes.map((stroke) => ({
      points: stroke.points.map((point) => ({ ...point })),
    })),
  };
}
