// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/HandwritingCandidateScoring.mjs
// Shared scoring helpers for handwriting recognition candidates.

export const DEFAULT_HANDWRITING_SCORING_CONFIG = Object.freeze({
  rasterOnlyWeights: Object.freeze({
    raster: 0.78,
    inkDensity: 0.02,
    strokeCount: 0.02,
    aspectRatio: 0.18,
  }),
  trajectoryWeights: Object.freeze({
    raster: 0.48,
    trajectory: 0.34,
    inkDensity: 0.06,
    strokeCount: 0.06,
    aspectRatio: 0.06,
  }),
  templateModeBonus: Object.freeze({
    personalMax: 0.08,
    henryscriptMax: 0.03,
    scriptMax: 0.015,
    sansMax: 0,
  }),
  minBaseScoreForPersonalBonus: 0.28,
  minRasterScoreForPersonalBonus: 0.2,
  maxContextAdjustment: 0.06,
  maxConfusionAdjustment: 0.07,
  maxFinalScore: 0.995,
});

function finiteNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function clamp(value, min, max) {
  const numeric = finiteNumber(value, min);
  return Math.max(min, Math.min(max, numeric));
}

function boundedBonus(baseScore, rasterScore, maxBonus, config) {
  if (maxBonus <= 0) return 0;
  if (baseScore < config.minBaseScoreForPersonalBonus && maxBonus >= config.templateModeBonus.personalMax) return 0;
  if (rasterScore < config.minRasterScoreForPersonalBonus && maxBonus >= config.templateModeBonus.personalMax) return 0;
  const headroom = Math.max(0, baseScore - 0.18);
  return clamp(headroom * maxBonus, 0, maxBonus);
}

function bonusForMode(mode, baseScore, rasterScore, config) {
  const text = String(mode || "");
  if (text === "user-correction" || text.startsWith("user-")) {
    return boundedBonus(baseScore, rasterScore, config.templateModeBonus.personalMax, config);
  }
  if (text.startsWith("henryscript-")) {
    return boundedBonus(baseScore, rasterScore, config.templateModeBonus.henryscriptMax, config);
  }
  if (text.startsWith("script-")) {
    return boundedBonus(baseScore, rasterScore, config.templateModeBonus.scriptMax, config);
  }
  return 0;
}

/**
 * Combine normalized evidence into one relative score in [0, 1].
 *
 * The returned score is a heuristic ranking score, not a calibrated probability.
 */
export function combineHandwritingCandidateEvidence(evidence = {}, options = {}) {
  const config = {
    ...DEFAULT_HANDWRITING_SCORING_CONFIG,
    ...options,
    rasterOnlyWeights: {
      ...DEFAULT_HANDWRITING_SCORING_CONFIG.rasterOnlyWeights,
      ...(options.rasterOnlyWeights || {}),
    },
    trajectoryWeights: {
      ...DEFAULT_HANDWRITING_SCORING_CONFIG.trajectoryWeights,
      ...(options.trajectoryWeights || {}),
    },
    templateModeBonus: {
      ...DEFAULT_HANDWRITING_SCORING_CONFIG.templateModeBonus,
      ...(options.templateModeBonus || {}),
    },
  };
  const rasterScore = clamp(evidence.rasterScore, 0, 1);
  const trajectoryScore = evidence.trajectoryScore === null || evidence.trajectoryScore === undefined
    ? null
    : clamp(evidence.trajectoryScore, 0, 1);
  const inkDensityScore = clamp(evidence.inkDensityScore, 0, 1);
  const strokeCountScore = clamp(evidence.strokeCountScore ?? 1, 0, 1);
  const aspectRatioScore = clamp(evidence.aspectRatioScore ?? 1, 0, 1);
  const weights = trajectoryScore === null ? config.rasterOnlyWeights : config.trajectoryWeights;
  const baseScore = trajectoryScore === null
    ? rasterScore * weights.raster
      + inkDensityScore * weights.inkDensity
      + strokeCountScore * weights.strokeCount
      + aspectRatioScore * weights.aspectRatio
    : rasterScore * weights.raster
      + trajectoryScore * weights.trajectory
      + inkDensityScore * weights.inkDensity
      + strokeCountScore * weights.strokeCount
      + aspectRatioScore * weights.aspectRatio;

  const personalSampleBonus = boundedBonus(
    baseScore,
    rasterScore,
    clamp(evidence.personalSampleBonus, 0, config.templateModeBonus.personalMax),
    config
  );
  const templateBonus = bonusForMode(evidence.mode, baseScore, rasterScore, config);
  const contextAdjustment = clamp(finiteNumber(evidence.contextAdjustment, 0), -config.maxContextAdjustment, config.maxContextAdjustment);
  const confusionAdjustment = clamp(finiteNumber(evidence.confusionAdjustment, 0), -config.maxConfusionAdjustment, config.maxConfusionAdjustment);
  const score = clamp(
    baseScore + Math.max(personalSampleBonus, templateBonus) + contextAdjustment + confusionAdjustment,
    0,
    config.maxFinalScore
  );

  return {
    score,
    relativeConfidence: score,
    evidence: {
      rasterScore,
      trajectoryScore,
      inkDensityScore,
      strokeCountScore,
      aspectRatioScore,
      personalSampleBonus: Math.max(personalSampleBonus, templateBonus),
      contextAdjustment,
      confusionAdjustment,
      baseScore: clamp(baseScore, 0, 1),
      trajectoryAware: trajectoryScore !== null,
    },
  };
}

export function stableSortHandwritingCandidates(candidates = []) {
  return [...candidates].sort((a, b) => {
    const scoreDiff = finiteNumber(b.score, 0) - finiteNumber(a.score, 0);
    if (Math.abs(scoreDiff) > 1e-9) return scoreDiff;
    const aText = String(a.text ?? a.char ?? "");
    const bText = String(b.text ?? b.char ?? "");
    return aText.localeCompare(bText) || String(a.mode || "").localeCompare(String(b.mode || ""));
  });
}

export function normalizeCandidateShape(candidate = {}) {
  const text = String(candidate.text ?? candidate.char ?? "").slice(0, 2);
  const score = clamp(candidate.score ?? candidate.relativeConfidence ?? candidate.confidence, 0, 1);
  return {
    ...candidate,
    text,
    char: candidate.char ?? text,
    score,
    relativeConfidence: clamp(candidate.relativeConfidence ?? score, 0, 1),
    confidence: clamp(candidate.confidence ?? candidate.relativeConfidence ?? score, 0, 1),
    evidence: candidate.evidence && typeof candidate.evidence === "object" ? candidate.evidence : {},
  };
}
