// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/PencilSketchTriangleFit.mjs
// Three-segment closed angular path / triangle hypothesis scoring for pencil previews.

const EPSILON = 1e-6;

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function toPoint(raw) {
  const x = Number(raw?.x);
  const y = Number(raw?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

function distance(a, b) {
  const dx = (Number(a?.x) || 0) - (Number(b?.x) || 0);
  const dy = (Number(a?.y) || 0) - (Number(b?.y) || 0);
  return Math.hypot(dx, dy);
}

function normalizeVector(x, y) {
  const len = Math.hypot(Number(x) || 0, Number(y) || 0);
  if (!Number.isFinite(len) || len <= EPSILON) return null;
  return { x: x / len, y: y / len };
}

function normalizeStroke(stroke, strokeIndex) {
  const source = Array.isArray(stroke?.points) ? stroke.points : stroke;
  if (!Array.isArray(source)) return [];
  const out = [];
  source.forEach((raw) => {
    const pt = toPoint(raw);
    if (!pt) return;
    if (!out.length || distance(out[out.length - 1], pt) > EPSILON) {
      out.push({ ...pt, strokeIndex });
    }
  });
  return out;
}

function strokeLength(points = []) {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += distance(points[i - 1], points[i]);
  }
  return total;
}

function sampleStroke(points = [], sampleCount = 7) {
  if (points.length <= 2) return points.slice();
  const count = Math.max(2, Number.parseInt(sampleCount, 10) || 7);
  const totalLength = strokeLength(points);
  if (totalLength <= EPSILON) return [points[0], points[points.length - 1]];

  const out = [];
  let segmentIndex = 1;
  let segmentStartDistance = 0;
  for (let i = 0; i < count; i += 1) {
    const target = (totalLength * i) / (count - 1);
    while (segmentIndex < points.length) {
      const a = points[segmentIndex - 1];
      const b = points[segmentIndex];
      const segmentLength = distance(a, b);
      if (target <= segmentStartDistance + segmentLength || segmentIndex === points.length - 1) {
        const t = segmentLength <= EPSILON
          ? 0
          : Math.max(0, Math.min(1, (target - segmentStartDistance) / segmentLength));
        out.push({
          x: a.x + (b.x - a.x) * t,
          y: a.y + (b.y - a.y) * t,
          strokeIndex: a.strokeIndex,
        });
        break;
      }
      segmentStartDistance += segmentLength;
      segmentIndex += 1;
    }
  }
  return out;
}

function buildOrderedSamples(rawStrokes = [], samplesPerStroke = 7) {
  return rawStrokes
    .map((stroke, strokeIndex) => normalizeStroke(stroke, strokeIndex))
    .filter((points) => points.length >= 2)
    .flatMap((points) => sampleStroke(points, samplesPerStroke));
}

function averagePoint(points = []) {
  if (!points.length) return { x: 0, y: 0 };
  const sum = points.reduce(
    (acc, pt) => ({ x: acc.x + pt.x, y: acc.y + pt.y }),
    { x: 0, y: 0 },
  );
  return { x: sum.x / points.length, y: sum.y / points.length };
}

function fitPcaLine(points = []) {
  if (points.length < 2) return null;
  const centroid = averagePoint(points);
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  points.forEach((pt) => {
    const dx = pt.x - centroid.x;
    const dy = pt.y - centroid.y;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  });

  const trace = sxx + syy;
  if (!Number.isFinite(trace) || trace <= EPSILON) return null;
  const diff = sxx - syy;
  const root = Math.sqrt((diff * diff) + (4 * sxy * sxy));
  const major = (trace + root) / 2;
  let axis = null;
  if (Math.abs(sxy) > EPSILON) {
    axis = normalizeVector(major - syy, sxy);
  } else {
    axis = sxx >= syy ? { x: 1, y: 0 } : { x: 0, y: 1 };
  }
  if (!axis) return null;
  return { centroid, axis };
}

function projectionOfPoint(point, origin, axis) {
  return ((point.x - origin.x) * axis.x) + ((point.y - origin.y) * axis.y);
}

function pointAtProjection(origin, axis, projection) {
  return {
    x: origin.x + axis.x * projection,
    y: origin.y + axis.y * projection,
  };
}

function projectionRange(points = [], origin, axis) {
  let min = Infinity;
  let max = -Infinity;
  points.forEach((pt) => {
    const projection = projectionOfPoint(pt, origin, axis);
    if (projection < min) min = projection;
    if (projection > max) max = projection;
  });
  return { min, max, length: Math.max(0, max - min) };
}

function perpendicularDistance(point, line) {
  const dx = point.x - line.centroid.x;
  const dy = point.y - line.centroid.y;
  return Math.abs((dx * -line.axis.y) + (dy * line.axis.x));
}

function rmsError(points = [], line) {
  if (!points.length || !line) return Infinity;
  let sum = 0;
  points.forEach((pt) => {
    const d = perpendicularDistance(pt, line);
    sum += d * d;
  });
  return Math.sqrt(sum / points.length);
}

function weightedThreeError(aPoints, aLine, bPoints, bLine, cPoints, cLine) {
  const total = Math.max(1, aPoints.length + bPoints.length + cPoints.length);
  const aError = rmsError(aPoints, aLine);
  const bError = rmsError(bPoints, bLine);
  const cError = rmsError(cPoints, cLine);
  return Math.sqrt(
    ((aError * aError * aPoints.length) +
      (bError * bError * bPoints.length) +
      (cError * cError * cPoints.length)) / total,
  );
}

function lineIntersection(a, b) {
  const cross = (a.axis.x * b.axis.y) - (a.axis.y * b.axis.x);
  if (Math.abs(cross) <= EPSILON) return null;
  const dx = b.centroid.x - a.centroid.x;
  const dy = b.centroid.y - a.centroid.y;
  const t = ((dx * b.axis.y) - (dy * b.axis.x)) / cross;
  return pointAtProjection(a.centroid, a.axis, t);
}

function angleDegreesBetween(a, b) {
  const dot = Math.abs((a.x * b.x) + (a.y * b.y));
  return Math.acos(Math.max(0, Math.min(1, dot))) * 180 / Math.PI;
}

function localCorner(points, splitIndex, windowSize = 4) {
  const from = Math.max(0, splitIndex - windowSize);
  const to = Math.min(points.length, splitIndex + windowSize);
  return averagePoint(points.slice(from, to));
}

function closureCorner(points, windowSize = 5) {
  const start = points.slice(0, Math.min(windowSize, points.length));
  const end = points.slice(Math.max(0, points.length - windowSize));
  return averagePoint([...start, ...end]);
}

function bboxDiagonal(points = []) {
  if (!points.length) return 0;
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
  return Math.hypot(maxX - minX, maxY - minY);
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

function supportCount(points = []) {
  return new Set(points.map((pt) => pt.strokeIndex)).size;
}

function chooseVertex(intersection, fallback, tolerance) {
  if (intersection && distance(intersection, fallback) <= tolerance * 2.5) {
    return intersection;
  }
  return fallback;
}

function internalAngles(vertices) {
  return vertices.map((vertex, index) => {
    const prev = vertices[(index + vertices.length - 1) % vertices.length];
    const next = vertices[(index + 1) % vertices.length];
    const a = normalizeVector(prev.x - vertex.x, prev.y - vertex.y);
    const b = normalizeVector(next.x - vertex.x, next.y - vertex.y);
    if (!a || !b) return 0;
    const dot = (a.x * b.x) + (a.y * b.y);
    return Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI;
  });
}

export function fitTriangleHypothesis(rawStrokes = [], options = {}) {
  const strokeCount = rawStrokes.filter((stroke) =>
    Array.isArray(stroke?.points) && stroke.points.length >= 2
  ).length;
  if (strokeCount < 3) {
    return { triangle: false, reason: "not-enough-strokes", strokeCount };
  }

  const samples = buildOrderedSamples(rawStrokes, options.samplesPerStroke || 7);
  const minSegmentPoints = Number(options.minSegmentPoints) || 5;
  if (samples.length < minSegmentPoints * 3) {
    return { triangle: false, reason: "not-enough-points", strokeCount };
  }

  const diagonal = bboxDiagonal(samples);
  const closureTolerance = Math.max(
    Number(options.minClosureTolerance) || 10,
    diagonal * (Number(options.closureDiagonalRatio) || 0.08),
  );
  const minSideLength = Math.max(
    Number(options.minSideLength) || 20,
    diagonal * (Number(options.minSideLengthRatio) || 0.15),
  );
  const minAngle = Number(options.minCornerAngleDegrees) || 20;
  const twoSegmentError = Number(options.twoSegmentError) || Infinity;

  let best = null;
  const firstStart = minSegmentPoints;
  const firstEnd = samples.length - minSegmentPoints * 2;
  for (let splitA = firstStart; splitA <= firstEnd; splitA += 1) {
    const secondStart = splitA + minSegmentPoints;
    const secondEnd = samples.length - minSegmentPoints;
    for (let splitB = secondStart; splitB <= secondEnd; splitB += 1) {
      const aPoints = samples.slice(0, splitA);
      const bPoints = samples.slice(splitA, splitB);
      const cPoints = samples.slice(splitB);
      const aLine = fitPcaLine(aPoints);
      const bLine = fitPcaLine(bPoints);
      const cLine = fitPcaLine(cPoints);
      if (!aLine || !bLine || !cLine) continue;

      const angleAB = angleDegreesBetween(aLine.axis, bLine.axis);
      const angleBC = angleDegreesBetween(bLine.axis, cLine.axis);
      const angleCA = angleDegreesBetween(cLine.axis, aLine.axis);
      if (Math.min(angleAB, angleBC, angleCA) < minAngle) continue;

      const localAB = localCorner(samples, splitA);
      const localBC = localCorner(samples, splitB);
      const localCA = closureCorner(samples);
      const vertexAB = chooseVertex(lineIntersection(aLine, bLine), localAB, closureTolerance);
      const vertexBC = chooseVertex(lineIntersection(bLine, cLine), localBC, closureTolerance);
      const vertexCA = chooseVertex(lineIntersection(cLine, aLine), localCA, closureTolerance);
      const vertices = [vertexCA, vertexAB, vertexBC];

      const sideA = distance(vertexCA, vertexAB);
      const sideB = distance(vertexAB, vertexBC);
      const sideC = distance(vertexBC, vertexCA);
      if (Math.min(sideA, sideB, sideC) < minSideLength) continue;

      const angles = internalAngles(vertices);
      if (Math.min(...angles) < 10) continue;

      const area = polygonArea(vertices);
      if (area < Math.max(closureTolerance * closureTolerance, diagonal * diagonal * 0.025)) {
        continue;
      }

      const supportA = supportCount(aPoints);
      const supportB = supportCount(bPoints);
      const supportC = supportCount(cPoints);
      if (Math.min(supportA, supportB, supportC) < 1) continue;

      const threeSegmentError = weightedThreeError(aPoints, aLine, bPoints, bLine, cPoints, cLine);
      const improvementRatio = threeSegmentError / Math.max(EPSILON, twoSegmentError);
      const closureError = (
        distance(vertexAB, localAB) + distance(vertexBC, localBC) + distance(vertexCA, localCA)
      ) / 3;
      const closureScore = clamp01(1 - closureError / Math.max(EPSILON, closureTolerance * 2.5));
      const supportScore = clamp01(Math.min(supportA, supportB, supportC) / 2);
      const angleScore = clamp01((Math.min(...angles) - 10) / 35);
      const improvementScore = Number.isFinite(twoSegmentError)
        ? clamp01(((Number(options.maxImprovementRatio) || 0.75) - improvementRatio) / 0.35)
        : 0.55;
      const sideBalance = Math.min(sideA, sideB, sideC) / Math.max(sideA, sideB, sideC, EPSILON);
      const sideScore = clamp01(sideBalance / 0.28);
      let confidence = 0.18 +
        improvementScore * 0.28 +
        closureScore * 0.24 +
        supportScore * 0.12 +
        angleScore * 0.1 +
        sideScore * 0.08;
      confidence = clamp01(confidence);
      const score = confidence - improvementRatio * 0.12 + closureScore * 0.08;

      if (!best || score > best.score) {
        best = {
          score,
          splitA,
          splitB,
          vertices,
          threeSegmentError,
          twoSegmentError,
          improvementRatio,
          closureError,
          closureScore,
          supportA,
          supportB,
          supportC,
          sideA,
          sideB,
          sideC,
          angles,
          confidence,
          area,
        };
      }
    }
  }

  if (!best) {
    return {
      triangle: false,
      reason: "no-supported-three-segment-closure",
      strokeCount,
      twoSegmentError,
      closureTolerance,
    };
  }

  const enoughImprovement = !Number.isFinite(twoSegmentError) ||
    best.improvementRatio <= (Number(options.maxImprovementRatio) || 0.75);
  const enoughClosure = best.closureScore >= (Number(options.minClosureScore) || 0.42);
  const enoughConfidence = best.confidence >= (Number(options.confidenceThreshold) || 0.58);
  const enoughSupport = Math.min(best.supportA, best.supportB, best.supportC) >= 1;
  const triangle = enoughImprovement && enoughClosure && enoughConfidence && enoughSupport;
  const reason = !enoughImprovement
    ? "three-segment-error-not-better-enough"
    : !enoughClosure
      ? "closure-too-weak"
      : !enoughSupport
        ? "not-enough-side-support"
        : !enoughConfidence
          ? "confidence-too-low"
          : "accepted";

  return {
    triangle,
    reason,
    winningHypothesis: triangle ? "triangle" : "none",
    points: best.vertices,
    vertices: best.vertices,
    strokeCount,
    pointCount: samples.length,
    activeSegmentCount: 3,
    confidence: best.confidence,
    twoSegmentError: best.twoSegmentError,
    threeSegmentError: best.threeSegmentError,
    improvementRatio: best.improvementRatio,
    closureScore: best.closureScore,
    closureError: best.closureError,
    closureTolerance,
    supportA: best.supportA,
    supportB: best.supportB,
    supportC: best.supportC,
    sideLengthA: best.sideA,
    sideLengthB: best.sideB,
    sideLengthC: best.sideC,
    cornerAngles: best.angles,
    splitA: best.splitA,
    splitB: best.splitB,
  };
}
