// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/ShapeRecognition.mjs
// Draw-and-hold geometric recognition for SVG-native correction previews.

import { simplifyRdp, pointsToPathD } from "./StrokeStabilizer.mjs";
import { fitTriangleHypothesis } from "./PencilSketchTriangleFit.mjs";
import { fitQuadrilateralHypothesis } from "./PencilSketchQuadrilateralFit.mjs";

const EPSILON = 1e-9;

function clamp(value, min, max, fallback = min) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function confidenceFromError(error, scale, min = 0, max = 1) {
  if (!Number.isFinite(error) || !Number.isFinite(scale) || scale <= EPSILON) return min;
  return clamp(1 - (error / scale), min, max, min);
}

function toPoint(raw) {
  const x = Number(raw?.x);
  const y = Number(raw?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

export function normalizeShapePoints(points = []) {
  const out = [];
  points.forEach((raw) => {
    const pt = toPoint(raw);
    if (!pt) return;
    const prev = out[out.length - 1];
    if (!prev || Math.hypot(prev.x - pt.x, prev.y - pt.y) > EPSILON) out.push(pt);
  });
  return out;
}

function distance(a, b) {
  return Math.hypot(Number(a?.x) - Number(b?.x), Number(a?.y) - Number(b?.y));
}

function strokeLength(points = []) {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) total += distance(points[i - 1], points[i]);
  return total;
}

function boundsFor(points = []) {
  if (!points.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  points.forEach((pt) => {
    minX = Math.min(minX, pt.x);
    minY = Math.min(minY, pt.y);
    maxX = Math.max(maxX, pt.x);
    maxY = Math.max(maxY, pt.y);
  });
  if (![minX, minY, maxX, maxY].every(Number.isFinite)) return null;
  return {
    x: minX,
    y: minY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY),
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    diagonal: Math.hypot(maxX - minX, maxY - minY),
  };
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

function averageDistanceToPolyline(points = [], polyline = [], closed = false) {
  if (!points.length || polyline.length < 2) return Infinity;
  let total = 0;
  points.forEach((pt) => {
    let best = Infinity;
    for (let i = 1; i < polyline.length; i += 1) {
      best = Math.min(best, pointSegmentDistance(pt, polyline[i - 1], polyline[i]));
    }
    if (closed && polyline.length > 2) {
      best = Math.min(best, pointSegmentDistance(pt, polyline[polyline.length - 1], polyline[0]));
    }
    total += best;
  });
  return total / points.length;
}

function polygonArea(points = []) {
  if (points.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area) / 2;
}

function vector(a, b) {
  return { x: b.x - a.x, y: b.y - a.y };
}

function angleBetween(a, b) {
  const al = Math.hypot(a.x, a.y);
  const bl = Math.hypot(b.x, b.y);
  if (al <= EPSILON || bl <= EPSILON) return 0;
  const dot = (a.x * b.x + a.y * b.y) / (al * bl);
  return Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI;
}

function internalAngles(vertices = []) {
  return vertices.map((pt, index) => {
    const prev = vertices[(index + vertices.length - 1) % vertices.length];
    const next = vertices[(index + 1) % vertices.length];
    return angleBetween(vector(pt, prev), vector(pt, next));
  });
}

function closeEnough(points, bounds) {
  if (points.length < 3 || !bounds) return false;
  const closeDistance = distance(points[0], points[points.length - 1]);
  return closeDistance <= Math.max(bounds.diagonal * 0.16, 1e-4);
}

function removeClosingDuplicate(points = []) {
  const list = normalizeShapePoints(points);
  if (list.length > 2 && distance(list[0], list[list.length - 1]) <= Math.max(1e-6, boundsFor(list)?.diagonal * 0.03 || 1e-6)) {
    return list.slice(0, -1);
  }
  return list;
}

function simplifyClosedVertices(points = [], tolerance = 1, maxVertices = 12) {
  let source = removeClosingDuplicate(points);
  if (source.length < 3) return source;
  let tol = Math.max(0, tolerance);
  let simplified = simplifyRdp([...source, source[0]], tol).slice(0, -1);
  let guard = 0;
  while (simplified.length > maxVertices && guard < 10) {
    guard += 1;
    tol *= 1.35;
    simplified = simplifyRdp([...source, source[0]], tol).slice(0, -1);
  }
  return removeClosingDuplicate(simplified);
}

function simplifyOpenVertices(points = [], tolerance = 1, maxVertices = 12) {
  let tol = Math.max(0, tolerance);
  let simplified = simplifyRdp(points, tol);
  let guard = 0;
  while (simplified.length > maxVertices && guard < 10) {
    guard += 1;
    tol *= 1.35;
    simplified = simplifyRdp(points, tol);
  }
  return simplified;
}

function lineCandidate(points, bounds, options) {
  if (points.length < 2 || !bounds) return null;
  const start = points[0];
  const end = points[points.length - 1];
  const chord = distance(start, end);
  const length = strokeLength(points);
  if (chord <= Math.max(1e-5, bounds.diagonal * 0.08) || length <= EPSILON) return null;
  const meanError = points.reduce((sum, pt) => sum + pointSegmentDistance(pt, start, end), 0) / points.length;
  const linearity = chord / Math.max(length, EPSILON);
  const errorScore = confidenceFromError(meanError, Math.max(bounds.diagonal * 0.055, 0.01));
  const confidence = clamp((linearity * 0.62) + (errorScore * 0.38), 0, 1);
  if (linearity < 0.86 || confidence < options.threshold) return null;
  return {
    type: "line",
    primitive: "line",
    confidence,
    closed: false,
    points: [start, end],
    metrics: { meanError, linearity },
  };
}

function ellipseCandidate(points, bounds, options) {
  if (!bounds || bounds.width <= EPSILON || bounds.height <= EPSILON || !closeEnough(points, bounds)) return null;
  const rx = bounds.width / 2;
  const ry = bounds.height / 2;
  if (rx <= EPSILON || ry <= EPSILON) return null;
  let radialError = 0;
  let minAngle = Infinity;
  let maxAngle = -Infinity;
  points.forEach((pt) => {
    const nx = (pt.x - bounds.cx) / rx;
    const ny = (pt.y - bounds.cy) / ry;
    radialError += Math.abs(Math.hypot(nx, ny) - 1);
    const angle = Math.atan2(ny, nx);
    minAngle = Math.min(minAngle, angle);
    maxAngle = Math.max(maxAngle, angle);
  });
  radialError /= Math.max(1, points.length);
  const aspect = rx > ry ? ry / rx : rx / ry;
  const circleLike = aspect >= 0.84;
  const confidence = clamp(
    confidenceFromError(radialError, 0.16) * 0.72 +
      confidenceFromError(distance(points[0], points[points.length - 1]), bounds.diagonal * 0.18) * 0.28,
    0,
    1,
  );
  if (confidence < options.threshold) return null;
  return {
    type: circleLike ? "circle" : "ellipse",
    primitive: circleLike ? "circle" : "ellipse",
    confidence,
    closed: true,
    points,
    bounds,
    cx: bounds.cx,
    cy: bounds.cy,
    rx,
    ry,
    r: (rx + ry) / 2,
    metrics: { radialError, aspect, angleSpan: maxAngle - minAngle },
  };
}

function isAxisAlignedRectangle(vertices = [], bounds) {
  if (vertices.length !== 4 || !bounds) return false;
  const tol = Math.max(bounds.diagonal * 0.08, 0.01);
  return vertices.every((pt) =>
    Math.min(
      Math.abs(pt.x - bounds.x),
      Math.abs(pt.x - (bounds.x + bounds.width)),
      Math.abs(pt.y - bounds.y),
      Math.abs(pt.y - (bounds.y + bounds.height)),
    ) <= tol
  );
}

function rectangleCandidate(points, bounds, options) {
  if (!bounds || !closeEnough(points, bounds) || bounds.width <= EPSILON || bounds.height <= EPSILON) return null;
  const vertices = simplifyClosedVertices(points, bounds.diagonal * 0.035, 6);
  if (vertices.length !== 4) return null;
  const angles = internalAngles(vertices);
  const worstAngleError = Math.max(...angles.map((angle) => Math.abs(angle - 90)));
  const meanError = averageDistanceToPolyline(points, vertices, true);
  const areaRatio = polygonArea(vertices) / Math.max(bounds.width * bounds.height, EPSILON);
  const angleScore = confidenceFromError(worstAngleError, 28);
  const errorScore = confidenceFromError(meanError, bounds.diagonal * 0.06);
  const areaScore = clamp(areaRatio, 0, 1);
  let confidence = (angleScore * 0.45) + (errorScore * 0.35) + (areaScore * 0.2);

  let sketchFit = null;
  try {
    const tri = fitTriangleHypothesis([{ points }], { confidenceThreshold: 0.45 });
    sketchFit = fitQuadrilateralHypothesis([{ points }], {
      confidenceThreshold: 0.45,
      triangleError: tri?.threeSegmentError || bounds.diagonal,
    });
    if (sketchFit?.quadrilateral) confidence = Math.max(confidence, clamp(Number(sketchFit.confidence) || 0, 0, 1));
  } catch {
    // Existing sketch predictors are advisory for draw-hold.
  }

  if (confidence < options.threshold) return null;
  const axisAligned = isAxisAlignedRectangle(vertices, bounds);
  const rounded = axisAligned &&
    points.length > 10 &&
    meanError > bounds.diagonal * 0.008 &&
    worstAngleError < 22 &&
    confidence > options.threshold + 0.04;
  return {
    type: rounded ? "rounded-rectangle" : "rectangle",
    primitive: axisAligned ? "rect" : "polygon",
    confidence,
    closed: true,
    points: vertices,
    bounds,
    rx: rounded ? Math.min(bounds.width, bounds.height) * 0.08 : 0,
    metrics: { worstAngleError, meanError, areaRatio, axisAligned, sketchFit },
  };
}

function triangleCandidate(points, bounds, options) {
  if (!bounds || !closeEnough(points, bounds)) return null;
  const vertices = simplifyClosedVertices(points, bounds.diagonal * 0.04, 5);
  if (vertices.length !== 3) return null;
  const angles = internalAngles(vertices);
  if (angles.some((angle) => angle < 12 || angle > 156)) return null;
  const meanError = averageDistanceToPolyline(points, vertices, true);
  let confidence = confidenceFromError(meanError, bounds.diagonal * 0.065) * 0.82 +
    clamp(polygonArea(vertices) / Math.max(bounds.width * bounds.height, EPSILON), 0, 1) * 0.18;
  try {
    const sketchFit = fitTriangleHypothesis([{ points }], { confidenceThreshold: 0.45 });
    if (sketchFit?.triangle || sketchFit?.threeSegment) {
      confidence = Math.max(confidence, clamp(Number(sketchFit.confidence) || 0, 0, 1));
    }
  } catch {
    // Advisory only.
  }
  if (confidence < options.threshold) return null;
  return {
    type: "triangle",
    primitive: "polygon",
    confidence,
    closed: true,
    points: vertices,
    metrics: { meanError, angles },
  };
}

function polygonCandidate(points, bounds, options) {
  if (!bounds || !closeEnough(points, bounds)) return null;
  const vertices = simplifyClosedVertices(points, bounds.diagonal * 0.035, 12);
  if (vertices.length < 3 || vertices.length > 12) return null;
  if (vertices.length === 3 || vertices.length === 4) return null;
  const meanError = averageDistanceToPolyline(points, vertices, true);
  const confidence = confidenceFromError(meanError, bounds.diagonal * 0.07) * 0.9 +
    clamp(polygonArea(vertices) / Math.max(bounds.width * bounds.height, EPSILON), 0, 1) * 0.1;
  if (confidence < options.threshold) return null;
  return {
    type: "polygon",
    primitive: "polygon",
    confidence,
    closed: true,
    points: vertices,
    metrics: { meanError, vertexCount: vertices.length },
  };
}

function polylineCandidate(points, bounds, options) {
  if (!bounds || closeEnough(points, bounds)) return null;
  const vertices = simplifyOpenVertices(points, bounds.diagonal * 0.035, 12);
  if (vertices.length < 3 || vertices.length > 12) return null;
  const meanError = averageDistanceToPolyline(points, vertices, false);
  const angles = [];
  for (let i = 1; i < vertices.length - 1; i += 1) {
    angles.push(angleBetween(vector(vertices[i], vertices[i - 1]), vector(vertices[i], vertices[i + 1])));
  }
  const hasIntentionalCorner = angles.some((angle) => angle < 142);
  if (!hasIntentionalCorner) return null;
  const confidence = confidenceFromError(meanError, bounds.diagonal * 0.06);
  if (confidence < options.threshold) return null;
  return {
    type: "polyline",
    primitive: "polyline",
    confidence,
    closed: false,
    points: vertices,
    metrics: { meanError, angles },
  };
}

function fitCircle(points = []) {
  if (points.length < 3) return null;
  let sumX = 0;
  let sumY = 0;
  let sumX2 = 0;
  let sumY2 = 0;
  let sumXY = 0;
  let sumX3 = 0;
  let sumY3 = 0;
  let sumX1Y2 = 0;
  let sumX2Y1 = 0;
  const n = points.length;
  points.forEach((pt) => {
    const x = pt.x;
    const y = pt.y;
    const x2 = x * x;
    const y2 = y * y;
    sumX += x;
    sumY += y;
    sumX2 += x2;
    sumY2 += y2;
    sumXY += x * y;
    sumX3 += x2 * x;
    sumY3 += y2 * y;
    sumX1Y2 += x * y2;
    sumX2Y1 += x2 * y;
  });
  const c = n * sumX2 - sumX * sumX;
  const d = n * sumXY - sumX * sumY;
  const e = n * sumY2 - sumY * sumY;
  const g = 0.5 * (n * (sumX3 + sumX1Y2) - sumX * (sumX2 + sumY2));
  const h = 0.5 * (n * (sumY3 + sumX2Y1) - sumY * (sumX2 + sumY2));
  const denom = c * e - d * d;
  if (Math.abs(denom) <= EPSILON) return null;
  const cx = (g * e - d * h) / denom;
  const cy = (c * h - d * g) / denom;
  const radii = points.map((pt) => Math.hypot(pt.x - cx, pt.y - cy));
  const r = radii.reduce((acc, value) => acc + value, 0) / radii.length;
  if (!Number.isFinite(cx) || !Number.isFinite(cy) || !Number.isFinite(r) || r <= EPSILON) return null;
  const rms = Math.sqrt(radii.reduce((acc, value) => acc + (value - r) ** 2, 0) / radii.length);
  return { cx, cy, r, rms };
}

function unwrapAngles(angles) {
  if (!angles.length) return [];
  const out = [angles[0]];
  for (let i = 1; i < angles.length; i += 1) {
    let value = angles[i];
    while (value - out[i - 1] > Math.PI) value -= Math.PI * 2;
    while (value - out[i - 1] < -Math.PI) value += Math.PI * 2;
    out.push(value);
  }
  return out;
}

function arcCandidate(points, bounds, options) {
  if (!bounds || closeEnough(points, bounds) || points.length < 5) return null;
  const fit = fitCircle(points);
  if (!fit) return null;
  const angles = unwrapAngles(points.map((pt) => Math.atan2(pt.y - fit.cy, pt.x - fit.cx)));
  const span = Math.abs(angles[angles.length - 1] - angles[0]);
  if (span < Math.PI / 8 || span > Math.PI * 1.85) return null;
  const confidence = confidenceFromError(fit.rms, Math.max(fit.r * 0.07, bounds.diagonal * 0.025));
  const chord = distance(points[0], points[points.length - 1]);
  if (chord < fit.r * 0.25 || confidence < options.threshold) return null;
  return {
    type: "arc",
    primitive: "path",
    confidence,
    closed: false,
    points: [points[0], points[points.length - 1]],
    cx: fit.cx,
    cy: fit.cy,
    r: fit.r,
    sweep: angles[angles.length - 1] >= angles[0] ? 1 : 0,
    largeArc: span > Math.PI ? 1 : 0,
    metrics: { rms: fit.rms, span },
  };
}

function smoothCurveCandidate(points, bounds, options) {
  if (!bounds || closeEnough(points, bounds) || points.length < 4) return null;
  const length = strokeLength(points);
  const chord = distance(points[0], points[points.length - 1]);
  if (length <= EPSILON || chord / length > 0.88) return null;
  const simplified = simplifyOpenVertices(points, bounds.diagonal * 0.018, 48);
  const confidence = clamp(0.62 + Math.min(0.18, (length - chord) / Math.max(length, EPSILON) * 0.35), 0, 0.8);
  if (confidence < Math.max(0.45, options.threshold - 0.08)) return null;
  return {
    type: "smooth-open-curve",
    primitive: "path",
    confidence,
    closed: false,
    points: simplified,
    metrics: { length, chord },
  };
}

function bestCandidate(candidates = []) {
  const ranked = candidates
    .filter(Boolean)
    .filter((candidate) => Number.isFinite(candidate.confidence))
    .sort((a, b) => b.confidence - a.confidence);
  return ranked[0] || null;
}

export function recognizeShape(points = [], options = {}) {
  const normalized = normalizeShapePoints(points);
  const bounds = boundsFor(normalized);
  const sensitivity = clamp(options.sensitivity, 0, 1, 0.62);
  const threshold = clamp(options.confidenceThreshold, 0.42, 0.9, 0.58 + sensitivity * 0.12);
  const opts = { ...options, threshold };
  if (!bounds || normalized.length < 2 || bounds.diagonal < (Number(options.minSize) || 1.5)) {
    return {
      type: "irregular",
      primitive: "path",
      confidence: 0,
      recognized: false,
      reason: "too-small",
      points: normalized,
    };
  }

  const candidates = [
    lineCandidate(normalized, bounds, opts),
    rectangleCandidate(normalized, bounds, opts),
    triangleCandidate(normalized, bounds, opts),
    ellipseCandidate(normalized, bounds, opts),
    polygonCandidate(normalized, bounds, opts),
    polylineCandidate(normalized, bounds, opts),
    arcCandidate(normalized, bounds, opts),
    smoothCurveCandidate(normalized, bounds, opts),
  ];
  const best = bestCandidate(candidates);
  if (!best || best.confidence < threshold) {
    return {
      type: "irregular",
      primitive: "path",
      confidence: best?.confidence || 0,
      recognized: false,
      reason: "low-confidence",
      points: normalized,
      candidate: best,
    };
  }
  return {
    ...best,
    recognized: true,
    bounds: best.bounds || bounds,
  };
}

function fmt(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  return String(Number(n.toFixed(4)));
}

function pointsAttr(points = []) {
  return points.map((pt) => `${fmt(pt.x)},${fmt(pt.y)}`).join(" ");
}

function pathFromClosedPoints(points = []) {
  if (!points.length) return "";
  return `${pointsToPathD(points)} Z`;
}

function smoothPathD(points = []) {
  const list = normalizeShapePoints(points);
  if (list.length < 3) return pointsToPathD(list);
  let d = `M ${fmt(list[0].x)} ${fmt(list[0].y)}`;
  for (let i = 1; i < list.length - 1; i += 1) {
    const mid = {
      x: (list[i].x + list[i + 1].x) / 2,
      y: (list[i].y + list[i + 1].y) / 2,
    };
    d += ` Q ${fmt(list[i].x)} ${fmt(list[i].y)} ${fmt(mid.x)} ${fmt(mid.y)}`;
  }
  const last = list[list.length - 1];
  d += ` T ${fmt(last.x)} ${fmt(last.y)}`;
  return d;
}

function regularPolygonFrom(points = [], count = 3) {
  const bounds = boundsFor(points);
  if (!bounds || count < 3) return points;
  const radius = Math.max(bounds.width, bounds.height) / 2;
  const startAngle = Math.atan2(points[0].y - bounds.cy, points[0].x - bounds.cx);
  return Array.from({ length: count }, (_, index) => {
    const theta = startAngle + (Math.PI * 2 * index) / count;
    return {
      x: bounds.cx + Math.cos(theta) * radius,
      y: bounds.cy + Math.sin(theta) * radius,
    };
  });
}

function constrainLine(points, options = {}) {
  const start = { ...points[0] };
  const end = { ...points[1] };
  if (options.horizontal) {
    end.y = start.y;
  } else if (options.vertical) {
    end.x = start.x;
  } else if (options.angleSnap) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const len = Math.hypot(dx, dy);
    if (len > EPSILON) {
      const inc = Math.PI / 12;
      const theta = Math.round(Math.atan2(dy, dx) / inc) * inc;
      end.x = start.x + Math.cos(theta) * len;
      end.y = start.y + Math.sin(theta) * len;
    }
  }
  return [start, end];
}

export function shapeToSvgSpec(result, style = {}, options = {}) {
  const stroke = style.stroke || "#000000";
  const strokeWidth = String(style.strokeWidth || "1");
  const closedFill = style.fill || "none";
  const openAttrs = { fill: "none", stroke, "stroke-width": strokeWidth, "stroke-linecap": "round", "stroke-linejoin": "round" };
  const closedAttrs = { fill: closedFill, stroke, "stroke-width": strokeWidth, "stroke-linejoin": "round" };
  const convertToPath = Boolean(options.convertToPath);
  const type = result?.type || "irregular";

  if (type === "line") {
    const [a, b] = constrainLine(result.points || [], options);
    if (convertToPath) {
      return { tag: "path", attrs: { ...openAttrs, d: `M ${fmt(a.x)} ${fmt(a.y)} L ${fmt(b.x)} ${fmt(b.y)}` } };
    }
    return {
      tag: "line",
      attrs: { stroke, "stroke-width": strokeWidth, x1: fmt(a.x), y1: fmt(a.y), x2: fmt(b.x), y2: fmt(b.y) },
    };
  }

  if (type === "circle" || (type === "ellipse" && options.perfectCircle)) {
    const cx = Number(result.cx ?? result.bounds?.cx ?? 0);
    const cy = Number(result.cy ?? result.bounds?.cy ?? 0);
    const r = Number(result.r ?? ((Number(result.rx) || 0) + (Number(result.ry) || 0)) / 2);
    if (convertToPath) {
      return {
        tag: "path",
        attrs: {
          ...closedAttrs,
          d: `M ${fmt(cx - r)} ${fmt(cy)} A ${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(cx + r)} ${fmt(cy)} A ${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(cx - r)} ${fmt(cy)} Z`,
        },
      };
    }
    return { tag: "circle", attrs: { ...closedAttrs, cx: fmt(cx), cy: fmt(cy), r: fmt(r) } };
  }

  if (type === "ellipse") {
    const cx = Number(result.cx ?? result.bounds?.cx ?? 0);
    const cy = Number(result.cy ?? result.bounds?.cy ?? 0);
    const rx = Number(result.rx || 0);
    const ry = Number(result.ry || 0);
    if (convertToPath) {
      return {
        tag: "path",
        attrs: {
          ...closedAttrs,
          d: `M ${fmt(cx - rx)} ${fmt(cy)} A ${fmt(rx)} ${fmt(ry)} 0 1 0 ${fmt(cx + rx)} ${fmt(cy)} A ${fmt(rx)} ${fmt(ry)} 0 1 0 ${fmt(cx - rx)} ${fmt(cy)} Z`,
        },
      };
    }
    return { tag: "ellipse", attrs: { ...closedAttrs, cx: fmt(cx), cy: fmt(cy), rx: fmt(rx), ry: fmt(ry) } };
  }

  if ((type === "rectangle" || type === "rounded-rectangle") && result.primitive === "rect" && result.bounds && !convertToPath) {
    const attrs = {
      ...closedAttrs,
      x: fmt(result.bounds.x),
      y: fmt(result.bounds.y),
      width: fmt(result.bounds.width),
      height: fmt(result.bounds.height),
    };
    if (type === "rounded-rectangle" && Number(result.rx) > 0) {
      attrs.rx = fmt(result.rx);
      attrs.ry = fmt(result.rx);
    }
    return { tag: "rect", attrs };
  }

  if (type === "rectangle" || type === "rounded-rectangle" || type === "triangle" || type === "polygon") {
    let pts = normalizeShapePoints(result.points || []);
    if (options.equalSides && pts.length >= 3) pts = regularPolygonFrom(pts, pts.length);
    if (convertToPath) return { tag: "path", attrs: { ...closedAttrs, d: pathFromClosedPoints(pts) } };
    return { tag: "polygon", attrs: { ...closedAttrs, points: pointsAttr(pts) } };
  }

  if (type === "polyline") {
    const pts = normalizeShapePoints(result.points || []);
    if (options.closePath) {
      if (convertToPath) return { tag: "path", attrs: { ...closedAttrs, d: pathFromClosedPoints(pts) } };
      return { tag: "polygon", attrs: { ...closedAttrs, points: pointsAttr(pts) } };
    }
    if (convertToPath) return { tag: "path", attrs: { ...openAttrs, d: pointsToPathD(pts) } };
    return { tag: "polyline", attrs: { ...openAttrs, points: pointsAttr(pts) } };
  }

  if (type === "arc") {
    const a = result.points?.[0] || { x: 0, y: 0 };
    const b = result.points?.[1] || a;
    const r = Math.max(0.001, Number(result.r) || distance(a, b) / 2 || 1);
    return {
      tag: "path",
      attrs: {
        ...openAttrs,
        d: `M ${fmt(a.x)} ${fmt(a.y)} A ${fmt(r)} ${fmt(r)} 0 ${result.largeArc ? 1 : 0} ${result.sweep ? 1 : 0} ${fmt(b.x)} ${fmt(b.y)}`,
      },
    };
  }

  if (type === "smooth-open-curve") {
    return { tag: "path", attrs: { ...openAttrs, d: smoothPathD(result.points || []) } };
  }

  return { tag: "path", attrs: { ...openAttrs, d: pointsToPathD(normalizeShapePoints(result?.points || [])) } };
}

export function createSvgElementFromSpec(createSvgEl, spec) {
  if (!spec || typeof createSvgEl !== "function") return null;
  return createSvgEl(spec.tag || "path", spec.attrs || {});
}

