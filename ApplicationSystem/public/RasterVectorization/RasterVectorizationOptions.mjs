// Nodevision/ApplicationSystem/public/RasterVectorization/RasterVectorizationOptions.mjs
// This module normalizes raster vectorization options so previews, final conversions, and tests share one deterministic interpretation of tracing controls across line drawing and woodcut modes.

const DEFAULTS = Object.freeze({
  mode: "line", threshold: 150, contrast: 20, cleanup: 1, minFeatureSize: 2,
  detail: 70, simplification: 30, invert: false, removeWhite: true, boldness: 0,
  colorizeFromSource: false, preserveAlpha: true, colorMaxColors: 12, regionMinArea: 12, backgroundPolicy: "preserve",
});

function numberInRange(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function normalizeVectorizationOptions(options = {}) {
  const rawMode = String(options.mode || DEFAULTS.mode).toLowerCase();
  const mode = rawMode === "woodcut" ? "woodcut" : rawMode === "color" ? "color" : "line";
  const preset = mode === "woodcut" ? { threshold: 132, contrast: 45, cleanup: 2, simplification: 55, boldness: 1 } : mode === "color" ? { cleanup: 0, simplification: 62, detail: 42, minFeatureSize: 3, colorizeFromSource: true } : {};
  const merged = { ...DEFAULTS, ...preset, ...options, mode };
  return {
    mode,
    threshold: numberInRange(merged.threshold, preset.threshold ?? DEFAULTS.threshold, 0, 255),
    contrast: numberInRange(merged.contrast, preset.contrast ?? DEFAULTS.contrast, -100, 100),
    cleanup: Math.round(numberInRange(merged.cleanup, preset.cleanup ?? DEFAULTS.cleanup, 0, 8)),
    minFeatureSize: Math.round(numberInRange(merged.minFeatureSize, DEFAULTS.minFeatureSize, 0, 5000)),
    detail: numberInRange(merged.detail, DEFAULTS.detail, 0, 100),
    simplification: numberInRange(merged.simplification, preset.simplification ?? DEFAULTS.simplification, 0, 100),
    invert: Boolean(merged.invert),
    removeWhite: merged.removeWhite !== false,
    boldness: Math.round(numberInRange(merged.boldness, preset.boldness ?? DEFAULTS.boldness, -3, 3)),
    colorizeFromSource: mode === "color" || Boolean(merged.colorizeFromSource),
    preserveAlpha: merged.preserveAlpha !== false,
    colorMaxColors: Math.round(numberInRange(merged.colorMaxColors, DEFAULTS.colorMaxColors, 4, 32)),
    regionMinArea: Math.round(numberInRange(merged.regionMinArea, DEFAULTS.regionMinArea, 1, 5000)),
    backgroundPolicy: ["preserve", "remove-light", "remove-dark"].includes(merged.backgroundPolicy) ? merged.backgroundPolicy : DEFAULTS.backgroundPolicy,
  };
}

export function previewScaleForSize(width, height, maxSide = 700) {
  const side = Math.max(1, Number(width) || 1, Number(height) || 1);
  return Math.min(1, Math.max(0.05, maxSide / side));
}
