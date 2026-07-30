// Nodevision/ApplicationSystem/public/HandwritingRecognition/StrokeRecognition/StrokeRecognizer.mjs
// Public facade for the experimental Scribblenauts-like isolated-character recognizer.

import { normalizeStrokeGlyph } from "./StrokeNormalizer.mjs";
import { matchStrokeGlyphToTemplates } from "./StrokeTemplateMatcher.mjs";
import { normalizeStrokeTemplates } from "./StrokeTemplateStore.mjs";
import { rerankStrokeCandidatesWithContext } from "./StrokeContextRanker.mjs";

export const STROKE_RECOGNIZER_VERSION = "experimental-stroke-recognizer/1";

export const DEFAULT_STROKE_RECOGNIZER_OPTIONS = Object.freeze({
  enabled: true,
  featureFlagEnabled: true,
  contextRankingEnabled: true,
  candidateLimit: 5,
  minCandidateScore: 0.12,
  lowConfidenceThreshold: 0.46,
});

function nowMs() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") return performance.now();
  return Date.now();
}

function normalizeCandidate(candidate) {
  const score = Math.max(0, Math.min(1, Number(candidate.score || 0)));
  return {
    character: candidate.character || candidate.text || "",
    text: candidate.text || candidate.character || "",
    score,
    confidence: score,
    templateId: candidate.templateId || "",
    diagnostics: candidate.diagnostics || {},
  };
}

export function createStrokeRecognitionRequestTracker() {
  let currentId = 0;
  return {
    begin() {
      currentId += 1;
      return { id: currentId };
    },
    invalidate() {
      currentId += 1;
      return currentId;
    },
    isActive(request) {
      return Boolean(request && request.id === currentId);
    },
    get currentId() {
      return currentId;
    },
  };
}

export function isExperimentalStrokeRecognitionEnabled(preferences = {}, fallback = true) {
  const handwriting = preferences?.handwriting && typeof preferences.handwriting === "object" ? preferences.handwriting : null;
  const nested = handwriting?.experimentalStrokeRecognitionEnabled;
  const flat = preferences?.handwritingExperimentalStrokeRecognitionEnabled;
  if (nested === false || flat === false) return false;
  if (nested === true || flat === true) return true;
  return fallback !== false;
}

export function recognizeGlyph(glyph, options = {}) {
  const started = nowMs();
  const config = { ...DEFAULT_STROKE_RECOGNIZER_OPTIONS, ...options };
  if (config.enabled === false || config.featureFlagEnabled === false) {
    return {
      recognizerVersion: STROKE_RECOGNIZER_VERSION,
      status: "disabled",
      candidates: [],
      diagnostics: { reason: "feature-disabled", recognitionDurationMs: Math.max(0, nowMs() - started) },
    };
  }

  const normalizedGlyph = normalizeStrokeGlyph(glyph, config.normalizerOptions || {});
  if (!normalizedGlyph.strokes.length || (normalizedGlyph.metadata?.pointCount || 0) <= 0) {
    return {
      recognizerVersion: STROKE_RECOGNIZER_VERSION,
      status: "empty",
      candidates: [],
      glyph: normalizedGlyph,
      diagnostics: { reason: "empty-glyph", recognitionDurationMs: Math.max(0, nowMs() - started) },
    };
  }

  const rawTemplates = [
    ...(Array.isArray(config.templates) ? config.templates : []),
    ...(Array.isArray(config.userTemplates) ? config.userTemplates : []),
  ];
  const templateSet = config.templatesAlreadyNormalized
    ? { templates: rawTemplates, errors: [], duplicateTemplateIds: [] }
    : normalizeStrokeTemplates(rawTemplates);

  if (!templateSet.templates.length) {
    return {
      recognizerVersion: STROKE_RECOGNIZER_VERSION,
      status: "no-templates",
      candidates: [],
      glyph: normalizedGlyph,
      diagnostics: {
        reason: "no-templates",
        templateErrors: templateSet.errors,
        recognitionDurationMs: Math.max(0, nowMs() - started),
      },
    };
  }

  const geometricCandidates = matchStrokeGlyphToTemplates(normalizedGlyph, templateSet.templates, {
    ...(config.matcherOptions || {}),
    limit: Math.max(config.candidateLimit * 3, config.candidateLimit),
  }).filter((candidate) => candidate.score >= config.minCandidateScore);

  const reranked = config.contextRankingEnabled === false
    ? { candidates: geometricCandidates, changed: false, adjustments: [] }
    : rerankStrokeCandidatesWithContext(geometricCandidates, config.context || {}, config.contextOptions || {});

  const candidates = reranked.candidates.slice(0, config.candidateLimit).map(normalizeCandidate);
  const best = candidates[0] || null;
  const status = best ? (best.score < config.lowConfidenceThreshold ? "low-confidence" : "success") : "empty";
  return {
    recognizerVersion: STROKE_RECOGNIZER_VERSION,
    status,
    candidates,
    glyph: normalizedGlyph,
    diagnostics: {
      recognitionDurationMs: Math.max(0, nowMs() - started),
      rawStrokeCount: normalizedGlyph.rawGlyph?.strokes?.length || 0,
      filteredPointCount: normalizedGlyph.metadata?.pointCount || 0,
      normalizedBounds: normalizedGlyph.bounds || null,
      pointerType: normalizedGlyph.pointerType || "unknown",
      lowConfidenceThreshold: config.lowConfidenceThreshold,
      templateCount: templateSet.templates.length,
      templateErrors: templateSet.errors,
      duplicateTemplateIds: templateSet.duplicateTemplateIds,
      contextRerankingChanged: reranked.changed,
      contextAdjustments: reranked.adjustments,
      selectedTemplateId: best?.templateId || "",
    },
  };
}

export function createExperimentalStrokeRecognitionProvider(options = {}) {
  return {
    name: "experimental-stroke",
    label: "Experimental Stroke Recognition",
    available: () => options.featureFlagEnabled !== false,
    recognize: (glyph, requestOptions = {}) => recognizeGlyph(glyph, { ...options, ...requestOptions }),
  };
}
