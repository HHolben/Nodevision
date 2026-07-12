// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/VectorBrushRenderer.mjs
// Converts normalized/stabilized pointer samples into editable SVG vector brush geometry.

import { pointsToPathD, stabilizeStroke } from "./StrokeStabilizer.mjs";
import { getBrushPreset, VECTOR_BRUSH_SCHEMA_VERSION } from "./VectorBrushPresets.mjs";

const EPSILON = 1e-9;

function clamp(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function fmt(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  return String(Number(n.toFixed(4)));
}

function finiteSamples(samples = []) {
  return (Array.isArray(samples) ? samples : [])
    .map((sample) => ({
      ...sample,
      x: Number(sample?.x),
      y: Number(sample?.y),
      pressure: clamp(sample?.pressure, 0.02, 1, 0.5),
      velocity: Math.max(0, Number(sample?.velocity) || 0),
      tiltX: clamp(sample?.tiltX, -90, 90, 0),
      tiltY: clamp(sample?.tiltY, -90, 90, 0),
      twist: clamp(sample?.twist, 0, 359, 0),
    }))
    .filter((sample) => Number.isFinite(sample.x) && Number.isFinite(sample.y));
}

function tangentAt(samples, index) {
  const prev = samples[Math.max(0, index - 1)];
  const next = samples[Math.min(samples.length - 1, index + 1)];
  const dx = (next?.x ?? 0) - (prev?.x ?? 0);
  const dy = (next?.y ?? 0) - (prev?.y ?? 0);
  const len = Math.hypot(dx, dy);
  if (!Number.isFinite(len) || len <= EPSILON) return { x: 1, y: 0 };
  return { x: dx / len, y: dy / len };
}

function normalAt(samples, index, preset) {
  const tangent = tangentAt(samples, index);
  let nx = -tangent.y;
  let ny = tangent.x;
  const tipAspect = clamp(preset.tip?.aspect, 0.05, 2, 1);
  const baseAngle = ((Number(preset.tip?.angle) || 0) * Math.PI) / 180;
  const sample = samples[index] || {};
  const tiltAngle = Math.atan2(Number(sample.tiltY) || 0, Number(sample.tiltX) || 0);
  const twistAngle = ((Number(sample.twist) || 0) * Math.PI) / 180;
  const dynamicAngle = baseAngle +
    tiltAngle * clamp(preset.dynamics?.tiltToAngle, 0, 1, 0) +
    twistAngle * clamp(preset.dynamics?.twistToRotation, 0, 1, 0);
  if (Math.abs(dynamicAngle) > EPSILON || Math.abs(tipAspect - 1) > EPSILON) {
    const cos = Math.cos(dynamicAngle);
    const sin = Math.sin(dynamicAngle);
    const rx = nx * cos - ny * sin;
    const ry = nx * sin + ny * cos;
    const len = Math.hypot(rx, ry * tipAspect);
    if (len > EPSILON) {
      nx = rx / len;
      ny = (ry * tipAspect) / len;
    }
  }
  return { x: nx, y: ny };
}

function sampleWidth(sample, index, count, preset, settings) {
  const baseSize = clamp(settings.brushSize, 0.1, 2048, preset.size);
  const pressure = clamp(sample.pressure, 0.02, 1, 0.5);
  const pressureToWidth = clamp(preset.dynamics?.pressureToWidth, 0, 1, 0);
  const speedToWidth = clamp(preset.dynamics?.speedToWidth, 0, 1, 0);
  const minRatio = clamp(preset.minWidthRatio, 0.01, 4, 0.2);
  const maxRatio = Math.max(minRatio, clamp(preset.maxWidthRatio, 0.01, 6, 1));
  const pressureRatio = minRatio + (maxRatio - minRatio) * pressure;
  const pressureFactor = 1 - pressureToWidth + pressureToWidth * pressureRatio;
  const speedNorm = clamp((Number(sample.velocity) || 0) / 1.8, 0, 1, 0);
  const speedFactor = 1 - speedToWidth * speedNorm * 0.72;
  let taperFactor = 1;
  const t = count <= 1 ? 0 : index / (count - 1);
  const startTaper = clamp(preset.taper?.start, 0, 1, 0);
  const endTaper = clamp(preset.taper?.end, 0, 1, 0);
  if (startTaper > 0 && t < startTaper) taperFactor *= clamp(t / Math.max(startTaper, EPSILON), 0.04, 1, 1);
  if (endTaper > 0 && t > 1 - endTaper) taperFactor *= clamp((1 - t) / Math.max(endTaper, EPSILON), 0.04, 1, 1);
  return clamp(baseSize * pressureFactor * speedFactor * taperFactor, baseSize * minRatio, baseSize * maxRatio, baseSize);
}

function averageOpacity(samples, preset, settings) {
  const base = clamp(settings.brushOpacity, 0.01, 1, preset.opacity);
  const pressureToOpacity = clamp(preset.dynamics?.pressureToOpacity, 0, 1, 0);
  if (!samples.length || pressureToOpacity <= EPSILON) return base;
  const avgPressure = samples.reduce((acc, sample) => acc + clamp(sample.pressure, 0.02, 1, 0.5), 0) / samples.length;
  return clamp(base * (1 - pressureToOpacity + pressureToOpacity * avgPressure), 0.01, 1, base);
}

function outlinePathD(samples, preset, settings) {
  const list = finiteSamples(samples);
  if (!list.length) return "";
  if (list.length === 1) {
    const w = sampleWidth(list[0], 0, 1, preset, settings) / 2;
    return `M ${fmt(list[0].x - w)} ${fmt(list[0].y)} A ${fmt(w)} ${fmt(w)} 0 1 0 ${fmt(list[0].x + w)} ${fmt(list[0].y)} A ${fmt(w)} ${fmt(w)} 0 1 0 ${fmt(list[0].x - w)} ${fmt(list[0].y)} Z`;
  }
  const left = [];
  const right = [];
  list.forEach((sample, index) => {
    const n = normalAt(list, index, preset);
    const half = sampleWidth(sample, index, list.length, preset, settings) / 2;
    left.push({ x: sample.x + n.x * half, y: sample.y + n.y * half });
    right.push({ x: sample.x - n.x * half, y: sample.y - n.y * half });
  });
  const start = left[0];
  let d = `M ${fmt(start.x)} ${fmt(start.y)}`;
  for (let i = 1; i < left.length; i += 1) d += ` L ${fmt(left[i].x)} ${fmt(left[i].y)}`;
  for (let i = right.length - 1; i >= 0; i -= 1) d += ` L ${fmt(right[i].x)} ${fmt(right[i].y)}`;
  return `${d} Z`;
}

function metadataAttrs(samples, preset, centerlineD, representation) {
  const compact = finiteSamples(samples).slice(0, 512).map((sample) => [
    Number(sample.x.toFixed(3)),
    Number(sample.y.toFixed(3)),
    Number(clamp(sample.pressure, 0.02, 1, 0.5).toFixed(3)),
  ]);
  return {
    "data-nv-vector-brush": representation,
    "data-nv-brush-schema-version": String(VECTOR_BRUSH_SCHEMA_VERSION),
    "data-nv-brush-preset": preset.id,
    "data-nv-brush-centerline": centerlineD,
    "data-nv-brush-samples": JSON.stringify(compact),
  };
}

export function buildVectorBrushSpec(samples = [], style = {}, settings = {}, options = {}) {
  const raw = finiteSamples(samples);
  const preset = options.preset || getBrushPreset(settings.defaultBrushPreset);
  const stabilized = options.stabilizedSamples
    ? finiteSamples(options.stabilizedSamples)
    : stabilizeStroke(raw, {
      mode: settings.stabilizationMode,
      strength: settings.stabilizationStrength,
      smoothing: settings.smoothing,
      minimumPointDistance: settings.minimumPointDistance,
      curveSimplification: settings.curveSimplification,
      preserveCorners: settings.preserveCorners,
    }).samples;
  const list = finiteSamples(stabilized);
  if (!list.length) return null;
  const stroke = style.stroke || style.fill || "#000000";
  const centerlineD = pointsToPathD(list);
  const opacity = averageOpacity(list, preset, settings);

  if (preset.representation === "centerline" || list.length < 2) {
    const width = clamp(settings.brushSize, 0.1, 2048, preset.size);
    return {
      tag: "path",
      attrs: {
        d: centerlineD,
        fill: "none",
        stroke,
        "stroke-width": fmt(width),
        "stroke-linecap": preset.stroke.linecap,
        "stroke-linejoin": preset.stroke.linejoin,
        "stroke-opacity": fmt(opacity),
        ...metadataAttrs(list, preset, centerlineD, "centerline"),
      },
      samples: list,
      preset,
    };
  }

  return {
    tag: "path",
    attrs: {
      d: outlinePathD(list, preset, settings),
      fill: stroke,
      "fill-opacity": fmt(opacity),
      stroke: "none",
      "fill-rule": "nonzero",
      ...metadataAttrs(list, preset, centerlineD, "outline"),
    },
    samples: list,
    preset,
  };
}

export function createVectorBrushElement(createSvgEl, samples = [], style = {}, settings = {}, options = {}) {
  const spec = buildVectorBrushSpec(samples, style, settings, options);
  if (!spec || typeof createSvgEl !== "function") return null;
  return createSvgEl(spec.tag, spec.attrs);
}

