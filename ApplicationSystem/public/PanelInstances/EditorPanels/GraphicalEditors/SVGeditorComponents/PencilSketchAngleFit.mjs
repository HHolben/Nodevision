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

function dotVectors(a, b) {
  return ((Number(a?.x) || 0) * (Number(b?.x) || 0)) +
    ((Number(a?.y) || 0) * (Number(b?.y) || 0));
}

function angleDegreesFromDirectionCompatibility(compatibility) {
  return Math.acos(Math.max(0, Math.min(1, Number(compatibility) || 0))) * 180 / Math.PI;
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

function boundingBoxForPoints(points = []) {
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
  return { minX, minY, maxX, maxY };
}

function buildStrokeEvidence(rawStrokes = [], samplesPerStroke = 7) {
  return rawStrokes
    .map((stroke, strokeIndex) => {
      const points = normalizeStroke(stroke, strokeIndex);
      if (points.length < 2) return null;
      const samples = sampleStroke(points, samplesPerStroke).map((pt) => ({
        ...pt,
        strokeIndex,
      }));
      const start = points[0];
      const end = points[points.length - 1];
      const midpoint = averagePoint([start, end]);
      const length = strokeLength(points);
      const direction = normalizeVector(end.x - start.x, end.y - start.y);
      return {
        id: strokeIndex,
        strokeIndex,
        start,
        end,
        midpoint,
        direction,
        length,
        bbox: boundingBoxForPoints(points),
        points,
        samples,
      };
    })
    .filter(Boolean);
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

function boundingBoxDiagonal(points = []) {
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

function orientedSegmentDirection(points, line, corner, fallbackSign) {
  const cornerProjection = projectionOfPoint(corner, line.centroid, line.axis);
  const range = projectionRange(points, line.centroid, line.axis);
  const negativeExtent = Math.max(0, cornerProjection - range.min);
  const positiveExtent = Math.max(0, range.max - cornerProjection);
  const sign = positiveExtent >= negativeExtent ? 1 : -1;
  return sign || fallbackSign || 1;
}

function pointSegmentMetrics(pt, line, corner, directionSign) {
  const projection = projectionOfPoint(pt, line.centroid, line.axis);
  const cornerProjection = projectionOfPoint(corner, line.centroid, line.axis);
  const signedFromCorner = (projection - cornerProjection) * directionSign;
  const perpendicular = perpendicularDistance(pt, line);
  return { projection, cornerProjection, signedFromCorner, perpendicular };
}

function strokeSegmentMetrics(stroke, line, corner, directionSign, tolerance, roughTolerance) {
  const pointMetrics = stroke.samples.map((pt) => pointSegmentMetrics(pt, line, corner, directionSign));
  const midpointMetrics = pointSegmentMetrics(stroke.midpoint, line, corner, directionSign);
  const directionCompatibility = stroke.direction
    ? Math.abs(dotVectors(stroke.direction, line.axis))
    : 0;
  const supportPoints = pointMetrics.filter((metrics) =>
    metrics.perpendicular <= roughTolerance &&
    metrics.signedFromCorner >= -tolerance * 1.25
  );
  const avgDistance = pointMetrics.length
    ? pointMetrics.reduce((sum, metrics) => sum + metrics.perpendicular, 0) / pointMetrics.length
    : Infinity;
  const minDistance = pointMetrics.length
    ? Math.min(...pointMetrics.map((metrics) => metrics.perpendicular))
    : Infinity;
  const maxSigned = pointMetrics.length
    ? Math.max(...pointMetrics.map((metrics) => metrics.signedFromCorner))
    : -Infinity;
  const supportRatio = pointMetrics.length ? supportPoints.length / pointMetrics.length : 0;
  const distanceBasis = Math.min(avgDistance, midpointMetrics.perpendicular);
  const distanceStrength = clamp01(1 - (distanceBasis / Math.max(roughTolerance, 1)));
  const projectionStrength = clamp01(maxSigned / Math.max(stroke.length, tolerance, 1));
  const score =
    directionCompatibility * 1.1 +
    supportRatio * 1.2 +
    distanceStrength * 0.8 +
    projectionStrength * 0.2;

  return {
    directionCompatibility,
    directionAngle: angleDegreesFromDirectionCompatibility(directionCompatibility),
    midpointDistance: midpointMetrics.perpendicular,
    midpointSignedFromCorner: midpointMetrics.signedFromCorner,
    avgDistance,
    minDistance,
    maxSignedFromCorner: maxSigned,
    supportCount: supportPoints.length,
    supportRatio,
    score,
    compatible: false,
  };
}

function markStrokeCompatibility(metrics, stroke, tolerance, roughTolerance, minDirectionCompatibility) {
  const requiredSupport = Math.max(2, Math.ceil(stroke.samples.length * 0.45));
  const directionCompatible = metrics.directionCompatibility >= minDirectionCompatibility;
  const distanceCompatible =
    metrics.midpointDistance <= roughTolerance ||
    metrics.avgDistance <= roughTolerance ||
    metrics.supportCount >= requiredSupport ||
    metrics.minDistance <= tolerance;
  const projectionCompatible = metrics.maxSignedFromCorner >= -tolerance * 1.25;
  return directionCompatible && distanceCompatible && projectionCompatible;
}

function rejectionReason(metricsA, metricsB, minDirectionCompatibility) {
  if (
    metricsA.directionCompatibility < minDirectionCompatibility &&
    metricsB.directionCompatibility < minDirectionCompatibility
  ) {
    return "direction-incompatible";
  }
  if (metricsA.maxSignedFromCorner < 0 && metricsB.maxSignedFromCorner < 0) {
    return "behind-corner";
  }
  if (metricsA.supportRatio < 0.35 && metricsB.supportRatio < 0.35) {
    return "outside-tolerance-band";
  }
  return "not-compatible-with-either-segment";
}

function pushUniquePoint(target, seen, pt) {
  const key = `${pt.strokeIndex}:${pt.sampleIndex ?? target.length}:${pt.x}:${pt.y}`;
  if (seen.has(key)) return;
  seen.add(key);
  target.push(pt);
}

function summarizeStrokeAssignment(stroke, assignedSegment, metricsA, metricsB, reason) {
  return {
    strokeId: stroke.id,
    assignedSegment,
    directionAngle: stroke.direction
      ? Math.atan2(stroke.direction.y, stroke.direction.x) * 180 / Math.PI
      : null,
    directionCompatibilityA: metricsA.directionCompatibility,
    directionCompatibilityB: metricsB.directionCompatibility,
    directionAngleToA: metricsA.directionAngle,
    directionAngleToB: metricsB.directionAngle,
    midpointDistanceA: metricsA.midpointDistance,
    midpointDistanceB: metricsB.midpointDistance,
    projectedDistanceFromCornerA: metricsA.midpointSignedFromCorner,
    projectedDistanceFromCornerB: metricsB.midpointSignedFromCorner,
    maxProjectedDistanceFromCornerA: metricsA.maxSignedFromCorner,
    maxProjectedDistanceFromCornerB: metricsB.maxSignedFromCorner,
    supportRatioA: metricsA.supportRatio,
    supportRatioB: metricsB.supportRatio,
    rejectionReason: assignedSegment === "rejected" ? reason : null,
  };
}

function assignSamplesToSegments(allPoints, strokeEvidence, splitIndex, aLine, bLine, corner, tolerance, roughTolerance) {
  const directionA = orientedSegmentDirection(allPoints.slice(0, splitIndex), aLine, corner, -1);
  const directionB = orientedSegmentDirection(allPoints.slice(splitIndex), bLine, corner, 1);
  const assignedA = [];
  const assignedB = [];
  const seenA = new Set();
  const seenB = new Set();
  const rejected = [];
  const strokeAssignments = [];
  const minDirectionCompatibility = 0.62;

  strokeEvidence.forEach((stroke) => {
    const metricsA = strokeSegmentMetrics(stroke, aLine, corner, directionA, tolerance, roughTolerance);
    const metricsB = strokeSegmentMetrics(stroke, bLine, corner, directionB, tolerance, roughTolerance);
    metricsA.compatible = markStrokeCompatibility(
      metricsA,
      stroke,
      tolerance,
      roughTolerance,
      minDirectionCompatibility,
    );
    metricsB.compatible = markStrokeCompatibility(
      metricsB,
      stroke,
      tolerance,
      roughTolerance,
      minDirectionCompatibility,
    );

    const averageSampleIndex = stroke.samples.reduce(
      (sum, pt) => sum + (Number(pt.sampleIndex) || 0),
      0,
    ) / Math.max(1, stroke.samples.length);
    const orderBiasA = averageSampleIndex < splitIndex ? 0.08 : 0;
    const orderBiasB = averageSampleIndex >= splitIndex ? 0.08 : 0;
    let assignedSegment = null;

    if (metricsA.compatible && metricsB.compatible) {
      assignedSegment = metricsB.score + orderBiasB > metricsA.score + orderBiasA ? "B" : "A";
    } else if (metricsA.compatible) {
      assignedSegment = "A";
    } else if (metricsB.compatible) {
      assignedSegment = "B";
    }

    if (assignedSegment === "A") {
      stroke.samples.forEach((pt) => pushUniquePoint(assignedA, seenA, pt));
    } else if (assignedSegment === "B") {
      stroke.samples.forEach((pt) => pushUniquePoint(assignedB, seenB, pt));
    } else {
      stroke.samples.forEach((pt) => {
        const pointA = pointSegmentMetrics(pt, aLine, corner, directionA);
        const pointB = pointSegmentMetrics(pt, bLine, corner, directionB);
        const pointCompatibleA =
          pointA.perpendicular <= roughTolerance &&
          pointA.signedFromCorner >= -tolerance &&
          metricsA.directionCompatibility >= minDirectionCompatibility;
        const pointCompatibleB =
          pointB.perpendicular <= roughTolerance &&
          pointB.signedFromCorner >= -tolerance &&
          metricsB.directionCompatibility >= minDirectionCompatibility;
        if (pointCompatibleA && pointCompatibleB) {
          if (pointB.perpendicular < pointA.perpendicular) {
            pushUniquePoint(assignedB, seenB, pt);
          } else {
            pushUniquePoint(assignedA, seenA, pt);
          }
        } else if (pointCompatibleA) {
          pushUniquePoint(assignedA, seenA, pt);
        } else if (pointCompatibleB) {
          pushUniquePoint(assignedB, seenB, pt);
        } else {
          rejected.push({
            ...pt,
            reason: rejectionReason(metricsA, metricsB, minDirectionCompatibility),
            distanceA: pointA.perpendicular,
            distanceB: pointB.perpendicular,
            signedFromCornerA: pointA.signedFromCorner,
            signedFromCornerB: pointB.signedFromCorner,
          });
        }
      });
      assignedSegment = "rejected";
    }

    strokeAssignments.push(summarizeStrokeAssignment(
      stroke,
      assignedSegment,
      metricsA,
      metricsB,
      rejectionReason(metricsA, metricsB, minDirectionCompatibility),
    ));
  });

  return { assignedA, assignedB, rejected, strokeAssignments, directionA, directionB };
}

function supportedFarthestProjection(assigned, fallbackProjection, tolerance) {
  if (!assigned.length) return { projection: fallbackProjection, sourceStrokeId: null };
  const sorted = [...assigned].sort((a, b) => b.signedFromCorner - a.signedFromCorner);
  const supportRadius = Math.max(tolerance * 1.25, 1);
  for (const candidate of sorted) {
    const supportCount = assigned.filter((pt) =>
      Math.abs(pt.signedFromCorner - candidate.signedFromCorner) <= supportRadius ||
      pt.strokeIndex === candidate.strokeIndex
    ).length;
    if (supportCount >= 2 || sorted.length <= 3) {
      return { projection: candidate.projection, sourceStrokeId: candidate.strokeIndex };
    }
  }
  return { projection: sorted[0].projection, sourceStrokeId: sorted[0].strokeIndex };
}

function segmentEndpointFromAssigned(assignedPoints, fallbackPoints, line, corner, directionSign, tolerance) {
  const sourcePoints = assignedPoints.length >= 2 ? assignedPoints : fallbackPoints;
  const fallbackPoint = chooseOuterEndpoint(sourcePoints, line, corner);
  const fallbackProjection = projectionOfPoint(fallbackPoint, line.centroid, line.axis);
  const cornerProjection = projectionOfPoint(corner, line.centroid, line.axis);
  const projected = sourcePoints.map((pt) => {
    const projection = projectionOfPoint(pt, line.centroid, line.axis);
    return {
      ...pt,
      projection,
      signedFromCorner: (projection - cornerProjection) * directionSign,
      perpendicular: perpendicularDistance(pt, line),
    };
  }).filter((pt) => pt.signedFromCorner >= -tolerance);
  const supported = supportedFarthestProjection(projected, fallbackProjection, tolerance);
  const endpoint = pointAtProjection(line.centroid, line.axis, supported.projection);
  return {
    endpoint,
    assignedCount: assignedPoints.length,
    rejectedCount: 0,
    rejectedFarPoints: [],
    projectionMin: Math.min(cornerProjection, supported.projection),
    projectionMax: Math.max(cornerProjection, supported.projection),
    cornerProjection,
    endpointProjection: supported.projection,
    endpointSourceStrokeId: supported.sourceStrokeId,
  };
}

function refineTwoSegmentCandidate(allPoints, strokeEvidence, splitIndex, aSeed, bSeed, aLine, bLine, corner, tolerance, roughTolerance) {
  const initial = assignSamplesToSegments(
    allPoints,
    strokeEvidence,
    splitIndex,
    aLine,
    bLine,
    corner,
    tolerance,
    roughTolerance,
  );
  const refitA = initial.assignedA.length >= Math.max(4, aSeed.length * 0.45)
    ? fitPcaLine(initial.assignedA) || aLine
    : aLine;
  const refitB = initial.assignedB.length >= Math.max(4, bSeed.length * 0.35)
    ? fitPcaLine(initial.assignedB) || bLine
    : bLine;
  const intersection = lineIntersection(refitA, refitB);
  const refinedCorner = intersection && distance(intersection, corner) <= tolerance * 3.5
    ? intersection
    : corner;
  const refined = assignSamplesToSegments(
    allPoints,
    strokeEvidence,
    splitIndex,
    refitA,
    refitB,
    refinedCorner,
    tolerance,
    roughTolerance,
  );
  const endpointA = segmentEndpointFromAssigned(
    refined.assignedA,
    refined.assignedA.length >= 2 ? refined.assignedA : aSeed,
    refitA,
    refinedCorner,
    refined.directionA,
    tolerance,
  );
  const endpointB = segmentEndpointFromAssigned(
    refined.assignedB,
    refined.assignedB.length >= 2 ? refined.assignedB : bSeed,
    refitB,
    refinedCorner,
    refined.directionB,
    tolerance,
  );

  return {
    aLine: refitA,
    bLine: refitB,
    corner: refinedCorner,
    endpointA,
    endpointB,
    assignedA: refined.assignedA,
    assignedB: refined.assignedB,
    rejected: refined.rejected,
    strokeAssignments: refined.strokeAssignments,
  };
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

  const samplesPerStroke = options.samplesPerStroke || 7;
  const strokeEvidence = buildStrokeEvidence(rawStrokes, samplesPerStroke);
  const samples = strokeEvidence.flatMap((stroke) => stroke.samples);
  samples.forEach((pt, sampleIndex) => {
    pt.sampleIndex = sampleIndex;
  });
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
  const boxDiagonal = boundingBoxDiagonal(samples);
  const allowedError = Math.max(
    Number(options.minAllowedError) || 8,
    boxDiagonal * (Number(options.assignmentDiagonalRatio) || 0.06),
    globalRange.length * (Number(options.errorLengthRatio) || 0.08),
  );
  const assignmentTolerance = Math.max(
    Number(options.minAssignmentTolerance) || 14,
    boxDiagonal * (Number(options.assignmentToleranceDiagonalRatio) || 0.08),
    allowedError,
  );
  const roughAssignmentTolerance = Math.max(
    Number(options.minRoughAssignmentTolerance) || 18,
    boxDiagonal * (Number(options.roughAssignmentToleranceDiagonalRatio) || 0.10),
    assignmentTolerance,
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

    const refined = refineTwoSegmentCandidate(
      samples,
      strokeEvidence,
      split,
      aPoints,
      bPoints,
      aLine,
      bLine,
      tentativeCorner,
      assignmentTolerance,
      roughAssignmentTolerance,
    );
    const endpointA = refined.endpointA;
    const endpointB = refined.endpointB;
    const startPoint = endpointA.endpoint;
    const endPoint = endpointB.endpoint;
    const refinedCorner = refined.corner;
    const segmentLengthA = distance(startPoint, refinedCorner);
    const segmentLengthB = distance(refinedCorner, endPoint);
    if (segmentLengthA < minSegmentLength || segmentLengthB < minSegmentLength) continue;

    const supportA = splitStrokeSupport(refined.assignedA.length ? refined.assignedA : aPoints);
    const supportB = splitStrokeSupport(refined.assignedB.length ? refined.assignedB : bPoints);
    if (supportA < 1 || supportB < 1) continue;

    const twoLineError = weightedCombinedError(
      refined.assignedA.length >= 2 ? refined.assignedA : aPoints,
      refined.aLine,
      refined.assignedB.length >= 2 ? refined.assignedB : bPoints,
      refined.bLine,
    );
    const improvementRatio = twoLineError / Math.max(EPSILON, oneLineError);
    const cornerError = distance(refinedCorner, localCorner);
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
        cornerPoint: refinedCorner,
        endPoint,
        endpointA,
        endpointB,
        assignedA: refined.assignedA,
        assignedB: refined.assignedB,
        rejectedOwnershipPoints: refined.rejected,
        strokeAssignments: refined.strokeAssignments,
        assignmentTolerance,
        roughAssignmentTolerance,
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
    assignedCountA: best.assignedA.length,
    assignedCountB: best.assignedB.length,
    projectionMinA: best.endpointA.projectionMin,
    projectionMaxA: best.endpointA.projectionMax,
    projectionMinB: best.endpointB.projectionMin,
    projectionMaxB: best.endpointB.projectionMax,
    endpointA: best.startPoint,
    endpointB: best.endPoint,
    endpointSourceStrokeIdA: best.endpointA.endpointSourceStrokeId,
    endpointSourceStrokeIdB: best.endpointB.endpointSourceStrokeId,
    strokeAssignments: best.strokeAssignments,
    segmentAAssignedStrokeCount: splitStrokeSupport(best.assignedA),
    segmentBAssignedStrokeCount: splitStrokeSupport(best.assignedB),
    segmentBFarthestProjectedEndpoint: best.endpointB.endpointProjection,
    segmentBEndpointSourceStrokeId: best.endpointB.endpointSourceStrokeId,
    assignmentTolerance: best.assignmentTolerance,
    roughAssignmentTolerance: best.roughAssignmentTolerance,
    rejectedFarPointsA: best.endpointA.rejectedFarPoints,
    rejectedFarPointsB: best.endpointB.rejectedFarPoints,
    rejectedOwnershipPoints: best.rejectedOwnershipPoints.slice(0, 6).map((pt) => ({
      x: pt.x,
      y: pt.y,
      reason: pt.reason,
      distanceA: pt.distanceA,
      distanceB: pt.distanceB,
    })),
    splitIndex: best.split,
    allowedError,
  };
}
