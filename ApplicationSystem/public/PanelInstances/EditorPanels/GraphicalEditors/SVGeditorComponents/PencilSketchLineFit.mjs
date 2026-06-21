// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/PencilSketchLineFit.mjs
// Straight-line hypothesis scoring for multi-stroke pencil sketch previews.

const EPSILON = 1e-6;

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
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

function lerpPoint(a, b, alpha) {
  const t = clamp01(alpha);
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

function normalizeVector(x, y) {
  const len = Math.hypot(Number(x) || 0, Number(y) || 0);
  if (!Number.isFinite(len) || len <= EPSILON) return null;
  return { x: x / len, y: y / len };
}

function normalizeStroke(stroke) {
  const source = Array.isArray(stroke?.points) ? stroke.points : stroke;
  if (!Array.isArray(source)) return [];
  const out = [];
  source.forEach((raw) => {
    const pt = toPoint(raw);
    if (!pt) return;
    if (!out.length || distance(out[out.length - 1], pt) > EPSILON) {
      out.push(pt);
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

function pointAtProjection(origin, axis, projection) {
  return {
    x: origin.x + axis.x * projection,
    y: origin.y + axis.y * projection,
  };
}

function projectionOfPoint(point, origin, axis) {
  return ((point.x - origin.x) * axis.x) + ((point.y - origin.y) * axis.y);
}

function perpendicularDistanceToLine(point, origin, axis) {
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  return Math.abs((dx * -axis.y) + (dy * axis.x));
}

function sampleStroke(points = [], sampleCount = 5) {
  if (points.length <= 2) return points.slice();
  const count = Math.max(2, Number.parseInt(sampleCount, 10) || 5);
  const totalLength = strokeLength(points);
  if (totalLength <= EPSILON) return [points[0], points[points.length - 1]];

  const out = [];
  let segmentIndex = 1;
  let traveled = 0;
  let segmentStartDistance = 0;
  for (let i = 0; i < count; i += 1) {
    const target = (totalLength * i) / (count - 1);
    while (segmentIndex < points.length) {
      const segmentLength = distance(points[segmentIndex - 1], points[segmentIndex]);
      if (target <= segmentStartDistance + segmentLength || segmentIndex === points.length - 1) {
        const segmentT = segmentLength <= EPSILON
          ? 0
          : (target - segmentStartDistance) / segmentLength;
        const a = points[segmentIndex - 1];
        const b = points[segmentIndex];
        out.push({
          x: a.x + (b.x - a.x) * clamp(segmentT, 0, 1),
          y: a.y + (b.y - a.y) * clamp(segmentT, 0, 1),
        });
        traveled = target;
        break;
      }
      segmentStartDistance += segmentLength;
      segmentIndex += 1;
    }
  }
  if (!Number.isFinite(traveled)) return [points[0], points[points.length - 1]];
  return out;
}

function equalizedPointCloud(strokes, sampleCount) {
  return strokes.flatMap((points) => sampleStroke(points, sampleCount));
}

function fitPcaLine(points = [], referenceAxis = null) {
  if (points.length < 2) return null;
  let sx = 0;
  let sy = 0;
  points.forEach((pt) => {
    sx += pt.x;
    sy += pt.y;
  });
  const centroid = { x: sx / points.length, y: sy / points.length };

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

  if (referenceAxis && ((axis.x * referenceAxis.x) + (axis.y * referenceAxis.y)) < 0) {
    axis = { x: -axis.x, y: -axis.y };
  }

  return {
    centroid,
    axis,
    eigenRatio: major > EPSILON ? minor / major : 1,
  };
}

function projectionExtents(points = [], origin, axis) {
  let minProjection = Infinity;
  let maxProjection = -Infinity;
  points.forEach((pt) => {
    const projection = projectionOfPoint(pt, origin, axis);
    if (projection < minProjection) minProjection = projection;
    if (projection > maxProjection) maxProjection = projection;
  });
  if (!Number.isFinite(minProjection) || !Number.isFinite(maxProjection)) {
    return null;
  }
  return {
    minProjection,
    maxProjection,
    projectedLength: Math.max(0, maxProjection - minProjection),
  };
}

function rmsPerpendicularError(points = [], origin, axis) {
  if (!points.length) return 0;
  let errorSq = 0;
  points.forEach((pt) => {
    const d = perpendicularDistanceToLine(pt, origin, axis);
    errorSq += d * d;
  });
  return Math.sqrt(errorSq / points.length);
}

function strokeDirection(points = []) {
  if (points.length < 2) return null;
  return normalizeVector(
    points[points.length - 1].x - points[0].x,
    points[points.length - 1].y - points[0].y,
  );
}

function projectionRange(points = [], origin, axis) {
  const extents = projectionExtents(points, origin, axis);
  if (!extents) return { min: Infinity, max: -Infinity, length: 0 };
  return {
    min: extents.minProjection,
    max: extents.maxProjection,
    length: extents.projectedLength,
  };
}

function normalizePreviousLine(previousLine) {
  const start = toPoint(previousLine?.start);
  const end = toPoint(previousLine?.end);
  if (!start || !end) return null;
  const axis = normalizeVector(end.x - start.x, end.y - start.y);
  if (!axis) return null;
  return {
    start,
    end,
    axis,
    origin: start,
    length: distance(start, end),
    strokeCount: Number(previousLine?.strokeCount) || 0,
    confidence: Number(previousLine?.confidence) || 0,
  };
}

function strokeStatsAgainstLine(points, line) {
  const sampled = sampleStroke(points, 5);
  const range = projectionRange(sampled, line.origin, line.axis);
  const rms = rmsPerpendicularError(sampled, line.origin, line.axis);
  const overlap = Math.max(
    0,
    Math.min(range.max, line.length) - Math.max(range.min, 0),
  );
  const projectedGap = range.min > line.length
    ? range.min - line.length
    : Math.max(0, -range.max);
  const dir = strokeDirection(points);
  const axialDot = dir
    ? Math.abs((dir.x * line.axis.x) + (dir.y * line.axis.y))
    : 0;
  const strokeProjectedLength = Math.max(EPSILON, range.length);
  return {
    rms,
    axialDot,
    projectedGap,
    minProjection: range.min,
    maxProjection: range.max,
    overlapRatio: clamp01(overlap / strokeProjectedLength),
    extensionStart: Math.max(0, -range.min),
    extensionEnd: Math.max(0, range.max - line.length),
  };
}

function computeAxisContinuation(strokes, fit, supportFlags) {
  const ranges = strokes
    .map((points, index) => ({
      supported: supportFlags[index] !== false,
      range: projectionRange(points, fit.centroid, fit.axis),
    }))
    .filter((entry) =>
      entry.supported &&
      Number.isFinite(entry.range.min) &&
      Number.isFinite(entry.range.max)
    )
    .map((entry) => entry.range)
    .sort((a, b) => a.min - b.min);
  if (ranges.length < 2) {
    return { coverageRatio: 1, maxGapRatio: 0, overlapOrContinueScore: 1 };
  }

  let unionLength = 0;
  let maxGap = 0;
  let cursorMin = ranges[0].min;
  let cursorMax = ranges[0].max;
  for (let i = 1; i < ranges.length; i += 1) {
    const range = ranges[i];
    if (range.min <= cursorMax) {
      cursorMax = Math.max(cursorMax, range.max);
    } else {
      unionLength += Math.max(0, cursorMax - cursorMin);
      maxGap = Math.max(maxGap, range.min - cursorMax);
      cursorMin = range.min;
      cursorMax = range.max;
    }
  }
  unionLength += Math.max(0, cursorMax - cursorMin);

  const extents = projectionExtents(
    ranges.flatMap((range) => [
      pointAtProjection(fit.centroid, fit.axis, range.min),
      pointAtProjection(fit.centroid, fit.axis, range.max),
    ]),
    fit.centroid,
    fit.axis,
  );
  const projectedLength = Math.max(EPSILON, extents?.projectedLength || 0);
  const coverageRatio = clamp01(unionLength / projectedLength);
  const maxGapRatio = clamp01(maxGap / projectedLength);
  const overlapOrContinueScore = clamp01(
    coverageRatio * (1 - maxGapRatio * 0.35),
  );
  return { coverageRatio, maxGapRatio, overlapOrContinueScore };
}

function stabilizeWithPrevious(candidate, previous, options) {
  if (!previous || previous.length <= EPSILON) return candidate;
  const dot = Math.abs(
    (candidate.axis.x * previous.axis.x) + (candidate.axis.y * previous.axis.y),
  );
  if (dot < (Number(options.previousAxisMinDot) || 0.82)) return candidate;

  const lastStats = candidate.lastStrokeStats;
  const tolerance = Math.max(EPSILON, candidate.allowedError);
  const stabilityTolerance = candidate.previousHighConfidence
    ? Math.max(tolerance, candidate.allowedOffset)
    : tolerance;
  let classification = "same-axis-evidence";
  if (lastStats && candidate.latestStrokeCompatible) {
    const extendsStart = lastStats.extensionStart > stabilityTolerance * 0.65;
    const extendsEnd = lastStats.extensionEnd > stabilityTolerance * 0.65;
    if (lastStats.overlapRatio >= 0.35 && !extendsStart && !extendsEnd) {
      classification = lastStats.rms > tolerance * 1.35
        ? "offset-reinforcement"
        : "reinforcement";
    } else if (extendsStart || extendsEnd) {
      classification = "extension";
    }
  } else if (lastStats && lastStats.rms <= tolerance * 1.35) {
    const extendsStart = lastStats.extensionStart > tolerance * 0.65;
    const extendsEnd = lastStats.extensionEnd > tolerance * 0.65;
    if (lastStats.overlapRatio >= 0.55 && !extendsStart && !extendsEnd) {
      classification = "reinforcement";
    } else if (extendsStart || extendsEnd) {
      classification = "extension";
    }
  }

  const oldMin = projectionOfPoint(previous.start, candidate.centroid, candidate.axis);
  const oldMax = projectionOfPoint(previous.end, candidate.centroid, candidate.axis);
  const prevMin = Math.min(oldMin, oldMax);
  const prevMax = Math.max(oldMin, oldMax);
  const candMin = candidate.minProjection;
  const candMax = candidate.maxProjection;

  let minProjection = candMin;
  let maxProjection = candMax;
  let endpointAlpha = 0.42;
  if (classification === "reinforcement" || classification === "offset-reinforcement") {
    minProjection = candMin < prevMin
      ? prevMin + (candMin - prevMin) * 0.32
      : prevMin;
    maxProjection = candMax > prevMax
      ? prevMax + (candMax - prevMax) * 0.32
      : prevMax;
    endpointAlpha = classification === "offset-reinforcement" ? 0.1 : 0.16;
  } else if (classification === "extension") {
    minProjection = candMin < prevMin
      ? prevMin + (candMin - prevMin) * 0.58
      : prevMin + (candMin - prevMin) * 0.08;
    maxProjection = candMax > prevMax
      ? prevMax + (candMax - prevMax) * 0.58
      : prevMax + (candMax - prevMax) * 0.08;
    endpointAlpha = 0.36;
  } else {
    minProjection = prevMin + (candMin - prevMin) * 0.36;
    maxProjection = prevMax + (candMax - prevMax) * 0.36;
  }

  const targetStart = pointAtProjection(candidate.centroid, candidate.axis, minProjection);
  const targetEnd = pointAtProjection(candidate.centroid, candidate.axis, maxProjection);
  const stableStart = lerpPoint(previous.start, targetStart, endpointAlpha);
  const stableEnd = lerpPoint(previous.end, targetEnd, endpointAlpha);

  return {
    ...candidate,
    start: stableStart,
    end: stableEnd,
    minProjection,
    maxProjection,
    projectedLength: Math.max(0, maxProjection - minProjection),
    reinforcementClassification: classification,
    reinforcementOverlapRatio: lastStats?.overlapRatio ?? 0,
    reinforcementRmsError: lastStats?.rms ?? 0,
    latestStrokeCompatible: Boolean(candidate.latestStrokeCompatible),
  };
}

export function fitStraightLineHypothesis(rawStrokes = [], options = {}) {
  const strokes = rawStrokes.map(normalizeStroke).filter((points) =>
    points.length >= 2
  );
  if (strokes.length < 2) {
    return {
      straight: false,
      reason: "single-stroke",
      strokeCount: strokes.length,
    };
  }

  const previousLine = normalizePreviousLine(options.previousLine);
  const previousUsable = previousLine &&
    previousLine.strokeCount > 0 &&
    previousLine.strokeCount <= strokes.length;
  const referenceAxis = previousUsable ? previousLine.axis : null;
  const sampleCount = Number(options.samplesPerStroke) || 5;
  const sampledPoints = equalizedPointCloud(strokes, sampleCount);
  let fit = fitPcaLine(sampledPoints, referenceAxis);
  if (!fit) {
    return { straight: false, reason: "no-fit", strokeCount: strokes.length };
  }

  const initialExtents = projectionExtents(sampledPoints, fit.centroid, fit.axis);
  if (!initialExtents || initialExtents.projectedLength <= EPSILON) {
    return { straight: false, reason: "no-fit", strokeCount: strokes.length };
  }

  let allowedError = Math.max(
    Number(options.minAllowedError) || 6,
    initialExtents.projectedLength * (Number(options.errorLengthRatio) || 0.08),
  );
  const previousHighConfidence = previousUsable &&
    previousLine.confidence >= (Number(options.previousConfidenceThreshold) || 0.7);
  const allowedOffset = previousUsable
    ? Math.max(
      allowedError,
      previousLine.length * (previousHighConfidence ? 0.1 : 0.08),
      Number(options.highConfidenceMinAllowedOffset) || allowedError * 1.25,
    )
    : allowedError;
  const latestPreviousStats = previousUsable
    ? strokeStatsAgainstLine(strokes[strokes.length - 1], previousLine)
    : null;
  const existingLineDirectionDot = Math.cos(
    ((Number(options.existingLineDirectionToleranceDegrees) || 20) * Math.PI) / 180,
  );
  const latestDirectionCompatible = Boolean(
    latestPreviousStats && latestPreviousStats.axialDot >= existingLineDirectionDot,
  );
  const latestOffsetCompatible = Boolean(
    latestPreviousStats && latestPreviousStats.rms <= allowedOffset * 1.12,
  );
  const latestSpanCompatible = Boolean(
    latestPreviousStats && latestPreviousStats.projectedGap <= allowedOffset * 1.25,
  );
  const latestStrokeCompatible = latestDirectionCompatible &&
    latestOffsetCompatible &&
    latestSpanCompatible;
  const strongViolationDirectionDot = Math.cos(
    ((Number(options.strongViolationAngleDegrees) || 45) * Math.PI) / 180,
  );
  const latestStrongViolation = Boolean(
    previousHighConfidence &&
      latestPreviousStats &&
      !latestStrokeCompatible &&
      latestPreviousStats.axialDot < strongViolationDirectionDot &&
      latestPreviousStats.rms > allowedOffset * 0.9,
  );

  const outlierDistance = Math.max(
    allowedError * (Number(options.outlierErrorScale) || 1.75),
    (Number(options.minAllowedError) || 6) * 1.35,
  );
  let supportPoints = sampledPoints.filter((pt) =>
    perpendicularDistanceToLine(pt, fit.centroid, fit.axis) <= outlierDistance
  );
  if (previousHighConfidence && latestStrokeCompatible) {
    const previousCompatiblePoints = sampledPoints.filter((pt) =>
      perpendicularDistanceToLine(pt, previousLine.origin, previousLine.axis) <=
        allowedOffset * 1.15
    );
    if (previousCompatiblePoints.length >= Math.max(6, sampledPoints.length * 0.5)) {
      supportPoints = previousCompatiblePoints;
      fit = fitPcaLine(supportPoints, referenceAxis) || fit;
    }
  } else if (supportPoints.length >= Math.max(6, sampledPoints.length * 0.52)) {
    fit = fitPcaLine(supportPoints, referenceAxis) || fit;
  } else {
    supportPoints = sampledPoints;
  }

  let extents = projectionExtents(supportPoints, fit.centroid, fit.axis);
  if (!extents || extents.projectedLength <= EPSILON) {
    extents = initialExtents;
    supportPoints = sampledPoints;
  }
  allowedError = Math.max(
    Number(options.minAllowedError) || 6,
    extents.projectedLength * (Number(options.errorLengthRatio) || 0.08),
  );

  const strokeSupportLimit = allowedError *
    (Number(options.strokeSupportErrorScale) || 1.45);
  const strokeSupport = strokes.map((points) => {
    const sampled = sampleStroke(points, sampleCount);
    const rms = rmsPerpendicularError(sampled, fit.centroid, fit.axis);
    const maxDistance = sampled.reduce(
      (max, pt) => Math.max(max, perpendicularDistanceToLine(pt, fit.centroid, fit.axis)),
      0,
    );
    return {
      supported: rms <= strokeSupportLimit || maxDistance <= allowedError * 2.4,
      rms,
      maxDistance,
    };
  });
  const supportFlags = strokeSupport.map((entry) => entry.supported);
  const supportedStrokeCount = strokeSupport.filter((entry) => entry.supported).length;
  const supportRatio = supportedStrokeCount / strokes.length;

  const robustRmsError = rmsPerpendicularError(supportPoints, fit.centroid, fit.axis);
  const allPointRmsError = rmsPerpendicularError(sampledPoints, fit.centroid, fit.axis);
  const linearity = 1 - clamp01(
    robustRmsError / Math.max(EPSILON, allowedError),
  );
  const spreadRatio = extents.projectedLength /
    Math.max(EPSILON, robustRmsError * 2);

  let directionCount = 0;
  let alignedCount = 0;
  let directionDotTotal = 0;
  const minDirectionDot = Math.cos(
    ((Number(options.directionToleranceDegrees) || 22) * Math.PI) / 180,
  );
  strokes.forEach((points, index) => {
    if (!supportFlags[index]) return;
    const dir = strokeDirection(points);
    if (!dir) return;
    const axialDot = Math.abs((dir.x * fit.axis.x) + (dir.y * fit.axis.y));
    directionCount += 1;
    directionDotTotal += axialDot;
    if (axialDot >= minDirectionDot) alignedCount += 1;
  });

  const directionAgreement = directionCount > 0
    ? directionDotTotal / directionCount
    : 0;
  const alignedRatio = directionCount > 0 ? alignedCount / directionCount : 0;
  const continuation = computeAxisContinuation(strokes, fit, supportFlags);
  const totalStrokeLength = strokes.reduce(
    (sum, points) => sum + strokeLength(points),
    0,
  );
  const projectedToInkRatio = extents.projectedLength /
    Math.max(EPSILON, totalStrokeLength);

  const lastStrokeStats = latestPreviousStats;
  const candidate = stabilizeWithPrevious({
    centroid: fit.centroid,
    axis: fit.axis,
    minProjection: extents.minProjection,
    maxProjection: extents.maxProjection,
    projectedLength: extents.projectedLength,
    start: pointAtProjection(fit.centroid, fit.axis, extents.minProjection),
    end: pointAtProjection(fit.centroid, fit.axis, extents.maxProjection),
    allowedError,
    allowedOffset,
    previousHighConfidence,
    latestStrokeCompatible,
    lastStrokeStats,
  }, previousUsable ? previousLine : null, options);

  let confidence = linearity;
  confidence += Math.max(0, directionAgreement - 0.86) * 0.78;
  confidence += Math.max(0, alignedRatio - 0.62) * 0.28;
  confidence += Math.max(0, supportRatio - 0.58) * 0.22;
  confidence += Math.max(0, continuation.overlapOrContinueScore - 0.5) * 0.14;
  if (strokes.length >= 3) confidence += 0.08;
  if (strokes.length >= 5) confidence += 0.06;
  if (
    candidate.reinforcementClassification === "reinforcement" ||
    candidate.reinforcementClassification === "offset-reinforcement"
  ) {
    confidence += 0.08;
  }
  if (previousHighConfidence && latestStrokeCompatible && strokes.length >= 3) {
    confidence += 0.12;
  }
  if (latestStrongViolation) confidence -= 0.24;
  confidence = clamp01(confidence);

  const enoughLength = candidate.projectedLength >= Math.max(
    Number(options.minProjectedLength) || 0,
    allowedError * 1.45,
  );
  const enoughLinearity = linearity >=
    (Number(options.linearityThreshold) || 0.34);
  const enoughDirection = alignedRatio >=
    (Number(options.minAlignedRatio) || 0.55) &&
    directionAgreement >= (Number(options.minDirectionAgreement) || 0.78);
  const enoughSupport = supportRatio >= (Number(options.minSupportRatio) || 0.55);
  const enoughSpread = spreadRatio >= (Number(options.minSpreadRatio) || 2.7) ||
    robustRmsError <= allowedError * 0.72;
  const notJustStacked = projectedToInkRatio >=
    (Number(options.minProjectedToInkRatio) || 0.32);
  const stablePreviousLine = previousHighConfidence &&
    latestStrokeCompatible &&
    enoughLength &&
    supportRatio >= (Number(options.stableLineMinSupportRatio) || 0.45) &&
    directionAgreement >= (Number(options.stableLineMinDirectionAgreement) || 0.68) &&
    linearity >= (Number(options.stableLineMinLinearity) || 0.12);
  const baseStraight = enoughLength &&
    enoughLinearity &&
    enoughDirection &&
    enoughSupport &&
    enoughSpread &&
    notJustStacked &&
    confidence >= (Number(options.confidenceThreshold) || 0.56);
  const straight = (baseStraight && !latestStrongViolation) || stablePreviousLine;
  const rejectionReason = latestStrongViolation
    ? "latest-stroke-strong-line-violation"
    : !enoughLength
      ? "projected-length-too-short"
      : !enoughLinearity
        ? "perpendicular-error-too-high"
        : !enoughDirection
          ? "direction-agreement-too-low"
          : !enoughSupport
            ? "not-enough-compatible-strokes"
            : !enoughSpread
              ? "not-enough-longitudinal-spread"
              : !notJustStacked
                ? "projected-span-too-small-for-ink"
                : confidence < (Number(options.confidenceThreshold) || 0.56)
                  ? "confidence-too-low"
                  : "accepted";

  const stableAxis = normalizeVector(
    candidate.end.x - candidate.start.x,
    candidate.end.y - candidate.start.y,
  ) || fit.axis;
  const angleRadians = Math.atan2(stableAxis.y, stableAxis.x);
  const angleDegrees = angleRadians * 180 / Math.PI;

  return {
    straight,
    reason: straight ? "accepted" : rejectionReason,
    previousWinningHypothesis: previousUsable ? "open-straight-line" : "none",
    currentWinningHypothesis: straight ? "open-straight-line" : "none",
    stablePreviousLine,
    latestStrokeCompatible,
    latestDirectionCompatible,
    latestOffsetCompatible,
    latestSpanCompatible,
    latestStrongViolation,
    points: [candidate.start, candidate.end],
    strokeCount: strokes.length,
    pointCount: sampledPoints.length,
    angleRadians,
    angleDegrees,
    projectedLength: candidate.projectedLength,
    perpendicularRmsError: robustRmsError,
    allPointRmsError,
    allowedError,
    allowedOffset,
    linearity,
    confidence,
    directionAgreement,
    alignedRatio,
    supportRatio,
    supportedStrokeCount,
    outlierPointCount: Math.max(0, sampledPoints.length - supportPoints.length),
    spreadRatio,
    totalStrokeLength,
    projectedToInkRatio,
    coverageRatio: continuation.coverageRatio,
    maxGapRatio: continuation.maxGapRatio,
    reinforcementClassification: candidate.reinforcementClassification || "none",
    reinforcementOverlapRatio: candidate.reinforcementOverlapRatio || 0,
    reinforcementRmsError: candidate.reinforcementRmsError || 0,
    winningHypothesis: straight ? "open-straight-line" : "none",
    state: straight
      ? {
        start: { ...candidate.start },
        end: { ...candidate.end },
        axis: { ...stableAxis },
        strokeCount: strokes.length,
        projectedLength: candidate.projectedLength,
        confidence,
      }
      : null,
  };
}
