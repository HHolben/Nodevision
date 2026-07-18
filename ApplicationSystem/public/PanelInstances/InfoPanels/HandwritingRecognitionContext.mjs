// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/HandwritingRecognitionContext.mjs
// Text-context reranking for handwriting OCR candidates. This never performs dictionary autocorrection.

import {
  normalizeCandidateShape,
  stableSortHandwritingCandidates,
} from "./HandwritingCandidateScoring.mjs";

export const DEFAULT_CONTEXT_RERANK_CONFIG = Object.freeze({
  uppercaseAfterSentencePunctuation: 0.04,
  uppercaseAtDocumentStart: 0.04,
  uppercaseAfterNewline: 0.026,
  lowercaseInsideWord: 0.035,
  lowercaseAfterSingleCapital: 0.035,
  lowercaseGeneral: 0.02,
  uppercaseRunPenalty: -0.02,
  uppercaseInsideWordPenalty: -0.01,
  digitInNumericContext: 0.04,
  letterInAlphabeticContext: 0.018,
  digitInAlphabeticContextPenalty: -0.018,
  maxAdjustment: 0.06,
});

function safeText(value) {
  return String(value ?? "").replace(/\u0000/g, "");
}

function clamp(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.max(min, Math.min(max, numeric));
}

export function isAsciiLetter(char) {
  return /^[A-Za-z]$/.test(char || "");
}

export function isAsciiDigit(char) {
  return /^[0-9]$/.test(char || "");
}

export function isUppercaseAscii(char) {
  return /^[A-Z]$/.test(char || "");
}

export function contextProfile(context = {}) {
  const before = typeof context === "string"
    ? safeText(context)
    : safeText(context?.before || context?.textBefore || context?.prefix || "");
  const after = typeof context === "string"
    ? ""
    : safeText(context?.after || context?.textAfter || context?.suffix || "");
  const significantBefore = before.replace(/[\s"\x27\u2018\u2019\u201c\u201d\(\[\{]+$/g, "");
  const previous = Array.from(significantBefore).pop() || "";
  const trailingLetters = (before.match(/[A-Za-z]+$/) || [""])[0];
  const trailingDigits = (before.match(/[0-9]+$/) || [""])[0];
  const leadingDigits = (after.match(/^[0-9]+/) || [""])[0];
  const leadingLetters = (after.match(/^[A-Za-z]+/) || [""])[0];
  const upperRun = ((trailingLetters.match(/[A-Z]+$/) || [""])[0] || "").length;
  const trimmedBefore = before.replace(/\s+$/g, "");

  return {
    before,
    after,
    previous,
    inWord: trailingLetters.length > 0,
    upperRun,
    documentStart: !trimmedBefore,
    sentenceStart: !previous || /[.!?]/.test(previous),
    afterNewline: /\n\s*$/.test(before),
    numericContext: trailingDigits.length > 0 || leadingDigits.length > 0,
    alphabeticContext: trailingLetters.length > 0 || leadingLetters.length > 0,
  };
}

export function contextAdjustmentForText(text, context = {}, options = {}) {
  const config = { ...DEFAULT_CONTEXT_RERANK_CONFIG, ...options };
  const char = Array.from(String(text || ""))[0] || "";
  if (!char) return 0;
  const profile = contextProfile(context);
  let adjustment = 0;

  if (isAsciiLetter(char)) {
    const uppercase = isUppercaseAscii(char);
    if (profile.documentStart && uppercase) adjustment += config.uppercaseAtDocumentStart;
    else if (profile.sentenceStart && uppercase) adjustment += config.uppercaseAfterSentencePunctuation;
    else if (profile.afterNewline && uppercase) adjustment += config.uppercaseAfterNewline;

    if (profile.inWord) {
      if (!uppercase && profile.upperRun === 1) adjustment += config.lowercaseAfterSingleCapital;
      else if (!uppercase) adjustment += config.lowercaseInsideWord;
      else if (profile.upperRun < 2) adjustment += config.uppercaseInsideWordPenalty;
      else adjustment += config.uppercaseRunPenalty;
    } else if (!uppercase && !profile.sentenceStart) {
      adjustment += config.lowercaseGeneral;
    }

    if (profile.alphabeticContext) adjustment += config.letterInAlphabeticContext;
  } else if (isAsciiDigit(char)) {
    if (profile.numericContext) adjustment += config.digitInNumericContext;
    if (profile.alphabeticContext && !profile.numericContext) adjustment += config.digitInAlphabeticContextPenalty;
  }

  return clamp(adjustment, -config.maxAdjustment, config.maxAdjustment);
}

export function rerankCandidatesWithContext(candidates = [], context = {}, options = {}) {
  const config = { ...DEFAULT_CONTEXT_RERANK_CONFIG, ...options };
  const adjusted = candidates.map((candidate) => {
    const normalized = normalizeCandidateShape(candidate);
    const contextAdjustment = contextAdjustmentForText(normalized.text || normalized.char, context, config);
    const evidence = {
      ...(normalized.evidence || {}),
      contextAdjustment: clamp((normalized.evidence?.contextAdjustment || 0) + contextAdjustment, -config.maxAdjustment, config.maxAdjustment),
    };
    const score = clamp((normalized.score || 0) + contextAdjustment, 0, 1);
    return {
      ...normalized,
      score,
      relativeConfidence: score,
      confidence: score,
      evidence,
    };
  });
  return stableSortHandwritingCandidates(adjusted);
}
