// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/PencilSketchAngleFit.mjs
// Two-segment angular polyline hypothesis scoring for multi-stroke pencil previews.

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
  const minor = Math.max(0, (trace - root) / 2);

  let axis = null;
  if (Math.abs(sxy) > EPSILON) {
    axis = normalizeVector(major - syy, sxy);
  } else {
    axis = sxx >= syy ? { x: 1, y: 0 } : { x: 0, y: 1 };
  }
  if (!axis) return null;
  return {
    centroid,
    axis,
    eigenRatio: major > EPSILON ? minor / major : 1,
  };
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

function weightedCombinedError(aPoints, aLine, bPoints, bLine) {
  const aError = rmsError(aPoints, aLine);
  const bError = rmsError(bPoints, bLine);
  const total = Math.max(1, aPoints.length + bPoints.length);
  return Math.sqrt(
    ((aError * aError * aPoints.length) + (bError * bError * bPoints.length)) / total,
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

function chooseOuterEndpoint(points, line, corner) {
  const range = projectionRange(points, line.centroid, line.axis);
  const cornerProjection = projectionOfPoint(corner, line.centroid, line.axis);
  const minPoint = pointAtProjection(line.centroid, line.axis, range.min);
  const maxPoint = pointAtProjection(line.centroid, line.axis, range.max);
  const minDistance = Math.abs(range.min - cornerProjection);
  const maxDistance = Math.abs(range.max - cornerProjection);
  return maxDistance >= minDistance ? maxPoint : minPoint;
}

function splitStrokeSupport(points = []) {
  return new Set(points.map((pt) => pt.strokeIndex)).size;
}

function cornerFallback(points, splitIndex, windowSize = 4) {
  const from = Math.max(0, splitIndex - windowSize);
  const to = Math.min(points.length, splitIndex + windowSize);
  return averagePoint(points.slice(from, to));
}

function cornerIsReasonable(corner, localCorner, segmentLengthA, segmentLengthB, allowedError) {
  const maxSegment = Math.max(segmentLengthA, segmentLengthB, allowedError);
  const limit = Math.max(allowedError * 4, maxSegment * 0.45);
  return distance(corner, localCorner) <= limit;
}

export function fitTwoSegmentAngleHypothesis(rawStrokes = [], options = {}) {
  const strokeCount = rawStrokes.filter((stroke) =>
    Array.isArray(stroke?.points) && stroke.points.length >= 2
  ).length;
  if (strokeCount < 2) {
    return { angle: false, reason: "single-stroke", strokeCount };
  }

  const samples = buildOrderedSamples(rawStrokes, options.samplesPerStroke || 7);
  const minSegmentPoints = Number(options.minSegmentPoints) || 5;
  if (samples.length < minSegmentPoints * 2) {
    return { angle: false, reason: "not-enough-points", strokeCount };
  }

  const oneLine = fitPcaLine(samples);
  const oneLineError = rmsError(samples, oneLine);
  if (!oneLine || !Number.isFinite(oneLineError)) {
    return { angle: false, reason: "no-global-fit", strokeCount };
  }

  const globalRange = projectionRange(samples, oneLine.centroid, oneLine.axis);
  const allowedError = Math.max(
    Number(options.minAllowedError) || 8,
    globalRange.length * (Number(options.errorLengthRatio) || 0.08),
  );
  const minSegmentLength = Math.max(
    Number(options.minSegmentLength) || 0,
    allowedError * 1.8,
  );

  let best = null;
  const start = minSegmentPoints;
  const end = samples.length - minSegmentPoints;
  for (let split = start; split <= end; split += 1) {
    const aPoints = samples.slice(0, split);
    const bPoints = samples.slice(split);
    const aLine = fitPcaLine(aPoints);
    const bLine = fitPcaLine(bPoints);
    if (!aLine || !bLine) continue;

    const angleBetweenSegments = angleDegreesBetween(aLine.axis, bLine.axis);
    if (angleBetweenSegments < (Number(options.minAngleDegrees) || 25)) continue;

    const localCorner = cornerFallback(samples, split);
    const rawIntersection = lineIntersection(aLine, bLine);
    const tentativeCorner = rawIntersection && cornerIsReasonable(
      rawIntersection,
      localCorner,
      projectionRange(aPoints, aLine.centroid, aLine.axis).length,
      projectionRange(bPoints, bLine.centroid, bLine.axis).length,
      allowedError,
    )
      ? rawIntersection
      : localCorner;

    const startPoint = chooseOuterEndpoint(aPoints, aLine, tentativeCorner);
    const endPoint = chooseOuterEndpoint(bPoints, bLine, tentativeCorner);
    const segmentLengthA = distance(startPoint, tentativeCorner);
    const segmentLengthB = distance(tentativeCorner, endPoint);
    if (segmentLengthA < minSegmentLength || segmentLengthB < minSegmentLength) continue;

    const supportA = splitStrokeSupport(aPoints);
    const supportB = splitStrokeSupport(bPoints);
    if (supportA < 1 || supportB < 1) continue;

    const twoLineError = weightedCombinedError(aPoints, aLine, bPoints, bLine);
    const improvementRatio = twoLineError / Math.max(EPSILON, oneLineError);
    const cornerError = distance(tentativeCorner, localCorner);
    const cornerPenalty = clamp01(cornerError / Math.max(allowedError * 4, 1));
    const lengthBalance = Math.min(segmentLengthA, segmentLengthB) /
      Math.max(EPSILON, Math.max(segmentLengthA, segmentLengthB));
    const angleStrength = clamp01(
      (angleBetweenSegments - (Number(options.minAngleDegrees) || 25)) / 55,
    );
    const errorStrength = clamp01(
      ((Number(options.maxImprovementRatio) || 0.65) - improvementRatio) / 0.35,
    );
    const lengthStrength = clamp01(lengthBalance / 0.32);
    const supportStrength = clamp01(Math.min(supportA, supportB) / 2);
    let confidence = 0.22 +
      errorStrength * 0.34 +
      angleStrength * 0.22 +
      lengthStrength * 0.12 +
      supportStrength * 0.1 -
      cornerPenalty * 0.12;
    confidence = clamp01(confidence);

    const score = confidence - improvementRatio * 0.12;
    if (!best || score > best.score) {
      best = {
        score,
        split,
        aLine,
        bLine,
        aPoints,
        bPoints,
        startPoint,
        cornerPoint: tentativeCorner,
        endPoint,
        oneLineError,
        twoLineError,
        improvementRatio,
        angleBetweenSegments,
        segmentLengthA,
        segmentLengthB,
        supportA,
        supportB,
        cornerError,
        confidence,
      };
    }
  }

  if (!best) {
    return {
      angle: false,
      reason: "no-meaningful-corner",
      strokeCount,
      oneLineError,
    };
  }

  const enoughImprovement = best.improvementRatio <=
    (Number(options.maxImprovementRatio) || 0.65);
  const enoughAngle = best.angleBetweenSegments >=
    (Number(options.minAngleDegrees) || 25);
  const enoughConfidence = best.confidence >=
    (Number(options.confidenceThreshold) || 0.6);
  const angle = enoughImprovement && enoughAngle && enoughConfidence;
  const reason = !enoughImprovement
    ? "two-line-error-not-better-enough"
    : !enoughAngle
      ? "angle-change-too-small"
      : !enoughConfidence
        ? "confidence-too-low"
        : "accepted";

  return {
    angle,
    reason,
    winningHypothesis: angle ? "two-segment-angle" : "none",
    points: [best.startPoint, best.cornerPoint, best.endPoint],
    strokeCount,
    pointCount: samples.length,
    confidence: best.confidence,
    oneLineError: best.oneLineError,
    bestTwoLineError: best.twoLineError,
    improvementRatio: best.improvementRatio,
    angleBetweenSegments: best.angleBetweenSegments,
    cornerPoint: best.cornerPoint,
    segmentLengthA: best.segmentLengthA,
    segmentLengthB: best.segmentLengthB,
    supportA: best.supportA,
    supportB: best.supportB,
    splitIndex: best.split,
    allowedError,
  };
}
