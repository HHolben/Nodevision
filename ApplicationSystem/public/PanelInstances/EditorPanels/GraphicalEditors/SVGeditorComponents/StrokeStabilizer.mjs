// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/StrokeStabilizer.mjs
// Freehand stroke stabilization and simplification for SVG vector drawing.

const EPSILON = 1e-9;

export const STABILIZATION_MODE_PROFILES = Object.freeze({
  none: { smoothing: 0, simplify: 0.2, minDistance: 0, cornerAngle: 35, rope: 0 },
  light: { smoothing: 0.22, simplify: 0.55, minDistance: 0.25, cornerAngle: 42, rope: 0 },
  medium: { smoothing: 0.45, simplify: 0.85, minDistance: 0.4, cornerAngle: 48, rope: 0 },
  strong: { smoothing: 0.68, simplify: 1.25, minDistance: 0.65, cornerAngle: 54, rope: 0 },
  technical: { smoothing: 0.12, simplify: 0.95, minDistance: 0.25, cornerAngle: 30, rope: 0 },
  "delayed-rope": { smoothing: 0.55, simplify: 0.75, minDistance: 0.35, cornerAngle: 50, rope: 0.65 },
});

function clamp(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function cloneSample(sample) {
  return {
    ...sample,
    x: Number(sample.x),
    y: Number(sample.y),
  };
}

function finiteSamples(samples = []) {
  const out = [];
  samples.forEach((sample) => {
    const x = Number(sample?.x);
    const y = Number(sample?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const next = cloneSample({ ...sample, x, y });
    const prev = out[out.length - 1];
    if (!prev || Math.hypot(prev.x - next.x, prev.y - next.y) > EPSILON) out.push(next);
  });
  return out;
}

function distance(a, b) {
  return Math.hypot(Number(a.x) - Number(b.x), Number(a.y) - Number(b.y));
}

export function filterByMinDistance(samples = [], minDistance = 0) {
  const list = finiteSamples(samples);
  const threshold = Math.max(0, Number(minDistance) || 0);
  if (list.length < 3 || threshold <= EPSILON) return list.map(cloneSample);
  const out = [cloneSample(list[0])];
  for (let i = 1; i < list.length - 1; i += 1) {
    if (distance(out[out.length - 1], list[i]) >= threshold) out.push(cloneSample(list[i]));
  }
  const last = list[list.length - 1];
  if (distance(out[out.length - 1], last) > EPSILON) out.push(cloneSample(last));
  return out;
}

function turnAngleDegrees(prev, current, next) {
  const ax = prev.x - current.x;
  const ay = prev.y - current.y;
  const bx = next.x - current.x;
  const by = next.y - current.y;
  const al = Math.hypot(ax, ay);
  const bl = Math.hypot(bx, by);
  if (al <= EPSILON || bl <= EPSILON) return 180;
  const dot = (ax * bx + ay * by) / (al * bl);
  return Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI;
}

export function detectCornerIndices(points = [], options = {}) {
  const list = finiteSamples(points);
  const threshold = clamp(options.cornerAngleDegrees, 8, 175, 45);
  const indices = new Set();
  if (list.length) {
    indices.add(0);
    indices.add(list.length - 1);
  }
  for (let i = 1; i < list.length - 1; i += 1) {
    const angle = turnAngleDegrees(list[i - 1], list[i], list[i + 1]);
    if (angle <= 180 - threshold) indices.add(i);
  }
  return indices;
}

function smoothSamples(samples = [], amount = 0, preserve = new Set()) {
  const list = finiteSamples(samples);
  if (list.length < 3 || amount <= EPSILON) return list;
  const radius = Math.max(1, Math.round(1 + amount * 4));
  const passes = Math.max(1, Math.round(1 + amount * 3));
  let current = list.map(cloneSample);
  for (let pass = 0; pass < passes; pass += 1) {
    current = current.map((sample, index) => {
      if (index === 0 || index === current.length - 1 || preserve.has(index)) return cloneSample(sample);
      let sx = 0;
      let sy = 0;
      let pressure = 0;
      let count = 0;
      for (let j = Math.max(0, index - radius); j <= Math.min(current.length - 1, index + radius); j += 1) {
        const weight = preserve.has(j) ? 1.5 : 1;
        sx += current[j].x * weight;
        sy += current[j].y * weight;
        pressure += (Number(current[j].pressure) || 0.5) * weight;
        count += weight;
      }
      return {
        ...sample,
        x: sx / count,
        y: sy / count,
        pressure: pressure / count,
      };
    });
  }
  return current;
}

function pointSegmentDistance(point, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const apx = point.x - a.x;
  const apy = point.y - a.y;
  const ab2 = abx * abx + aby * aby;
  if (ab2 <= EPSILON) return distance(point, a);
  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / ab2));
  const x = a.x + abx * t;
  const y = a.y + aby * t;
  return Math.hypot(point.x - x, point.y - y);
}

function rdpRecursive(points, first, last, tolerance, keep, out) {
  let bestIndex = -1;
  let bestDistance = -1;
  for (let i = first + 1; i < last; i += 1) {
    const d = keep.has(i) ? tolerance + 1 : pointSegmentDistance(points[i], points[first], points[last]);
    if (d > bestDistance) {
      bestDistance = d;
      bestIndex = i;
    }
  }
  if (bestIndex > first && bestDistance > tolerance) {
    rdpRecursive(points, first, bestIndex, tolerance, keep, out);
    out.push(bestIndex);
    rdpRecursive(points, bestIndex, last, tolerance, keep, out);
  }
}

export function simplifyRdp(points = [], tolerance = 0, keepIndices = new Set()) {
  const list = finiteSamples(points);
  const tol = Math.max(0, Number(tolerance) || 0);
  if (list.length < 3 || tol <= EPSILON) return list.map(cloneSample);
  const keep = new Set(keepIndices || []);
  keep.add(0);
  keep.add(list.length - 1);
  const indices = [0];
  rdpRecursive(list, 0, list.length - 1, tol, keep, indices);
  indices.push(list.length - 1);
  return [...new Set(indices)].sort((a, b) => a - b).map((index) => cloneSample(list[index]));
}

function applyDelayedRope(samples = [], amount = 0) {
  const list = finiteSamples(samples);
  if (list.length < 3 || amount <= EPSILON) return list;
  const out = [cloneSample(list[0])];
  let cursor = cloneSample(list[0]);
  const rope = Math.max(0.01, amount);
  for (let i = 1; i < list.length; i += 1) {
    const target = list[i];
    cursor = {
      ...target,
      x: cursor.x + (target.x - cursor.x) * (1 - rope * 0.72),
      y: cursor.y + (target.y - cursor.y) * (1 - rope * 0.72),
      pressure: target.pressure,
    };
    out.push(cursor);
  }
  out[out.length - 1] = cloneSample(list[list.length - 1]);
  return out;
}

export function stabilizeStroke(samples = [], options = {}) {
  const mode = String(options.mode || "light").toLowerCase();
  const profile = STABILIZATION_MODE_PROFILES[mode] || STABILIZATION_MODE_PROFILES.light;
  const strength = clamp(options.strength, 0, 1, 0.35);
  const smoothing = clamp(options.smoothing, 0, 1, profile.smoothing);
  const preserveCorners = options.preserveCorners !== false;
  const minDistance = Math.max(0, Number(options.minimumPointDistance ?? profile.minDistance) || 0);
  const simplification = Math.max(0, Number(options.curveSimplification ?? profile.simplify) || 0);
  const cornerAngleDegrees = clamp(options.cornerAngleDegrees, 8, 175, profile.cornerAngle);

  const original = finiteSamples(samples);
  if (original.length <= 1 || mode === "none") {
    return {
      samples: original.map(cloneSample),
      points: original.map(({ x, y }) => ({ x, y })),
      cornerIndices: new Set(original.length ? [0, original.length - 1] : []),
    };
  }

  let current = filterByMinDistance(original, minDistance * (0.25 + strength));
  if (profile.rope > 0) current = applyDelayedRope(current, profile.rope * (0.35 + strength));
  const cornerIndices = preserveCorners
    ? detectCornerIndices(current, { cornerAngleDegrees })
    : new Set(current.length ? [0, current.length - 1] : []);
  current = smoothSamples(current, smoothing * (0.35 + strength), cornerIndices);
  const simplified = simplifyRdp(
    current,
    simplification * (0.35 + strength),
    preserveCorners ? cornerIndices : new Set([0, current.length - 1]),
  );

  if (simplified.length && original.length) {
    simplified[0] = { ...simplified[0], x: original[0].x, y: original[0].y };
    simplified[simplified.length - 1] = {
      ...simplified[simplified.length - 1],
      x: original[original.length - 1].x,
      y: original[original.length - 1].y,
    };
  }

  return {
    samples: simplified,
    points: simplified.map(({ x, y }) => ({ x, y })),
    cornerIndices,
  };
}

export function createIncrementalStrokeSampler(options = {}) {
  const samples = [];
  const minDistance = Math.max(0, Number(options.minimumPointDistance) || 0);
  return {
    add(sample) {
      if (!sample || !Number.isFinite(Number(sample.x)) || !Number.isFinite(Number(sample.y))) return false;
      const next = cloneSample(sample);
      const prev = samples[samples.length - 1];
      if (prev && minDistance > EPSILON && distance(prev, next) < minDistance) {
        samples[samples.length - 1] = next;
        return false;
      }
      samples.push(next);
      return true;
    },
    replaceLast(sample) {
      if (!samples.length || !sample) return false;
      samples[samples.length - 1] = cloneSample(sample);
      return true;
    },
    getSamples() {
      return samples.map(cloneSample);
    },
    clear() {
      samples.length = 0;
    },
  };
}

export function pointsToPathD(points = []) {
  const list = finiteSamples(points);
  if (!list.length) return "";
  let d = `M ${list[0].x} ${list[0].y}`;
  for (let i = 1; i < list.length; i += 1) {
    d += ` L ${list[i].x} ${list[i].y}`;
  }
  return d;
}

