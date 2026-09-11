// Nodevision/ApplicationSystem/public/FpsOverlay.mjs
// Optional workspace-wide FPS/frame-time overlay backed by a single requestAnimationFrame loop.

const STORAGE_KEY = "nodevision.fpsOverlay";
const OVERLAY_ID = "nv-fps-overlay";
const FRAME_WINDOW_SIZE = 90;
const TEXT_UPDATE_INTERVAL_MS = 250;

let enabled = false;
let overlayElement = null;
let overlayTextNode = null;
let rafId = 0;
let lastTimestamp = 0;
let lastTextUpdate = 0;
let frameTimes = [];
let lastStats = {
  fps: 0,
  frameMs: 0,
  worstMs: 0,
  slowFrames: 0,
  slowThresholdMs: 50,
};

function hasWindow() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function readStoredEnabled() {
  if (!hasWindow()) return false;
  try {
    return /^(1|true|yes|on)$/i.test(String(window.localStorage?.getItem?.(STORAGE_KEY) || ""));
  } catch {
    return false;
  }
}

function writeStoredEnabled(value) {
  if (!hasWindow()) return;
  try {
    window.localStorage?.setItem?.(STORAGE_KEY, value ? "1" : "0");
  } catch {
    // The overlay still behaves as a session toggle if storage is unavailable.
  }
}

function nowMs() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function round1(value) {
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

function computeStats() {
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

function setOverlayText(stats = lastStats) {
  if (!overlayTextNode) return;
  overlayTextNode.textContent = [
    `FPS: ${Math.round(stats.fps)}`,
    `Frame: ${round1(stats.frameMs)} ms`,
    `Worst: ${round1(stats.worstMs)} ms`,
    `Slow: ${stats.slowFrames}`,
  ].join("\n");
}

function createOverlayElement() {
  if (!hasWindow()) return null;
  const existing = document.getElementById?.(OVERLAY_ID);
  if (existing) {
    overlayElement = existing;
    overlayTextNode = existing.firstChild || document.createTextNode("");
    if (!existing.firstChild) existing.appendChild(overlayTextNode);
    return existing;
  }

  const node = document.createElement("div");
  node.id = OVERLAY_ID;
  node.setAttribute("role", "status");
  node.setAttribute("aria-live", "polite");
  node.dataset.nvFpsOverlay = "true";
  Object.assign(node.style, {
    position: "fixed",
    right: "10px",
    bottom: "28px",
    zIndex: "2600",
    pointerEvents: "none",
    whiteSpace: "pre",
    font: "11px/1.35 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    letterSpacing: "0",
    color: "#f7f7f7",
    background: "rgba(17, 24, 39, 0.82)",
    border: "1px solid rgba(255, 255, 255, 0.22)",
    borderRadius: "4px",
    padding: "6px 7px",
    minWidth: "96px",
    boxShadow: "0 2px 10px rgba(0, 0, 0, 0.22)",
  });
  overlayTextNode = document.createTextNode("");
  node.appendChild(overlayTextNode);
  document.body?.appendChild(node);
  overlayElement = node;
  setOverlayText();
  return node;
}

function resetMeasurements(timestamp = 0) {
  frameTimes = [];
  lastTimestamp = timestamp || 0;
  lastTextUpdate = 0;
  lastStats = {
    fps: 0,
    frameMs: 0,
    worstMs: 0,
    slowFrames: 0,
    slowThresholdMs: 50,
  };
}

function scheduleNextFrame() {
  if (!enabled || !hasWindow() || typeof window.requestAnimationFrame !== "function") return;
  rafId = window.requestAnimationFrame(measureFrame);
}

function measureFrame(timestamp) {
  rafId = 0;
  if (!enabled) return;

  const time = Number.isFinite(timestamp) ? timestamp : nowMs();
  if (lastTimestamp > 0) {
    const delta = Math.max(0, time - lastTimestamp);
    frameTimes.push(delta);
    if (frameTimes.length > FRAME_WINDOW_SIZE) frameTimes.splice(0, frameTimes.length - FRAME_WINDOW_SIZE);
  }
  lastTimestamp = time;

  if (!lastTextUpdate || time - lastTextUpdate >= TEXT_UPDATE_INTERVAL_MS) {
    lastTextUpdate = time;
    lastStats = computeStats();
    setOverlayText(lastStats);
  }

  scheduleNextFrame();
}

export function enableFpsOverlay(options = {}) {
  if (!hasWindow()) return false;
  if (enabled) {
    if (!overlayElement?.isConnected) createOverlayElement();
    if (!rafId) scheduleNextFrame();
    if (options.persist !== false) writeStoredEnabled(true);
    window.NodevisionState = window.NodevisionState || {};
    window.NodevisionState.fpsOverlayVisible = true;
    return true;
  }

  enabled = true;
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.fpsOverlayVisible = true;
  createOverlayElement();
  resetMeasurements();
  scheduleNextFrame();
  if (options.persist !== false) writeStoredEnabled(true);
  window.dispatchEvent?.(new CustomEvent("nodevision-fps-overlay-changed", { detail: { enabled: true } }));
  return true;
}

export function disableFpsOverlay(options = {}) {
  if (!hasWindow()) return false;
  if (rafId && typeof window.cancelAnimationFrame === "function") {
    window.cancelAnimationFrame(rafId);
  }
  rafId = 0;
  enabled = false;
  overlayElement?.remove?.();
  overlayElement = null;
  overlayTextNode = null;
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.fpsOverlayVisible = false;
  resetMeasurements();
  if (options.persist !== false) writeStoredEnabled(false);
  window.dispatchEvent?.(new CustomEvent("nodevision-fps-overlay-changed", { detail: { enabled: false } }));
  return false;
}

export function toggleFpsOverlay(options = {}) {
  return enabled ? disableFpsOverlay(options) : enableFpsOverlay(options);
}

export function initializeFpsOverlayFromPreference() {
  if (readStoredEnabled()) enableFpsOverlay({ persist: false });
  else if (hasWindow()) {
    window.NodevisionState = window.NodevisionState || {};
    window.NodevisionState.fpsOverlayVisible = false;
  }
  return enabled;
}

export function isFpsOverlayEnabled() {
  return enabled;
}

export function getFpsOverlaySnapshot() {
  return {
    enabled,
    rafActive: Boolean(rafId),
    overlayConnected: Boolean(overlayElement?.isConnected),
    frameHistoryLength: frameTimes.length,
    frameWindowSize: FRAME_WINDOW_SIZE,
    textUpdateIntervalMs: TEXT_UPDATE_INTERVAL_MS,
    stats: { ...lastStats },
  };
}

export function destroyFpsOverlay() {
  return disableFpsOverlay({ persist: false });
}

if (hasWindow()) {
  window.NodevisionFpsOverlay = {
    enable: enableFpsOverlay,
    disable: disableFpsOverlay,
    toggle: toggleFpsOverlay,
    initialize: initializeFpsOverlayFromPreference,
    destroy: destroyFpsOverlay,
    isEnabled: isFpsOverlayEnabled,
    snapshot: getFpsOverlaySnapshot,
  };
}
