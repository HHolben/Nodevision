// Nodevision/ApplicationSystem/public/HandwritingRecognition/StrokeRecognition/StrokeTemplateMatcher.mjs
// Deterministic multi-metric template matching for experimental isolated-character strokes.

import { clamp, finiteNumber } from "./StrokeGlyphModel.mjs";
import {
  bidirectionalNearestDistance,
  extractStrokeFeatures,
  flattenStrokePoints,
  occupancySimilarity,
  rasterizeGlyphOccupancy,
  ratioCompatibility,
  resampledGlyphPath,
  vectorAt,
} from "./StrokeFeatureExtractor.mjs";
import {
  pathLength,
  pointDistance,
  resampleStrokePoints,
  reverseStrokePoints,
} from "./StrokeResampler.mjs";

export const DEFAULT_STROKE_MATCHER_WEIGHTS = Object.freeze({
  nearestPoint: 0.2,
  orderedPath: 0.27,
  direction: 0.14,
  strokeCount: 0.1,
  endpoints: 0.1,
  aspectRatio: 0.08,
  pathLength: 0.05,
  occupancy: 0.06,
});

export const DEFAULT_STROKE_MATCHER_CONFIG = Object.freeze({
  pointsPerStroke: 24,
  pathPoints: 72,
  occupancyGrid: 12,
  permutationLimit: 24,
  nearestDistanceScale: 0.24,
  orderedDistanceScale: 0.34,
  endpointDistanceScale: 0.34,
  directionSampleCount: 24,
  weights: DEFAULT_STROKE_MATCHER_WEIGHTS,
});

function weightedConfig(options = {}) {
  return {
    ...DEFAULT_STROKE_MATCHER_CONFIG,
    ...options,
    weights: {
      ...DEFAULT_STROKE_MATCHER_WEIGHTS,
      ...(options.weights || {}),
    },
  };
}

function similarityFromDistance(distance, scale) {
  return clamp(1 - finiteNumber(distance, 1) / Math.max(1e-9, scale), 0, 1);
}

function dynamicTimeWarpingDistance(aPoints = [], bPoints = []) {
  if (!aPoints.length || !bPoints.length) return 1;
  let previous = new Float64Array(bPoints.length + 1);
  let current = new Float64Array(bPoints.length + 1);
  previous.fill(Infinity);
  previous[0] = 0;
  for (let i = 1; i <= aPoints.length; i += 1) {
    current.fill(Infinity);
    for (let j = 1; j <= bPoints.length; j += 1) {
      const cost = pointDistance(aPoints[i - 1], bPoints[j - 1]) / Math.SQRT2;
      current[j] = cost + Math.min(previous[j], current[j - 1], previous[j - 1]);
    }
    const swap = previous;
    previous = current;
    current = swap;
  }
  return clamp(previous[bPoints.length] / Math.max(aPoints.length, bPoints.length, 1), 0, 1);
}

function directionSimilarity(aPoints = [], bPoints = [], sampleCount = 24) {
  if (aPoints.length < 2 || bPoints.length < 2) return aPoints.length === bPoints.length ? 1 : 0.35;
  const count = Math.max(2, Math.round(sampleCount));
  const a = resampleStrokePoints(aPoints, count);
  const b = resampleStrokePoints(bPoints, count);
  let total = 0;
  for (let index = 0; index < count; index += 1) {
    const av = vectorAt(a, index);
    const bv = vectorAt(b, index);
    if (!av.valid && !bv.valid) {
      total += 1;
      continue;
    }
    if (!av.valid || !bv.valid) {
      total += 0.35;
      continue;
    }
    const dot = clamp(av.x * bv.x + av.y * bv.y, -1, 1);
    total += (dot + 1) / 2;
  }
  return clamp(total / count, 0, 1);
}

function endpointSimilarity(aPoints = [], bPoints = []) {
  if (!aPoints.length || !bPoints.length) return 0;
  const start = pointDistance(aPoints[0], bPoints[0]);
  const end = pointDistance(aPoints[aPoints.length - 1], bPoints[bPoints.length - 1]);
  return similarityFromDistance((start + end) * 0.5, DEFAULT_STROKE_MATCHER_CONFIG.endpointDistanceScale);
}

function strokeCountSimilarity(inputCount, templateCount) {
  const maxCount = Math.max(inputCount, templateCount, 1);
  return clamp(1 - Math.abs(inputCount - templateCount) / maxCount, 0, 1);
}

function permutationList(count, limit) {
  const safeCount = Math.max(0, Math.round(count));
  if (safeCount <= 1) return [Array.from({ length: safeCount }, (_, index) => index)];
  const output = [];
  const used = new Array(safeCount).fill(false);
  const current = [];
  function visit() {
    if (output.length >= limit) return;
    if (current.length === safeCount) {
      output.push([...current]);
      return;
    }
    for (let index = 0; index < safeCount; index += 1) {
      if (used[index]) continue;
      used[index] = true;
      current.push(index);
      visit();
      current.pop();
      used[index] = false;
    }
  }
  visit();
  return output;
}

function pairedStrokeComparison(inputGlyph, templateGlyph, metadata, config) {
  const inputStrokes = Array.isArray(inputGlyph?.strokes) ? inputGlyph.strokes : [];
  const templateStrokes = Array.isArray(templateGlyph?.strokes) ? templateGlyph.strokes : [];
  if (!inputStrokes.length || !templateStrokes.length) return null;
  const sameCount = inputStrokes.length === templateStrokes.length;
  const orderFlexible = metadata.strokeOrderFlexible !== false && sameCount && templateStrokes.length <= 4;
  const orders = orderFlexible ? permutationList(templateStrokes.length, config.permutationLimit) : [templateStrokes.map((_, index) => index)];
  const directionFlexible = metadata.strokeDirectionReversible !== false;
  let best = null;

  for (const order of orders) {
    let orderedDistance = 0;
    let endpointScore = 0;
    let directionScore = 0;
    let weightTotal = 0;
    for (let index = 0; index < Math.max(inputStrokes.length, templateStrokes.length); index += 1) {
      const inputStroke = inputStrokes[index];
      const templateStroke = templateStrokes[order[index]];
      if (!inputStroke || !templateStroke) {
        orderedDistance += 0.34;
        endpointScore += 0;
        directionScore += 0;
        weightTotal += 1;
        continue;
      }
      const a = resampleStrokePoints(inputStroke.points || [], config.pointsPerStroke);
      const bForward = resampleStrokePoints(templateStroke.points || [], config.pointsPerStroke);
      const bReverse = directionFlexible ? reverseStrokePoints(bForward) : null;
      const forward = {
        distance: dynamicTimeWarpingDistance(a, bForward),
        endpointScore: endpointSimilarity(a, bForward),
        directionScore: directionSimilarity(a, bForward, config.directionSampleCount),
        reversed: false,
      };
      const reverse = bReverse ? {
        distance: dynamicTimeWarpingDistance(a, bReverse),
        endpointScore: endpointSimilarity(a, bReverse),
        directionScore: directionSimilarity(a, bReverse, config.directionSampleCount),
        reversed: true,
      } : null;
      const chosen = reverse && (reverse.distance + (1 - reverse.endpointScore) * 0.05 < forward.distance + (1 - forward.endpointScore) * 0.05) ? reverse : forward;
      const weight = Math.max(pathLength(a), pathLength(bForward), 0.05);
      orderedDistance += chosen.distance * weight;
      endpointScore += chosen.endpointScore * weight;
      directionScore += chosen.directionScore * weight;
      weightTotal += weight;
    }
    const comparison = {
      orderedDistance: weightTotal ? orderedDistance / weightTotal : 1,
      endpointScore: weightTotal ? endpointScore / weightTotal : 0,
      directionScore: weightTotal ? directionScore / weightTotal : 0,
      order,
    };
    if (!best || comparison.orderedDistance < best.orderedDistance) best = comparison;
  }

  return best;
}

function flattenComparison(inputGlyph, templateGlyph, metadata, config) {
  const a = resampledGlyphPath(inputGlyph, Math.max(6, Math.round(config.pathPoints / Math.max(1, inputGlyph.strokes?.length || 1))));
  const bForward = resampledGlyphPath(templateGlyph, Math.max(6, Math.round(config.pathPoints / Math.max(1, templateGlyph.strokes?.length || 1))));
  const bReverse = metadata.strokeDirectionReversible !== false ? reverseStrokePoints(bForward) : null;
  const forward = {
    orderedDistance: dynamicTimeWarpingDistance(a, bForward),
    endpointScore: endpointSimilarity(a, bForward),
    directionScore: directionSimilarity(a, bForward, config.directionSampleCount),
    order: null,
    flattened: true,
  };
  if (!bReverse) return forward;
  const reverse = {
    orderedDistance: dynamicTimeWarpingDistance(a, bReverse),
    endpointScore: endpointSimilarity(a, bReverse),
    directionScore: directionSimilarity(a, bReverse, config.directionSampleCount),
    order: null,
    flattened: true,
  };
  return reverse.orderedDistance < forward.orderedDistance ? reverse : forward;
}

function componentScores(inputGlyph, templateGlyph, metadata, config) {
  const inputPoints = flattenStrokePoints(inputGlyph);
  const templatePoints = flattenStrokePoints(templateGlyph);
  const nearestDistance = bidirectionalNearestDistance(inputPoints, templatePoints);
  const paired = pairedStrokeComparison(inputGlyph, templateGlyph, metadata, config) || flattenComparison(inputGlyph, templateGlyph, metadata, config);
  const flatFallback = metadata.strokesMayBeJoined || inputGlyph.strokes?.length !== templateGlyph.strokes?.length
    ? flattenComparison(inputGlyph, templateGlyph, metadata, config)
    : null;
  const ordered = flatFallback && flatFallback.orderedDistance + 0.04 < paired.orderedDistance ? flatFallback : paired;
  const inputPathLength = finiteNumber(inputGlyph?.metadata?.pathLength, 0);
  const templatePathLength = finiteNumber(templateGlyph?.metadata?.pathLength, 0);
  const occupancy = occupancySimilarity(
    rasterizeGlyphOccupancy(inputGlyph, config.occupancyGrid),
    rasterizeGlyphOccupancy(templateGlyph, config.occupancyGrid)
  );

  return {
    nearestPoint: similarityFromDistance(nearestDistance, config.nearestDistanceScale),
    orderedPath: similarityFromDistance(ordered.orderedDistance, config.orderedDistanceScale),
    direction: ordered.directionScore,
    strokeCount: strokeCountSimilarity(inputGlyph.strokes?.length || 0, templateGlyph.strokes?.length || 0),
    endpoints: ordered.endpointScore,
    aspectRatio: ratioCompatibility(inputGlyph?.metadata?.aspectRatio, templateGlyph?.metadata?.aspectRatio, 0.85),
    pathLength: ratioCompatibility(inputPathLength, templatePathLength, 0.85),
    occupancy,
    raw: {
      nearestDistance,
      orderedDistance: ordered.orderedDistance,
      order: ordered.order,
      flattened: Boolean(ordered.flattened),
    },
  };
}

export function compareGlyphToTemplate(inputGlyph, template, options = {}) {
  const config = weightedConfig(options);
  const templateGlyph = template?.normalizedGlyph || template?.glyph;
  if (!inputGlyph?.strokes?.length || !templateGlyph?.strokes?.length) {
    return { score: 0, confidence: 0, diagnostics: { status: "missing-glyph" } };
  }
  const metadata = template.metadata || {};
  const components = componentScores(inputGlyph, templateGlyph, metadata, config);
  const weights = config.weights;
  const weightTotal = Object.values(weights).reduce((total, value) => total + finiteNumber(value, 0), 0) || 1;
  const baseScore = clamp(Object.entries(weights).reduce((total, [key, weight]) => total + finiteNumber(components[key], 0) * finiteNumber(weight, 0), 0) / weightTotal, 0, 1);
  const personalTemplateBonus = metadata.source === "user-approved" && baseScore >= 0.62 ? Math.min(0.035, (1 - baseScore) * 0.5) : 0;
  const score = clamp(baseScore + personalTemplateBonus, 0, 1);
  return {
    score,
    confidence: score,
    diagnostics: {
      status: "matched",
      components,
      weights,
      templateId: template.id || template.variantId || "",
      source: metadata.source || "builtin",
      baseScore,
      personalTemplateBonus,
    },
  };
}

export function matchStrokeGlyphToTemplates(inputGlyph, templates = [], options = {}) {
  const limit = Math.max(1, Math.round(finiteNumber(options.limit, 8)));
  const byCharacter = new Map();
  for (const template of Array.isArray(templates) ? templates : []) {
    const result = compareGlyphToTemplate(inputGlyph, template, options);
    const character = template.character || template.char || "";
    if (!character) continue;
    const candidate = {
      character,
      text: character,
      score: result.score,
      confidence: result.confidence,
      templateId: template.id || template.variantId || "",
      diagnostics: result.diagnostics,
      metadata: { ...(template.metadata || {}) },
    };
    const previous = byCharacter.get(character);
    if (!previous || candidate.score > previous.score || (candidate.score === previous.score && candidate.templateId < previous.templateId)) {
      byCharacter.set(character, candidate);
    }
  }
  const sourcePriority = (candidate) => candidate.metadata?.source === "user-approved" ? 1 : 0;
  return [...byCharacter.values()]
    .sort((a, b) => (b.score - a.score) || (sourcePriority(b) - sourcePriority(a)) || a.character.localeCompare(b.character) || a.templateId.localeCompare(b.templateId))
    .slice(0, limit);
}

export const strokeMatcherInternals = Object.freeze({
  dynamicTimeWarpingDistance,
  directionSimilarity,
  endpointSimilarity,
  permutationList,
});
