// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/VectorBrushPresets.mjs
// Data-driven vector brush preset schema for SVG drawing.

export const VECTOR_BRUSH_SCHEMA_VERSION = 1;

export const DEFAULT_VECTOR_BRUSH_PRESETS = Object.freeze([
  {
    id: "monoline",
    name: "Monoline",
    representation: "centerline",
    size: 6,
    opacity: 1,
    minWidthRatio: 1,
    maxWidthRatio: 1,
    dynamics: {
      pressureToWidth: 0,
      speedToWidth: 0,
      pressureToOpacity: 0,
      tiltToAngle: 0,
      twistToRotation: 0,
    },
    stroke: {
      linecap: "round",
      linejoin: "round",
    },
  },
  {
    id: "technical-pen",
    name: "Technical Pen",
    representation: "centerline",
    size: 3,
    opacity: 1,
    minWidthRatio: 0.88,
    maxWidthRatio: 1.08,
    dynamics: {
      pressureToWidth: 0.12,
      speedToWidth: 0.05,
      pressureToOpacity: 0,
      tiltToAngle: 0,
      twistToRotation: 0,
    },
    stroke: {
      linecap: "round",
      linejoin: "round",
    },
  },
  {
    id: "pencil",
    name: "Pencil",
    representation: "outline",
    size: 5,
    opacity: 0.72,
    minWidthRatio: 0.24,
    maxWidthRatio: 1.1,
    dynamics: {
      pressureToWidth: 0.65,
      speedToWidth: 0.28,
      pressureToOpacity: 0.38,
      tiltToAngle: 0.2,
      twistToRotation: 0,
    },
    stroke: {
      linecap: "round",
      linejoin: "round",
    },
  },
  {
    id: "tapered-ink",
    name: "Tapered Ink",
    representation: "outline",
    size: 9,
    opacity: 1,
    minWidthRatio: 0.08,
    maxWidthRatio: 1.18,
    dynamics: {
      pressureToWidth: 0.88,
      speedToWidth: 0.36,
      pressureToOpacity: 0.05,
      tiltToAngle: 0.12,
      twistToRotation: 0.15,
    },
    taper: {
      start: 0.65,
      end: 0.72,
    },
    stroke: {
      linecap: "round",
      linejoin: "round",
    },
  },
  {
    id: "calligraphy",
    name: "Calligraphy",
    representation: "outline",
    size: 12,
    opacity: 1,
    minWidthRatio: 0.16,
    maxWidthRatio: 1.35,
    dynamics: {
      pressureToWidth: 0.5,
      speedToWidth: 0.1,
      pressureToOpacity: 0,
      tiltToAngle: 0.65,
      twistToRotation: 0.55,
    },
    tip: {
      angle: 35,
      aspect: 0.38,
    },
    stroke: {
      linecap: "round",
      linejoin: "round",
    },
  },
  {
    id: "marker",
    name: "Marker",
    representation: "outline",
    size: 16,
    opacity: 0.64,
    minWidthRatio: 0.72,
    maxWidthRatio: 1.18,
    dynamics: {
      pressureToWidth: 0.22,
      speedToWidth: 0.12,
      pressureToOpacity: 0.1,
      tiltToAngle: 0.08,
      twistToRotation: 0.08,
    },
    tip: {
      angle: 18,
      aspect: 0.72,
    },
    stroke: {
      linecap: "round",
      linejoin: "round",
    },
  },
]);

function clamp(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function id(value, fallback = "monoline") {
  const raw = String(value || "").trim().toLowerCase();
  return /^[a-z0-9][a-z0-9_-]{0,48}$/.test(raw) ? raw : fallback;
}

function text(value, fallback) {
  const raw = String(value || "").trim();
  return raw ? raw.slice(0, 80) : fallback;
}

export function normalizeBrushPreset(preset = {}) {
  const fallback = DEFAULT_VECTOR_BRUSH_PRESETS[0];
  const source = preset && typeof preset === "object" ? preset : fallback;
  const dynamics = source.dynamics && typeof source.dynamics === "object" ? source.dynamics : {};
  const tip = source.tip && typeof source.tip === "object" ? source.tip : {};
  const taper = source.taper && typeof source.taper === "object" ? source.taper : {};
  const stroke = source.stroke && typeof source.stroke === "object" ? source.stroke : {};
  const representation = String(source.representation || fallback.representation).toLowerCase() === "outline"
    ? "outline"
    : "centerline";

  return {
    id: id(source.id, fallback.id),
    name: text(source.name, fallback.name),
    schemaVersion: VECTOR_BRUSH_SCHEMA_VERSION,
    representation,
    size: clamp(source.size, 0.1, 2048, fallback.size),
    opacity: clamp(source.opacity, 0.01, 1, fallback.opacity),
    minWidthRatio: clamp(source.minWidthRatio, 0.01, 4, fallback.minWidthRatio),
    maxWidthRatio: clamp(source.maxWidthRatio, 0.01, 6, fallback.maxWidthRatio),
    dynamics: {
      pressureToWidth: clamp(dynamics.pressureToWidth, 0, 1, 0),
      speedToWidth: clamp(dynamics.speedToWidth, 0, 1, 0),
      pressureToOpacity: clamp(dynamics.pressureToOpacity, 0, 1, 0),
      tiltToAngle: clamp(dynamics.tiltToAngle, 0, 1, 0),
      twistToRotation: clamp(dynamics.twistToRotation, 0, 1, 0),
    },
    tip: {
      angle: clamp(tip.angle, -180, 180, 0),
      aspect: clamp(tip.aspect, 0.05, 2, 1),
    },
    taper: {
      start: clamp(taper.start, 0, 1, 0),
      end: clamp(taper.end, 0, 1, 0),
    },
    stroke: {
      linecap: ["butt", "round", "square"].includes(String(stroke.linecap || "").toLowerCase())
        ? String(stroke.linecap).toLowerCase()
        : "round",
      linejoin: ["miter", "round", "bevel"].includes(String(stroke.linejoin || "").toLowerCase())
        ? String(stroke.linejoin).toLowerCase()
        : "round",
    },
  };
}

export function getBrushPresets(extraPresets = []) {
  const all = [...DEFAULT_VECTOR_BRUSH_PRESETS, ...(Array.isArray(extraPresets) ? extraPresets : [])]
    .map(normalizeBrushPreset);
  const byId = new Map();
  all.forEach((preset) => byId.set(preset.id, preset));
  return [...byId.values()];
}

export function getBrushPreset(idValue = "monoline", extraPresets = []) {
  const normalized = id(idValue, "monoline");
  const presets = getBrushPresets(extraPresets);
  return presets.find((preset) => preset.id === normalized) ||
    presets.find((preset) => preset.id === "monoline") ||
    normalizeBrushPreset(DEFAULT_VECTOR_BRUSH_PRESETS[0]);
}

export function brushPresetSchemaDocument() {
  return {
    schema: "nodevision-svg-vector-brush-preset",
    version: VECTOR_BRUSH_SCHEMA_VERSION,
    fields: {
      id: "Stable lowercase identifier.",
      name: "Human-readable preset label.",
      representation: "centerline or outline.",
      size: "Default brush width in SVG user units.",
      opacity: "Default opacity, 0.01 to 1.",
      minWidthRatio: "Minimum width as a ratio of size.",
      maxWidthRatio: "Maximum width as a ratio of size.",
      dynamics: {
        pressureToWidth: "0..1 pressure influence on width.",
        speedToWidth: "0..1 velocity influence on width.",
        pressureToOpacity: "0..1 pressure influence on opacity.",
        tiltToAngle: "0..1 tilt influence on calligraphic angle.",
        twistToRotation: "0..1 twist influence on tip rotation.",
      },
      tip: {
        angle: "Base calligraphic angle in degrees.",
        aspect: "Brush tip aspect ratio for calligraphy.",
      },
      taper: {
        start: "0..1 start taper amount.",
        end: "0..1 end taper amount.",
      },
    },
  };
}

