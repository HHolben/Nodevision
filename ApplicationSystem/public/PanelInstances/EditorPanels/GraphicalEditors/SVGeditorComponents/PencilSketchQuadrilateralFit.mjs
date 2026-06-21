// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/PencilSketchQuadrilateralFit.mjs
// Four-segment closed angular path / quadrilateral hypothesis scoring for pencil previews.

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

function vectorAngleDegrees(axis) {
  if (!axis) return null;
  return Math.atan2(axis.y, axis.x) * 180 / Math.PI;
}

function averagePoint(points = []) {
  if (!points.length) return { x: 0, y: 0 };
  const sum = points.reduce(
    (acc, pt) => ({ x: acc.x + pt.x, y: acc.y + pt.y }),
    { x: 0, y: 0 },
  );
  return { x: sum.x / points.length, y: sum.y / points.length };
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
  for (let i = 1; i < points.length; i += 1) total += distance(points[i - 1], points[i]);
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

function bboxDiagonal(points = []) {
  const box = boundingBoxForPoints(points);
  if (!box) return 0;
  return Math.hypot(box.maxX - box.minX, box.maxY - box.minY);
}

function buildStrokeEvidence(rawStrokes = [], samplesPerStroke = 7) {
  return rawStrokes
    .map((stroke, strokeIndex) => {
      const points = normalizeStroke(stroke, strokeIndex);
      if (points.length < 2) return null;
      const samples = sampleStroke(points, samplesPerStroke).map((pt) => ({ ...pt, strokeIndex }));
      const start = points[0];
      const end = points[points.length - 1];
      const endpointDirection = normalizeVector(end.x - start.x, end.y - start.y);
      const localLine = fitPcaLine(samples);
      return {
        id: strokeIndex,
        strokeIndex,
        start,
        end,
        midpoint: averagePoint([start, end]),
        direction: localLine?.axis || endpointDirection,
        endpointDirection,
        localLine,
        length: strokeLength(points),
        bbox: boundingBoxForPoints(points),
        points,
        samples,
      };
    })
    .filter(Boolean);
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

function weightedFourError(pointGroups, lines) {
  const total = Math.max(1, pointGroups.reduce((sum, pts) => sum + pts.length, 0));
  let weighted = 0;
  for (let i = 0; i < 4; i += 1) {
    const error = rmsError(pointGroups[i], lines[i]);
    weighted += error * error * pointGroups[i].length;
  }
  return Math.sqrt(weighted / total);
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

function sideAngleDegrees(line) {
  const raw = vectorAngleDegrees(line?.axis);
  if (raw === null) return null;
  return raw < 0 ? raw + 180 : raw;
}

function pointInsideExpandedBounds(point, bounds, padding) {
  if (!bounds || !point) return true;
  return point.x >= bounds.minX - padding &&
    point.x <= bounds.maxX + padding &&
    point.y >= bounds.minY - padding &&
    point.y <= bounds.maxY + padding;
}

function chooseVertex(intersection, fallback, bounds, tolerance) {
  if (intersection && pointInsideExpandedBounds(intersection, bounds, tolerance * 3.5)) {
    return intersection;
  }
  if (intersection && distance(intersection, fallback) <= tolerance * 2.5) return intersection;
  return fallback;
}

function sideProjectionRange(side) {
  const startProjection = projectionOfPoint(side.start, side.line.centroid, side.line.axis);
  const endProjection = projectionOfPoint(side.end, side.line.centroid, side.line.axis);
  return {
    min: Math.min(startProjection, endProjection),
    max: Math.max(startProjection, endProjection),
    length: Math.abs(endProjection - startProjection),
  };
}

function strokeSideMetrics(stroke, side, tolerance) {
  const range = sideProjectionRange(side);
  const pointMetrics = stroke.samples.map((pt) => {
    const projection = projectionOfPoint(pt, side.line.centroid, side.line.axis);
    const distanceToAxis = perpendicularDistance(pt, side.line);
    const projectedInside = projection >= range.min - tolerance * 1.6 &&
      projection <= range.max + tolerance * 1.6;
    return { projection, distanceToAxis, projectedInside };
  });
  const midpointProjection = projectionOfPoint(stroke.midpoint, side.line.centroid, side.line.axis);
  const midpointDistance = perpendicularDistance(stroke.midpoint, side.line);
  const directionCompatibility = stroke.direction
    ? Math.abs(dotVectors(stroke.direction, side.line.axis))
    : 0;
  const supportPoints = pointMetrics.filter((metrics) =>
    metrics.distanceToAxis <= tolerance && metrics.projectedInside
  );
  const avgDistance = pointMetrics.length
    ? pointMetrics.reduce((sum, metrics) => sum + metrics.distanceToAxis, 0) / pointMetrics.length
    : Infinity;
  const supportRatio = pointMetrics.length ? supportPoints.length / pointMetrics.length : 0;
  const midpointInside = midpointProjection >= range.min - tolerance * 1.9 &&
    midpointProjection <= range.max + tolerance * 1.9;
  const distanceScore = clamp01(1 - Math.min(avgDistance, midpointDistance) / Math.max(tolerance, 1));
  const projectionScore = midpointInside ? 1 : clamp01(supportRatio);
  const score = directionCompatibility * 1.1 +
    supportRatio * 1.2 +
    distanceScore * 0.75 +
    projectionScore * 0.25;
  const compatible = directionCompatibility >= 0.55 && (
    supportRatio >= 0.35 ||
    avgDistance <= tolerance ||
    midpointDistance <= tolerance * 1.2
  ) && (midpointInside || supportRatio >= 0.45);

  return {
    directionCompatibility,
    midpointDistance,
    midpointProjection,
    avgDistance,
    supportRatio,
    projectedInside: midpointInside,
    score,
    compatible,
  };
}

function rejectionReason(metricsBySide) {
  const bestDirection = Math.max(...metricsBySide.map((entry) => entry.metrics.directionCompatibility));
  const bestSupport = Math.max(...metricsBySide.map((entry) => entry.metrics.supportRatio));
  const bestDistance = Math.min(...metricsBySide.map((entry) => entry.metrics.midpointDistance));
  if (bestDirection < 0.55) return "direction-incompatible";
  if (bestSupport < 0.25 && bestDistance > 0) return "outside-side-band";
  if (!metricsBySide.some((entry) => entry.metrics.projectedInside)) return "outside-side-span";
  return "not-compatible-with-any-quadrilateral-side";
}

function assignStrokesToSides(strokeEvidence, sides, splits, tolerance) {
  const assigned = [[], [], [], []];
  const assignedStrokeIds = [new Set(), new Set(), new Set(), new Set()];
  const rejectedStrokes = [];
  const strokeAssignments = [];
  const labels = ["A", "B", "C", "D"];

  strokeEvidence.forEach((stroke) => {
    const averageSampleIndex = stroke.samples.reduce(
      (sum, pt) => sum + (Number(pt.sampleIndex) || 0),
      0,
    ) / Math.max(1, stroke.samples.length);
    const expectedIndex = averageSampleIndex < splits[0]
      ? 0
      : averageSampleIndex < splits[1]
        ? 1
        : averageSampleIndex < splits[2]
          ? 2
          : 3;
    const metricsBySide = sides.map((side, sideIndex) => {
      const metrics = strokeSideMetrics(stroke, side, tolerance);
      const orderBias = sideIndex === expectedIndex ? 0.08 : 0;
      return { sideIndex, metrics, score: metrics.score + orderBias };
    }).sort((a, b) => b.score - a.score);
    const best = metricsBySide[0];
    const assignedSide = best?.metrics.compatible ? best.sideIndex : -1;

    if (assignedSide >= 0) {
      assignedStrokeIds[assignedSide].add(stroke.id);
      stroke.samples.forEach((pt) => assigned[assignedSide].push(pt));
    } else {
      rejectedStrokes.push({ strokeId: stroke.id, reason: rejectionReason(metricsBySide) });
    }

    strokeAssignments.push({
      strokeId: stroke.id,
      assignedSide: assignedSide >= 0 ? labels[assignedSide] : "rejected",
      directionAngle: stroke.direction ? vectorAngleDegrees(stroke.direction) : null,
      metrics: metricsBySide
        .sort((a, b) => a.sideIndex - b.sideIndex)
        .map((entry) => ({
          side: labels[entry.sideIndex],
          directionCompatibility: entry.metrics.directionCompatibility,
          midpointDistance: entry.metrics.midpointDistance,
          midpointProjection: entry.metrics.midpointProjection,
          supportRatio: entry.metrics.supportRatio,
          projectedInside: entry.metrics.projectedInside,
        })),
      rejectionReason: assignedSide >= 0 ? null : rejectionReason(metricsBySide),
    });
  });

  return { assigned, assignedStrokeIds, rejectedStrokes, strokeAssignments };
}

function verticesFromLines(lines, fallbacks, bounds, tolerance) {
  return [
    chooseVertex(lineIntersection(lines[3], lines[0]), fallbacks[0], bounds, tolerance),
    chooseVertex(lineIntersection(lines[0], lines[1]), fallbacks[1], bounds, tolerance),
    chooseVertex(lineIntersection(lines[1], lines[2]), fallbacks[2], bounds, tolerance),
    chooseVertex(lineIntersection(lines[2], lines[3]), fallbacks[3], bounds, tolerance),
  ];
}

function refineCandidate(strokeEvidence, samples, splits, lines, vertices, bounds, tolerance) {
  const sides = [
    { name: "A", line: lines[0], start: vertices[0], end: vertices[1] },
    { name: "B", line: lines[1], start: vertices[1], end: vertices[2] },
    { name: "C", line: lines[2], start: vertices[2], end: vertices[3] },
    { name: "D", line: lines[3], start: vertices[3], end: vertices[0] },
  ];
  const assigned = assignStrokesToSides(strokeEvidence, sides, splits, tolerance);
  const seedPoints = [
    samples.slice(0, splits[0]),
    samples.slice(splits[0], splits[1]),
    samples.slice(splits[1], splits[2]),
    samples.slice(splits[2]),
  ];
  const refinedLines = lines.map((line, index) => {
    const points = assigned.assigned[index].length >= Math.max(4, seedPoints[index].length * 0.35)
      ? assigned.assigned[index]
      : seedPoints[index];
    return fitPcaLine(points) || line;
  });
  const refinedVertices = verticesFromLines(refinedLines, vertices, bounds, tolerance);
  const refinedSides = [
    { name: "A", line: refinedLines[0], start: refinedVertices[0], end: refinedVertices[1] },
    { name: "B", line: refinedLines[1], start: refinedVertices[1], end: refinedVertices[2] },
    { name: "C", line: refinedLines[2], start: refinedVertices[2], end: refinedVertices[3] },
    { name: "D", line: refinedLines[3], start: refinedVertices[3], end: refinedVertices[0] },
  ];
  const refinedAssigned = assignStrokesToSides(strokeEvidence, refinedSides, splits, tolerance);
  return {
    lines: refinedLines,
    vertices: refinedVertices,
    assignedPoints: refinedAssigned.assigned,
    assignedStrokeIds: refinedAssigned.assignedStrokeIds,
    strokeAssignments: refinedAssigned.strokeAssignments,
    rejectedStrokes: refinedAssigned.rejectedStrokes,
  };
}

function mean(values = []) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function angleScoreNear(value, target, tolerance) {
  return clamp01(1 - Math.abs(value - target) / Math.max(1, tolerance));
}

function oppositeParallelScore(lines, tolerance) {
  const ac = angleDegreesBetween(lines[0].axis, lines[2].axis);
  const bd = angleDegreesBetween(lines[1].axis, lines[3].axis);
  return mean([angleScoreNear(ac, 0, tolerance), angleScoreNear(bd, 0, tolerance)]);
}

function rightCornerScore(angles, tolerance) {
  return mean(angles.map((angle) => angleScoreNear(angle, 90, tolerance)));
}

export function fitQuadrilateralHypothesis(rawStrokes = [], options = {}) {
  const strokeCount = rawStrokes.filter((stroke) =>
    Array.isArray(stroke?.points) && stroke.points.length >= 2
  ).length;
  if (strokeCount < 4) {
    return { quadrilateral: false, rectangleLike: false, reason: "not-enough-strokes", strokeCount };
  }

  const samplesPerStroke = options.samplesPerStroke || 7;
  const strokeEvidence = buildStrokeEvidence(rawStrokes, samplesPerStroke);
  const samples = strokeEvidence.flatMap((stroke) => stroke.samples);
  samples.forEach((pt, sampleIndex) => {
    pt.sampleIndex = sampleIndex;
  });
  const minSegmentPoints = Number(options.minSegmentPoints) || 4;
  const splitStep = Math.max(1, Number(options.splitStep) || Math.floor(samples.length / 64));
  if (samples.length < minSegmentPoints * 4) {
    return { quadrilateral: false, rectangleLike: false, reason: "not-enough-points", strokeCount };
  }

  const diagonal = bboxDiagonal(samples);
  const closureTolerance = Math.max(
    Number(options.minClosureTolerance) || 12,
    diagonal * (Number(options.closureDiagonalRatio) || 0.10),
  );
  const assignmentTolerance = Math.max(
    closureTolerance,
    Number(options.minAssignmentTolerance) || 14,
    diagonal * (Number(options.assignmentDiagonalRatio) || 0.10),
  );
  const bounds = boundingBoxForPoints(samples);
  const minSideLength = Math.max(
    Number(options.minSideLength) || 20,
    diagonal * (Number(options.minSideLengthRatio) || 0.12),
  );
  const minAngle = Number(options.minCornerAngleDegrees) || 18;
  const parallelTolerance = Number(options.parallelToleranceDegrees) || 15;
  const rightAngleTolerance = Number(options.rightAngleToleranceDegrees) || 15;
  const triangleError = Number(options.triangleError) || Infinity;

  let best = null;
  const firstStart = minSegmentPoints;
  const firstEnd = samples.length - minSegmentPoints * 3;
  for (let splitA = firstStart; splitA <= firstEnd; splitA += splitStep) {
    const secondStart = splitA + minSegmentPoints;
    const secondEnd = samples.length - minSegmentPoints * 2;
    for (let splitB = secondStart; splitB <= secondEnd; splitB += splitStep) {
      const thirdStart = splitB + minSegmentPoints;
      const thirdEnd = samples.length - minSegmentPoints;
      for (let splitC = thirdStart; splitC <= thirdEnd; splitC += splitStep) {
        const groups = [
          samples.slice(0, splitA),
          samples.slice(splitA, splitB),
          samples.slice(splitB, splitC),
          samples.slice(splitC),
        ];
        const lines = groups.map((points) => fitPcaLine(points));
        if (lines.some((line) => !line)) continue;

        const adjacentAngles = [
          angleDegreesBetween(lines[0].axis, lines[1].axis),
          angleDegreesBetween(lines[1].axis, lines[2].axis),
          angleDegreesBetween(lines[2].axis, lines[3].axis),
          angleDegreesBetween(lines[3].axis, lines[0].axis),
        ];
        if (Math.min(...adjacentAngles) < minAngle) continue;

        const fallbacks = [
          closureCorner(samples),
          localCorner(samples, splitA),
          localCorner(samples, splitB),
          localCorner(samples, splitC),
        ];
        const vertices = verticesFromLines(lines, fallbacks, bounds, closureTolerance);
        const refined = refineCandidate(
          strokeEvidence,
          samples,
          [splitA, splitB, splitC],
          lines,
          vertices,
          bounds,
          assignmentTolerance,
        );
        const candidateVertices = refined.vertices;
        const sideLengths = [
          distance(candidateVertices[0], candidateVertices[1]),
          distance(candidateVertices[1], candidateVertices[2]),
          distance(candidateVertices[2], candidateVertices[3]),
          distance(candidateVertices[3], candidateVertices[0]),
        ];
        if (Math.min(...sideLengths) < minSideLength) continue;

        const angles = internalAngles(candidateVertices);
        if (Math.min(...angles) < 8 || Math.max(...angles) > 172) continue;

        const area = polygonArea(candidateVertices);
        if (area < Math.max(closureTolerance * closureTolerance, diagonal * diagonal * 0.03)) continue;

        const support = refined.assignedStrokeIds.map((ids) => ids.size);
        if (Math.min(...support) < 1) continue;

        const assignedGroups = refined.assignedPoints.map((points, index) =>
          points.length >= 2 ? points : groups[index]
        );
        const fourSegmentError = weightedFourError(assignedGroups, refined.lines);
        const improvementRatio = Number.isFinite(triangleError)
          ? fourSegmentError / Math.max(EPSILON, triangleError)
          : 0.85;
        const closureError = (
          distance(candidateVertices[0], fallbacks[0]) +
          distance(candidateVertices[1], fallbacks[1]) +
          distance(candidateVertices[2], fallbacks[2]) +
          distance(candidateVertices[3], fallbacks[3])
        ) / 4;
        const closureScore = clamp01(1 - closureError / Math.max(EPSILON, closureTolerance * 3));
        const supportScore = clamp01(Math.min(...support) / 2);
        const angleSpreadScore = clamp01((Math.min(...angles) - 8) / 35);
        const parallelScore = oppositeParallelScore(refined.lines, parallelTolerance);
        const rightScore = rightCornerScore(angles, rightAngleTolerance);
        const rectangleSubtypeConfidence = clamp01((parallelScore * 0.55) + (rightScore * 0.45));
        const sideAngles = refined.lines.map((line) => sideAngleDegrees(line));
        const fitScore = Number.isFinite(triangleError)
          ? clamp01((1.18 - improvementRatio) / 0.55)
          : 0.55;
        let confidence = 0.16 +
          supportScore * 0.24 +
          closureScore * 0.24 +
          fitScore * 0.16 +
          angleSpreadScore * 0.08 +
          parallelScore * 0.08 +
          rightScore * 0.04;
        confidence = clamp01(confidence);
        const score = confidence + closureScore * 0.08 + parallelScore * 0.05 - improvementRatio * 0.06;

        if (!best || score > best.score) {
          best = {
            score,
            splitA,
            splitB,
            splitC,
            vertices: candidateVertices,
            lines: refined.lines,
            fourSegmentError,
            triangleError,
            improvementRatio,
            closureError,
            closureScore,
            support,
            sideLengths,
            angles,
            sideAngles,
            parallelScore,
            rightAngleScore: rightScore,
            rectangleSubtypeConfidence,
            rectangleLike: rectangleSubtypeConfidence >= 0.5,
            strokeAssignments: refined.strokeAssignments,
            rejectedStrokes: refined.rejectedStrokes,
            confidence,
            area,
          };
        }
      }
    }
  }

  if (!best) {
    return {
      quadrilateral: false,
      rectangleLike: false,
      reason: "no-supported-four-segment-closure",
      strokeCount,
      triangleError,
      closureTolerance,
      assignmentTolerance,
    };
  }

  const enoughClosure = best.closureScore >= (Number(options.minClosureScore) || 0.38);
  const enoughConfidence = best.confidence >= (Number(options.confidenceThreshold) || 0.56);
  const enoughSupport = Math.min(...best.support) >= 1;
  const comparableFit = !Number.isFinite(triangleError) || best.improvementRatio <= (Number(options.maxTriangleErrorRatio) || 1.18);
  const quadrilateral = enoughClosure && enoughConfidence && enoughSupport && comparableFit;
  const reason = !enoughClosure
    ? "closure-too-weak"
    : !enoughSupport
      ? "not-enough-side-support"
      : !comparableFit
        ? "four-segment-fit-worse-than-triangle"
        : !enoughConfidence
          ? "confidence-too-low"
          : "accepted";

  return {
    quadrilateral,
    rectangleLike: quadrilateral && best.rectangleLike,
    reason,
    winningHypothesis: quadrilateral ? (best.rectangleLike ? "rectangle" : "quadrilateral") : "none",
    points: best.vertices,
    vertices: best.vertices,
    strokeCount,
    pointCount: samples.length,
    activeSegmentCount: 4,
    confidence: best.confidence,
    triangleError: best.triangleError,
    fourSegmentError: best.fourSegmentError,
    improvementRatio: best.improvementRatio,
    closureScore: best.closureScore,
    closureError: best.closureError,
    closureTolerance,
    assignmentTolerance,
    rectangleSubtypeConfidence: best.rectangleSubtypeConfidence,
    parallelScore: best.parallelScore,
    rightAngleScore: best.rightAngleScore,
    sideAngles: best.sideAngles,
    detectedSideCount: best.support.filter((count) => count >= 1).length,
    strokeAssignments: best.strokeAssignments,
    rejectedStrokes: best.rejectedStrokes,
    supportA: best.support[0],
    supportB: best.support[1],
    supportC: best.support[2],
    supportD: best.support[3],
    sideLengthA: best.sideLengths[0],
    sideLengthB: best.sideLengths[1],
    sideLengthC: best.sideLengths[2],
    sideLengthD: best.sideLengths[3],
    cornerAngles: best.angles,
    splitA: best.splitA,
    splitB: best.splitB,
    splitC: best.splitC,
  };
}
