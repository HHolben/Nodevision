// Nodevision/ApplicationSystem/public/FpsOverlayStatistics.mjs
// This module calculates bounded frame-window statistics for the optional FPS overlay, including adaptive slow-frame counts without allocating per-terrain diagnostics. It keeps measurement math independent of the overlay DOM and animation lifecycle.

export function round1(value) {
  return Math.round(Number(value || 0) * 10) / 10;
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] || 0;
}

function slowThreshold(values) {
  const typical = median(values) || average(values) || 16.7;
  return Math.max(32, typical * 2.5);
}

export function computeFrameStats(frameTimes) {
  const avgFrame = average(frameTimes);
  const worst = frameTimes.length ? Math.max(...frameTimes) : 0;
  const threshold = slowThreshold(frameTimes);
  return {
    fps: avgFrame > 0 ? 1000 / avgFrame : 0,
    frameMs: avgFrame,
    worstMs: worst,
    slowFrames: frameTimes.filter((value) => value > threshold).length,
    slowThresholdMs: threshold,
  };
}

