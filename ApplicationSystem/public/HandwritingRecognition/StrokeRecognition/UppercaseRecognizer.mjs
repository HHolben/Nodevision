// Nodevision/ApplicationSystem/public/HandwritingRecognition/StrokeRecognition/UppercaseRecognizer.mjs
// This module exposes a replaceable uppercase-only recognizer using the existing local geometry pipeline, without linguistic context or personal training dependencies.

import { UPPERCASE_TEMPLATE_VARIANTS } from "./UppercaseTemplateVariants.mjs";
import { recognizeGlyph } from "./StrokeRecognizer.mjs";
import { normalizeStrokeGlyph } from "./StrokeNormalizer.mjs";
import { loadBuiltinStrokeTemplates, normalizeStrokeTemplates } from "./StrokeTemplateStore.mjs";

export function createUppercaseRecognizer(rawTemplates) {
  const { templates, errors } = normalizeStrokeTemplates(
    [...(Array.isArray(rawTemplates) ? rawTemplates : []), ...UPPERCASE_TEMPLATE_VARIANTS].filter((item) => /^[A-Z]$/.test(item?.character))
  );
  if (errors.length || new Set(templates.map((item) => item.character)).size !== 26) {
    throw new Error("Uppercase recognition requires valid templates for all 26 letters.");
  }
  return function recognizeLetter(strokes) {
    const glyph = normalizeStrokeGlyph({ strokes }, { minRawPointDistance: 0, minNormalizedPointDistance: 0 });
    if (!glyph.strokes.length || glyph.metadata.pathLength < 0.01) {
      return { letter: null, confidence: 0, candidates: [], status: "empty", glyph, diagnostics: {} };
    }
    const result = recognizeGlyph(glyph.rawGlyph, {
      templates, templatesAlreadyNormalized: true, contextRankingEnabled: false,
      normalizerOptions: { minRawPointDistance: 0, minNormalizedPointDistance: 0 },
      candidateLimit: 5, minCandidateScore: 0,
    });
    const candidates = result.candidates.map((item) => ({ ...item, letter: item.character }));
    const margin = (candidates[0]?.score || 0) - (candidates[1]?.score || 0);
    return {
      ...result, candidates, letter: candidates[0]?.letter || null,
      confidence: candidates[0]?.score || 0,
      diagnostics: { ...result.diagnostics, margin, ambiguous: margin < 0.06 },
    };
  };
}

export async function loadUppercaseRecognizer() {
  const { templates } = await loadBuiltinStrokeTemplates();
  return createUppercaseRecognizer(templates);
}
