// Nodevision/ApplicationSystem/public/HandwritingRecognition/StrokeRecognition/StrokeContextRanker.mjs
// Optional local-only context ranking for plausible experimental stroke candidates.

import { clamp } from "./StrokeGlyphModel.mjs";

export const DEFAULT_STROKE_CONTEXT_CONFIG = Object.freeze({
  enabled: true,
  maxAdjustment: 0.045,
  plausibleScoreGap: 0.1,
  minGeometricScore: 0.25,
  letterInWord: 0.016,
  digitInNumber: 0.03,
  digitInWordPenalty: -0.02,
  lowercaseInsideWord: 0.026,
  uppercaseSentenceStart: 0.026,
  commonPrefixBonus: 0.028,
});

const COMMON_WORDS = Object.freeze([
  "the", "this", "that", "there", "then", "they", "their", "and", "for", "from", "with", "you", "your", "node", "note", "text", "html", "world"
]);

function safeText(value = "") {
  return String(value || "").replace(/\u0000/g, "");
}

function profileFromContext(context = {}) {
  const before = typeof context === "string" ? safeText(context) : safeText(context.before || context.textBefore || context.prefix || "");
  const trailingLetters = (before.match(/[A-Za-z]+$/) || [""])[0];
  const trailingDigits = (before.match(/[0-9]+$/) || [""])[0];
  const significant = before.replace(/[\s"'\(\[\{]+$/g, "");
  const previous = Array.from(significant).pop() || "";
  return {
    before,
    trailingLetters,
    trailingDigits,
    inWord: trailingLetters.length > 0,
    inNumber: trailingDigits.length > 0,
    sentenceStart: !previous || /[.!?]/.test(previous),
  };
}

function prefixBonus(char, profile, config) {
  if (!profile.inWord || !/^[A-Za-z]$/.test(char)) return 0;
  const prefix = (profile.trailingLetters + char).toLowerCase();
  if (prefix.length < 2) return 0;
  return COMMON_WORDS.some((word) => word.startsWith(prefix)) ? config.commonPrefixBonus : 0;
}

function contextAdjustment(char, profile, config) {
  let adjustment = 0;
  if (/^[0-9]$/.test(char)) {
    if (profile.inNumber) adjustment += config.digitInNumber;
    if (profile.inWord) adjustment += config.digitInWordPenalty;
  } else if (/^[A-Za-z]$/.test(char)) {
    if (profile.inWord) adjustment += config.letterInWord;
    if (profile.inWord && /^[a-z]$/.test(char)) adjustment += config.lowercaseInsideWord;
    if (profile.sentenceStart && /^[A-Z]$/.test(char)) adjustment += config.uppercaseSentenceStart;
    adjustment += prefixBonus(char, profile, config);
  }
  return clamp(adjustment, -config.maxAdjustment, config.maxAdjustment);
}

export function rerankStrokeCandidatesWithContext(candidates = [], context = {}, options = {}) {
  const config = { ...DEFAULT_STROKE_CONTEXT_CONFIG, ...options };
  if (config.enabled === false) {
    return { candidates: [...candidates], changed: false, adjustments: [] };
  }
  const bestScore = Number(candidates[0]?.score || 0);
  const profile = profileFromContext(context);
  const adjustments = [];
  const adjusted = candidates.map((candidate) => {
    const char = candidate.character || candidate.text || "";
    const score = Number(candidate.score || 0);
    const plausible = score >= config.minGeometricScore && bestScore - score <= config.plausibleScoreGap;
    const adjustment = plausible ? contextAdjustment(char, profile, config) : 0;
    adjustments.push({ character: char, adjustment, plausible });
    const nextScore = clamp(score + adjustment, 0, 1);
    return {
      ...candidate,
      score: nextScore,
      confidence: nextScore,
      diagnostics: {
        ...(candidate.diagnostics || {}),
        contextAdjustment: adjustment,
      },
    };
  }).sort((a, b) => (b.score - a.score) || String(a.character).localeCompare(String(b.character)) || String(a.templateId).localeCompare(String(b.templateId)));
  const before = candidates.map((candidate) => candidate.character || candidate.text || "").join("");
  const after = adjusted.map((candidate) => candidate.character || candidate.text || "").join("");
  return { candidates: adjusted, changed: before !== after, adjustments, profile };
}
