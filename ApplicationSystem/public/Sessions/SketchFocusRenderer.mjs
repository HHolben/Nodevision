// Nodevision/ApplicationSystem/public/Sessions/SketchFocusRenderer.mjs
// This module draws Sketch Focus paper and graphite strokes to canvas with deterministic grain, pressure-responsive widths, and resize-friendly replay from the stroke model.

import { tiltBroadening } from "./SketchFocusModel.mjs";

export const PAPER_BASE = "#f1f1ee";

export function resizeCanvasForDisplay(canvas, width, height, dpr = globalThis.devicePixelRatio || 1) {
  const cssWidth = Math.max(1, Math.floor(width || canvas.clientWidth || 1));
  const cssHeight = Math.max(1, Math.floor(height || canvas.clientHeight || 1));
  const scale = Math.max(1, Math.min(4, Number(dpr) || 1));
  canvas.style.width = cssWidth + "px";
  canvas.style.height = cssHeight + "px";
  canvas.width = Math.round(cssWidth * scale);
  canvas.height = Math.round(cssHeight * scale);
  const ctx = canvas.getContext("2d", { alpha: true });
  ctx?.setTransform(scale, 0, 0, scale, 0, 0);
  return { width: cssWidth, height: cssHeight, dpr: scale };
}

export function drawPaper(ctx, width, height) {
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = PAPER_BASE;
  ctx.fillRect(0, 0, width, height);
  for (let y = 0; y < height; y += 9) {
    for (let x = 0; x < width; x += 9) {
      const n = valueNoise(x, y, 9127);
      const shade = 236 + Math.round(n * 10);
      ctx.fillStyle = `rgba(${shade}, ${shade}, ${shade}, 0.10)`;
      ctx.fillRect(x, y, 10, 10);
    }
  }
  ctx.restore();
}

export function renderSketchToCanvas(canvas, sketch, options = {}) {
  const scale = Math.max(0.1, Number(options.scale || 1));
  const width = Math.max(1, Math.round((sketch.width || 1) * scale));
  const height = Math.max(1, Math.round((sketch.height || 1) * scale));
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: options.alpha !== false });
  if (!ctx) return canvas;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  drawPaper(ctx, sketch.width, sketch.height);
  const graphite = createLayer(sketch.width, sketch.height);
  renderStrokes(graphite.getContext("2d"), sketch.strokes || []);
  ctx.drawImage(graphite, 0, 0);
  return canvas;
}

export function replaySketch(ctx, sketch, width, height) {
  ctx.clearRect(0, 0, width, height);
  renderStrokes(ctx, sketch.strokes || []);
  if (sketch.activeStroke) drawStroke(ctx, sketch.activeStroke);
}

export function renderStrokes(ctx, strokes) {
  if (!ctx) return;
  for (const stroke of strokes || []) drawStroke(ctx, stroke);
}

export function drawStroke(ctx, stroke) {
  const samples = stroke?.samples || [];
  if (!ctx || samples.length === 0) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (stroke.tool === "eraser") ctx.globalCompositeOperation = "destination-out";
  for (let i = 1; i < samples.length; i += 1) drawSegment(ctx, stroke, samples[i - 1], samples[i], i);
  if (samples.length === 1) drawDot(ctx, stroke, samples[0]);
  ctx.restore();
}

function drawSegment(ctx, stroke, a, b, segmentIndex) {
  const width = segmentWidth(stroke, a, b);
  const passes = stroke.tool === "eraser" ? 1 : 3;
  for (let pass = 0; pass < passes; pass += 1) {
    const jitter = stroke.tool === "eraser" ? { x: 0, y: 0 } : jitterFor(stroke.seed, segmentIndex, pass, stroke.grain);
    ctx.beginPath();
    ctx.moveTo(a.x + jitter.x, a.y + jitter.y);
    ctx.lineTo(b.x + jitter.x, b.y + jitter.y);
    ctx.lineWidth = width * (stroke.tool === "eraser" ? 1.6 : 1 - pass * 0.16);
    const alpha = stroke.tool === "eraser" ? 1 : Math.max(0.025, stroke.opacity / passes);
    ctx.strokeStyle = stroke.tool === "eraser" ? `rgba(0,0,0,${alpha})` : `rgba(${stroke.gray},${stroke.gray},${stroke.gray},${alpha})`;
    ctx.stroke();
  }
}

function drawDot(ctx, stroke, sample) {
  ctx.beginPath();
  const radius = Math.max(0.5, stroke.size * sample.pressure * 0.5);
  ctx.arc(sample.x, sample.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = stroke.tool === "eraser" ? "rgba(0,0,0,1)" : `rgba(${stroke.gray},${stroke.gray},${stroke.gray},${stroke.opacity})`;
  ctx.fill();
}

function segmentWidth(stroke, a, b) {
  const pressure = Math.max(0.05, ((a.pressure || 0.35) + (b.pressure || 0.35)) / 2);
  return Math.max(0.4, stroke.size * (0.45 + pressure * 0.9) * ((tiltBroadening(a) + tiltBroadening(b)) / 2));
}

function jitterFor(seed, index, pass, grain) {
  const amount = Math.max(0, Math.min(1, Number(grain || 0))) * 0.9;
  const a = random01(seed + index * 92821 + pass * 68917) - 0.5;
  const b = random01(seed + index * 19391 + pass * 37441) - 0.5;
  return { x: a * amount, y: b * amount };
}

function random01(value) {
  let x = value >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return (x >>> 0) / 4294967295;
}

function valueNoise(x, y, seed) {
  return random01(((x * 73856093) ^ (y * 19349663) ^ seed) >>> 0);
}

function createLayer(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width || 1));
  canvas.height = Math.max(1, Math.round(height || 1));
  return canvas;
}
