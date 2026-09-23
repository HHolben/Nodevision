// Nodevision/ApplicationSystem/public/Sessions/SketchFocusSvgExport.mjs
// This module serializes Sketch Focus stroke models as standalone grayscale SVG files with vector paths and a subtle paper background.

import { PAPER_BASE } from "./SketchFocusRenderer.mjs";

const PROFILES = Object.freeze({
  faithful: { precision: 2, tolerance: 0 },
  balanced: { precision: 1, tolerance: 0.75 },
  compact: { precision: 0, tolerance: 1.8 },
});

export function serializeSketchSvg(sketch, options = {}) {
  const profile = PROFILES[String(options.profile || "balanced").toLowerCase()] || PROFILES.balanced;
  const width = Math.max(1, Math.round(sketch.width || 1));
  const height = Math.max(1, Math.round(sketch.height || 1));
  const paths = (sketch.strokes || []).map((stroke) => strokeToPath(stroke, profile)).filter(Boolean).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img">
  <title>${escapeXml(options.title || "Sketch Focus drawing")}</title>
  <defs>
    <filter id="paperCloud" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="2" seed="17" result="noise"/>
      <feColorMatrix in="noise" type="matrix" values="0.04 0 0 0 0.92 0 0.04 0 0 0.92 0 0 0.04 0 0.92 0 0 0 0.16 0"/>
    </filter>
  </defs>
  <rect width="100%" height="100%" fill="${PAPER_BASE}"/>
  <rect width="100%" height="100%" filter="url(#paperCloud)" opacity="0.35"/>
${paths}
</svg>
`;
}

export function strokeToPath(stroke = {}, profile = PROFILES.balanced) {
  const samples = simplifySamples(stroke.samples || [], profile.tolerance);
  if (!samples.length) return "";
  const path = samples.length === 1
    ? dotPath(samples[0], stroke.size || 2, profile.precision)
    : polyPath(samples, profile.precision);
  const width = strokeWidth(stroke, samples);
  const gray = stroke.tool === "eraser" ? 241 : clampByte(stroke.gray);
  const opacity = stroke.tool === "eraser" ? 0.92 : Math.max(0.04, Math.min(1, Number(stroke.opacity || 0.4)));
  return `  <path d="${path}" fill="none" stroke="rgb(${gray},${gray},${gray})" stroke-width="${fmt(width, profile.precision)}" stroke-linecap="round" stroke-linejoin="round" opacity="${fmt(opacity, 2)}"/>`;
}

export function simplifySamples(samples = [], tolerance = 0) {
  if (samples.length <= 2 || tolerance <= 0) return samples.map((sample) => ({ ...sample }));
  const keep = new Set([0, samples.length - 1]);
  simplifyRange(samples, 0, samples.length - 1, tolerance, keep);
  return [...keep].sort((a, b) => a - b).map((index) => ({ ...samples[index] }));
}

function simplifyRange(points, start, end, tolerance, keep) {
  let maxDistance = 0;
  let maxIndex = -1;
  for (let i = start + 1; i < end; i += 1) {
    const distance = pointLineDistance(points[i], points[start], points[end]);
    if (distance > maxDistance) {
      maxDistance = distance;
      maxIndex = i;
    }
  }
  if (maxDistance <= tolerance || maxIndex < 0) return;
  keep.add(maxIndex);
  simplifyRange(points, start, maxIndex, tolerance, keep);
  simplifyRange(points, maxIndex, end, tolerance, keep);
}

function pointLineDistance(point, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) return Math.hypot(point.x - a.x, point.y - a.y);
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

function polyPath(samples, precision) {
  const [first, ...rest] = samples;
  return `M ${fmt(first.x, precision)} ${fmt(first.y, precision)} ` + rest.map((sample) => `L ${fmt(sample.x, precision)} ${fmt(sample.y, precision)}`).join(" ");
}

function dotPath(sample, size, precision) {
  const r = Math.max(0.5, Number(size || 2) * 0.5);
  return `M ${fmt(sample.x - r, precision)} ${fmt(sample.y, precision)} a ${fmt(r, precision)} ${fmt(r, precision)} 0 1 0 ${fmt(r * 2, precision)} 0 a ${fmt(r, precision)} ${fmt(r, precision)} 0 1 0 ${fmt(-r * 2, precision)} 0`;
}

function strokeWidth(stroke, samples) {
  const pressure = samples.reduce((sum, sample) => sum + Number(sample.pressure || 0.35), 0) / Math.max(1, samples.length);
  return Math.max(0.4, Number(stroke.size || 4) * (0.55 + pressure * 0.75));
}

function fmt(value, precision) {
  return Number(value || 0).toFixed(precision).replace(/\.?0+$/, "");
}

function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(Number(value || 0))));
}

function escapeXml(value) {
  return String(value || "").replace(/[<>&"']/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "\"": "&quot;", "'": "&apos;" }[char]));
}
