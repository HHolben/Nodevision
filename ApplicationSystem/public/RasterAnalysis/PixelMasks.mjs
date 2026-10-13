// Nodevision/ApplicationSystem/public/RasterAnalysis/PixelMasks.mjs
// This module computes gamma-encoded sRGB luma and reusable binary masks in decoded image coordinates. Nonzero-alpha pixels are eligible and count once regardless of partial opacity; fully transparent pixels never enter grayscale bands.
export function normalizeThresholds(lower = 0, upper = 100) {
  const clamp = (v, fallback) => Number.isFinite(Number(v)) ? Math.min(100, Math.max(0, Number(v))) : fallback;
  const lo = clamp(lower, 0); return { lower: lo, upper: Math.max(lo, clamp(upper, 100)) };
}
export function cacheLuma({ data, width, height }) {
  const values = new Float64Array(width * height), eligible = new Uint8Array(values.length);
  for (let i = 0; i < values.length; i++) {
    const k = i * 4;
    // Integer coefficients sum to 10000, preserving exact black and white endpoints.
    values[i] = (2126 * data[k] + 7152 * data[k + 1] + 722 * data[k + 2]) / 25500;
    eligible[i] = Number(data[k + 3] > 0);
  }
  return { values, eligible };
}
export function thresholdMask(cache, lower, upper) {
  const range = normalizeThresholds(lower, upper), mask = new Uint8Array(cache.values.length);
  for (let i = 0; i < mask.length; i++) mask[i] = Number(cache.eligible[i] && cache.values[i] >= range.lower && cache.values[i] <= range.upper);
  return mask;
}
export function intersectMasks(inputs) {
  if (!inputs.length || inputs.some(mask => !mask || mask.length !== inputs[0].length)) return null;
  const mask = inputs[0].slice();
  for (const input of inputs.slice(1)) for (let i = 0; i < mask.length; i++) mask[i] &= input[i];
  return mask;
}
export const countMask = mask => mask?.reduce((sum, value) => sum + Number(Boolean(value)), 0) ?? null;
export function maskVisualization(mask, pixels, { mode = 'highlight', color = '#ffcc00', opacity = .45 } = {}) {
  const rgba = new Uint8ClampedArray(mask.length * 4);
  const hex = /^#[\da-f]{6}$/i.test(color) ? color : '#ffcc00';
  const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  for (let i = 0; i < mask.length; i++) {
    const k = i * 4;
    if (mode === 'binary') { rgba[k] = rgba[k + 1] = rgba[k + 2] = mask[i] ? 255 : 0; rgba[k + 3] = 255; }
    else if (mode === 'isolate') { rgba[k + 3] = mask[i] ? 0 : 200; }
    else if (mask[i]) { rgba.set(rgb, k); rgba[k + 3] = Math.round(255 * Math.min(1, Math.max(0, opacity))); }
  }
  return rgba;
}
