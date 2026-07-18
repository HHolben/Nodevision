// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/HandwritingTrajectoryMatcher.mjs
// Dynamic Time Warping comparison for normalized handwriting trajectories.

import {
  flattenTrajectoryPoints,
  normalizeStoredHandwritingSample,
  resampleStrokePoints,
} from "./HandwritingTrajectory.mjs";

export const DEFAULT_TRAJECTORY_MATCHER_CONFIG = Object.freeze({
  pointsPerStroke: 24,
  maxDtwCells: 24000,
  allowLimitedStrokeAlternates: true,
  localCostWeights: Object.freeze({
    position: 0.72,
    direction: 0.28,
  }),
  scoreWeights: Object.freeze({
    dtw: 0.58,
    strokeCount: 0.1,
    startEnd: 0.12,
    aspectRatio: 0.1,
    pathLength: 0.1,
  }),
  strokeMismatchPenalty: 0.42,
});

function finiteNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function clamp(value, min, max) {
  const numeric = finiteNumber(value, min);
  return Math.max(min, Math.min(max, numeric));
}

function distance(a, b) {
  const dx = finiteNumber(a?.x) - finiteNumber(b?.x);
  const dy = finiteNumber(a?.y) - finiteNumber(b?.y);
  return Math.sqrt(dx * dx + dy * dy);
}

function vectorAt(points, index) {
  const previous = points[Math.max(0, index - 1)];
  const next = points[Math.min(points.length - 1, index + 1)];
  const dx = finiteNumber(next?.x) - finiteNumber(previous?.x);
  const dy = finiteNumber(next?.y) - finiteNumber(previous?.y);
  const length = Math.sqrt(dx * dx + dy * dy);
  if (!Number.isFinite(length) || length <= 1e-9) return { x: 0, y: 0, valid: false };
  return { x: dx / length, y: dy / length, valid: true };
}

function directionDifference(aPoints, aIndex, bPoints, bIndex) {
  const a = vectorAt(aPoints, aIndex);
  const b = vectorAt(bPoints, bIndex);
  if (!a.valid && !b.valid) return 0;
  if (!a.valid || !b.valid) return 0.5;
  const dot = clamp(a.x * b.x + a.y * b.y, -1, 1);
  return (1 - dot) / 2;
}

function localCost(aPoints, aIndex, bPoints, bIndex, config) {
  const weights = config.localCostWeights || DEFAULT_TRAJECTORY_MATCHER_CONFIG.localCostWeights;
  const position = clamp(distance(aPoints[aIndex], bPoints[bIndex]) / Math.SQRT2, 0, 1);
  const direction = directionDifference(aPoints, aIndex, bPoints, bIndex);
  return clamp(position * weights.position + direction * weights.direction, 0, 1);
}

/**
 * Return normalized DTW distance in [0, 1], where lower is better.
 */
export function dynamicTimeWarpingDistance(aPoints, bPoints, options = {}) {
  const config = { ...DEFAULT_TRAJECTORY_MATCHER_CONFIG, ...options };
  const a = Array.isArray(aPoints) ? aPoints : [];
  const b = Array.isArray(bPoints) ? bPoints : [];
  if (!a.length || !b.length) return { distance: 1, cells: 0, skipped: false };
  const cells = a.length * b.length;
  if (cells > config.maxDtwCells) {
    return { distance: 1, cells, skipped: true, reason: "complexity-guard" };
  }

  let previous = new Float64Array(b.length + 1);
  let current = new Float64Array(b.length + 1);
  previous.fill(Infinity);
  previous[0] = 0;

  for (let i = 1; i <= a.length; i += 1) {
    current.fill(Infinity);
    for (let j = 1; j <= b.length; j += 1) {
      const cost = localCost(a, i - 1, b, j - 1, config);
      current[j] = cost + Math.min(previous[j], current[j - 1], previous[j - 1]);
    }
    const swap = previous;
    previous = current;
    current = swap;
  }

  const normalized = previous[b.length] / Math.max(a.length, b.length, 1);
  return { distance: clamp(normalized, 0, 1), cells, skipped: false };
}

function pathLength(points) {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += distance(points[index - 1], points[index]);
  }
  return total;
}

function metadataPathLength(sample) {
  const metaLength = finiteNumber(sample?.metadata?.pathLength, NaN);
  if (Number.isFinite(metaLength) && metaLength >= 0) return metaLength;
  return (Array.isArray(sample?.strokes) ? sample.strokes : []).reduce((total, stroke) => (
    total + pathLength(Array.isArray(stroke?.points) ? stroke.points : [])
  ), 0);
}

function ratioCompatibility(a, b, neutral = 1) {
  const av = finiteNumber(a, NaN);
  const bv = finiteNumber(b, NaN);
  if (!Number.isFinite(av) || !Number.isFinite(bv) || av <= 0 || bv <= 0) return neutral;
  const diff = Math.abs(Math.log(av / bv));
  return clamp(1 - diff / Math.log(4), 0, 1);
}

function pointCompatibility(a, b) {
  if (!a || !b) return 0;
  return clamp(1 - distance(a, b) / Math.SQRT2, 0, 1);
}

function endpointsCompatibility(aSample, bSample) {
  const a = flattenTrajectoryPoints(aSample);
  const b = flattenTrajectoryPoints(bSample);
  if (!a.length || !b.length) return 0;
  const start = pointCompatibility(a[0], b[0]);
  const end = pointCompatibility(a[a.length - 1], b[b.length - 1]);
  return (start + end) / 2;
}

function strokeCountCompatibility(aCount, bCount) {
  const maxCount = Math.max(aCount, bCount, 1);
  return clamp(1 - Math.abs(aCount - bCount) / maxCount, 0, 1);
}

function sequenceVariants(count, config) {
  const base = Array.from({ length: count }, (_, index) => index);
  if (!config.allowLimitedStrokeAlternates || count < 2 || count > 3) return [base];
  const variants = [base];
  for (let index = 0; index < count - 1; index += 1) {
    const swapped = [...base];
    const temp = swapped[index];
    swapped[index] = swapped[index + 1];
    swapped[index + 1] = temp;
    variants.push(swapped);
  }
  return variants;
}

function strokeSequenceDtwDistance(inputSample, templateSample, config, templateOrder = null) {
  const inputStrokes = Array.isArray(inputSample?.strokes) ? inputSample.strokes : [];
  const templateStrokes = Array.isArray(templateSample?.strokes) ? templateSample.strokes : [];
  const count = Math.max(inputStrokes.length, templateStrokes.length);
  if (!count) return { distance: 1, cells: 0, skipped: false };

  let weightedDistance = 0;
  let totalWeight = 0;
  let totalCells = 0;
  let skipped = false;
  const order = templateOrder || Array.from({ length: templateStrokes.length }, (_, index) => index);

  for (let index = 0; index < count; index += 1) {
    const inputStroke = inputStrokes[index];
    const templateStroke = templateStrokes[order[index]];
    if (!inputStroke || !templateStroke) {
      weightedDistance += config.strokeMismatchPenalty;
      totalWeight += 1;
      continue;
    }

    const a = resampleStrokePoints(inputStroke.points || [], config.pointsPerStroke);
    const b = resampleStrokePoints(templateStroke.points || [], config.pointsPerStroke);
    const weight = Math.max(pathLength(a), pathLength(b), 0.05);
    const result = dynamicTimeWarpingDistance(a, b, config);
    totalCells += result.cells;
    skipped = skipped || result.skipped;
    weightedDistance += result.distance * weight;
    totalWeight += weight;
  }

  return {
    distance: totalWeight > 0 ? clamp(weightedDistance / totalWeight, 0, 1) : 1,
    cells: totalCells,
    skipped,
  };
}

/**
 * Compare two normalized handwriting trajectories.
 *
 * Returns `similarity` in [0, 1], where higher is better. `distance` is the
 * complementary trajectory distance, where lower is better.
 */
export function compareHandwritingTrajectories(inputSample, templateSample, options = {}) {
  const config = {
    ...DEFAULT_TRAJECTORY_MATCHER_CONFIG,
    ...options,
    localCostWeights: {
      ...DEFAULT_TRAJECTORY_MATCHER_CONFIG.localCostWeights,
      ...(options.localCostWeights || {}),
    },
    scoreWeights: {
      ...DEFAULT_TRAJECTORY_MATCHER_CONFIG.scoreWeights,
      ...(options.scoreWeights || {}),
    },
  };
  const input = normalizeStoredHandwritingSample(inputSample, { requireStrokes: true });
  const template = normalizeStoredHandwritingSample(templateSample, { requireStrokes: true });
  if (!input || !template) {
    return {
      similarity: null,
      distance: null,
      status: "missing-trajectory",
      evidence: {
        trajectoryAware: false,
      },
    };
  }

  const inputCount = input.strokes.length;
  const templateCount = template.strokes.length;
  const variants = inputCount === templateCount
    ? sequenceVariants(templateCount, config)
    : [Array.from({ length: templateCount }, (_, index) => index)];

  let best = null;
  for (const variant of variants) {
    const candidate = strokeSequenceDtwDistance(input, template, config, variant);
    if (!best || candidate.distance < best.distance) best = { ...candidate, variant };
  }

  const dtwSimilarity = clamp(1 - (best?.distance ?? 1), 0, 1);
  const strokeCountScore = strokeCountCompatibility(inputCount, templateCount);
  const aspectRatioScore = ratioCompatibility(input.metadata?.aspectRatio, template.metadata?.aspectRatio, 0.82);
  const startEndScore = endpointsCompatibility(input, template);
  const pathLengthScore = ratioCompatibility(metadataPathLength(input), metadataPathLength(template), 0.82);
  const weights = config.scoreWeights;
  const similarity = clamp(
    dtwSimilarity * weights.dtw
      + strokeCountScore * weights.strokeCount
      + startEndScore * weights.startEnd
      + aspectRatioScore * weights.aspectRatio
      + pathLengthScore * weights.pathLength,
    0,
    1
  );

  return {
    similarity,
    distance: 1 - similarity,
    status: best?.skipped ? "complexity-limited" : "success",
    evidence: {
      trajectoryAware: true,
      dtwSimilarity,
      strokeCountScore,
      aspectRatioScore,
      startEndScore,
      pathLengthScore,
      dtwDistance: best?.distance ?? 1,
      dtwCells: best?.cells ?? 0,
      alternateStrokeOrderUsed: Boolean(best?.variant?.some((value, index) => value !== index)),
    },
  };
}
