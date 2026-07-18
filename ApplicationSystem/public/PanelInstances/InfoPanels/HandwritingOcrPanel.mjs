// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/HandwritingOcrPanel.mjs
// This file defines browser-side Handwriting Ocr Panel logic for the Nodevision UI. It renders interface components and handles user interactions.
//
// Uses local Tesseract.js assets from /Tesseract. For fully offline OCR you must provide
// language data (e.g. eng.traineddata.gz) under /Tesseract/lang-data.

import { createFloatingInventoryPanel } from "/PanelInstances/InfoPanels/PlayerInventory.mjs";
import {
  HANDWRITING_TRAJECTORY_SCHEMA,
  normalizeRawHandwritingStrokes,
  normalizeStoredHandwritingSample,
} from "/PanelInstances/InfoPanels/HandwritingTrajectory.mjs";
import { compareHandwritingTrajectories } from "/PanelInstances/InfoPanels/HandwritingTrajectoryMatcher.mjs";
import {
  combineHandwritingCandidateEvidence,
  stableSortHandwritingCandidates,
} from "/PanelInstances/InfoPanels/HandwritingCandidateScoring.mjs";
import {
  contextProfile,
  rerankCandidatesWithContext,
} from "/PanelInstances/InfoPanels/HandwritingRecognitionContext.mjs";
import {
  rerankCandidatesWithConfusions,
  validateConfusions,
} from "/PanelInstances/InfoPanels/HandwritingConfusions.mjs";
import {
  coordinateHandwritingRecognition,
  createRecognitionRequestTracker,
} from "/PanelInstances/InfoPanels/HandwritingRecognitionCoordinator.mjs";

const PANEL_KEY = "__nvHandwritingOcrPanel";
const DEFAULT_BG = "#fff4a8";
const DEFAULT_FG = "#172033";
const DEFAULT_PEN_SIZE = 7;
const OCR_PAGE_BG = "#ffffff";
const HENRY_SCRIPT_FONT_FAMILY = "Henryscriptversion1";
const HENRY_SCRIPT_FONT_URL = "/api/handwriting-ocr/font/henryscript";
const HENRY_SCRIPT_TEMPLATE_STACK = "\"Henryscriptversion1\", \"Segoe Print\", \"Bradley Hand\", \"Comic Sans MS\", cursive";
const GUIDE_LINE_COLOR = "rgba(79, 146, 205, 0.3)";
const GUIDE_BASELINE_COLOR = "rgba(51, 126, 204, 0.42)";
const GUIDE_MARGIN_COLOR = "rgba(212, 88, 92, 0.32)";
const SIMPLE_RECOGNITION_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const SIMPLE_RECOGNITION_SIZE = 64;
const SIMPLE_RECOGNITION_GRID = 28;
const CUSTOM_RECOGNITION_CANDIDATE_LIMIT = 5;
const CUSTOM_RECOGNITION_RAW_LIMIT = 16;
const LIVE_RECOGNITION_MOVE_DELAY_MS = 900;
const LIVE_RECOGNITION_STROKE_DELAY_MS = 320;
const DEBUG_REFRESH_DELAY_MS = 220;
const CUSTOM_RECOGNITION_ACCEPTANCE = Object.freeze({
  minScore: 0.42,
  minLead: 0.018,
  strongScore: 0.56,
});
let handwritingFontPromise = null;

function clamp(num, min, max) {
  const n = Number(num);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function safeText(value) {
  return String(value ?? "").replace(/\u0000/g, "");
}

function isHandwritingFontReady() {
  try {
    return Boolean(document.fonts?.check?.("16px \"" + HENRY_SCRIPT_FONT_FAMILY + "\""));
  } catch (_) {
    return false;
  }
}

function ensureHandwritingFontLoaded() {
  if (isHandwritingFontReady()) return Promise.resolve(true);
  if (handwritingFontPromise) return handwritingFontPromise;
  handwritingFontPromise = Promise.resolve()
    .then(async () => {
      if (!document.fonts?.load) return false;
      const loaded = await document.fonts.load(
        SIMPLE_RECOGNITION_SIZE + "px \"" + HENRY_SCRIPT_FONT_FAMILY + "\"",
        SIMPLE_RECOGNITION_CHARS
      );
      return Boolean(loaded?.length) || isHandwritingFontReady();
    })
    .catch((err) => {
      console.warn("[HandwritingOcrPanel] Henryscript font unavailable:", err);
      handwritingFontPromise = null;
      return false;
    });
  return handwritingFontPromise;
}

function makeButton(label, opts = {}) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = label;
  btn.className = opts.primary ? "nv-ocr-btn primary" : "nv-ocr-btn";
  if (opts.title) btn.title = opts.title;
  return btn;
}

function injectStylesOnce() {
  if (document.getElementById("nv-ocr-style")) return;
  const style = document.createElement("style");
  style.id = "nv-ocr-style";
  style.textContent = `
    @font-face { font-family: "${HENRY_SCRIPT_FONT_FAMILY}"; src: url("${HENRY_SCRIPT_FONT_URL}") format("truetype"); font-style: normal; font-weight: 400; font-display: swap; }
    .nv-ocr-wrap { display: flex; flex-direction: column; gap: 8px; min-height: 0; height: 100%; box-sizing: border-box; overflow-y: auto; overflow-x: hidden; scrollbar-gutter: stable; color: #eaf7ff; }
    .nv-ocr-header { display:flex; gap: 10px; align-items: baseline; flex-wrap: wrap; flex: 0 0 auto; }
    .nv-ocr-note { opacity: 0.85; font-size: 12px; }
    .nv-ocr-board { display:flex; flex-direction: column; gap: 8px; min-height: 0; flex: 0 0 auto; padding: 10px; border: 1px solid rgba(70, 96, 135, 0.65); background: rgba(12, 18, 28, 0.85); }
    .nv-ocr-toolbar { display:flex; gap: 8px; align-items:center; flex-wrap: wrap; min-width: 0; }
    .nv-ocr-seg { display:inline-flex; border: 1px solid rgba(75, 102, 140, 0.9); overflow: hidden; }
    .nv-ocr-seg button { border: none; border-right: 1px solid rgba(75, 102, 140, 0.9); background: rgba(18, 32, 52, 0.92); }
    .nv-ocr-seg button:last-child { border-right: none; }
    .nv-ocr-seg button.active { background: #2b72ff; }
    .nv-ocr-btn { border: 1px solid rgba(75, 102, 140, 0.9); background: rgba(18, 32, 52, 0.92); color: #eaf7ff; padding: 7px 10px; border-radius: 6px; cursor: pointer; font-weight: 650; }
    .nv-ocr-btn.primary { background: #2b72ff; border-color: #2b72ff; color: #ffffff; }
    .nv-ocr-btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .nv-ocr-label { opacity: 0.9; font-size: 12px; display: inline-flex; align-items: center; gap: 6px; }
    .nv-ocr-range { width: min(140px, 30vw); min-width: 86px; }
    .nv-ocr-spacer { flex: 1; }
    .nv-ocr-canvas-wrap { position: relative; width: 100%; flex: 1 1 auto; min-height: 180px; height: clamp(190px, 38vh, 440px); }
    .nv-ocr-canvas { display: block; width: 100%; height: 100%; min-height: 0; border-radius: 6px; border: 1px solid rgba(168, 132, 46, 0.9); background: ${DEFAULT_BG}; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.45), inset 0 10px 18px rgba(145,113,30,0.12); touch-action: none; }
    .nv-ocr-debug-overlay { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; display: none; border-radius: 6px; }
    .nv-ocr-debug-overlay.active { display: block; }
    .nv-ocr-progress { height: 10px; background: rgba(16, 28, 46, 0.85); border: 1px solid rgba(75, 102, 140, 0.65); border-radius: 7px; overflow: hidden; }
    .nv-ocr-bar { height: 100%; width: 0%; background: #2b72ff; transition: width 0.18s ease; }
    .nv-ocr-out { display:grid; gap: 6px; flex: 0 0 auto; }
    .nv-ocr-textarea { width: 100%; min-height: 78px; max-height: 22vh; box-sizing: border-box; padding: 10px; border-radius: 6px; border: 1px solid rgba(75, 102, 140, 0.9); background: rgba(10, 18, 32, 0.92); color: #eaf7ff; resize: vertical; font-family: ${HENRY_SCRIPT_TEMPLATE_STACK}; font-size: 20px; line-height: 1.45; }
    .nv-ocr-help { opacity: 0.75; font-size: 12px; line-height: 1.35; }
    .nv-ocr-status { min-height: 16px; font-size: 12px; opacity: 0.82; }
    .nv-ocr-debug { display: none; gap: 6px; padding: 8px; border: 1px solid rgba(75, 102, 140, 0.72); border-radius: 6px; background: rgba(7, 12, 22, 0.78); color: #eaf7ff; font-size: 12px; }
    .nv-ocr-debug.active { display: grid; }
    .nv-ocr-debug-head { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .nv-ocr-debug-summary { opacity: 0.9; line-height: 1.35; }
    .nv-ocr-debug-segments { display: grid; gap: 4px; }
    .nv-ocr-debug-segment { padding: 6px; border-radius: 4px; border: 1px solid rgba(75, 102, 140, 0.55); background: rgba(18, 32, 52, 0.64); line-height: 1.35; }
    .nv-ocr-debug-json { width: 100%; min-height: 76px; max-height: 22vh; box-sizing: border-box; padding: 8px; border-radius: 5px; border: 1px solid rgba(75, 102, 140, 0.72); background: rgba(3, 8, 16, 0.86); color: #d8edff; font: 11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; resize: vertical; }
    .nv-ocr-training-count { opacity: 0.82; font-size: 12px; white-space: nowrap; }
    .nv-ocr-correction { display: none; gap: 6px; padding: 8px; border: 1px solid rgba(75, 102, 140, 0.72); border-radius: 6px; background: rgba(7, 12, 22, 0.78); color: #eaf7ff; font-size: 12px; }
    .nv-ocr-correction.active { display: grid; }
    .nv-ocr-correction-summary { opacity: 0.9; line-height: 1.35; }
    .nv-ocr-correction-rows { display: grid; gap: 5px; }
    .nv-ocr-correction-row { display: grid; grid-template-columns: 42px minmax(0, 1fr) 54px auto; gap: 7px; align-items: center; padding: 6px; border-radius: 5px; border: 1px solid rgba(75, 102, 140, 0.55); background: rgba(18, 32, 52, 0.64); }
    .nv-ocr-correction-char { min-width: 0; overflow: hidden; text-overflow: ellipsis; font-family: ${HENRY_SCRIPT_TEMPLATE_STACK}; font-size: 22px; line-height: 1.1; color: #ffffff; }
    .nv-ocr-correction-meta { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; opacity: 0.84; }
    .nv-ocr-correction-input { width: 48px; box-sizing: border-box; padding: 5px 6px; border-radius: 5px; border: 1px solid rgba(75, 102, 140, 0.9); background: rgba(10, 18, 32, 0.92); color: #eaf7ff; font: 16px ${HENRY_SCRIPT_TEMPLATE_STACK}; text-align: center; }
    .nv-ocr-wrap input[type="checkbox"] { margin: 0; }
    @media (max-width: 620px) {
      .nv-ocr-board { padding: 8px; }
      .nv-ocr-toolbar { gap: 6px; }
      .nv-ocr-btn { padding: 6px 8px; }
      .nv-ocr-canvas-wrap { min-height: 220px; height: 44vh; }
      .nv-ocr-range { width: 96px; }
    }
  `;
  document.head.appendChild(style);
}

function getDpr() {
  return Math.max(1, window.devicePixelRatio || 1);
}

function drawHandwritingGuides(ctx, canvas) {
  const w = canvas.width;
  const h = canvas.height;
  const lineWidth = Math.max(1, Math.round(h * 0.003));
  const lineGap = Math.max(34, Math.round(h * 0.115));
  const firstLine = Math.round(h * 0.16) + 0.5;
  const baselineY = Math.round(h * 0.78) + 0.5;
  const marginX = Math.round(w * 0.12) + 0.5;

  ctx.save();
  ctx.lineCap = "butt";
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = GUIDE_LINE_COLOR;
  ctx.setLineDash([]);
  for (let y = firstLine; y < h; y += lineGap) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  ctx.strokeStyle = GUIDE_BASELINE_COLOR;
  ctx.lineWidth = Math.max(lineWidth, 2);
  ctx.beginPath();
  ctx.moveTo(0, baselineY);
  ctx.lineTo(w, baselineY);
  ctx.stroke();

  ctx.strokeStyle = GUIDE_MARGIN_COLOR;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.moveTo(marginX, 0);
  ctx.lineTo(marginX, h);
  ctx.stroke();
  ctx.restore();
}

function fillCanvas(ctx, canvas, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawHandwritingGuides(ctx, canvas);
  ctx.restore();
}

function binarizeCanvas(sourceCanvas, threshold) {
  const sourceCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });
  const source = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  const d = source.data;
  const t = clamp(threshold, 0, 255);
  let minX = sourceCanvas.width;
  let minY = sourceCanvas.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < sourceCanvas.height; y += 1) {
    for (let x = 0; x < sourceCanvas.width; x += 1) {
      const i = (y * sourceCanvas.width + x) * 4;
      const gray = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
      if (gray < t) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    const blank = document.createElement("canvas");
    blank.width = 64;
    blank.height = 64;
    const bctx = blank.getContext("2d");
    bctx.fillStyle = "#ffffff";
    bctx.fillRect(0, 0, blank.width, blank.height);
    return blank;
  }

  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;
  const scale = cropH < 160 ? 3 : (cropH < 280 ? 2 : 1);
  const pad = 32;
  const off = document.createElement("canvas");
  off.width = Math.max(1, Math.ceil((cropW + pad * 2) * scale));
  off.height = Math.max(1, Math.ceil((cropH + pad * 2) * scale));
  const octx = off.getContext("2d", { willReadFrequently: true });
  octx.imageSmoothingEnabled = true;
  octx.fillStyle = OCR_PAGE_BG;
  octx.fillRect(0, 0, off.width, off.height);
  octx.drawImage(
    sourceCanvas,
    minX,
    minY,
    cropW,
    cropH,
    pad * scale,
    pad * scale,
    cropW * scale,
    cropH * scale
  );

  const img = octx.getImageData(0, 0, off.width, off.height);
  const out = img.data;
  for (let i = 0; i < out.length; i += 4) {
    const gray = out[i] * 0.299 + out[i + 1] * 0.587 + out[i + 2] * 0.114;
    const v = gray < t ? 0 : 255;
    out[i] = v;
    out[i + 1] = v;
    out[i + 2] = v;
    out[i + 3] = 255;
  }

  octx.putImageData(img, 0, 0);
  return off;
}


async function ensureTesseract() {
  const mod = await import("/Tesseract/tesseract.esm.min.js");
  return mod?.default || mod;
}

function describeOfflineRequirement() {
  return "Offline OCR requires language data at /Tesseract/lang-data (e.g. eng.traineddata.gz).";
}

export function mountHandwritingOcrPanel(container, {
  onInsertText = null,
  onLiveText = null,
  getCorrectionText = null,
  onAcceptCorrectionText = null,
  getRecognitionContext = null,
  liveInsert = true,
  title = "Handwriting -> Text"
} = {}) {
  injectStylesOnce();

  let worker = null;
  let workerPromise = null;
  let nativeRecognizer = null;
  let nativeRecognizerPromise = null;
  let liveTimer = 0;
  let preloadTimer = 0;
  let recognizing = false;
  let queuedRecognition = false;
  let hasInk = false;
  let lastLiveText = "";
  let lastLiveScheduleAt = 0;

  const root = document.createElement("div");
  root.className = "nv-ocr-wrap";

  const header = document.createElement("div");
  header.className = "nv-ocr-header";
  const note = document.createElement("div");
  note.className = "nv-ocr-note";
  note.textContent = "Write in the box. Recognition updates the active editor as text is interpreted.";
  header.appendChild(note);
  root.appendChild(header);

  const board = document.createElement("section");
  board.className = "nv-ocr-board";

  const toolbar = document.createElement("div");
  toolbar.className = "nv-ocr-toolbar";

  const seg = document.createElement("div");
  seg.className = "nv-ocr-seg";
  seg.setAttribute("role", "tablist");
  seg.setAttribute("aria-label", "Tool");

  const penBtn = makeButton("Pen", { title: "Pen" });
  penBtn.classList.add("active");
  penBtn.setAttribute("aria-selected", "true");

  const eraserBtn = makeButton("Eraser", { title: "Eraser" });
  eraserBtn.setAttribute("aria-selected", "false");

  seg.appendChild(penBtn);
  seg.appendChild(eraserBtn);
  toolbar.appendChild(seg);

  const sizeLabel = document.createElement("label");
  sizeLabel.className = "nv-ocr-label";
  sizeLabel.textContent = "Size";
  sizeLabel.setAttribute("for", "nv-ocr-size");
  toolbar.appendChild(sizeLabel);

  const sizeInput = document.createElement("input");
  sizeInput.id = "nv-ocr-size";
  sizeInput.type = "range";
  sizeInput.min = "2";
  sizeInput.max = "36";
  sizeInput.value = String(DEFAULT_PEN_SIZE);
  sizeInput.className = "nv-ocr-range";
  toolbar.appendChild(sizeInput);

  const threshLabel = document.createElement("label");
  threshLabel.className = "nv-ocr-label";
  threshLabel.textContent = "Contrast";
  threshLabel.setAttribute("for", "nv-ocr-threshold");
  toolbar.appendChild(threshLabel);

  const thresholdInput = document.createElement("input");
  thresholdInput.id = "nv-ocr-threshold";
  thresholdInput.type = "range";
  thresholdInput.min = "0";
  thresholdInput.max = "255";
  thresholdInput.value = "180";
  thresholdInput.className = "nv-ocr-range";
  toolbar.appendChild(thresholdInput);

  const liveLabel = document.createElement("label");
  liveLabel.className = "nv-ocr-label";
  const liveInput = document.createElement("input");
  liveInput.type = "checkbox";
  liveInput.checked = liveInsert !== false;
  liveLabel.appendChild(liveInput);
  liveLabel.appendChild(document.createTextNode("Live insert"));
  toolbar.appendChild(liveLabel);

  const debugLabel = document.createElement("label");
  debugLabel.className = "nv-ocr-label";
  const debugInput = document.createElement("input");
  debugInput.type = "checkbox";
  debugLabel.appendChild(debugInput);
  debugLabel.appendChild(document.createTextNode("Debug"));
  toolbar.appendChild(debugLabel);

  const correctionLabel = document.createElement("label");
  correctionLabel.className = "nv-ocr-label";
  const correctionInput = document.createElement("input");
  correctionInput.type = "checkbox";
  correctionLabel.appendChild(correctionInput);
  correctionLabel.appendChild(document.createTextNode("Correction mode"));
  toolbar.appendChild(correctionLabel);

  const trainingCount = document.createElement("span");
  trainingCount.className = "nv-ocr-training-count";
  trainingCount.textContent = "Training: -";
  toolbar.appendChild(trainingCount);

  const refreshDebugBtn = makeButton("Refresh debug");
  toolbar.appendChild(refreshDebugBtn);

  const copyDebugBtn = makeButton("Copy debug");
  toolbar.appendChild(copyDebugBtn);

  const copyStrokesBtn = makeButton("Copy strokes");
  toolbar.appendChild(copyStrokesBtn);

  const editorCorrectionBtn = makeButton("Correction", { title: "Use the corrected text from the main editor and save training samples" });
  toolbar.appendChild(editorCorrectionBtn);

  const clearBtn = makeButton("Clear");
  toolbar.appendChild(clearBtn);

  const spacer = document.createElement("div");
  spacer.className = "nv-ocr-spacer";
  toolbar.appendChild(spacer);

  const recognizeBtn = makeButton("Recognize Text", { primary: true });
  toolbar.appendChild(recognizeBtn);

  board.appendChild(toolbar);

  const canvas = document.createElement("canvas");
  canvas.className = "nv-ocr-canvas";
  canvas.width = 1024;
  canvas.height = 512;
  canvas.setAttribute("aria-label", "Handwriting pad");
  const canvasWrap = document.createElement("div");
  canvasWrap.className = "nv-ocr-canvas-wrap";
  canvasWrap.appendChild(canvas);

  const debugOverlay = document.createElement("canvas");
  debugOverlay.className = "nv-ocr-debug-overlay";
  debugOverlay.width = canvas.width;
  debugOverlay.height = canvas.height;
  canvasWrap.appendChild(debugOverlay);
  board.appendChild(canvasWrap);

  const progress = document.createElement("div");
  progress.className = "nv-ocr-progress";
  const bar = document.createElement("div");
  bar.className = "nv-ocr-bar";
  progress.appendChild(bar);
  board.appendChild(progress);

  const status = document.createElement("div");
  status.className = "nv-ocr-status";
  board.appendChild(status);

  const debugPanel = document.createElement("section");
  debugPanel.className = "nv-ocr-debug";

  const debugSummary = document.createElement("div");
  debugSummary.className = "nv-ocr-debug-summary";
  debugPanel.appendChild(debugSummary);

  const debugSegments = document.createElement("div");
  debugSegments.className = "nv-ocr-debug-segments";
  debugPanel.appendChild(debugSegments);

  const debugJson = document.createElement("textarea");
  debugJson.className = "nv-ocr-debug-json";
  debugJson.readOnly = true;
  debugPanel.appendChild(debugJson);
  board.appendChild(debugPanel);

  const correctionPanel = document.createElement("section");
  correctionPanel.className = "nv-ocr-correction";

  const correctionSummary = document.createElement("div");
  correctionSummary.className = "nv-ocr-correction-summary";
  correctionPanel.appendChild(correctionSummary);

  const correctionRows = document.createElement("div");
  correctionRows.className = "nv-ocr-correction-rows";
  correctionPanel.appendChild(correctionRows);
  board.appendChild(correctionPanel);

  const outWrap = document.createElement("div");
  outWrap.className = "nv-ocr-out";
  const outLabel = document.createElement("label");
  outLabel.className = "nv-ocr-label";
  outLabel.textContent = "Recognized text";
  outLabel.setAttribute("for", "nv-ocr-out");
  outWrap.appendChild(outLabel);

  const outText = document.createElement("textarea");
  outText.id = "nv-ocr-out";
  outText.className = "nv-ocr-textarea";
  outText.placeholder = "Recognition result will appear here...";
  outWrap.appendChild(outText);

  const outToolbar = document.createElement("div");
  outToolbar.className = "nv-ocr-toolbar";
  const copyBtn = makeButton("Copy");
  const insertBtn = makeButton("Insert");
  const savePngBtn = makeButton("Save PNG");
  outToolbar.appendChild(copyBtn);
  outToolbar.appendChild(insertBtn);
  outToolbar.appendChild(savePngBtn);
  outWrap.appendChild(outToolbar);

  const help = document.createElement("div");
  help.className = "nv-ocr-help";
  help.textContent = describeOfflineRequirement();
  outWrap.appendChild(help);

  board.appendChild(outWrap);
  root.appendChild(board);
  container.replaceChildren(root);

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  fillCanvas(ctx, canvas, DEFAULT_BG);

  let drawing = false;
  let tool = "pen";
  let currentStroke = null;
  let penStrokes = [];
  let lastDebugState = null;
  let debugRefreshTimer = 0;
  let trainingSamples = [];
  let trainingSamplesLoaded = false;
  let trainingLoadPromise = null;
  let confusionStats = validateConfusions(null);
  const recognitionRequests = createRecognitionRequestTracker();

  function getActiveStrokes() {
    return currentStroke?.length ? [...penStrokes, currentStroke] : [...penStrokes];
  }

  function cloneStrokesForRecognition(strokes = getActiveStrokes()) {
    return (Array.isArray(strokes) ? strokes : []).map((stroke) => (Array.isArray(stroke) ? stroke : []).map((point) => ({
      x: Number(point?.x) || 0,
      y: Number(point?.y) || 0,
      t: Number.isFinite(point?.t) ? point.t : 0,
      pressure: Number.isFinite(point?.pressure) ? clamp(point.pressure, 0, 1) : 0.5,
    })));
  }

  function roundDebugNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.round(n * 10) / 10 : 0;
  }

  function formatDebugScore(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n.toFixed(3) : "-";
  }

  function simplifyBounds(bounds) {
    if (!bounds) return null;
    return {
      minX: roundDebugNumber(bounds.minX),
      minY: roundDebugNumber(bounds.minY),
      maxX: roundDebugNumber(bounds.maxX),
      maxY: roundDebugNumber(bounds.maxY),
      width: roundDebugNumber(bounds.width),
      height: roundDebugNumber(bounds.height),
    };
  }

  function boundsForStrokes(strokes) {
    return (strokes || []).reduce((bounds, stroke) => mergeBounds(bounds, strokeBounds(stroke)), null);
  }

  function serializeStrokesForDebug(strokes = getActiveStrokes()) {
    return (strokes || []).map((stroke, strokeIndex) => ({
      strokeIndex,
      pointCount: Array.isArray(stroke) ? stroke.length : 0,
      points: (stroke || []).map((point, pointIndex) => ({
        pointIndex,
        x: roundDebugNumber(point.x),
        y: roundDebugNumber(point.y),
      })),
    }));
  }

  function normalizeDebugScore(value) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.round(n * 1000) / 1000 : 0;
  }

  function normalizeDebugCandidates(candidates = []) {
    return candidates.map((candidate) => ({
      char: candidate.char || candidate.text || "",
      text: candidate.text || candidate.char || "",
      mode: candidate.mode || candidate.engine || "",
      score: normalizeDebugScore(candidate.score),
      evidence: {
        rasterScore: normalizeDebugScore(candidate.evidence?.rasterScore),
        trajectoryScore: candidate.evidence?.trajectoryScore === null ? null : normalizeDebugScore(candidate.evidence?.trajectoryScore),
        inkDensityScore: normalizeDebugScore(candidate.evidence?.inkDensityScore),
        strokeCountScore: normalizeDebugScore(candidate.evidence?.strokeCountScore),
        aspectRatioScore: normalizeDebugScore(candidate.evidence?.aspectRatioScore),
        personalSampleBonus: normalizeDebugScore(candidate.evidence?.personalSampleBonus),
        contextAdjustment: normalizeDebugScore(candidate.evidence?.contextAdjustment),
        confusionAdjustment: normalizeDebugScore(candidate.evidence?.confusionAdjustment),
        trajectoryAware: Boolean(candidate.evidence?.trajectoryAware || candidate.evidence?.trajectoryEvidence?.trajectoryAware),
      },
    }));
  }

  function makeDebugState(source, text, detail = null, extra = {}) {
    const strokes = getActiveStrokes();
    const segments = (detail?.segments || []).map((segment) => ({
      index: segment.index,
      char: segment.char || "",
      source: segment.source || "",
      accepted: Boolean(segment.accepted),
      score: normalizeDebugScore(segment.score),
      strokeCount: segment.strokeCount || 0,
      bounds: simplifyBounds(segment.bounds),
      candidates: normalizeDebugCandidates(segment.candidates),
    }));

    return {
      source: source || "unknown",
      text: safeText(text || ""),
      strokeCount: strokes.length,
      segmentCount: detail?.segmentCount ?? segments.length,
      threshold: Number(thresholdInput.value || "180"),
      canvas: { width: canvas.width, height: canvas.height },
      segments,
      strokes: serializeStrokesForDebug(strokes),
      ...extra,
    };
  }

  function drawDebugOverlay(state = lastDebugState) {
    if (debugOverlay.width !== canvas.width) debugOverlay.width = canvas.width;
    if (debugOverlay.height !== canvas.height) debugOverlay.height = canvas.height;
    const overlayCtx = debugOverlay.getContext("2d");
    overlayCtx.clearRect(0, 0, debugOverlay.width, debugOverlay.height);
    if (!debugInput.checked || !state?.segments?.length) return;

    overlayCtx.save();
    overlayCtx.lineWidth = Math.max(2, Math.round(canvas.height * 0.004));
    overlayCtx.font = `${Math.max(12, Math.round(canvas.height * 0.03))}px system-ui, sans-serif`;
    overlayCtx.textBaseline = "top";
    state.segments.forEach((segment, index) => {
      const bounds = segment.bounds;
      if (!bounds) return;
      const hue = (index * 64 + 205) % 360;
      overlayCtx.strokeStyle = `hsl(${hue}, 88%, 58%)`;
      overlayCtx.fillStyle = `hsla(${hue}, 88%, 45%, 0.16)`;
      overlayCtx.fillRect(bounds.minX, bounds.minY, Math.max(1, bounds.width), Math.max(1, bounds.height));
      overlayCtx.strokeRect(bounds.minX, bounds.minY, Math.max(1, bounds.width), Math.max(1, bounds.height));
      const label = `${segment.index || index + 1}: ${segment.char || "?"}`;
      const labelW = overlayCtx.measureText(label).width + 8;
      const labelY = Math.max(2, bounds.minY - 20);
      overlayCtx.fillStyle = `hsla(${hue}, 88%, 28%, 0.86)`;
      overlayCtx.fillRect(bounds.minX, labelY, labelW, 18);
      overlayCtx.fillStyle = "#ffffff";
      overlayCtx.fillText(label, bounds.minX + 4, labelY + 2);
    });
    overlayCtx.restore();
  }

  function renderDebugSegments(segments = []) {
    debugSegments.replaceChildren();
    if (!segments.length) {
      const empty = document.createElement("div");
      empty.className = "nv-ocr-debug-segment";
      empty.textContent = "No stroke segments yet.";
      debugSegments.appendChild(empty);
      return;
    }

    segments.forEach((segment) => {
      const row = document.createElement("div");
      row.className = "nv-ocr-debug-segment";
      const candidates = (segment.candidates || [])
        .slice(0, 5)
        .map((candidate) => `${candidate.char || "?"} ${formatDebugScore(candidate.score)}${candidate.mode ? ` ${candidate.mode}` : ""}`)
        .join(", ");
      row.textContent = `#${segment.index}: ${segment.char || "?"} | ${segment.source || "unknown"} | score ${formatDebugScore(segment.score)} | strokes ${segment.strokeCount || 0} | ${candidates || "no candidates"}`;
      debugSegments.appendChild(row);
    });
  }

  function updateDebugView(state = lastDebugState) {
    const visible = debugInput.checked;
    debugPanel.classList.toggle("active", visible);
    debugOverlay.classList.toggle("active", visible);
    if (!visible) {
      drawDebugOverlay(null);
      return;
    }

    const activeState = state || makeDebugState("idle", outText.value, null);
    lastDebugState = activeState;
    debugSummary.textContent = `source ${activeState.source} | text "${activeState.text || ""}" | strokes ${activeState.strokeCount} | segments ${activeState.segmentCount} | contrast ${activeState.threshold}`;
    renderDebugSegments(activeState.segments);
    debugJson.value = JSON.stringify(activeState, null, 2);
    drawDebugOverlay(activeState);
  }

  function setDebugState(source, text, detail = null, extra = {}) {
    const detailForState = detail || (debugInput.checked ? recognizeSimpleStrokesDetailed() : null);
    lastDebugState = makeDebugState(source, text, detailForState, extra);
    updateDebugView(lastDebugState);
    updateCorrectionView();
  }

  function schedulePanelAnalysisRefresh(source = "strokes", delay = DEBUG_REFRESH_DELAY_MS) {
    if (!debugInput.checked && !correctionInput.checked) return;
    clearTimeout(debugRefreshTimer);
    debugRefreshTimer = window.setTimeout(() => {
      debugRefreshTimer = 0;
      if (debugInput.checked) {
        refreshDebugFromStrokes(source);
      } else if (correctionInput.checked) {
        updateCorrectionView();
      }
    }, delay);
  }

  function refreshDebugFromStrokes(source = "strokes") {
    if (!debugInput.checked) return;
    const detail = recognizeSimpleStrokesDetailed();
    setDebugState(source, detail.text, detail);
  }

  async function copyDebugText(text) {
    const clean = safeText(text || "");
    if (!clean) return;
    try {
      await navigator.clipboard.writeText(clean);
    } catch (_) {
      const temp = document.createElement("textarea");
      temp.value = clean;
      temp.style.position = "fixed";
      temp.style.left = "-9999px";
      document.body.appendChild(temp);
      temp.select();
      document.execCommand?.("copy");
      temp.remove();
    }
  }

  function firstTrainingChar(value) {
    return Array.from(String(value || "").trim())[0] || "";
  }

  function cleanRasterBounds(bounds) {
    if (!bounds || typeof bounds !== "object") return null;
    const clean = {
      minX: Number(bounds.minX),
      minY: Number(bounds.minY),
      maxX: Number(bounds.maxX),
      maxY: Number(bounds.maxY),
      width: Number(bounds.width),
      height: Number(bounds.height),
    };
    return Object.values(clean).every(Number.isFinite) ? clean : null;
  }

  function normalizeTrainingSample(raw) {
    const label = firstTrainingChar(raw?.label || raw?.char);
    const points = Array.isArray(raw?.sample?.points) ? raw.sample.points : [];
    if (!label || !points.length) return null;
    const cleanPoints = points
      .map((point) => ({ x: Math.round(Number(point?.x)), y: Math.round(Number(point?.y)) }))
      .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
    if (!cleanPoints.length) return null;
    const sampleAspectRatio = Number(raw?.sample?.aspectRatio);
    const sampleBounds = cleanRasterBounds(raw?.sample?.bounds);
    const normalizedSample = {
      grid: SIMPLE_RECOGNITION_GRID,
      points: cleanPoints,
      ...(Number.isFinite(sampleAspectRatio) && sampleAspectRatio > 0 ? { aspectRatio: sampleAspectRatio } : {}),
      ...(sampleBounds ? { bounds: sampleBounds } : {}),
    };
    const trajectory = normalizeStoredHandwritingSample(raw?.trajectory, {
      character: label,
      raster28: normalizedSample,
      requireStrokes: false,
    });
    return {
      id: safeText(raw?.id || ""),
      schema: safeText(raw?.schema || (trajectory ? "nodevision-handwriting-correction-sample/2" : "nodevision-handwriting-correction-sample/1")),
      label,
      recognizedChar: firstTrainingChar(raw?.recognizedChar),
      source: safeText(raw?.source || "user-correction"),
      createdAt: safeText(raw?.createdAt || ""),
      mode: safeText(raw?.mode || "user-correction"),
      sample: normalizedSample,
      trajectory,
      bounds: raw?.bounds || null,
      strokeCount: Math.max(0, Math.round(Number(raw?.strokeCount || trajectory?.metadata?.strokeCount || 0))),
    };
  }

  function setTrainingCount() {
    trainingCount.textContent = trainingSamplesLoaded
      ? `Training: ${trainingSamples.length}`
      : "Training: -";
  }

  function getUserTrainingTemplates() {
    return trainingSamples.map((entry) => ({
      char: entry.label,
      text: entry.label,
      mode: "user-correction",
      source: entry.source || "user-correction",
      sample: entry.sample,
      trajectory: entry.trajectory || null,
      schema: entry.schema || "nodevision-handwriting-correction-sample/1",
    }));
  }

  async function loadTrainingSamples({ force = false } = {}) {
    if (trainingSamplesLoaded && !force) return trainingSamples;
    if (trainingLoadPromise && !force) return trainingLoadPromise;
    trainingLoadPromise = fetch("/api/handwriting-ocr/training", {
      cache: "no-store",
      credentials: "include",
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Training load failed: ${res.status}`);
        const data = await res.json();
        trainingSamples = (Array.isArray(data?.samples) ? data.samples : [])
          .map(normalizeTrainingSample)
          .filter(Boolean);
        confusionStats = validateConfusions(data?.confusions || null);
        trainingSamplesLoaded = true;
        setTrainingCount();
        if (root.isConnected) updateCorrectionView();
        return trainingSamples;
      })
      .catch((err) => {
        console.warn("[HandwritingOcrPanel] training samples unavailable:", err);
        trainingSamplesLoaded = true;
        trainingSamples = [];
        setTrainingCount();
        return trainingSamples;
      })
      .finally(() => {
        trainingLoadPromise = null;
      });
    return trainingLoadPromise;
  }

  function makeCorrectionSegments() {
    const activeStrokes = getActiveStrokes();
    const segments = segmentStrokesForText(activeStrokes);
    const details = segments.map((strokes, index) => {
      const detail = recognizeSingleGlyphDetailed(strokes);
      return {
        index: index + 1,
        strokes,
        char: detail.char || "",
        source: detail.source || "none",
        score: detail.score || 0,
        candidates: detail.candidates || [],
        bounds: detail.bounds || boundsForStrokes(strokes),
        strokeCount: strokes.length,
      };
    });
    return applyCapitalizationContext(details, getRecognitionContextText());
  }

  function makeTrainingArtifact(strokes) {
    const imageCanvas = renderStrokesForPrediction(strokes);
    if (!imageCanvas) return null;
    const sample = canvasInkToGrid(imageCanvas, 48);
    if (!sample?.points?.length) return null;
    const compactSample = {
      grid: SIMPLE_RECOGNITION_GRID,
      points: sample.points.map((point) => ({ x: point.x, y: point.y })),
      bounds: sample.bounds || null,
      aspectRatio: Number.isFinite(sample.aspectRatio) ? sample.aspectRatio : 1,
    };
    const trajectory = normalizeRawHandwritingStrokes(strokes, {
      raster28: compactSample,
    });
    return {
      imageDataUrl: imageCanvas.toDataURL("image/png"),
      sample: compactSample,
      trajectory,
    };
  }

  function updateCorrectionView() {
    const visible = correctionInput.checked;
    correctionPanel.classList.toggle("active", visible);
    if (!visible) return;

    if (!trainingSamplesLoaded && !trainingLoadPromise) loadTrainingSamples();
    const segments = makeCorrectionSegments();
    correctionRows.replaceChildren();
    correctionSummary.textContent = `${segments.length} segments. ${trainingSamples.length} saved samples.`;

    if (!segments.length) {
      const empty = document.createElement("div");
      empty.className = "nv-ocr-debug-segment";
      empty.textContent = "No segments.";
      correctionRows.appendChild(empty);
      return;
    }

    segments.forEach((segment) => {
      const row = document.createElement("div");
      row.className = "nv-ocr-correction-row";

      const preview = document.createElement("div");
      preview.className = "nv-ocr-correction-char";
      preview.textContent = segment.char || "?";
      row.appendChild(preview);

      const meta = document.createElement("div");
      meta.className = "nv-ocr-correction-meta";
      const candidates = (segment.candidates || [])
        .slice(0, 3)
        .map((candidate) => `${candidate.char || "?"} ${formatDebugScore(candidate.score)}`)
        .join(", ");
      meta.textContent = `#${segment.index} ${segment.source} ${formatDebugScore(segment.score)} ${candidates}`;
      row.appendChild(meta);

      const input = document.createElement("input");
      input.className = "nv-ocr-correction-input";
      input.type = "text";
      input.maxLength = 2;
      input.value = segment.char || "";
      input.setAttribute("aria-label", `Correction for segment ${segment.index}`);
      row.appendChild(input);

      const saveBtn = makeButton("Save");
      saveBtn.addEventListener("click", () => saveCorrectionSegment(segment, input.value, row, saveBtn));
      row.appendChild(saveBtn);

      correctionRows.appendChild(row);
    });
  }


  async function postCorrectionSample(segment, label, source = "stroke") {
    const artifact = makeTrainingArtifact(segment.strokes);
    if (!artifact) throw new Error("No character sample to save.");
    const res = await fetch("/api/handwriting-ocr/training", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        label,
        recognizedChar: segment.char || "",
        source,
        segmentIndex: segment.index,
        strokeCount: segment.strokeCount,
        bounds: simplifyBounds(segment.bounds),
        sample: artifact.sample,
        trajectory: artifact.trajectory ? { ...artifact.trajectory, schema: HANDWRITING_TRAJECTORY_SCHEMA, character: label } : null,
        imageDataUrl: artifact.imageDataUrl,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || `Correction save failed: ${res.status}`);
    const saved = normalizeTrainingSample(data?.sample);
    if (saved) {
      trainingSamples = [saved, ...trainingSamples.filter((entry) => entry.id !== saved.id)];
      trainingSamplesLoaded = true;
      setTrainingCount();
    }
    confusionStats = validateConfusions(data?.confusions || confusionStats);
    return saved;
  }

  async function saveCorrectionSegment(segment, rawLabel, row, saveBtn) {
    const label = firstTrainingChar(rawLabel);
    if (!label) {
      status.textContent = "Enter a correction character.";
      return;
    }

    saveBtn.disabled = true;
    status.textContent = "Saving correction...";
    try {
      await postCorrectionSample(segment, label, "manual-correction");
      row.dataset.saved = "true";
      status.textContent = `Saved correction ${label}.`;
      updateCorrectionView();
    } catch (err) {
      console.warn("[HandwritingOcrPanel] correction save failed:", err);
      status.textContent = err?.message || "Correction save failed.";
    } finally {
      saveBtn.disabled = false;
    }
  }

  function correctionLabelsFromText(text) {
    return Array.from(safeText(text || "")).filter((char) => !/\s/.test(char));
  }

  async function readEditorCorrectionText() {
    if (typeof getCorrectionText !== "function") return "";
    return safeText(await getCorrectionText());
  }

  async function saveEditorCorrection() {
    editorCorrectionBtn.disabled = true;
    status.textContent = "Reading editor correction...";
    try {
      const correctedText = safeText((await readEditorCorrectionText()) || outText.value);
      const visibleText = correctedText.trim();
      if (!visibleText) {
        status.textContent = "No corrected text found in the editor.";
        return;
      }

      const segments = makeCorrectionSegments();
      const labels = correctionLabelsFromText(correctedText);
      if (!segments.length) {
        status.textContent = "No handwriting segments to train.";
        return;
      }
      if (!labels.length) {
        status.textContent = "No correction characters to save.";
        return;
      }

      if (typeof onAcceptCorrectionText === "function") {
        onAcceptCorrectionText(correctedText);
      } else if (typeof onInsertText === "function") {
        onInsertText(correctedText);
      }

      outText.value = correctedText;
      const count = Math.min(segments.length, labels.length);
      let savedCount = 0;
      for (let i = 0; i < count; i += 1) {
        await postCorrectionSample(segments[i], labels[i], "editor-correction");
        savedCount += 1;
      }

      const mismatch = labels.length !== segments.length ? ` (${labels.length} chars, ${segments.length} segments)` : "";
      status.textContent = `Saved ${savedCount} editor corrections${mismatch}.`;
      updateCorrectionView();
    } catch (err) {
      console.warn("[HandwritingOcrPanel] editor correction failed:", err);
      status.textContent = err?.message || "Editor correction failed.";
    } finally {
      editorCorrectionBtn.disabled = false;
    }
  }


  function setStroke() {
    const dpr = getDpr();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = tool === "pen" ? DEFAULT_FG : DEFAULT_BG;
    ctx.lineWidth = clamp(sizeInput.valueAsNumber || DEFAULT_PEN_SIZE, 2, 36) * dpr;
  }

  function resizeCanvasKeepContent() {
    const rect = canvas.getBoundingClientRect();
    const dpr = getDpr();
    const w = Math.max(1, Math.floor(rect.width * dpr));
    const h = Math.max(1, Math.floor(rect.height * dpr));
    if (w === canvas.width && h === canvas.height) {
      drawDebugOverlay();
      return;
    }

    const tmp = document.createElement("canvas");
    tmp.width = canvas.width;
    tmp.height = canvas.height;
    tmp.getContext("2d").drawImage(canvas, 0, 0);

    canvas.width = w;
    canvas.height = h;
    debugOverlay.width = w;
    debugOverlay.height = h;
    fillCanvas(ctx, canvas, DEFAULT_BG);
    ctx.drawImage(tmp, 0, 0, w, h);
    setStroke();
    drawDebugOverlay();
  }

  function getPoint(e) {
    const rect = canvas.getBoundingClientRect();
    const dpr = getDpr();
    const clientX = e.touches?.[0]?.clientX ?? e.clientX;
    const clientY = e.touches?.[0]?.clientY ?? e.clientY;
    const touch = e.touches?.[0] || e.changedTouches?.[0] || null;
    const pressure = Number.isFinite(e.pressure) && e.pressure > 0
      ? e.pressure
      : (Number.isFinite(touch?.force) && touch.force > 0 ? touch.force : 0.5);
    const t = Number.isFinite(e.timeStamp) ? e.timeStamp : Date.now();
    return {
      x: (clientX - rect.left) * dpr,
      y: (clientY - rect.top) * dpr,
      t,
      pressure: clamp(pressure, 0, 1),
    };
  }

  function normalizeStrokePoints(strokes) {
    const points = strokes.flatMap((stroke) => Array.isArray(stroke) ? stroke : []);
    if (!points.length) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const point of points) {
      if (point.x < minX) minX = point.x;
      if (point.x > maxX) maxX = point.x;
      if (point.y < minY) minY = point.y;
      if (point.y > maxY) maxY = point.y;
    }
    const width = Math.max(0, maxX - minX);
    const height = Math.max(0, maxY - minY);
    const scale = Math.max(width, height, 1);
    const offsetX = (1 - width / scale) / 2;
    const offsetY = (1 - height / scale) / 2;
    const norm = (point) => ({
      x: clamp(((point.x - minX) / scale) + offsetX, 0, 1),
      y: clamp(((point.y - minY) / scale) + offsetY, 0, 1),
    });
    return { width: Math.max(1, width), height: Math.max(1, height), strokes: strokes.map((stroke) => stroke.map(norm)) };
  }

  function strokeHasMiddleBar(stroke) {
    const middle = stroke.filter((p) => p.y > 0.32 && p.y < 0.72);
    if (middle.length < 2) return false;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of middle) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    return (maxX - minX) > 0.24 && (maxY - minY) < 0.18 && minX < 0.58 && maxX > 0.42;
  }

  function statsForNormalizedPoints(points) {
    if (!points?.length) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const point of points) {
      if (point.x < minX) minX = point.x;
      if (point.x > maxX) maxX = point.x;
      if (point.y < minY) minY = point.y;
      if (point.y > maxY) maxY = point.y;
    }
    return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY, count: points.length };
  }

  function normalizedYSpanInXBand(points, minX, maxX) {
    const stats = statsForNormalizedPoints(points.filter((point) => point.x >= minX && point.x <= maxX));
    return stats ? stats.height : 0;
  }

  function strokeNormalizedStats(stroke) {
    return statsForNormalizedPoints(Array.isArray(stroke) ? stroke : []);
  }

  function countNormalizedPoints(points, predicate) {
    return points.reduce((count, point) => count + (predicate(point) ? 1 : 0), 0);
  }

  function hasNormalizedRegion(points, predicate, minCount = 3) {
    return countNormalizedPoints(points, predicate) >= minCount;
  }

  function verticalStrokeInNormalizedBand(points, minX, maxX) {
    const band = points.filter((point) => point.x >= minX && point.x <= maxX);
    const stats = statsForNormalizedPoints(band);
    if (!stats) return false;
    const minCount = Math.max(5, points.length * 0.1);
    const yBins = new Set(band.map((point) => clamp(Math.floor(point.y * 8), 0, 7)));
    const xBins = new Set(band.map((point) => clamp(Math.floor(point.x * 8), 0, 7)));
    return stats.count >= minCount && yBins.size >= 5 && xBins.size <= 3 && stats.height > 0.68 && stats.width < 0.22;
  }

  function horizontalStrokeInNormalizedBand(points, minY, maxY, minSpan = 0.38) {
    const band = points.filter((point) => point.y >= minY && point.y <= maxY);
    const stats = statsForNormalizedPoints(band);
    if (!stats) return false;
    const minCount = Math.max(4, points.length * 0.06);
    const hasLeft = band.some((point) => point.x < 0.38);
    const hasCenter = band.some((point) => point.x >= 0.34 && point.x <= 0.66);
    const hasRight = band.some((point) => point.x > 0.62);
    return stats.count >= minCount && stats.width >= minSpan && stats.height <= 0.24 && hasLeft && hasCenter && hasRight;
  }

  function maxXInNormalizedBand(points, minY, maxY) {
    const band = points.filter((point) => point.y >= minY && point.y <= maxY);
    if (!band.length) return 0;
    return Math.max(...band.map((point) => point.x));
  }

  function getGlyphFeatures(strokes) {
    const normalized = normalizeStrokePoints(strokes);
    if (!normalized) return null;
    const points = normalized.strokes.flat();
    if (!points.length) return null;
    const ratio = normalized.height / Math.max(1, normalized.width);
    const topBar = horizontalStrokeInNormalizedBand(points, 0, 0.28, 0.42);
    const middleBar = normalized.strokes.some(strokeHasMiddleBar) || horizontalStrokeInNormalizedBand(points, 0.32, 0.68, 0.34);
    const bottomBar = horizontalStrokeInNormalizedBand(points, 0.72, 1, 0.42);
    const leftSpine = verticalStrokeInNormalizedBand(points, 0, 0.34);
    const centerSpine = verticalStrokeInNormalizedBand(points, 0.32, 0.68);
    const rightSpine = verticalStrokeInNormalizedBand(points, 0.66, 1);
    const leftTop = hasNormalizedRegion(points, (point) => point.x < 0.38 && point.y < 0.3);
    const leftBottom = hasNormalizedRegion(points, (point) => point.x < 0.38 && point.y > 0.7);
    const rightTopMax = maxXInNormalizedBand(points, 0.06, 0.36);
    const rightMidMax = maxXInNormalizedBand(points, 0.37, 0.63);
    const rightBottomMax = maxXInNormalizedBand(points, 0.64, 0.94);
    const rightTop = hasNormalizedRegion(points, (point) => point.x > 0.56 && point.y < 0.34);
    const rightMiddle = hasNormalizedRegion(points, (point) => point.x > 0.62 && point.y > 0.34 && point.y < 0.68);
    const rightBottom = hasNormalizedRegion(points, (point) => point.x > 0.56 && point.y > 0.66);
    const leftMiddle = hasNormalizedRegion(points, (point) => point.x < 0.38 && point.y > 0.28 && point.y < 0.74);
    const topCenter = hasNormalizedRegion(points, (point) => point.x > 0.38 && point.x < 0.62 && point.y < 0.3);
    const centerMiddle = hasNormalizedRegion(points, (point) => point.x > 0.36 && point.x < 0.64 && point.y > 0.32 && point.y < 0.68);
    const bottomCenter = hasNormalizedRegion(points, (point) => point.x > 0.36 && point.x < 0.64 && point.y > 0.68);
    const leftYSpan = normalizedYSpanInXBand(points, 0, 0.34);
    const centerYSpan = normalizedYSpanInXBand(points, 0.32, 0.68);
    const rightYSpan = normalizedYSpanInXBand(points, 0.66, 1);
    const rightMiddleStrong = countNormalizedPoints(points, (point) => point.x > 0.64 && point.y > 0.34 && point.y < 0.68) >= Math.max(4, points.length * 0.08);
    const rightWaist = rightTopMax > 0.64 && rightBottomMax > 0.64 && rightMidMax < Math.min(rightTopMax, rightBottomMax) - 0.045;
    const rightBulge = rightMidMax > 0.7 && rightMidMax >= rightTopMax - 0.03 && rightMidMax >= rightBottomMax - 0.03;
    return {
      normalized,
      points,
      ratio,
      topBar,
      middleBar,
      bottomBar,
      leftSpine,
      centerSpine,
      rightSpine,
      leftTop,
      leftBottom,
      leftTall: leftSpine,
      rightTop,
      rightMiddle,
      rightBottom,
      leftMiddle,
      topCenter,
      centerMiddle,
      bottomCenter,
      leftYSpan,
      centerYSpan,
      rightYSpan,
      rightMiddleStrong,
      rightTopMax,
      rightMidMax,
      rightBottomMax,
      rightWaist,
      rightBulge,
    };
  }

  function hasLeftColumn(features) {
    return Boolean(features?.leftSpine || (features?.leftTop && features.leftMiddle && features.leftBottom));
  }

  function hasRightColumn(features) {
    return Boolean(features?.rightSpine || (features?.rightTop && features.rightMiddle && features.rightBottom && !features.rightWaist));
  }

  function normalizedGlyphAspect(features) {
    return features?.normalized ? features.normalized.width / Math.max(1, features.normalized.height) : 0;
  }

  function looksLikeLowercaseF(features) {
    if (!features) return false;
    const aspect = normalizedGlyphAspect(features);
    const tallStem = features.centerSpine || features.centerYSpan > 0.66 || (!features.leftSpine && features.leftYSpan > 0.62);
    const crossbar = features.middleBar || horizontalStrokeInNormalizedBand(features.points, 0.28, 0.62, 0.22);
    const topHook = features.topCenter || features.leftTop || features.rightTop || features.topBar;
    const bowl = features.rightMiddleStrong && features.rightBottom && features.leftMiddle;
    if (features.leftSpine && features.topBar && features.middleBar) return false;
    return features.ratio > 1.05 && aspect < 1.05 && tallStem && crossbar && topHook && !features.bottomBar && !bowl;
  }

  function looksLikeLowercaseG(features) {
    if (!features) return false;
    const aspect = normalizedGlyphAspect(features);
    const bowl = features.leftMiddle && (features.rightMiddle || features.rightMiddleStrong) && (features.topCenter || features.leftTop || features.rightTop);
    const lowerLoop = features.bottomCenter && (features.leftBottom || features.rightBottom);
    const descenderCoverage = features.centerYSpan > 0.58 || features.rightYSpan > 0.5 || features.leftYSpan > 0.5;
    const notBlockD = !features.leftSpine || features.rightWaist || features.middleBar || aspect < 0.72;
    return features.ratio > 0.85 && features.ratio < 3.8 && bowl && lowerLoop && descenderCoverage && notBlockD;
  }


  function hasLowerDiagonalStroke(features, minWidth = 0.16, minHeight = 0.12) {
    return Boolean(features?.normalized?.strokes?.some((stroke) => {
      if (!stroke || stroke.length < 2) return false;
      const stats = strokeNormalizedStats(stroke);
      if (!stats || stats.width < minWidth || stats.height < minHeight) return false;
      if (stats.maxY < 0.58 || stats.maxX < 0.52) return false;
      const first = stroke[0];
      const last = stroke[stroke.length - 1];
      const dx = last.x - first.x;
      const dy = last.y - first.y;
      return Math.abs(dx) > minWidth * 0.7 && Math.abs(dy) > minHeight * 0.7;
    }));
  }

  function hasDiagonalThroughCenter(features, direction = "any") {
    if (!features?.points?.length) return false;
    const center = features.points.filter((point) => point.x > 0.32 && point.x < 0.68 && point.y > 0.28 && point.y < 0.72);
    if (center.length < Math.max(3, features.points.length * 0.05)) return false;
    const topLeft = hasNormalizedRegion(features.points, (point) => point.x < 0.42 && point.y < 0.38, 2);
    const topRight = hasNormalizedRegion(features.points, (point) => point.x > 0.58 && point.y < 0.38, 2);
    const bottomLeft = hasNormalizedRegion(features.points, (point) => point.x < 0.42 && point.y > 0.62, 2);
    const bottomRight = hasNormalizedRegion(features.points, (point) => point.x > 0.58 && point.y > 0.62, 2);
    if (direction === "falling") return topRight && bottomLeft;
    if (direction === "rising") return topLeft && bottomRight;
    return (topRight && bottomLeft) || (topLeft && bottomRight);
  }

  function recognizeCapitalAFromStrokes(strokes) {
    const normalized = normalizeStrokePoints(strokes);
    if (!normalized) return "";
    const features = getGlyphFeatures(strokes);
    if (features?.leftSpine && (features.topBar || features.bottomBar || features.rightSpine)) return "";
    if (features?.topBar && features.bottomBar) return "";
    if (features?.topBar && features.middleBar && !features.bottomCenter) return "";
    const { width, height, strokes: normStrokes } = normalized;
    const ratio = height / Math.max(1, width);
    if (ratio < 0.75 || ratio > 3.6) return "";

    const points = normStrokes.flat();
    const apex = points.some((p) => p.y < 0.18 && p.x > 0.25 && p.x < 0.75);
    const leftFoot = points.some((p) => p.y > 0.72 && p.x < 0.35);
    const rightFoot = points.some((p) => p.y > 0.72 && p.x > 0.65);
    const middleBar = normStrokes.some(strokeHasMiddleBar);
    if (apex && leftFoot && rightFoot && middleBar) return "A";

    return "";
  }

  function recognizeCapitalIFromStrokes(strokes) {
    const features = getGlyphFeatures(strokes);
    if (!features) return "";
    if (features.ratio < 1.1 || features.ratio > 5.0) return "";
    if (features.centerSpine && features.topBar && features.bottomBar && !features.leftTall && !features.rightSpine) return "I";
    if (features.topBar && features.bottomBar && !features.middleBar && !features.rightMiddleStrong && features.centerYSpan > 0.54) return "I";
    return "";
  }

  function recognizeCapitalHFromStrokes(strokes) {
    const features = getGlyphFeatures(strokes);
    if (!features) return "";
    if (features.ratio < 0.85 || features.ratio > 3.9) return "";
    if (features.leftSpine && features.rightSpine && features.middleBar && !features.topBar && !features.bottomBar) return "H";
    return "";
  }

  function recognizeCapitalEFromStrokes(strokes) {
    const features = getGlyphFeatures(strokes);
    if (!features) return "";
    if (features.ratio < 0.75 || features.ratio > 4.1) return "";
    if ((hasLeftColumn(features) || features.leftMiddle) && features.topBar && features.middleBar && features.bottomBar && !features.rightSpine) return "E";
    if (features.leftTall && features.topBar && features.middleBar && (features.bottomBar || features.rightBottom) && !features.rightSpine) return "E";
    return "";
  }

  function recognizeCapitalFFromStrokes(strokes) {
    const features = getGlyphFeatures(strokes);
    if (!features) return "";
    if (features.ratio < 0.8 || features.ratio > 4.2) return "";
    if ((hasLeftColumn(features) || features.leftMiddle) && features.topBar && features.middleBar && !features.bottomBar && !features.rightSpine && !features.rightBottom) return "F";
    if (features.leftTall && features.topBar && features.middleBar && !features.bottomBar && !features.rightSpine) return "F";
    return "";
  }

  function recognizeLowercaseFFromStrokes(strokes) {
    return looksLikeLowercaseF(getGlyphFeatures(strokes)) ? "f" : "";
  }

  function recognizeCapitalLFromStrokes(strokes) {
    const features = getGlyphFeatures(strokes);
    if (!features) return "";
    if (features.ratio < 1.0 || features.ratio > 5.2) return "";
    if (features.leftSpine && features.bottomBar && !features.topBar && !features.middleBar && !features.rightSpine) return "L";
    return "";
  }

  function recognizeCapitalDFromStrokes(strokes) {
    const features = getGlyphFeatures(strokes);
    if (!features) return "";
    if (features.ratio < 0.75 || features.ratio > 4.2) return "";
    if (looksLikeLowercaseG(features)) return "";
    if (hasLeftColumn(features) && !features.rightSpine && features.rightTop && features.rightMiddle && features.rightBottom && !features.rightWaist && !features.middleBar) return "D";
    if (features.leftSpine && !features.rightSpine && !features.topBar && !features.bottomBar && !features.middleBar && features.rightTop && features.rightMiddle && features.rightBottom && features.rightBulge && !features.rightWaist) return "D";
    return "";
  }

  function recognizeCapitalBFromStrokes(strokes) {
    const features = getGlyphFeatures(strokes);
    if (!features) return "";
    if (features.ratio < 0.75 || features.ratio > 4.2) return "";
    if (hasLeftColumn(features) && !features.rightSpine && features.rightTop && features.rightMiddle && features.rightBottom && (features.middleBar || features.rightWaist)) return "B";
    return "";
  }

  function recognizeCapitalGFromStrokes(strokes) {
    const features = getGlyphFeatures(strokes);
    if (!features) return "";
    if (features.ratio < 0.55 || features.ratio > 2.8) return "";
    if (!features.rightSpine && features.leftMiddle && features.rightTop && features.rightBottom && features.rightMiddleStrong && features.middleBar) return "G";
    return "";
  }

  function recognizeCapitalCFromStrokes(strokes) {
    const features = getGlyphFeatures(strokes);
    if (!features) return "";
    if (features.ratio < 1.05 || features.ratio > 2.8) return "";
    if (!features.leftSpine && features.leftMiddle && features.rightTop && features.rightBottom && !features.middleBar && !features.rightMiddleStrong) return "C";
    return "";
  }

  function recognizeCapitalJFromStrokes(strokes) {
    const features = getGlyphFeatures(strokes);
    if (!features) return "";
    if (features.ratio < 0.9 || features.ratio > 4.8) return "";
    const stem = features.centerSpine || features.rightSpine || features.rightYSpan > 0.5 || features.centerYSpan > 0.58;
    const hook = features.leftBottom && features.bottomCenter && !features.bottomBar;
    if (features.topBar && stem && hook && !hasLeftColumn(features) && !features.middleBar) return "J";
    return "";
  }

  function recognizeCapitalKFromStrokes(strokes) {
    const features = getGlyphFeatures(strokes);
    if (!features) return "";
    if (features.ratio < 0.8 || features.ratio > 4.4) return "";
    const leftSide = hasLeftColumn(features) || (features.leftMiddle && features.leftYSpan > 0.46);
    const arms = features.rightTop && features.rightBottom && features.centerMiddle;
    if (leftSide && arms && !features.topBar && !features.bottomBar && !features.rightSpine && !features.rightWaist) return "K";
    return "";
  }

  function recognizeCapitalMFromStrokes(strokes) {
    const features = getGlyphFeatures(strokes);
    if (!features) return "";
    const aspect = features.normalized.width / Math.max(1, features.normalized.height);
    if (features.ratio < 0.55 || features.ratio > 2.2 || aspect < 0.62) return "";
    const peaks = features.leftTop && features.rightTop;
    const feet = features.leftBottom && features.rightBottom;
    if (peaks && feet && features.bottomCenter && !features.topCenter && !features.middleBar) return "M";
    return "";
  }

  function recognizeCapitalNFromStrokes(strokes) {
    const features = getGlyphFeatures(strokes);
    if (!features) return "";
    if (features.ratio < 0.85 || features.ratio > 4.2) return "";
    const columns = (hasLeftColumn(features) || features.leftYSpan > 0.58) && (hasRightColumn(features) || features.rightYSpan > 0.58);
    if (columns && hasDiagonalThroughCenter(features, "rising") && !features.middleBar && !features.topBar && !features.bottomBar) return "N";
    return "";
  }

  function recognizeCapitalPFromStrokes(strokes) {
    const features = getGlyphFeatures(strokes);
    if (!features) return "";
    if (features.ratio < 0.85 || features.ratio > 4.6) return "";
    const leftSide = hasLeftColumn(features) || features.leftYSpan > 0.62;
    if (leftSide && features.rightTop && features.rightMiddle && !features.rightBottom && !features.bottomBar) return "P";
    return "";
  }

  function recognizeCapitalQFromStrokes(strokes) {
    const features = getGlyphFeatures(strokes);
    if (!features) return "";
    if (features.ratio < 0.55 || features.ratio > 2.2) return "";
    const roundBody = features.leftMiddle && features.rightTop && features.rightBottom && !hasLeftColumn(features);
    if (roundBody && hasLowerDiagonalStroke(features, 0.14, 0.1)) return "Q";
    return "";
  }

  function recognizeCapitalRFromStrokes(strokes) {
    const features = getGlyphFeatures(strokes);
    if (!features) return "";
    if (features.ratio < 0.85 || features.ratio > 4.5) return "";
    const leftSide = hasLeftColumn(features) || features.leftYSpan > 0.58;
    const bowl = features.rightTop && features.rightMiddle;
    if (leftSide && bowl && features.rightBottom && hasLowerDiagonalStroke(features, 0.14, 0.12) && !features.bottomBar) return "R";
    return "";
  }

  function recognizeCapitalUFromStrokes(strokes) {
    const features = getGlyphFeatures(strokes);
    if (!features) return "";
    if (features.ratio < 0.8 || features.ratio > 4.4) return "";
    const sideCoverage = features.leftYSpan > 0.48 && features.rightYSpan > 0.48;
    if (sideCoverage && features.leftTop && features.rightTop && features.bottomCenter && !features.topBar && !features.middleBar) return "U";
    return "";
  }

  function recognizeCapitalZFromStrokes(strokes) {
    const features = getGlyphFeatures(strokes);
    if (!features) return "";
    if (features.ratio < 0.45 || features.ratio > 2.8) return "";
    if (features.topBar && features.bottomBar && hasDiagonalThroughCenter(features, "falling") && !hasLeftColumn(features) && !features.rightSpine) return "Z";
    return "";
  }

  function renderStrokesForPrediction(strokes) {
    const normalized = normalizeStrokePoints(strokes);
    if (!normalized) return null;
    const canvasForPrediction = document.createElement("canvas");
    canvasForPrediction.width = SIMPLE_RECOGNITION_SIZE;
    canvasForPrediction.height = SIMPLE_RECOGNITION_SIZE;
    const predictCtx = canvasForPrediction.getContext("2d", { willReadFrequently: true });
    predictCtx.fillStyle = "#000000";
    predictCtx.fillRect(0, 0, canvasForPrediction.width, canvasForPrediction.height);
    predictCtx.strokeStyle = "#ffffff";
    predictCtx.lineCap = "round";
    predictCtx.lineJoin = "round";
    predictCtx.lineWidth = Math.max(3, Math.round(SIMPLE_RECOGNITION_SIZE * 0.075));

    const pad = SIMPLE_RECOGNITION_SIZE * 0.14;
    const drawable = SIMPLE_RECOGNITION_SIZE - pad * 2;
    const aspect = normalized.width / Math.max(1, normalized.height);
    let drawW = drawable;
    let drawH = drawable;
    if (aspect > 1) drawH = drawable / aspect;
    else drawW = drawable * aspect;
    const offsetX = (SIMPLE_RECOGNITION_SIZE - drawW) / 2;
    const offsetY = (SIMPLE_RECOGNITION_SIZE - drawH) / 2;

    for (const stroke of normalized.strokes) {
      if (!stroke.length) continue;
      if (stroke.length === 1) {
        const point = stroke[0];
        predictCtx.beginPath();
        predictCtx.arc(offsetX + point.x * drawW, offsetY + point.y * drawH, predictCtx.lineWidth * 0.55, 0, Math.PI * 2);
        predictCtx.fillStyle = "#ffffff";
        predictCtx.fill();
        continue;
      }
      predictCtx.beginPath();
      stroke.forEach((point, index) => {
        const x = offsetX + point.x * drawW;
        const y = offsetY + point.y * drawH;
        if (index === 0) predictCtx.moveTo(x, y);
        else predictCtx.lineTo(x, y);
      });
      predictCtx.stroke();
    }
    return canvasForPrediction;
  }

  function canvasInkToGrid(sourceCanvas, threshold = 64) {
    const sourceCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });
    const image = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
    const data = image.data;
    let minX = sourceCanvas.width;
    let minY = sourceCanvas.height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < sourceCanvas.height; y += 1) {
      for (let x = 0; x < sourceCanvas.width; x += 1) {
        const i = (y * sourceCanvas.width + x) * 4;
        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        if (gray > threshold) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < minX || maxY < minY) return null;

    const width = Math.max(1, maxX - minX + 1);
    const height = Math.max(1, maxY - minY + 1);
    const cells = new Uint8Array(SIMPLE_RECOGNITION_GRID * SIMPLE_RECOGNITION_GRID);
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const i = (y * sourceCanvas.width + x) * 4;
        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        if (gray <= threshold) continue;
        const gx = clamp(Math.floor(((x - minX) / width) * SIMPLE_RECOGNITION_GRID), 0, SIMPLE_RECOGNITION_GRID - 1);
        const gy = clamp(Math.floor(((y - minY) / height) * SIMPLE_RECOGNITION_GRID), 0, SIMPLE_RECOGNITION_GRID - 1);
        cells[gy * SIMPLE_RECOGNITION_GRID + gx] = 1;
      }
    }

    const points = [];
    for (let y = 0; y < SIMPLE_RECOGNITION_GRID; y += 1) {
      for (let x = 0; x < SIMPLE_RECOGNITION_GRID; x += 1) {
        if (cells[y * SIMPLE_RECOGNITION_GRID + x]) points.push({ x, y });
      }
    }
    return points.length ? {
      grid: SIMPLE_RECOGNITION_GRID,
      cells,
      points,
      bounds: { minX, minY, maxX, maxY, width, height },
      aspectRatio: width / Math.max(height, 1),
    } : null;
  }

  let simpleLetterTemplates = null;
  let simpleLetterTemplateKey = "";

  function getTemplateFontStacks() {
    const stacks = [];
    if (isHandwritingFontReady()) {
      stacks.push({
        label: "henryscript",
        family: HENRY_SCRIPT_TEMPLATE_STACK,
        scale: 0.9,
        y: 0.58,
      });
    }
    stacks.push({
      label: "script",
      family: "\"Segoe Print\", \"Bradley Hand\", \"Comic Sans MS\", cursive",
      scale: 0.9,
      y: 0.58,
    });
    stacks.push({
      label: "sans",
      family: "Arial, Helvetica, sans-serif",
      scale: 0.86,
      y: 0.56,
    });
    return stacks;
  }

  function buildSimpleLetterTemplates() {
    const fontStacks = getTemplateFontStacks();
    const cacheKey = fontStacks.map((font) => font.label).join("|");
    if (simpleLetterTemplates && simpleLetterTemplateKey === cacheKey) return simpleLetterTemplates;
    simpleLetterTemplates = [];
    simpleLetterTemplateKey = cacheKey;

    for (const char of SIMPLE_RECOGNITION_CHARS) {
      for (const fontDef of fontStacks) {
        for (const mode of ["fill", "stroke"]) {
          const templateCanvas = document.createElement("canvas");
          templateCanvas.width = SIMPLE_RECOGNITION_SIZE;
          templateCanvas.height = SIMPLE_RECOGNITION_SIZE;
          const templateCtx = templateCanvas.getContext("2d", { willReadFrequently: true });
          templateCtx.fillStyle = "#000000";
          templateCtx.fillRect(0, 0, templateCanvas.width, templateCanvas.height);
          templateCtx.textAlign = "center";
          templateCtx.textBaseline = "middle";
          templateCtx.lineJoin = "round";
          templateCtx.lineCap = "round";
          templateCtx.font = Math.round(SIMPLE_RECOGNITION_SIZE * (fontDef.scale || 0.86)) + "px " + fontDef.family;
          const textY = SIMPLE_RECOGNITION_SIZE * (fontDef.y || 0.56);
          if (mode === "stroke") {
            templateCtx.strokeStyle = "#ffffff";
            templateCtx.lineWidth = Math.max(3, Math.round(SIMPLE_RECOGNITION_SIZE * 0.055));
            templateCtx.strokeText(char, SIMPLE_RECOGNITION_SIZE / 2, textY);
          } else {
            templateCtx.fillStyle = "#ffffff";
            templateCtx.fillText(char, SIMPLE_RECOGNITION_SIZE / 2, textY);
          }
          const sample = canvasInkToGrid(templateCanvas, 32);
          if (sample) simpleLetterTemplates.push({ char, mode: fontDef.label + "-" + mode, sample });
        }
      }
    }
    return simpleLetterTemplates;
  }


  function meanNearestDistance(fromPoints, toPoints) {
    if (!fromPoints.length || !toPoints.length) return Infinity;
    let total = 0;
    for (const point of fromPoints) {
      let best = Infinity;
      for (const target of toPoints) {
        const dx = point.x - target.x;
        const dy = point.y - target.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < best) best = dist;
      }
      total += best;
    }
    return total / fromPoints.length;
  }

  function scoreSamplesDetailed(inputSample, templateSample) {
    const gridScale = SIMPLE_RECOGNITION_GRID - 1;
    const inputToTemplate = meanNearestDistance(inputSample.points, templateSample.points) / gridScale;
    const templateToInput = meanNearestDistance(templateSample.points, inputSample.points) / gridScale;
    const inkDensityScore = Math.min(inputSample.points.length, templateSample.points.length) / Math.max(inputSample.points.length, templateSample.points.length);
    const weightedDistance = inputToTemplate * 0.62 + templateToInput * 0.38;
    const shapeScore = Math.max(0, 1 - weightedDistance / 0.22);
    return {
      rasterScore: Math.max(0, Math.min(1, shapeScore * (0.74 + inkDensityScore * 0.26))),
      inkDensityScore: Math.max(0, Math.min(1, inkDensityScore)),
      rasterDistance: weightedDistance,
      inputToTemplate,
      templateToInput,
    };
  }

  function scoreSamples(inputSample, templateSample) {
    return scoreSamplesDetailed(inputSample, templateSample).rasterScore;
  }

  function metadataRatioScore(inputValue, templateValue) {
    const a = Number(inputValue);
    const b = Number(templateValue);
    if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) return 1;
    return Math.max(0, Math.min(1, 1 - Math.abs(Math.log(a / b)) / Math.log(4)));
  }

  function scoreTemplateTrajectory(inputTrajectory, template) {
    if (!inputTrajectory?.strokes?.length || !template?.trajectory?.strokes?.length) {
      return { trajectoryScore: null, strokeCountScore: 1, aspectRatioScore: 1, evidence: { trajectoryAware: false } };
    }
    const comparison = compareHandwritingTrajectories(inputTrajectory, template.trajectory);
    const inputCount = inputTrajectory.metadata?.strokeCount || inputTrajectory.strokes.length || 0;
    const templateCount = template.trajectory.metadata?.strokeCount || template.trajectory.strokes.length || 0;
    const strokeCountScore = Math.max(0, Math.min(1, 1 - Math.abs(inputCount - templateCount) / Math.max(inputCount, templateCount, 1)));
    const aspectRatioScore = metadataRatioScore(inputTrajectory.metadata?.aspectRatio, template.trajectory.metadata?.aspectRatio);
    return {
      trajectoryScore: comparison.similarity,
      strokeCountScore,
      aspectRatioScore,
      evidence: comparison.evidence || { trajectoryAware: true },
    };
  }

  function rankTemplateLetters(strokes, limit = CUSTOM_RECOGNITION_CANDIDATE_LIMIT) {
    const predictionCanvas = renderStrokesForPrediction(strokes);
    if (!predictionCanvas) return [];
    const inputSample = canvasInkToGrid(predictionCanvas, 48);
    if (!inputSample || inputSample.points.length < 1) return [];
    const inputTrajectory = normalizeRawHandwritingStrokes(strokes, {
      raster28: { grid: SIMPLE_RECOGNITION_GRID, points: inputSample.points },
    });

    const byChar = new Map();
    const templates = [...getUserTrainingTemplates(), ...buildSimpleLetterTemplates()];
    for (const template of templates) {
      const rasterEvidence = scoreSamplesDetailed(inputSample, template.sample);
      const trajectoryEvidence = scoreTemplateTrajectory(inputTrajectory, template);
      const personalSampleBonus = template.mode === "user-correction" ? 0.08 : 0;
      const combined = combineHandwritingCandidateEvidence({
        mode: template.mode,
        rasterScore: rasterEvidence.rasterScore,
        trajectoryScore: trajectoryEvidence.trajectoryScore,
        inkDensityScore: rasterEvidence.inkDensityScore,
        strokeCountScore: trajectoryEvidence.strokeCountScore,
        aspectRatioScore: trajectoryEvidence.trajectoryScore === null
          ? metadataRatioScore(inputSample.aspectRatio, template.sample?.aspectRatio)
          : trajectoryEvidence.aspectRatioScore,
        personalSampleBonus,
      });
      const candidate = {
        char: template.char,
        text: template.char,
        mode: template.mode,
        engine: template.mode === "user-correction" ? "nodevision-personal-template" : "nodevision-custom-template",
        score: combined.score,
        relativeConfidence: combined.relativeConfidence,
        confidence: combined.relativeConfidence,
        evidence: {
          ...combined.evidence,
          rasterDistance: rasterEvidence.rasterDistance,
          inputToTemplate: rasterEvidence.inputToTemplate,
          templateToInput: rasterEvidence.templateToInput,
          trajectoryEvidence: trajectoryEvidence.evidence,
          sampleSchema: template.trajectory?.schema || "nodevision-handwriting-sample/1",
          sampleSource: template.source || template.mode || "template",
        },
      };
      const previous = byChar.get(template.char);
      if (!previous || candidate.score > previous.score) byChar.set(template.char, candidate);
    }

    const sorted = stableSortHandwritingCandidates(Array.from(byChar.values()));
    return rerankCandidatesWithConfusions(sorted, confusionStats).slice(0, Math.max(limit, CUSTOM_RECOGNITION_CANDIDATE_LIMIT));
  }

  function findCandidate(candidates, char, maxBehind = 0.05) {
    const bestScore = candidates[0]?.score || 0;
    return candidates.find((candidate) => candidate.char === char && bestScore - candidate.score <= maxBehind) || null;
  }

  function chooseTemplateCandidate(strokes, candidates) {
    const best = candidates[0] || { char: "", score: 0, mode: "" };
    if (!best.char) return best;

    const features = getGlyphFeatures(strokes);
    if (best.char === "g" && looksLikeLowercaseG(features)) return best;
    if (best.char === "f" && looksLikeLowercaseF(features)) return best;

    const fCandidate = findCandidate(candidates, "f", 0.16);
    if (fCandidate && looksLikeLowercaseF(features) && ["a", "A", "t", "l", "I", "F", "f"].includes(best.char)) return fCandidate;

    const gCandidate = findCandidate(candidates, "g", 0.16);
    if (gCandidate && looksLikeLowercaseG(features) && ["D", "d", "O", "o", "Q", "q", "a", "g"].includes(best.char)) return gCandidate;

    const upperTwin = best.char.toLowerCase?.() === best.char && best.char.toUpperCase?.() !== best.char
      ? findCandidate(candidates, best.char.toUpperCase(), 0.055)
      : null;
    if (upperTwin) return upperTwin;

    const bCandidate = findCandidate(candidates, "B", 0.12);
    if (bCandidate && features?.leftTall && features.rightTop && features.rightBottom) return bCandidate;

    const dCandidate = findCandidate(candidates, "D", 0.06);
    if (dCandidate && features?.leftTall && ["Q", "O", "o"].includes(best.char) && !looksLikeLowercaseG(features)) return dCandidate;

    const zCandidate = findCandidate(candidates, "Z", 0.035);
    if (zCandidate && best.char === "z") return zCandidate;

    const nCandidate = findCandidate(candidates, "N", 0.035);
    if (nCandidate && best.char === "H" && !features?.middleBar) return nCandidate;

    const mCandidate = findCandidate(candidates, "M", 0.045);
    const glyphAspect = features ? features.normalized.width / Math.max(1, features.normalized.height) : 0;
    if (mCandidate && best.char === "N" && glyphAspect > 0.72) return mCandidate;


    const vCandidate = findCandidate(candidates, "V", 0.035);
    if (vCandidate && ["y", "v", "f"].includes(best.char) && !features?.leftTall) return vCandidate;

    const wCandidate = findCandidate(candidates, "W", 0.085);
    if (wCandidate && ["k", "v", "V", "u", "U"].includes(best.char) && glyphAspect > 0.68 && !features?.leftTall) return wCandidate;

    const rCandidate = findCandidate(candidates, "R", 0.09);
    if (rCandidate && ["P", "p", "B", "C"].includes(best.char) && features?.leftSpine && features.rightBottom && !features.bottomBar) return rCandidate;

    const tCandidate = findCandidate(candidates, "T", 0.06);
    if (tCandidate && features?.topBar && features.centerSpine && !features.bottomBar) return tCandidate;

    const qCandidate = findCandidate(candidates, "Q", 0.07);
    if (qCandidate && ["O", "o", "C", "G"].includes(best.char) && features?.rightBottom && !features.leftTall) return qCandidate;

    return best;
  }

  function recognizeTemplateLetterDetailed(strokes) {
    const candidates = rankTemplateLetters(strokes, CUSTOM_RECOGNITION_RAW_LIMIT);
    const rawBest = candidates[0] || { char: "", score: 0, mode: "" };
    const best = chooseTemplateCandidate(strokes, candidates);
    const adjusted = Boolean(best.char && rawBest.char && best.char !== rawBest.char);
    const second = candidates.find((candidate) => candidate.char !== best.char) || { char: "", score: 0, mode: "" };
    const accepted = best.score >= CUSTOM_RECOGNITION_ACCEPTANCE.minScore
      && (best.score - second.score >= CUSTOM_RECOGNITION_ACCEPTANCE.minLead || best.score >= CUSTOM_RECOGNITION_ACCEPTANCE.strongScore);
    return {
      char: accepted ? best.char : "",
      source: adjusted ? "template-adjusted" : (best.mode === "user-correction" ? "user-correction" : "template"),
      accepted,
      score: best.score || 0,
      candidates,
      bounds: boundsForStrokes(strokes),
    };
  }

  function recognizeTemplateLetter(strokes) {
    return recognizeTemplateLetterDetailed(strokes).char;
  }

  function shouldKeepLowercaseTemplateDetail(templateDetail, strokes) {
    if (!templateDetail?.accepted || !["f", "g"].includes(templateDetail.char)) return false;
    const features = getGlyphFeatures(strokes);
    if (templateDetail.char === "f") return looksLikeLowercaseF(features) || (templateDetail.score || 0) >= 0.48;
    if (templateDetail.char === "g") return looksLikeLowercaseG(features) || (templateDetail.score || 0) >= 0.48;
    return false;
  }

  function strokeBounds(stroke) {
    if (!Array.isArray(stroke) || !stroke.length) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const point of stroke) {
      if (point.x < minX) minX = point.x;
      if (point.x > maxX) maxX = point.x;
      if (point.y < minY) minY = point.y;
      if (point.y > maxY) maxY = point.y;
    }
    return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
  }

  function mergeBounds(a, b) {
    if (!a) return b;
    if (!b) return a;
    const minX = Math.min(a.minX, b.minX);
    const minY = Math.min(a.minY, b.minY);
    const maxX = Math.max(a.maxX, b.maxX);
    const maxY = Math.max(a.maxY, b.maxY);
    return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
  }

  function isTinyArtifactStroke(entry) {
    const bounds = entry?.bounds;
    if (!bounds) return true;
    const span = Math.max(bounds.width || 0, bounds.height || 0);
    const pointCount = Array.isArray(entry.stroke) ? entry.stroke.length : 0;
    const minSpan = Math.max(4 * getDpr(), clamp(sizeInput.valueAsNumber || DEFAULT_PEN_SIZE, 2, 36) * getDpr() * 0.18);
    return pointCount <= 8 && span < minSpan;
  }

  function segmentStrokesForText(strokes) {
    let entries = strokes
      .map((stroke) => ({ stroke, bounds: strokeBounds(stroke) }))
      .filter((entry) => entry.bounds && !isTinyArtifactStroke(entry))
      .sort((a, b) => a.bounds.minX - b.bounds.minX || a.bounds.minY - b.bounds.minY);
    if (entries.length <= 1) return entries.map((entry) => [entry.stroke]);

    let usableWidths = entries.map((entry) => Math.max(1, entry.bounds.width)).sort((a, b) => a - b);
    let medianWidth = usableWidths[Math.floor(usableWidths.length / 2)] || 1;
    let allBounds = entries.reduce((bounds, entry) => mergeBounds(bounds, entry.bounds), null);
    let textHeight = Math.max(1, allBounds?.height || medianWidth);

    entries = entries.filter((entry) => {
      const b = entry.bounds;
      const high = b.maxY <= (allBounds.minY + textHeight * 0.24);
      const shallow = b.height <= Math.max(6 * getDpr(), textHeight * 0.2);
      const broad = b.width >= Math.max(medianWidth * 1.8, textHeight * 0.72);
      if (!(high && shallow && broad)) return true;
      const overlappedBelow = entries.filter((other) => {
        if (other === entry || other.bounds.minY <= b.maxY) return false;
        const overlapX = Math.min(b.maxX, other.bounds.maxX) - Math.max(b.minX, other.bounds.minX);
        return overlapX > Math.min(b.width, other.bounds.width) * 0.2;
      });
      return overlappedBelow.length < 2;
    });
    if (entries.length <= 1) return entries.map((entry) => [entry.stroke]);

    usableWidths = entries.map((entry) => Math.max(1, entry.bounds.width)).sort((a, b) => a - b);
    medianWidth = usableWidths[Math.floor(usableWidths.length / 2)] || 1;
    allBounds = entries.reduce((bounds, entry) => mergeBounds(bounds, entry.bounds), null);
    textHeight = Math.max(1, allBounds?.height || medianWidth);
    const maxGlyphGap = Math.max(8 * getDpr(), Math.min(textHeight * 0.18, medianWidth * 0.42));
    const strokeJoinGap = clamp(sizeInput.valueAsNumber || DEFAULT_PEN_SIZE, 2, 36) * getDpr() * 0.42;
    const closeStrokeGap = Math.max(4 * getDpr(), Math.min(textHeight * 0.1, medianWidth * 0.38, strokeJoinGap));
    const groups = [];

    for (const entry of entries) {
      let target = null;
      for (const group of groups) {
        const gap = entry.bounds.minX - group.bounds.maxX;
        const horizontalOverlap = Math.min(entry.bounds.maxX, group.bounds.maxX) - Math.max(entry.bounds.minX, group.bounds.minX);
        const overlapsX = horizontalOverlap > 0;
        const minWidthForOverlap = Math.max(1, Math.min(entry.bounds.width || 1, group.bounds.width || 1));
        const horizontalOverlapRatio = overlapsX ? horizontalOverlap / minWidthForOverlap : 0;
        const centerX = (entry.bounds.minX + entry.bounds.maxX) * 0.5;
        const groupCenterX = (group.bounds.minX + group.bounds.maxX) * 0.5;
        const nearCenter = centerX >= group.bounds.minX - maxGlyphGap * 0.6 && centerX <= group.bounds.maxX + maxGlyphGap * 0.6;
        const entryNearGroupDot = groupCenterX >= entry.bounds.minX - maxGlyphGap * 0.6 && groupCenterX <= entry.bounds.maxX + maxGlyphGap * 0.6;
        const verticalOverlap = Math.min(entry.bounds.maxY, group.bounds.maxY) - Math.max(entry.bounds.minY, group.bounds.minY);
        const minHeight = Math.max(1, Math.min(entry.bounds.height || 1, group.bounds.height || 1));
        const verticalOverlapRatio = verticalOverlap > 0 ? verticalOverlap / minHeight : 0;
        const looksLikeDot = entry.bounds.width <= textHeight * 0.18 && entry.bounds.height <= textHeight * 0.18 && entry.bounds.maxY < group.bounds.minY + textHeight * 0.42;
        const groupLooksLikeDot = group.bounds.width <= textHeight * 0.18 && group.bounds.height <= textHeight * 0.18 && group.bounds.maxY < entry.bounds.minY + textHeight * 0.42;
        const verticalGap = verticalOverlap > 0
          ? 0
          : Math.max(0, Math.max(entry.bounds.minY, group.bounds.minY) - Math.min(entry.bounds.maxY, group.bounds.maxY));
        const stackedStroke = overlapsX && horizontalOverlapRatio > 0.16 && verticalGap <= closeStrokeGap * 1.2 && (
          verticalOverlapRatio > 0.12 ||
          entry.bounds.height <= textHeight * 0.32 ||
          group.bounds.height <= textHeight * 0.32
        );
        const strongOverlap = overlapsX && horizontalOverlapRatio > 0.18 && verticalOverlapRatio > 0.16;
        const closeStroke = gap >= 0 && gap <= closeStrokeGap && verticalOverlapRatio > 0.42;
        if (strongOverlap || stackedStroke || closeStroke || (looksLikeDot && nearCenter) || (groupLooksLikeDot && entryNearGroupDot)) {
          target = group;
          break;
        }
      }

      if (!target) {
        groups.push({ strokes: [entry.stroke], bounds: entry.bounds });
        continue;
      }
      target.strokes.push(entry.stroke);
      target.bounds = mergeBounds(target.bounds, entry.bounds);
    }

    return groups
      .sort((a, b) => a.bounds.minX - b.bounds.minX)
      .map((group) => group.strokes);
  }


  function getRecognitionContextText() {
    if (typeof getRecognitionContext !== "function") return "";
    try {
      const context = getRecognitionContext();
      if (typeof context === "string") return safeText(context);
      return safeText(context?.before || context?.textBefore || context?.prefix || "");
    } catch (err) {
      console.warn("[HandwritingOcrPanel] recognition context unavailable:", err);
      return "";
    }
  }

  function isAsciiLetter(char) {
    return /^[A-Za-z]$/.test(char || "");
  }

  function isUppercaseAscii(char) {
    return /^[A-Z]$/.test(char || "");
  }

  function capitalizationProfile(contextText) {
    const text = safeText(contextText || "");
    const significant = text.replace(/[\s\"\x27\u2018\u2019\u201c\u201d\(\[\{]+$/g, "");
    const previous = Array.from(significant).pop() || "";
    const trailingLetters = (text.match(/[A-Za-z]+$/) || [""])[0];
    const upperRun = ((trailingLetters.match(/[A-Z]+$/) || [""])[0] || "").length;
    return {
      previous,
      inWord: trailingLetters.length > 0,
      upperRun,
      sentenceStart: !previous || /[.!?]/.test(previous) || /\n\s*$/.test(text),
    };
  }

  function bestCandidateForChar(detail, char) {
    const candidates = Array.isArray(detail?.candidates) ? detail.candidates : [];
    const preferTemplateScore = String(detail?.source || "").startsWith("heuristic");
    let best = null;
    let heuristicBest = null;
    for (const candidate of candidates) {
      if (candidate?.char !== char) continue;
      const score = Number(candidate.score) || 0;
      const entry = { ...candidate, score };
      if (preferTemplateScore && candidate.mode === "heuristic") {
        if (!heuristicBest || score > heuristicBest.score) heuristicBest = entry;
        continue;
      }
      if (!best || score > best.score) best = entry;
    }

    if (detail?.char === char && !preferTemplateScore) {
      const score = Number(detail.score) || 0;
      if (!best || score > best.score) best = { char, mode: detail.source || "detail", score };
    }

    return best || heuristicBest;
  }

  function capitalizationBias(char, profile) {
    const upper = isUppercaseAscii(char);
    if (profile.sentenceStart) return upper ? 0.04 : 0;
    if (!profile.inWord) return upper ? -0.01 : 0.02;
    if (profile.upperRun >= 2) return upper ? 0.015 : 0;
    if (profile.upperRun === 1) return upper ? -0.02 : 0.035;
    return upper ? -0.01 : 0.02;
  }

  function maxCaseSwitchBehind(profile, targetIsUpper) {
    if (profile.sentenceStart && targetIsUpper) return 0.008;
    if (profile.inWord && profile.upperRun === 1 && !targetIsUpper) return 0.008;
    if (!targetIsUpper && !profile.sentenceStart) return 0.008;
    if (profile.upperRun >= 2 && targetIsUpper) return 0.008;
    return 0.006;
  }

  function applyCapitalizationContextToDetail(detail, contextText) {
    const candidates = Array.isArray(detail?.candidates) ? detail.candidates : [];
    if (!candidates.length) return detail;
    const reranked = rerankCandidatesWithContext(candidates, { before: contextText });
    const chosen = reranked[0] || null;
    if (!chosen?.char && !chosen?.text) return detail;
    const currentChar = detail?.char || candidates[0]?.char || candidates[0]?.text || "";
    const chosenChar = chosen.char || chosen.text || "";
    const originalCurrent = candidates.find((candidate) => (candidate.char || candidate.text) === currentChar) || candidates[0];
    const originalChosen = candidates.find((candidate) => (candidate.char || candidate.text) === chosenChar) || chosen;
    const rawBehind = Math.max(0, Number(originalCurrent?.score || 0) - Number(originalChosen?.score || 0));
    const profile = contextProfile({ before: contextText });
    const targetIsUpper = isUppercaseAscii(chosenChar);
    if (chosenChar !== currentChar && rawBehind > maxCaseSwitchBehind(profile, targetIsUpper)) return detail;
    return {
      ...detail,
      char: chosenChar,
      source: chosenChar !== currentChar ? (detail.source || "template") + "+context" : detail.source,
      score: chosen.score || detail.score || 0,
      accepted: Boolean(chosenChar),
      candidates: reranked,
    };
  }

  function applyCapitalizationContext(segmentDetails, startingContext = "") {
    let contextText = safeText(startingContext || "");
    for (const segment of segmentDetails) {
      const adjusted = applyCapitalizationContextToDetail(segment, contextText);
      Object.assign(segment, adjusted);
      if (segment.char) contextText += segment.char;
    }
    return segmentDetails;
  }

  function recognizeSingleGlyphDetailed(strokes) {
    const bounds = boundsForStrokes(strokes);
    const templateDetail = recognizeTemplateLetterDetailed(strokes);
    if (templateDetail?.source === "user-correction" && templateDetail.accepted) return templateDetail;
    if (shouldKeepLowercaseTemplateDetail(templateDetail, strokes)) return templateDetail;
    const heuristics = [
      ["I", recognizeCapitalIFromStrokes],
      ["H", recognizeCapitalHFromStrokes],
      ["E", recognizeCapitalEFromStrokes],
      ["f", recognizeLowercaseFFromStrokes],
      ["F", recognizeCapitalFFromStrokes],
      ["L", recognizeCapitalLFromStrokes],
      ["B", recognizeCapitalBFromStrokes],
      ["D", recognizeCapitalDFromStrokes],
      ["P", recognizeCapitalPFromStrokes],
      ["R", recognizeCapitalRFromStrokes],
      ["K", recognizeCapitalKFromStrokes],
      ["M", recognizeCapitalMFromStrokes],
      ["N", recognizeCapitalNFromStrokes],
      ["U", recognizeCapitalUFromStrokes],
      ["J", recognizeCapitalJFromStrokes],
      ["Q", recognizeCapitalQFromStrokes],
      ["G", recognizeCapitalGFromStrokes],
      ["C", recognizeCapitalCFromStrokes],
      ["Z", recognizeCapitalZFromStrokes],
      ["A", recognizeCapitalAFromStrokes],
    ];

    for (const [label, recognizer] of heuristics) {
      const char = recognizer(strokes);
      if (!char) continue;
      return {
        char,
        source: `heuristic-${label}`,
        accepted: true,
        score: 1,
        candidates: [{ char, mode: "heuristic", score: 1 }, ...(templateDetail?.candidates || [])],
        bounds,
      };
    }

    return templateDetail || recognizeTemplateLetterDetailed(strokes);
  }

  function recognizeSingleGlyph(strokes) {
    return recognizeSingleGlyphDetailed(strokes).char;
  }

  function recognizeSimpleStrokesDetailed(strokesOverride = null, contextOverride = null) {
    const activeStrokes = Array.isArray(strokesOverride) ? strokesOverride : getActiveStrokes();
    const segments = segmentStrokesForText(activeStrokes);
    if (!segments.length) {
      return { text: "", strokeCount: activeStrokes.length, segmentCount: 0, segments: [] };
    }

    const segmentDetails = segments.map((segment, index) => {
      const detail = recognizeSingleGlyphDetailed(segment);
      return {
        index: index + 1,
        char: detail.char || "",
        source: detail.source || "none",
        accepted: Boolean(detail.char),
        score: detail.score || 0,
        candidates: detail.candidates || [],
        bounds: detail.bounds || boundsForStrokes(segment),
        strokeCount: segment.length,
      };
    });

    const contextBefore = contextOverride === null ? getRecognitionContextText() : safeText(contextOverride);
    applyCapitalizationContext(segmentDetails, contextBefore);

    const recognizedCount = segmentDetails.filter((detail) => detail.char).length;
    let text = "";
    if (segments.length > 1 && recognizedCount > 0) {
      text = segmentDetails.map((detail) => detail.char || "?").join("");
    } else {
      const rawDetail = recognizeSingleGlyphDetailed(activeStrokes);
      const detail = applyCapitalizationContextToDetail(rawDetail, contextBefore);
      text = detail.char || "";
      if (segmentDetails.length === 1) {
        segmentDetails[0] = {
          ...segmentDetails[0],
          char: detail.char || "",
          source: detail.source || segmentDetails[0].source,
          accepted: Boolean(detail.char),
          score: detail.score || 0,
          candidates: detail.candidates || [],
          bounds: detail.bounds || segmentDetails[0].bounds,
        };
      }
    }

    return {
      text,
      strokeCount: activeStrokes.length,
      segmentCount: segments.length,
      segments: segmentDetails,
    };
  }

  function recognizeSimpleStrokes() {
    return recognizeSimpleStrokesDetailed().text;
  }


  function startDraw(e) {
    if (drawing) endDraw(e);
    recognitionRequests.invalidate();
    clearTimeout(liveTimer);
    clearTimeout(debugRefreshTimer);
    liveTimer = 0;
    debugRefreshTimer = 0;
    drawing = true;
    if (typeof canvas.setPointerCapture === "function" && e?.pointerId !== undefined) {
      try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    }
    const p = getPoint(e);
    currentStroke = tool === "pen" ? [p] : null;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    if (tool === "pen") {
      hasInk = true;
      ctx.save();
      ctx.fillStyle = DEFAULT_FG;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(1, ctx.lineWidth * 0.5), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      setStroke();
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
    }
    e.preventDefault?.();
  }
  function moveDraw(e) {
    if (!drawing) return;
    const p = getPoint(e);
    if (currentStroke) currentStroke.push(p);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    hasInk = true;
    scheduleLiveRecognition(LIVE_RECOGNITION_MOVE_DELAY_MS);
    e.preventDefault?.();
  }
  function endDraw(e = null) {
    if (drawing && currentStroke?.length) penStrokes.push(currentStroke);
    currentStroke = null;
    if (drawing) {
      scheduleLiveRecognition(LIVE_RECOGNITION_STROKE_DELAY_MS);
      schedulePanelAnalysisRefresh("drawing");
    }
    if (typeof canvas.releasePointerCapture === "function" && e?.pointerId !== undefined) {
      try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
    }
    drawing = false;
  }

  const onResize = () => resizeCanvasKeepContent();
  const usePointerEvents = typeof window.PointerEvent === "function";
  if (usePointerEvents) {
    canvas.addEventListener("pointerdown", startDraw);
    canvas.addEventListener("pointermove", moveDraw);
    window.addEventListener("pointerup", endDraw);
    window.addEventListener("pointercancel", endDraw);
  } else {
    canvas.addEventListener("mousedown", startDraw);
    canvas.addEventListener("mousemove", moveDraw);
    window.addEventListener("mouseup", endDraw);
    canvas.addEventListener("touchstart", startDraw, { passive: false });
    canvas.addEventListener("touchmove", moveDraw, { passive: false });
    window.addEventListener("touchend", endDraw);
    window.addEventListener("touchcancel", endDraw);
  }

  window.addEventListener("resize", onResize);
  window.addEventListener("blur", endDraw);
  sizeInput.addEventListener("input", () => {
    setStroke();
    refreshDebugFromStrokes("settings");
  });
  thresholdInput.addEventListener("input", () => {
    scheduleLiveRecognition(260);
    refreshDebugFromStrokes("settings");
  });

  penBtn.addEventListener("click", () => {
    tool = "pen";
    penBtn.classList.add("active");
    eraserBtn.classList.remove("active");
    penBtn.setAttribute("aria-selected", "true");
    eraserBtn.setAttribute("aria-selected", "false");
    setStroke();
  });
  eraserBtn.addEventListener("click", () => {
    tool = "eraser";
    eraserBtn.classList.add("active");
    penBtn.classList.remove("active");
    penBtn.setAttribute("aria-selected", "false");
    eraserBtn.setAttribute("aria-selected", "true");
    setStroke();
  });

  clearBtn.addEventListener("click", () => {
    recognitionRequests.invalidate();
    clearTimeout(liveTimer);
    clearTimeout(debugRefreshTimer);
    liveTimer = 0;
    debugRefreshTimer = 0;
    fillCanvas(ctx, canvas, DEFAULT_BG);
    setStroke();
    hasInk = false;
    penStrokes = [];
    currentStroke = null;
    lastLiveText = "";
    outText.value = "";
    bar.style.width = "0%";
    status.textContent = "";
    setDebugState("clear", "", { text: "", strokeCount: 0, segmentCount: 0, segments: [] });
    if (typeof onLiveText === "function") onLiveText("");
  });

  copyBtn.addEventListener("click", async () => {
    const text = safeText(outText.value).trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch (_) {
      outText.select();
      document.execCommand?.("copy");
    }
  });

  insertBtn.addEventListener("click", () => {
    const text = safeText(outText.value).trim();
    if (!text) return;
    if (typeof onInsertText === "function") {
      onInsertText(text);
    } else {
      document.execCommand?.("insertText", false, text);
    }
  });

  savePngBtn.addEventListener("click", () => {
    const link = document.createElement("a");
    link.download = "handwriting.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  });

  debugInput.addEventListener("change", () => {
    if (debugInput.checked) {
      refreshDebugFromStrokes("debug");
      return;
    }
    updateDebugView();
  });

  correctionInput.addEventListener("change", () => {
    if (correctionInput.checked) {
      loadTrainingSamples();
      updateCorrectionView();
      return;
    }
    updateCorrectionView();
  });

  refreshDebugBtn.addEventListener("click", () => {
    debugInput.checked = true;
    refreshDebugFromStrokes("manual");
  });
  copyDebugBtn.addEventListener("click", async () => {
    await ensureHandwritingFontLoaded();
    const detail = recognizeSimpleStrokesDetailed();
    const state = makeDebugState("manual", detail.text, detail);
    lastDebugState = state;
    updateDebugView(state);
    await copyDebugText(JSON.stringify(state, null, 2));
    status.textContent = "Debug JSON copied.";
  });
  copyStrokesBtn.addEventListener("click", async () => {
    await copyDebugText(JSON.stringify(serializeStrokesForDebug(), null, 2));
    status.textContent = "Stroke JSON copied.";
  });

  editorCorrectionBtn.addEventListener("click", () => {
    saveEditorCorrection();
  });

  async function ensureNativeRecognizer() {
    if (nativeRecognizer) return nativeRecognizer;
    if (nativeRecognizerPromise) return nativeRecognizerPromise;
    if (typeof navigator?.createHandwritingRecognizer !== "function") return null;
    if (typeof window.HandwritingStroke !== "function") return null;

    nativeRecognizerPromise = navigator
      .createHandwritingRecognizer({ languages: ["en"] })
      .then((recognizer) => {
        nativeRecognizer = recognizer;
        return recognizer;
      })
      .catch((err) => {
        console.warn("[HandwritingOcrPanel] native handwriting recognition unavailable:", err);
        nativeRecognizerPromise = null;
        nativeRecognizer = null;
        return null;
      });

    return nativeRecognizerPromise;
  }

  async function recognizeNativeHandwriting(strokesSnapshot = null, signal = null) {
    const recognizer = await ensureNativeRecognizer();
    if (signal?.aborted) return "";
    if (!recognizer?.startDrawing) return "";
    const strokes = Array.isArray(strokesSnapshot) ? strokesSnapshot : (currentStroke?.length ? [...penStrokes, currentStroke] : penStrokes);
    if (!strokes.length) return "";

    const drawing = recognizer.startDrawing({ recognitionType: "text" });
    for (const stroke of strokes) {
      if (!stroke?.length) continue;
      const nativeStroke = new window.HandwritingStroke();
      stroke.forEach((point, index) => {
        nativeStroke.addPoint({ x: point.x, y: point.y, t: Number.isFinite(point.t) ? point.t : index * 16 });
      });
      drawing.addStroke(nativeStroke);
    }

    const predictions = await drawing.getPrediction();
    drawing.clear?.();
    return safeText(predictions?.[0]?.text || "").trim();
  }


  async function configureWorker(wk) {
    try {
      await wk?.setParameters?.({
        tessedit_pageseg_mode: "7",
        preserve_interword_spaces: "1",
      });
    } catch (err) {
      console.warn("[HandwritingOcrPanel] failed to configure OCR worker:", err);
    }
  }

  async function ensureWorker() {
    if (worker) return worker;
    if (workerPromise) return workerPromise;

    workerPromise = (async () => {
      const Tesseract = await ensureTesseract();
      const logger = (m) => {
        if (m?.status === "recognizing text" && typeof m.progress === "number") {
          bar.style.width = `${Math.round(m.progress * 100)}%`;
        }
      };
      const baseOptions = {
        workerPath: "/Tesseract/worker.min.js",
        corePath: "/Tesseract/tesseract-core-simd.wasm.js",
        cacheMethod: "readwrite",
        logger,
      };

      try {
        status.textContent = "Loading local OCR data...";
        worker = await Tesseract.createWorker("eng", 1, {
          ...baseOptions,
          langPath: "/Tesseract/lang-data",
        });
        await configureWorker(worker);
        return worker;
      } catch (localErr) {
        console.warn("[HandwritingOcrPanel] local OCR data unavailable, trying online language data:", localErr);
        status.textContent = "Local OCR data unavailable; trying online OCR data...";
        if (!safeText(outText.value).trim()) {
          outText.value = `${describeOfflineRequirement()}\nTrying online OCR language data...`;
        }
        worker = await Tesseract.createWorker("eng", 1, baseOptions);
        await configureWorker(worker);
        return worker;
      }
    })().catch((err) => {
      workerPromise = null;
      worker = null;
      throw err;
    });

    return workerPromise;
  }

  function emitLiveText(text) {
    const clean = safeText(text || "").trim();
    if (clean === lastLiveText) return;
    lastLiveText = clean;
    if (typeof onLiveText === "function") onLiveText(clean);
  }

  function scheduleLiveRecognition(delay = 520) {
    if (!liveInput.checked || !hasInk) return;
    if (!recognizing) status.textContent = "Ink captured; reading shortly...";
    lastLiveScheduleAt = Date.now();
    const actualDelay = delay;
    clearTimeout(liveTimer);
    liveTimer = window.setTimeout(() => {
      liveTimer = 0;
      recognizeCanvas({ live: true });
    }, actualDelay);
  }

  async function recognizeCanvas({ live = false } = {}) {
    if (!hasInk && live) return;
    if (recognizing) {
      queuedRecognition = true;
      return;
    }

    const request = recognitionRequests.begin();
    const strokesSnapshot = cloneStrokesForRecognition();
    const contextBefore = getRecognitionContextText();
    let customDetail = null;

    recognizing = true;
    recognizeBtn.disabled = true;
    if (!live) outText.value = "Recognizing...";
    status.textContent = live ? "Reading handwriting..." : "Recognizing handwriting...";
    bar.style.width = "0%";

    const engines = [
      {
        name: "browser-native",
        stopOnSuccess: true,
        available: () => !live && typeof navigator !== "undefined" && typeof navigator.createHandwritingRecognizer === "function" && typeof window !== "undefined" && typeof window.HandwritingStroke === "function",
        run: async ({ signal }) => {
          const text = await recognizeNativeHandwriting(strokesSnapshot, signal);
          return {
            engine: "browser-native",
            status: text ? "success" : "empty",
            candidates: text ? [{ text, score: 0.78, evidence: { source: "browser-native" } }] : [],
          };
        },
      },
      {
        name: "nodevision-custom",
        stopOnSuccess: true,
        available: () => strokesSnapshot.some((stroke) => stroke.length),
        run: async ({ signal }) => {
          if (live) {
            if (!isHandwritingFontReady()) {
              ensureHandwritingFontLoaded().then((loaded) => {
                if (!loaded || !root.isConnected) return;
                simpleLetterTemplates = null;
                simpleLetterTemplateKey = "";
              });
            }
            if (!trainingSamplesLoaded && !trainingLoadPromise) loadTrainingSamples();
          } else {
            await ensureHandwritingFontLoaded();
            await loadTrainingSamples();
          }
          if (signal?.aborted) return { engine: "nodevision-custom", status: "cancelled", candidates: [] };
          customDetail = recognizeSimpleStrokesDetailed(strokesSnapshot, contextBefore);
          const segmentCandidates = customDetail.segmentCount === 1 ? (customDetail.segments?.[0]?.candidates || []) : [];
          const fallbackScore = customDetail.segments?.length
            ? customDetail.segments.reduce((total, segment) => total + (Number(segment.score) || 0), 0) / customDetail.segments.length
            : 0.64;
          const candidates = segmentCandidates.length
            ? segmentCandidates.map((candidate) => ({ ...candidate, engine: "nodevision-custom" }))
            : (customDetail.text ? [{ text: customDetail.text, char: customDetail.text, score: Math.max(0.01, Math.min(1, fallbackScore)), evidence: { segmentCount: customDetail.segmentCount } }] : []);
          return {
            engine: "nodevision-custom",
            status: customDetail.text ? "success" : "empty",
            candidates,
            detail: customDetail,
          };
        },
      },
      {
        name: "tesseract",
        stopOnSuccess: true,
        available: () => !live,
        run: async ({ signal }) => {
          if (signal?.aborted) return { engine: "tesseract", status: "cancelled", candidates: [] };
          const threshold = Number(thresholdInput.value || "180");
          const bin = binarizeCanvas(canvas, threshold);
          const wk = await ensureWorker();
          if (signal?.aborted) return { engine: "tesseract", status: "cancelled", candidates: [] };
          const { data } = await wk.recognize(bin);
          const text = safeText(data?.text || "").trim();
          const confidence = Math.max(0.01, Math.min(0.72, Number(data?.confidence || 50) / 100));
          return {
            engine: "tesseract",
            status: text ? "success" : "empty",
            candidates: text ? [{ text, score: confidence, evidence: { source: "tesseract" } }] : [],
          };
        },
      },
    ];

    try {
      const finalResult = await coordinateHandwritingRecognition({
        engines,
        context: { before: contextBefore },
        signal: request.signal,
        requestId: request.id,
      });
      if (!recognitionRequests.isActive(request)) return;

      const text = safeText(finalResult.text || "").trim();
      if (!text && live) {
        status.textContent = "Add more strokes, or use Recognize Text for OCR.";
        return;
      }

      outText.value = text || "(no text detected)";
      if (finalResult.selectedEngine === "nodevision-custom" && customDetail) {
        setDebugState("stroke", text, customDetail, { recognition: finalResult });
      } else {
        setDebugState(finalResult.selectedEngine || "none", text, { text, strokeCount: strokesSnapshot.length, segmentCount: 0, segments: [] }, { recognition: finalResult });
      }
      if (text && (liveInput.checked || live)) emitLiveText(text);
      bar.style.width = "100%";
      if (finalResult.selectedEngine === "browser-native") status.textContent = "Text updated from native handwriting recognition.";
      else if (finalResult.selectedEngine === "nodevision-custom") status.textContent = "Text updated from handwriting strokes.";
      else if (finalResult.selectedEngine === "tesseract") status.textContent = text ? "Text updated in the editor." : "No text detected yet.";
      else status.textContent = "No text detected yet.";
      setTimeout(() => { if (recognitionRequests.isActive(request)) bar.style.width = "0%"; }, 900);
    } catch (err) {
      if (!recognitionRequests.isActive(request) || err?.name === "AbortError") return;
      console.warn("[HandwritingOcrPanel] recognition failed:", err);
      const msg = err?.message ? String(err.message) : String(err);
      if (live) {
        if (!isHandwritingFontReady()) ensureHandwritingFontLoaded();
        if (!trainingSamplesLoaded && !trainingLoadPromise) loadTrainingSamples();
      } else {
        await ensureHandwritingFontLoaded();
        await loadTrainingSamples();
      }
      if (!recognitionRequests.isActive(request)) return;
      const strokeDetail = recognizeSimpleStrokesDetailed(strokesSnapshot, contextBefore);
      const strokeText = strokeDetail.text;
      if (strokeText) {
        setDebugState("stroke-fallback", strokeText, strokeDetail, { error: msg });
        outText.value = strokeText;
        if (liveInput.checked || live) emitLiveText(strokeText);
        status.textContent = "Text updated from handwriting strokes.";
      } else {
        setDebugState("error", "", null, { error: msg });
        outText.value = "Recognition error: " + msg + "\n\n" + describeOfflineRequirement();
        status.textContent = "Recognition failed.";
      }
      bar.style.width = "0%";
    } finally {
      if (recognitionRequests.isActive(request)) {
        recognizing = false;
        recognizeBtn.disabled = false;
      } else {
        recognizing = false;
        recognizeBtn.disabled = false;
      }
      if (queuedRecognition) {
        queuedRecognition = false;
        scheduleLiveRecognition(LIVE_RECOGNITION_STROKE_DELAY_MS);
      }
    }
  }

  recognizeBtn.addEventListener("click", () => {
    clearTimeout(liveTimer);
    liveTimer = 0;
    recognizeCanvas({ live: false });
  });

  liveInput.addEventListener("change", () => {
    if (liveInput.checked) {
      scheduleLiveRecognition(160);
      return;
    }
    recognitionRequests.invalidate();
    if (typeof onLiveText === "function") {
      lastLiveText = "";
      onLiveText("");
    }
  });

  status.textContent = "Ready.";
  loadTrainingSamples();
  preloadTimer = window.setTimeout(() => {
    ensureHandwritingFontLoaded().then((loaded) => {
      if (!loaded || !root.isConnected) return;
      simpleLetterTemplates = null;
      simpleLetterTemplateKey = "";
      refreshDebugFromStrokes("font");
    });
  }, 60);

  setStroke();
  resizeCanvasKeepContent();

  const api = {
    dispose: async () => {
      recognitionRequests.invalidate();
      clearTimeout(liveTimer);
      clearTimeout(debugRefreshTimer);
      clearTimeout(preloadTimer);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("blur", endDraw);
      if (usePointerEvents) {
        canvas.removeEventListener("pointerdown", startDraw);
        canvas.removeEventListener("pointermove", moveDraw);
        window.removeEventListener("pointerup", endDraw);
        window.removeEventListener("pointercancel", endDraw);
      } else {
        canvas.removeEventListener("mousedown", startDraw);
        canvas.removeEventListener("mousemove", moveDraw);
        window.removeEventListener("mouseup", endDraw);
        canvas.removeEventListener("touchstart", startDraw);
        canvas.removeEventListener("touchmove", moveDraw);
        window.removeEventListener("touchend", endDraw);
        window.removeEventListener("touchcancel", endDraw);
      }
      try {
        await worker?.terminate?.();
      } catch (_) {
        // ignore
      }
      worker = null;
      workerPromise = null;
      try {
        nativeRecognizer?.finish?.();
      } catch (_) {
        // ignore
      }
      nativeRecognizer = null;
      nativeRecognizerPromise = null;
      if (root.parentNode === container) root.remove();
    }
  };

  return api;
}

export async function setupPanel(panel, panelVars = {}) {
  panel.style.display = "flex";
  panel.style.flexDirection = "column";
  panel.style.minHeight = "0";
  panel.style.overflow = "hidden";

  const api = mountHandwritingOcrPanel(panel, panelVars);
  panel.cleanup = async () => {
    await api?.dispose?.();
  };
}

export function openHandwritingOcrPanel(options = {}) {
  injectStylesOnce();

  const existing = window[PANEL_KEY];
  if (existing?.setVisible) {
    existing.setVisible(true);
    return existing;
  }

  let innerApi = null;
  const floating = createFloatingInventoryPanel({
    title: options.title || "Handwriting -> Text",
    onRequestClose: () => floating.setVisible(false)
  });

  innerApi = mountHandwritingOcrPanel(floating.content, options);

  const api = {
    setVisible: (visible) => floating.setVisible(visible),
    dispose: async () => {
      try {
        await innerApi?.dispose?.();
      } finally {
        floating.dispose();
        delete window[PANEL_KEY];
      }
    }
  };

  window[PANEL_KEY] = api;
  return api;
}
