// Nodevision/ApplicationSystem/public/Sessions/SketchFocusModel.mjs
// This module stores the canonical stroke model for Sketch Focus and normalizes pointer pressure, tilt, undo, redo, and eraser operations independently of the live canvas.

export const GRAPHITE_PRESETS = Object.freeze({
  "2H": { label: "2H", gray: 96, opacity: 0.22, grain: 0.44 },
  H: { label: "H", gray: 78, opacity: 0.30, grain: 0.52 },
  HB: { label: "HB", gray: 55, opacity: 0.42, grain: 0.62 },
  "2B": { label: "2B", gray: 35, opacity: 0.58, grain: 0.74 },
  "4B": { label: "4B", gray: 20, opacity: 0.72, grain: 0.86 },
});

export function normalizePressure(value, pointerType = "mouse", buttons = 0) {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return Math.max(0.05, Math.min(1, numeric));
  if (pointerType === "mouse" && buttons) return 0.5;
  return 0.35;
}

export function normalizeTilt(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(-90, Math.min(90, numeric)) : 0;
}

export function tiltBroadening(sample = {}) {
  const x = Math.abs(normalizeTilt(sample.tiltX));
  const y = Math.abs(normalizeTilt(sample.tiltY));
  return 1 + Math.min(0.8, Math.sqrt(x * x + y * y) / 90);
}

export function sampleFromPointerEvent(event, rect = { left: 0, top: 0 }) {
  return {
    x: Number(event.clientX || 0) - Number(rect.left || 0),
    y: Number(event.clientY || 0) - Number(rect.top || 0),
    pressure: normalizePressure(event.pressure, event.pointerType, event.buttons),
    tiltX: normalizeTilt(event.tiltX),
    tiltY: normalizeTilt(event.tiltY),
    time: Number(event.timeStamp || Date.now()),
  };
}

export function createSketchModel(options = {}) {
  let nextId = Number(options.nextId || 1);
  const state = {
    width: Math.max(1, Number(options.width || 1)),
    height: Math.max(1, Number(options.height || 1)),
    strokes: [],
    redoStack: [],
    activeStroke: null,
  };

  function snapshot() {
    return {
      width: state.width,
      height: state.height,
      strokes: state.strokes.map(cloneStroke),
      activeStroke: state.activeStroke ? cloneStroke(state.activeStroke) : null,
    };
  }

  function beginStroke(sample, settings = {}) {
    const preset = GRAPHITE_PRESETS[settings.preset] || GRAPHITE_PRESETS.HB;
    const stroke = {
      id: nextId,
      seed: hashStrokeSeed(nextId, sample),
      tool: settings.tool === "eraser" ? "eraser" : "pencil",
      preset: preset.label,
      size: clampNumber(settings.size, 1, 64, 5),
      gray: preset.gray,
      opacity: preset.opacity,
      grain: preset.grain,
      samples: [cleanSample(sample)],
    };
    nextId += 1;
    state.activeStroke = stroke;
    state.redoStack.length = 0;
    return stroke;
  }

  function addSample(sample) {
    if (!state.activeStroke) return null;
    const clean = cleanSample(sample);
    const samples = state.activeStroke.samples;
    const previous = samples[samples.length - 1];
    if (previous && Math.hypot(clean.x - previous.x, clean.y - previous.y) < 0.2) return null;
    samples.push(clean);
    return clean;
  }

  function finishStroke() {
    const stroke = state.activeStroke;
    state.activeStroke = null;
    if (!stroke || stroke.samples.length === 0) return null;
    state.strokes.push(stroke);
    return stroke;
  }

  function cancelActiveStroke() {
    state.activeStroke = null;
  }

  function undo() {
    const stroke = state.strokes.pop();
    if (!stroke) return null;
    state.redoStack.push(stroke);
    return stroke;
  }

  function redo() {
    const stroke = state.redoStack.pop();
    if (!stroke) return null;
    state.strokes.push(stroke);
    return stroke;
  }

  function resize(width, height) {
    state.width = Math.max(1, Number(width || state.width || 1));
    state.height = Math.max(1, Number(height || state.height || 1));
  }

  return { state, snapshot, beginStroke, addSample, finishStroke, cancelActiveStroke, undo, redo, resize };
}

export function cloneStroke(stroke = {}) {
  return {
    ...stroke,
    samples: (stroke.samples || []).map((sample) => ({ ...sample })),
  };
}

function cleanSample(sample = {}) {
  return {
    x: round(sample.x),
    y: round(sample.y),
    pressure: round(normalizePressure(sample.pressure)),
    tiltX: round(normalizeTilt(sample.tiltX)),
    tiltY: round(normalizeTilt(sample.tiltY)),
    time: round(Number(sample.time || 0)),
  };
}

function clampNumber(value, min, max, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, numeric));
}

function hashStrokeSeed(id, sample = {}) {
  const x = Math.round(Number(sample.x || 0) * 10);
  const y = Math.round(Number(sample.y || 0) * 10);
  return ((id * 1103515245) ^ (x * 2654435761) ^ (y * 1597334677)) >>> 0;
}

function round(value) {
  return Math.round(Number(value || 0) * 1000) / 1000;
}
