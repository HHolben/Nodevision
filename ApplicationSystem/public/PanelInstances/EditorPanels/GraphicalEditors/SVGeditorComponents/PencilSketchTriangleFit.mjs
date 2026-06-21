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

function dotVectors(a, b) {
  return ((Number(a?.x) || 0) * (Number(b?.x) || 0)) +
    ((Number(a?.y) || 0) * (Number(b?.y) || 0));
}

function vectorAngleDegrees(axis) {
  if (!axis) return null;
  return Math.atan2(axis.y, axis.x) * 180 / Math.PI;
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


function sideAngleDegrees(line) {
  const raw = vectorAngleDegrees(line?.axis);
  if (raw === null) return null;
  return raw < 0 ? raw + 180 : raw;
}

function rightAngleScore(angles = [], tolerance = 15) {
  if (!angles.length) return 0;
  const closest = Math.min(...angles.map((angle) => Math.abs(angle - 90)));
  return clamp01(1 - closest / Math.max(tolerance, 1));
}

function axisAlignmentScore(lines = []) {
  let score = 0;
  lines.forEach((line) => {
    const axis = line?.axis;
    if (!axis) return;
    const vertical = Math.abs(axis.y);
    const horizontal = Math.abs(axis.x);
    score = Math.max(score, clamp01((Math.max(vertical, horizontal) - 0.82) / 0.18));
  });
  return score;
}

function pointInsideExpandedBounds(point, bounds, padding) {
  if (!bounds || !point) return true;
  return point.x >= bounds.minX - padding &&
    point.x <= bounds.maxX + padding &&
    point.y >= bounds.minY - padding &&
    point.y <= bounds.maxY + padding;
}

function chooseTriangleVertex(intersection, fallback, bounds, tolerance) {
  if (intersection && pointInsideExpandedBounds(intersection, bounds, tolerance * 3.5)) {
    return intersection;
  }
  return chooseVertex(intersection, fallback, tolerance);
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
    const projectedInside = projection >= range.min - tolerance * 1.5 &&
      projection <= range.max + tolerance * 1.5;
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
  const midpointInside = midpointProjection >= range.min - tolerance * 1.8 &&
    midpointProjection <= range.max + tolerance * 1.8;
  const distanceScore = clamp01(1 - Math.min(avgDistance, midpointDistance) / Math.max(tolerance, 1));
  const projectionScore = midpointInside ? 1 : clamp01(supportRatio);
  const score = directionCompatibility * 1.1 +
    supportRatio * 1.15 +
    distanceScore * 0.75 +
    projectionScore * 0.25;
  const compatible = directionCompatibility >= 0.55 && (
    supportRatio >= 0.35 ||
    avgDistance <= tolerance ||
    midpointDistance <= tolerance * 1.15
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

function triangleStrokeRejectionReason(metricsBySide) {
  const bestDirection = Math.max(...metricsBySide.map((entry) => entry.metrics.directionCompatibility));
  const bestSupport = Math.max(...metricsBySide.map((entry) => entry.metrics.supportRatio));
  const bestDistance = Math.min(...metricsBySide.map((entry) => entry.metrics.midpointDistance));
  if (bestDirection < 0.55) return "direction-incompatible";
  if (bestSupport < 0.25 && bestDistance > 0) return "outside-side-band";
  if (!metricsBySide.some((entry) => entry.metrics.projectedInside)) return "outside-side-span";
  return "not-compatible-with-any-triangle-side";
}

function assignStrokesToTriangleSides(strokeEvidence, sides, splitA, splitB, tolerance) {
  const assigned = [[], [], []];
  const assignedStrokeIds = [new Set(), new Set(), new Set()];
  const rejectedStrokes = [];
  const strokeAssignments = [];

  strokeEvidence.forEach((stroke) => {
    const averageSampleIndex = stroke.samples.reduce(
      (sum, pt) => sum + (Number(pt.sampleIndex) || 0),
      0,
    ) / Math.max(1, stroke.samples.length);
    const expectedIndex = averageSampleIndex < splitA ? 0 : averageSampleIndex < splitB ? 1 : 2;
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
      rejectedStrokes.push({
        strokeId: stroke.id,
        reason: triangleStrokeRejectionReason(metricsBySide),
      });
    }

    strokeAssignments.push({
      strokeId: stroke.id,
      assignedSide: assignedSide >= 0 ? ["A", "B", "C"][assignedSide] : "rejected",
      directionAngle: stroke.direction ? vectorAngleDegrees(stroke.direction) : null,
      metrics: metricsBySide
        .sort((a, b) => a.sideIndex - b.sideIndex)
        .map((entry) => ({
          side: ["A", "B", "C"][entry.sideIndex],
          directionCompatibility: entry.metrics.directionCompatibility,
          midpointDistance: entry.metrics.midpointDistance,
          midpointProjection: entry.metrics.midpointProjection,
          supportRatio: entry.metrics.supportRatio,
          projectedInside: entry.metrics.projectedInside,
        })),
      rejectionReason: assignedSide >= 0 ? null : triangleStrokeRejectionReason(metricsBySide),
    });
  });

  return { assigned, assignedStrokeIds, rejectedStrokes, strokeAssignments };
}

function refineTriangleCandidate(strokeEvidence, samples, splitA, splitB, lines, vertices, bounds, tolerance) {
  const sides = [
    { name: "A", line: lines[0], start: vertices[0], end: vertices[1] },
    { name: "B", line: lines[1], start: vertices[1], end: vertices[2] },
    { name: "C", line: lines[2], start: vertices[2], end: vertices[0] },
  ];
  const assigned = assignStrokesToTriangleSides(strokeEvidence, sides, splitA, splitB, tolerance);
  const seedPoints = [samples.slice(0, splitA), samples.slice(splitA, splitB), samples.slice(splitB)];
  const refinedLines = lines.map((line, index) => {
    const points = assigned.assigned[index].length >= Math.max(4, seedPoints[index].length * 0.35)
      ? assigned.assigned[index]
      : seedPoints[index];
    return fitPcaLine(points) || line;
  });
  const refinedAB = chooseTriangleVertex(lineIntersection(refinedLines[0], refinedLines[1]), vertices[1], bounds, tolerance);
  const refinedBC = chooseTriangleVertex(lineIntersection(refinedLines[1], refinedLines[2]), vertices[2], bounds, tolerance);
  const refinedCA = chooseTriangleVertex(lineIntersection(refinedLines[2], refinedLines[0]), vertices[0], bounds, tolerance);
  const refinedVertices = [refinedCA, refinedAB, refinedBC];

  const refinedSides = [
    { name: "A", line: refinedLines[0], start: refinedVertices[0], end: refinedVertices[1] },
    { name: "B", line: refinedLines[1], start: refinedVertices[1], end: refinedVertices[2] },
    { name: "C", line: refinedLines[2], start: refinedVertices[2], end: refinedVertices[0] },
  ];
  const refinedAssigned = assignStrokesToTriangleSides(strokeEvidence, refinedSides, splitA, splitB, tolerance);
  return {
    lines: refinedLines,
    vertices: refinedVertices,
    assignedPoints: refinedAssigned.assigned,
    assignedStrokeIds: refinedAssigned.assignedStrokeIds,
    strokeAssignments: refinedAssigned.strokeAssignments,
    rejectedStrokes: refinedAssigned.rejectedStrokes,
  };
}

export function fitTriangleHypothesis(rawStrokes = [], options = {}) {
  const strokeCount = rawStrokes.filter((stroke) =>
    Array.isArray(stroke?.points) && stroke.points.length >= 2
  ).length;
  if (strokeCount < 3) {
    return { triangle: false, reason: "not-enough-strokes", strokeCount };
  }

  const samplesPerStroke = options.samplesPerStroke || 7;
  const strokeEvidence = buildStrokeEvidence(rawStrokes, samplesPerStroke);
  const samples = strokeEvidence.flatMap((stroke) => stroke.samples);
  samples.forEach((pt, sampleIndex) => {
    pt.sampleIndex = sampleIndex;
  });
  const minSegmentPoints = Number(options.minSegmentPoints) || 5;
  if (samples.length < minSegmentPoints * 3) {
    return { triangle: false, reason: "not-enough-points", strokeCount };
  }

  const diagonal = bboxDiagonal(samples);
  const closureTolerance = Math.max(
    Number(options.minClosureTolerance) || 12,
    diagonal * (Number(options.closureDiagonalRatio) || 0.10),
  );
  const assignmentTolerance = Math.max(
    closureTolerance,
    Number(options.minAssignmentTolerance) || 14,
    diagonal * (Number(options.assignmentDiagonalRatio) || 0.09),
  );
  const bounds = boundingBoxForPoints(samples);
  const rightAngleTolerance = Number(options.rightAngleToleranceDegrees) || 15;
  const minSideLength = Math.max(
    Number(options.minSideLength) || 20,
    diagonal * (Number(options.minSideLengthRatio) || 0.15),
  );
  const minAngle = Number(options.minCornerAngleDegrees) || 20;
  const twoSegmentError = Number(options.twoSegmentError) || Infinity;

  let best = null;
  let rightTriangleCandidateEvaluated = false;
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
      const refined = refineTriangleCandidate(
        strokeEvidence,
        samples,
        splitA,
        splitB,
        [aLine, bLine, cLine],
        vertices,
        bounds,
        assignmentTolerance,
      );
      const candidateVertices = refined.vertices;
      const [candidateLineA, candidateLineB, candidateLineC] = refined.lines;
      const sideA = distance(candidateVertices[0], candidateVertices[1]);
      const sideB = distance(candidateVertices[1], candidateVertices[2]);
      const sideC = distance(candidateVertices[2], candidateVertices[0]);
      if (Math.min(sideA, sideB, sideC) < minSideLength) continue;

      const angles = internalAngles(candidateVertices);
      if (Math.min(...angles) < 10) continue;

      const area = polygonArea(candidateVertices);
      if (area < Math.max(closureTolerance * closureTolerance, diagonal * diagonal * 0.02)) {
        continue;
      }

      const supportA = refined.assignedStrokeIds[0].size;
      const supportB = refined.assignedStrokeIds[1].size;
      const supportC = refined.assignedStrokeIds[2].size;
      if (Math.min(supportA, supportB, supportC) < 1) continue;

      const assignedA = refined.assignedPoints[0].length >= 2 ? refined.assignedPoints[0] : aPoints;
      const assignedB = refined.assignedPoints[1].length >= 2 ? refined.assignedPoints[1] : bPoints;
      const assignedC = refined.assignedPoints[2].length >= 2 ? refined.assignedPoints[2] : cPoints;
      const threeSegmentError = weightedThreeError(
        assignedA,
        candidateLineA,
        assignedB,
        candidateLineB,
        assignedC,
        candidateLineC,
      );
      const improvementRatio = threeSegmentError / Math.max(EPSILON, twoSegmentError);
      const closureError = (
        distance(candidateVertices[1], localAB) +
        distance(candidateVertices[2], localBC) +
        distance(candidateVertices[0], localCA)
      ) / 3;
      const closureScore = clamp01(1 - closureError / Math.max(EPSILON, closureTolerance * 3));
      const supportScore = clamp01(Math.min(supportA, supportB, supportC) / 2);
      const angleScore = clamp01((Math.min(...angles) - 10) / 35);
      const rightScore = rightAngleScore(angles, rightAngleTolerance);
      if (rightScore > 0) rightTriangleCandidateEvaluated = true;
      const axisScore = axisAlignmentScore(refined.lines);
      const improvementScore = Number.isFinite(twoSegmentError)
        ? clamp01(((Number(options.maxImprovementRatio) || 0.78) - improvementRatio) / 0.38)
        : 0.55;
      const sideBalance = Math.min(sideA, sideB, sideC) / Math.max(sideA, sideB, sideC, EPSILON);
      const sideScore = clamp01(sideBalance / 0.18);
      const rightTriangleCompatible = rightScore > 0;
      const sideAngles = refined.lines.map((line) => sideAngleDegrees(line));
      let confidence = 0.18 +
        improvementScore * 0.24 +
        closureScore * 0.24 +
        supportScore * 0.15 +
        angleScore * 0.08 +
        sideScore * 0.03 +
        rightScore * 0.05 +
        axisScore * 0.03;
      confidence = clamp01(confidence);
      const score = confidence - improvementRatio * 0.1 + closureScore * 0.08 + rightScore * 0.04;

      if (!best || score > best.score) {
        best = {
          score,
          splitA,
          splitB,
          vertices: candidateVertices,
          lines: refined.lines,
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
          sideAngles,
          rightAngleScore: rightScore,
          rightTriangleCompatible,
          axisAlignmentScore: axisScore,
          strokeAssignments: refined.strokeAssignments,
          rejectedStrokes: refined.rejectedStrokes,
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
      assignmentTolerance,
      rightTriangleCandidateEvaluated,
    };
  }

  const maxImprovementRatio = (Number(options.maxImprovementRatio) || 0.75) +
    (best.rightTriangleCompatible ? 0.08 : 0);
  const minClosureScore = (Number(options.minClosureScore) || 0.42) -
    (best.rightTriangleCompatible ? 0.04 : 0);
  const enoughImprovement = !Number.isFinite(twoSegmentError) ||
    best.improvementRatio <= maxImprovementRatio;
  const enoughClosure = best.closureScore >= minClosureScore;
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
    assignmentTolerance,
    rightTriangleCandidateEvaluated,
    rightTriangleCompatible: best.rightTriangleCompatible,
    rightAngleScore: best.rightAngleScore,
    sideAngles: best.sideAngles,
    detectedSideCount: [best.supportA, best.supportB, best.supportC].filter((count) => count >= 1).length,
    strokeAssignments: best.strokeAssignments,
    rejectedStrokes: best.rejectedStrokes,
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
