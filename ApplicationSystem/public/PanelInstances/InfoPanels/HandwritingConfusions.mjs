// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/HandwritingConfusions.mjs
// Directional, per-user handwriting confusion statistics and bounded reranking helpers.

import {
  normalizeCandidateShape,
  stableSortHandwritingCandidates,
} from "./HandwritingCandidateScoring.mjs";

export const HANDWRITING_CONFUSIONS_SCHEMA = "nodevision-handwriting-confusions/1";

export const DEFAULT_CONFUSION_CONFIG = Object.freeze({
  minObservations: 3,
  maxAdjustment: 0.055,
  scale: 8,
  maxScoreGapForAdjustment: 0.14,
  minCandidateScoreForAdjustment: 0.22,
});

function safeText(value) {
  return String(value ?? "").replace(/\u0000/g, "");
}

function firstGrapheme(value) {
  return Array.from(safeText(value).trim())[0] || "";
}

function clamp(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.max(min, Math.min(max, numeric));
}

export function sanitizeConfusionCharacter(value) {
  const char = firstGrapheme(value);
  if (!char || /\s/.test(char)) return "";
  return char;
}

export function confusionPairKey(recognized, intended) {
  const from = sanitizeConfusionCharacter(recognized);
  const to = sanitizeConfusionCharacter(intended);
  if (!from || !to || from === to) return "";
  return `${from}>${to}`;
}

export function createEmptyConfusions(now = new Date().toISOString()) {
  return {
    schema: HANDWRITING_CONFUSIONS_SCHEMA,
    updatedAt: now,
    pairs: {},
  };
}

export function validateConfusions(raw, now = new Date().toISOString()) {
  if (!raw || typeof raw !== "object" || raw.schema !== HANDWRITING_CONFUSIONS_SCHEMA) {
    return createEmptyConfusions(now);
  }
  const pairs = {};
  const rawPairs = raw.pairs && typeof raw.pairs === "object" ? raw.pairs : {};
  for (const [key, value] of Object.entries(rawPairs)) {
    const [from, to] = String(key).split(">");
    const pairKey = confusionPairKey(from, to);
    if (!pairKey || pairKey !== key) continue;
    const count = Math.max(0, Math.floor(Number(value?.count || 0)));
    if (!count) continue;
    pairs[pairKey] = {
      count,
      updatedAt: safeText(value?.updatedAt || raw.updatedAt || ""),
    };
  }
  return {
    schema: HANDWRITING_CONFUSIONS_SCHEMA,
    updatedAt: safeText(raw.updatedAt || now),
    pairs,
  };
}

export function recordDirectionalConfusion(rawConfusions, recognized, intended, options = {}) {
  const now = options.now || new Date().toISOString();
  const key = confusionPairKey(recognized, intended);
  const confusions = validateConfusions(rawConfusions, now);
  if (!key) return { confusions, recorded: false, key: "" };
  const current = confusions.pairs[key] || { count: 0 };
  confusions.pairs[key] = {
    ...current,
    count: Math.max(0, Math.floor(Number(current.count || 0))) + 1,
    updatedAt: now,
  };
  confusions.updatedAt = now;
  return { confusions, recorded: true, key };
}

export function confusionAdjustment(rawConfusions, recognized, intended, options = {}) {
  const config = { ...DEFAULT_CONFUSION_CONFIG, ...options };
  const key = confusionPairKey(recognized, intended);
  if (!key) return 0;
  const confusions = validateConfusions(rawConfusions);
  const count = Math.max(0, Math.floor(Number(confusions.pairs[key]?.count || 0)));
  if (count < config.minObservations) return 0;
  const activeCount = count - config.minObservations + 1;
  const scaled = 1 - Math.exp(-activeCount / Math.max(1, config.scale));
  return clamp(scaled * config.maxAdjustment, 0, config.maxAdjustment);
}

export function rerankCandidatesWithConfusions(candidates = [], rawConfusions = null, options = {}) {
  const config = { ...DEFAULT_CONFUSION_CONFIG, ...options };
  const normalized = candidates.map(normalizeCandidateShape);
  if (!normalized.length) return [];
  const sorted = stableSortHandwritingCandidates(normalized);
  const top = sorted[0];

  const adjusted = sorted.map((candidate) => {
    if (candidate.text === top.text) {
      return {
        ...candidate,
        evidence: {
          ...(candidate.evidence || {}),
          confusionAdjustment: candidate.evidence?.confusionAdjustment || 0,
        },
      };
    }
    const gap = (top.score || 0) - (candidate.score || 0);
    const shapeGoodEnough = (candidate.score || 0) >= config.minCandidateScoreForAdjustment;
    const closeEnough = gap <= config.maxScoreGapForAdjustment;
    const adjustment = shapeGoodEnough && closeEnough
      ? confusionAdjustment(rawConfusions, top.text, candidate.text, config)
      : 0;
    const evidence = {
      ...(candidate.evidence || {}),
      confusionAdjustment: clamp((candidate.evidence?.confusionAdjustment || 0) + adjustment, 0, config.maxAdjustment),
    };
    const score = clamp((candidate.score || 0) + adjustment, 0, 1);
    return {
      ...candidate,
      score,
      relativeConfidence: score,
      confidence: score,
      evidence,
    };
  });

  return stableSortHandwritingCandidates(adjusted);
}
