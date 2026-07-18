// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/HandwritingRecognitionCoordinator.mjs
// Central orchestration and normalization for handwriting recognition engines.

import {
  normalizeCandidateShape,
  stableSortHandwritingCandidates,
} from "./HandwritingCandidateScoring.mjs";
import { rerankCandidatesWithContext } from "./HandwritingRecognitionContext.mjs";

export const DEFAULT_RECOGNITION_COORDINATOR_CONFIG = Object.freeze({
  engineWeights: Object.freeze({
    "browser-native": 0.92,
    "nodevision-custom": 1,
    "nodevision-personal-template": 1,
    tesseract: 0.62,
  }),
  defaultTextScore: 0.68,
  minUsableScore: 0.01,
});

function nowMs() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") return performance.now();
  return Date.now();
}

function safeText(value) {
  return String(value ?? "").replace(/\u0000/g, "");
}

function clamp(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.max(min, Math.min(max, numeric));
}

function abortError() {
  const error = new Error("Recognition request was cancelled");
  error.name = "AbortError";
  return error;
}

export function createRecognitionRequestTracker() {
  let currentId = 0;
  let currentController = null;
  return {
    begin() {
      currentId += 1;
      currentController?.abort?.();
      currentController = typeof AbortController === "function" ? new AbortController() : null;
      return {
        id: currentId,
        signal: currentController?.signal || null,
      };
    },
    invalidate() {
      currentId += 1;
      currentController?.abort?.();
      currentController = null;
      return currentId;
    },
    isActive(request) {
      return Boolean(request && request.id === currentId && !request.signal?.aborted);
    },
    get currentId() {
      return currentId;
    },
  };
}

export function normalizeEngineResult(rawResult, engineName, options = {}) {
  const config = { ...DEFAULT_RECOGNITION_COORDINATOR_CONFIG, ...options };
  const name = rawResult?.engine || engineName || "unknown";
  const rawCandidates = Array.isArray(rawResult?.candidates)
    ? rawResult.candidates
    : (safeText(rawResult?.text || rawResult).trim()
      ? [{ text: safeText(rawResult?.text || rawResult).trim(), score: config.defaultTextScore }]
      : []);

  const candidates = stableSortHandwritingCandidates(rawCandidates.map((candidate) => {
    const normalized = normalizeCandidateShape(candidate);
    const rawScore = candidate.score ?? candidate.relativeConfidence ?? candidate.confidence ?? config.defaultTextScore;
    const score = clamp(rawScore, 0, 1);
    return {
      ...normalized,
      engine: name,
      score,
      relativeConfidence: score,
      confidence: score,
    };
  })).filter((candidate) => safeText(candidate.text || candidate.char));

  return {
    engine: name,
    candidates,
    latencyMs: Math.max(0, Number(rawResult?.latencyMs || 0)),
    status: rawResult?.status || (candidates.length ? "success" : "empty"),
    skippedReason: rawResult?.skippedReason || "",
    error: rawResult?.error || "",
  };
}

function weightedEngineCandidates(engineResult, config, context) {
  const weight = clamp(config.engineWeights?.[engineResult.engine] ?? 1, 0, 1);
  const weighted = engineResult.candidates.map((candidate) => {
    const score = clamp((candidate.score || 0) * weight, 0, 1);
    return {
      ...candidate,
      score,
      relativeConfidence: score,
      confidence: score,
      evidence: {
        ...(candidate.evidence || {}),
        engineWeight: weight,
      },
    };
  });
  return context ? rerankCandidatesWithContext(weighted, context) : stableSortHandwritingCandidates(weighted);
}

function selectFinal(engineResults, config, context) {
  const successful = engineResults.filter((result) => result.status === "success" && result.candidates.length);
  if (!successful.length) {
    return {
      text: "",
      confidence: 0,
      selectedEngine: "",
      alternatives: [],
      engineResults,
      context: {
        contextAdjustmentApplied: false,
      },
    };
  }

  const selectedEngineResult = successful[successful.length - 1];
  const candidates = weightedEngineCandidates(selectedEngineResult, config, context);
  const selected = candidates[0] || null;
  return {
    text: safeText(selected?.text || selected?.char || ""),
    confidence: clamp(selected?.score || 0, 0, 1),
    selectedEngine: selectedEngineResult.engine,
    alternatives: candidates.slice(1, 6).map((candidate) => ({
      text: candidate.text || candidate.char,
      confidence: clamp(candidate.score || 0, 0, 1),
      score: clamp(candidate.score || 0, 0, 1),
      evidence: candidate.evidence || {},
      engine: candidate.engine || selectedEngineResult.engine,
    })),
    engineResults,
    context: {
      contextAdjustmentApplied: candidates.some((candidate) => Number(candidate.evidence?.contextAdjustment || 0) !== 0),
    },
  };
}

/**
 * Run recognition engines in order and arbitrate their candidates.
 *
 * Engines are run sequentially by default to preserve the existing native ->
 * custom -> Tesseract behavior. An engine with `stopOnSuccess !== false`
 * prevents later fallback engines from running once it returns candidates.
 */
export async function coordinateHandwritingRecognition({
  engines = [],
  context = null,
  signal = null,
  requestId = null,
  config: rawConfig = {},
} = {}) {
  const config = {
    ...DEFAULT_RECOGNITION_COORDINATOR_CONFIG,
    ...rawConfig,
    engineWeights: {
      ...DEFAULT_RECOGNITION_COORDINATOR_CONFIG.engineWeights,
      ...(rawConfig.engineWeights || {}),
    },
  };
  const engineResults = [];

  for (const engine of engines) {
    const name = engine?.name || engine?.engine || "unknown";
    if (signal?.aborted) throw abortError();

    let available = true;
    try {
      if (typeof engine?.available === "function") available = await engine.available({ signal, requestId });
      else if (engine?.available === false) available = false;
    } catch (err) {
      available = false;
      engineResults.push({
        engine: name,
        candidates: [],
        latencyMs: 0,
        status: "failed",
        error: err?.message || String(err),
      });
      continue;
    }

    if (!available) {
      engineResults.push({
        engine: name,
        candidates: [],
        latencyMs: 0,
        status: "skipped",
        skippedReason: "unavailable",
      });
      continue;
    }

    const started = nowMs();
    try {
      const raw = await engine.run({ signal, requestId });
      if (signal?.aborted) throw abortError();
      const normalized = normalizeEngineResult({
        ...raw,
        engine: raw?.engine || name,
        latencyMs: raw?.latencyMs ?? (nowMs() - started),
      }, name, config);
      engineResults.push(normalized);
      const best = normalized.candidates[0];
      if (normalized.status === "success" && best && (best.score || 0) >= config.minUsableScore && engine.stopOnSuccess !== false) {
        break;
      }
    } catch (err) {
      if (err?.name === "AbortError" || signal?.aborted) throw abortError();
      engineResults.push({
        engine: name,
        candidates: [],
        latencyMs: Math.max(0, nowMs() - started),
        status: "failed",
        error: err?.message || String(err),
      });
    }
  }

  return selectFinal(engineResults, config, context);
}
