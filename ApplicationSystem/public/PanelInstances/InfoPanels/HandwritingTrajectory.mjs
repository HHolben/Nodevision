// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/HandwritingTrajectory.mjs
// Pure helpers for normalized handwriting trajectories and deterministic resampling.

export const HANDWRITING_TRAJECTORY_SCHEMA = "nodevision-handwriting-sample/2";
export const HANDWRITING_RASTER_GRID = 28;

export const DEFAULT_TRAJECTORY_OPTIONS = Object.freeze({
  defaultPointIntervalMs: 16,
  defaultPressure: 0.5,
  minSpan: 1e-6,
  rasterGrid: HANDWRITING_RASTER_GRID,
  resamplePointCount: 24,
});

function finiteNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function clamp(value, min, max) {
  const numeric = finiteNumber(value, min);
  return Math.max(min, Math.min(max, numeric));
}

function firstFinite(...values) {
  for (const value of values) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
  }
  return null;
}

function cloneRaster28(raster, grid = HANDWRITING_RASTER_GRID) {
  if (!raster || typeof raster !== "object") return null;
  const rasterGrid = Math.max(1, Math.round(finiteNumber(raster.grid, grid)));
  const rawPoints = Array.isArray(raster.points) ? raster.points : [];
  const points = [];
  const seen = new Set();
  for (const point of rawPoints) {
    const x = Math.round(finiteNumber(point?.x, NaN));
    const y = Math.round(finiteNumber(point?.y, NaN));
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (x < 0 || y < 0 || x >= rasterGrid || y >= rasterGrid) continue;
    const key = `${x},${y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    points.push({ x, y });
  }
  return points.length ? { grid: rasterGrid, points } : null;
}

function cleanRawStrokes(rawStrokes, options) {
  const interval = finiteNumber(options.defaultPointIntervalMs, DEFAULT_TRAJECTORY_OPTIONS.defaultPointIntervalMs);
  const defaultPressure = clamp(options.defaultPressure, 0, 1);
  const strokes = [];
  let globalIndex = 0;

  for (const rawStroke of Array.isArray(rawStrokes) ? rawStrokes : []) {
    if (!Array.isArray(rawStroke)) continue;
    const points = [];
    for (const rawPoint of rawStroke) {
      const x = firstFinite(rawPoint?.x, rawPoint?.clientX, rawPoint?.pageX);
      const y = firstFinite(rawPoint?.y, rawPoint?.clientY, rawPoint?.pageY);
      if (x === null || y === null) continue;
      const t = firstFinite(rawPoint?.t, rawPoint?.time, rawPoint?.timestamp, rawPoint?.timeStamp);
      const pressure = firstFinite(rawPoint?.pressure, rawPoint?.force);
      points.push({
        x,
        y,
        t: t === null ? globalIndex * interval : t,
        pressure: pressure === null ? defaultPressure : clamp(pressure, 0, 1),
      });
      globalIndex += 1;
    }
    if (points.length) strokes.push(points);
  }

  return strokes;
}

export function boundsForTrajectoryStrokes(strokes) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let count = 0;
  for (const stroke of Array.isArray(strokes) ? strokes : []) {
    for (const point of Array.isArray(stroke) ? stroke : []) {
      const x = Number(point?.x);
      const y = Number(point?.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
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

function pathLengthForPoints(points) {
  let length = 0;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const point = points[index];
    const dx = point.x - previous.x;
    const dy = point.y - previous.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (Number.isFinite(distance)) length += distance;
  }
  return length;
}

function directionForEndpoints(points) {
  if (!Array.isArray(points) || points.length < 2) return { x: 0, y: 0 };
  const first = points[0];
  const last = points[points.length - 1];
  const dx = last.x - first.x;
  const dy = last.y - first.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  if (!Number.isFinite(length) || length <= 1e-9) return { x: 0, y: 0 };
  return { x: dx / length, y: dy / length };
}

function normalizePointToSquare(point, bounds, scale, offsetX, offsetY, baseTime) {
  if (scale <= 1e-9) {
    return {
      x: 0.5,
      y: 0.5,
      t: Math.max(0, finiteNumber(point.t, baseTime) - baseTime),
      pressure: clamp(point.pressure, 0, 1),
    };
  }
  return {
    x: clamp(((point.x - bounds.minX) / scale) + offsetX, 0, 1),
    y: clamp(((point.y - bounds.minY) / scale) + offsetY, 0, 1),
    t: Math.max(0, finiteNumber(point.t, baseTime) - baseTime),
    pressure: clamp(point.pressure, 0, 1),
  };
}

/**
 * Convert raw pen strokes into a stable, canvas-independent handwriting sample.
 *
 * Higher-level recognition code may pass an existing 28x28 raster sample through
 * `options.raster28`. If omitted, a lightweight trajectory raster is generated
 * from the normalized stroke path for compatibility with older sample users.
 */
export function normalizeRawHandwritingStrokes(rawStrokes, options = {}) {
  const mergedOptions = { ...DEFAULT_TRAJECTORY_OPTIONS, ...options };
  const raw = cleanRawStrokes(rawStrokes, mergedOptions);
  const originalBounds = boundsForTrajectoryStrokes(raw);
  const character = String(options.character ?? "").trim();

  if (!originalBounds) {
    return {
      schema: HANDWRITING_TRAJECTORY_SCHEMA,
      character,
      strokes: [],
      raster28: cloneRaster28(options.raster28, mergedOptions.rasterGrid),
      metadata: {
        strokeCount: 0,
        pointCount: 0,
        aspectRatio: 1,
        durationMs: 0,
        pathLength: 0,
        rawPathLength: 0,
        startDirection: { x: 0, y: 0 },
        endDirection: { x: 0, y: 0 },
        originalBounds: null,
      },
    };
  }

  const pointCount = raw.reduce((count, stroke) => count + stroke.length, 0);
  const allPoints = raw.flat();
  const startTime = Math.min(...allPoints.map((point) => finiteNumber(point.t, 0)));
  const endTime = Math.max(...allPoints.map((point) => finiteNumber(point.t, startTime)));
  const rawPathLength = raw.reduce((total, stroke) => total + pathLengthForPoints(stroke), 0);
  const width = Math.max(0, originalBounds.width);
  const height = Math.max(0, originalBounds.height);
  const scale = Math.max(width, height, finiteNumber(mergedOptions.minSpan, DEFAULT_TRAJECTORY_OPTIONS.minSpan));
  const offsetX = scale > 1e-9 ? (1 - width / scale) / 2 : 0;
  const offsetY = scale > 1e-9 ? (1 - height / scale) / 2 : 0;

  const strokes = raw.map((stroke) => ({
    points: stroke.map((point) => normalizePointToSquare(point, originalBounds, scale, offsetX, offsetY, startTime)),
  }));
  const normalizedPointGroups = strokes.map((stroke) => stroke.points);
  const pathLength = normalizedPointGroups.reduce((total, stroke) => total + pathLengthForPoints(stroke), 0);
  const aspectRatio = width <= 1e-9 && height <= 1e-9
    ? 1
    : clamp(width / Math.max(height, finiteNumber(mergedOptions.minSpan, DEFAULT_TRAJECTORY_OPTIONS.minSpan)), 0, 9999);
  const flattened = normalizedPointGroups.flat();
  const raster28 = cloneRaster28(options.raster28, mergedOptions.rasterGrid)
    || rasterizeNormalizedTrajectory({ strokes }, mergedOptions.rasterGrid);

  return {
    schema: HANDWRITING_TRAJECTORY_SCHEMA,
    character,
    strokes,
    raster28,
    metadata: {
      strokeCount: strokes.length,
      pointCount,
      aspectRatio,
      durationMs: Math.max(0, endTime - startTime),
      pathLength,
      rawPathLength,
      startDirection: directionForEndpoints(flattened.slice(0, Math.min(flattened.length, 4))),
      endDirection: directionForEndpoints(flattened.slice(Math.max(0, flattened.length - 4))),
      originalBounds: { ...originalBounds },
    },
  };
}

function normalizedPointFromStored(point) {
  const x = clamp(point?.x, 0, 1);
  const y = clamp(point?.y, 0, 1);
  const t = Math.max(0, finiteNumber(point?.t, 0));
  const pressure = clamp(point?.pressure ?? DEFAULT_TRAJECTORY_OPTIONS.defaultPressure, 0, 1);
  return { x, y, t, pressure };
}

/**
 * Validate a stored v2 trajectory sample. Malformed samples return null.
 */
export function normalizeStoredHandwritingSample(rawSample, options = {}) {
  if (!rawSample || typeof rawSample !== "object") return null;
  if (rawSample.schema && rawSample.schema !== HANDWRITING_TRAJECTORY_SCHEMA) return null;
  const strokes = [];
  let pointCount = 0;
  for (const rawStroke of Array.isArray(rawSample.strokes) ? rawSample.strokes : []) {
    const rawPoints = Array.isArray(rawStroke?.points) ? rawStroke.points : [];
    const points = rawPoints.map(normalizedPointFromStored).filter((point) => (
      Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.t)
    ));
    if (!points.length) continue;
    pointCount += points.length;
    strokes.push({ points });
  }
  if (!strokes.length && options.requireStrokes !== false) return null;

  const metadata = rawSample.metadata && typeof rawSample.metadata === "object" ? rawSample.metadata : {};
  const raster28 = cloneRaster28(rawSample.raster28 || rawSample.raster || options.raster28, options.rasterGrid || HANDWRITING_RASTER_GRID)
    || rasterizeNormalizedTrajectory({ strokes }, options.rasterGrid || HANDWRITING_RASTER_GRID);
  const flattened = strokes.flatMap((stroke) => stroke.points);
  const pathLength = finiteNumber(metadata.pathLength, strokes.reduce((total, stroke) => total + pathLengthForPoints(stroke.points), 0));

  return {
    schema: HANDWRITING_TRAJECTORY_SCHEMA,
    character: String(rawSample.character ?? options.character ?? "").trim(),
    strokes,
    raster28,
    metadata: {
      strokeCount: Math.max(0, Math.round(finiteNumber(metadata.strokeCount, strokes.length))),
      pointCount: Math.max(0, Math.round(finiteNumber(metadata.pointCount, pointCount))),
      aspectRatio: finiteNumber(metadata.aspectRatio, 1),
      durationMs: Math.max(0, finiteNumber(metadata.durationMs, 0)),
      pathLength,
      rawPathLength: Math.max(0, finiteNumber(metadata.rawPathLength, pathLength)),
      startDirection: metadata.startDirection || directionForEndpoints(flattened.slice(0, Math.min(flattened.length, 4))),
      endDirection: metadata.endDirection || directionForEndpoints(flattened.slice(Math.max(0, flattened.length - 4))),
      originalBounds: metadata.originalBounds || null,
    },
  };
}

export function rasterizeNormalizedTrajectory(sample, grid = HANDWRITING_RASTER_GRID) {
  const gridSize = Math.max(1, Math.round(finiteNumber(grid, HANDWRITING_RASTER_GRID)));
  const cells = new Uint8Array(gridSize * gridSize);

  const mark = (x, y) => {
    const gx = clamp(Math.round(x * (gridSize - 1)), 0, gridSize - 1);
    const gy = clamp(Math.round(y * (gridSize - 1)), 0, gridSize - 1);
    cells[gy * gridSize + gx] = 1;
  };

  for (const stroke of Array.isArray(sample?.strokes) ? sample.strokes : []) {
    const points = Array.isArray(stroke?.points) ? stroke.points : [];
    if (points.length === 1) {
      mark(points[0].x, points[0].y);
      continue;
    }
    for (let index = 1; index < points.length; index += 1) {
      const previous = points[index - 1];
      const point = points[index];
      const dx = point.x - previous.x;
      const dy = point.y - previous.y;
      const steps = Math.max(1, Math.ceil(Math.sqrt(dx * dx + dy * dy) * gridSize * 1.5));
      for (let step = 0; step <= steps; step += 1) {
        const t = step / steps;
        mark(previous.x + dx * t, previous.y + dy * t);
      }
    }
  }

  const points = [];
  for (let y = 0; y < gridSize; y += 1) {
    for (let x = 0; x < gridSize; x += 1) {
      if (cells[y * gridSize + x]) points.push({ x, y });
    }
  }
  return points.length ? { grid: gridSize, points } : null;
}

function interpolatePoint(a, b, ratio) {
  const t = clamp(ratio, 0, 1);
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    t: finiteNumber(a.t, 0) + (finiteNumber(b.t, 0) - finiteNumber(a.t, 0)) * t,
    pressure: clamp(finiteNumber(a.pressure, DEFAULT_TRAJECTORY_OPTIONS.defaultPressure)
      + (finiteNumber(b.pressure, DEFAULT_TRAJECTORY_OPTIONS.defaultPressure) - finiteNumber(a.pressure, DEFAULT_TRAJECTORY_OPTIONS.defaultPressure)) * t, 0, 1),
  };
}

/**
 * Resample one stroke to a fixed number of points, approximately evenly by path length.
 * The returned array always preserves the original first and last point when possible.
 */
export function resampleStrokePoints(points, targetCount = DEFAULT_TRAJECTORY_OPTIONS.resamplePointCount) {
  const count = Math.max(0, Math.round(finiteNumber(targetCount, DEFAULT_TRAJECTORY_OPTIONS.resamplePointCount)));
  if (!count) return [];
  const clean = (Array.isArray(points) ? points : [])
    .map(normalizedPointFromStored)
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  if (!clean.length) return [];
  if (count === 1) return [{ ...clean[0] }];
  if (clean.length === 1) return Array.from({ length: count }, () => ({ ...clean[0] }));

  const cumulative = [0];
  let total = 0;
  for (let index = 1; index < clean.length; index += 1) {
    const previous = clean[index - 1];
    const point = clean[index];
    const dx = point.x - previous.x;
    const dy = point.y - previous.y;
    const segmentLength = Math.sqrt(dx * dx + dy * dy);
    total += Number.isFinite(segmentLength) ? segmentLength : 0;
    cumulative.push(total);
  }

  if (total <= 1e-9) {
    const repeated = Array.from({ length: count }, () => ({ ...clean[0] }));
    repeated[count - 1] = { ...clean[clean.length - 1] };
    return repeated;
  }

  const output = [];
  let segmentIndex = 1;
  for (let outputIndex = 0; outputIndex < count; outputIndex += 1) {
    if (outputIndex === 0) {
      output.push({ ...clean[0] });
      continue;
    }
    if (outputIndex === count - 1) {
      output.push({ ...clean[clean.length - 1] });
      continue;
    }

    const targetLength = (total * outputIndex) / (count - 1);
    while (segmentIndex < cumulative.length - 1 && cumulative[segmentIndex] < targetLength) {
      segmentIndex += 1;
    }
    const previousLength = cumulative[segmentIndex - 1];
    const nextLength = cumulative[segmentIndex];
    const denominator = Math.max(1e-9, nextLength - previousLength);
    const ratio = (targetLength - previousLength) / denominator;
    output.push(interpolatePoint(clean[segmentIndex - 1], clean[segmentIndex], ratio));
  }
  return output;
}

export function resampleTrajectory(sample, options = {}) {
  const pointCount = Math.max(1, Math.round(finiteNumber(
    options.pointsPerStroke,
    options.resamplePointCount ?? DEFAULT_TRAJECTORY_OPTIONS.resamplePointCount
  )));
  const normalized = normalizeStoredHandwritingSample(sample, { requireStrokes: false }) || sample;
  return {
    ...normalized,
    strokes: (Array.isArray(normalized?.strokes) ? normalized.strokes : []).map((stroke) => ({
      points: resampleStrokePoints(stroke?.points || [], pointCount),
    })),
  };
}

export function flattenTrajectoryPoints(sample) {
  return (Array.isArray(sample?.strokes) ? sample.strokes : []).flatMap((stroke) => (
    Array.isArray(stroke?.points) ? stroke.points : []
  ));
}
