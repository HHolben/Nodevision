// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/DrawingAssistSettings.mjs
// Shared settings and SVG metadata helpers for SVG drawing assistance.

export const DRAWING_ASSIST_METADATA_ID = "nv-drawing-assist-metadata";
export const DRAWING_ASSIST_SCHEMA_VERSION = 1;

const QUICK_MENU_ACTIONS = [
  "brush",
  "eraser",
  "eyedropper",
  "select",
  "transform",
  "duplicate",
  "bringForward",
  "sendBackward",
];

const STABILIZATION_MODES = new Set([
  "none",
  "light",
  "medium",
  "strong",
  "technical",
  "delayed-rope",
]);

const EYEDROPPER_TARGETS = new Set(["fill", "stroke", "recent"]);
const SYMMETRY_STRATEGIES = new Set(["linked-use", "independent-copy", "expanded-geometry"]);
const GUIDE_TYPES = new Set([
  "rectangular-grid",
  "isometric-grid",
  "horizontal-symmetry",
  "vertical-symmetry",
  "quadrant-symmetry",
  "radial-symmetry",
  "one-point-perspective",
  "two-point-perspective",
]);
const SYMMETRY_MODES = new Set(["none", "horizontal", "vertical", "quadrant", "radial"]);

export const DEFAULT_DRAWING_ASSIST_SETTINGS = Object.freeze({
  shapeHoldDelayMs: 450,
  shapeRecognitionSensitivity: 0.62,
  shapeCorrectionEnabled: true,
  preserveOriginalStrokeAfterShapeCorrection: false,
  showCorrectionConfidence: true,

  stabilizationMode: "light",
  stabilizationStrength: 0.35,
  smoothing: 0.32,
  minimumPointDistance: 0.35,
  curveSimplification: 0.65,
  preserveCorners: true,
  livePreview: true,

  syntheticMousePressure: 0.5,
  defaultBrushPreset: "monoline",
  brushSize: 6,
  brushOpacity: 1,
  recentBrushSizes: [2, 4, 6, 10, 16],
  showBrushCursor: true,

  eyedropperTarget: "recent",
  quickMenuShortcut: "q",
  quickMenuLongPressMs: 550,
  quickMenuActionSlots: QUICK_MENU_ACTIONS,
  gestureLongPressEyedropper: true,
  gestureLongPressQuickMenu: true,
  gestureBarrelButtonQuickMenu: true,
  gestureRightClickQuickMenu: false,

  guideType: "rectangular-grid",
  guidesVisible: false,
  guideSpacing: 24,
  guideAngle: 30,
  guideOrigin: { x: 0, y: 0 },
  vanishingPoint1: { x: 160, y: 120 },
  vanishingPoint2: { x: 640, y: 120 },
  radialSegmentCount: 8,
  guideOpacity: 0.35,
  snapStrength: 0,
  assistedDrawing: false,
  applyAssistToActiveLayer: true,

  symmetryMode: "none",
  symmetryOutputStrategy: "linked-use",
  symmetryAxis: { x: 0, y: 0 },
  radialMirrored: false,

  eraserMode: "delete-object",
});

function clamp(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function positive(value, fallback, max = 1000000) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(max, n);
}

function bool(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}

function stringFromSet(value, allowed, fallback) {
  const normalized = String(value || "").trim().toLowerCase();
  return allowed.has(normalized) ? normalized : fallback;
}

function finitePoint(value, fallback) {
  const x = Number(value?.x);
  const y = Number(value?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return { ...fallback };
  return { x, y };
}

function sanitizeShortcut(value, fallback) {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  return raw.length > 32 ? fallback : raw;
}

function sanitizeBrushPresetId(value, fallback) {
  const raw = String(value || "").trim().toLowerCase();
  if (/^[a-z0-9][a-z0-9_-]{0,48}$/.test(raw)) return raw;
  return fallback;
}

function sanitizeRecentBrushSizes(value, fallback) {
  const source = Array.isArray(value) ? value : fallback;
  const out = [];
  source.forEach((entry) => {
    const n = clamp(entry, 0.1, 2048, null);
    if (n === null) return;
    const rounded = Number(n.toFixed(3));
    if (!out.includes(rounded)) out.push(rounded);
  });
  return out.slice(-8);
}

function sanitizeQuickMenuActions(value, fallback) {
  const source = Array.isArray(value) ? value : fallback;
  const out = [];
  source.forEach((entry) => {
    const normalized = String(entry || "").trim();
    if (!normalized || out.includes(normalized)) return;
    out.push(normalized);
  });
  return out.slice(0, 12);
}

export function normalizeDrawingAssistSettings(input = {}) {
  const base = DEFAULT_DRAWING_ASSIST_SETTINGS;
  const source = input && typeof input === "object" ? input : {};
  return {
    shapeHoldDelayMs: positive(source.shapeHoldDelayMs, base.shapeHoldDelayMs, 5000),
    shapeRecognitionSensitivity: clamp(source.shapeRecognitionSensitivity, 0, 1, base.shapeRecognitionSensitivity),
    shapeCorrectionEnabled: bool(source.shapeCorrectionEnabled, base.shapeCorrectionEnabled),
    preserveOriginalStrokeAfterShapeCorrection: bool(
      source.preserveOriginalStrokeAfterShapeCorrection,
      base.preserveOriginalStrokeAfterShapeCorrection,
    ),
    showCorrectionConfidence: bool(source.showCorrectionConfidence, base.showCorrectionConfidence),

    stabilizationMode: stringFromSet(source.stabilizationMode, STABILIZATION_MODES, base.stabilizationMode),
    stabilizationStrength: clamp(source.stabilizationStrength, 0, 1, base.stabilizationStrength),
    smoothing: clamp(source.smoothing, 0, 1, base.smoothing),
    minimumPointDistance: clamp(source.minimumPointDistance, 0, 128, base.minimumPointDistance),
    curveSimplification: clamp(source.curveSimplification, 0, 256, base.curveSimplification),
    preserveCorners: bool(source.preserveCorners, base.preserveCorners),
    livePreview: bool(source.livePreview, base.livePreview),

    syntheticMousePressure: clamp(source.syntheticMousePressure, 0.02, 1, base.syntheticMousePressure),
    defaultBrushPreset: sanitizeBrushPresetId(source.defaultBrushPreset, base.defaultBrushPreset),
    brushSize: clamp(source.brushSize, 0.1, 2048, base.brushSize),
    brushOpacity: clamp(source.brushOpacity, 0.01, 1, base.brushOpacity),
    recentBrushSizes: sanitizeRecentBrushSizes(source.recentBrushSizes, base.recentBrushSizes),
    showBrushCursor: bool(source.showBrushCursor, base.showBrushCursor),

    eyedropperTarget: stringFromSet(source.eyedropperTarget, EYEDROPPER_TARGETS, base.eyedropperTarget),
    quickMenuShortcut: sanitizeShortcut(source.quickMenuShortcut, base.quickMenuShortcut),
    quickMenuLongPressMs: positive(source.quickMenuLongPressMs, base.quickMenuLongPressMs, 5000),
    quickMenuActionSlots: sanitizeQuickMenuActions(source.quickMenuActionSlots, base.quickMenuActionSlots),
    gestureLongPressEyedropper: bool(source.gestureLongPressEyedropper, base.gestureLongPressEyedropper),
    gestureLongPressQuickMenu: bool(source.gestureLongPressQuickMenu, base.gestureLongPressQuickMenu),
    gestureBarrelButtonQuickMenu: bool(source.gestureBarrelButtonQuickMenu, base.gestureBarrelButtonQuickMenu),
    gestureRightClickQuickMenu: bool(source.gestureRightClickQuickMenu, base.gestureRightClickQuickMenu),

    guideType: stringFromSet(source.guideType, GUIDE_TYPES, base.guideType),
    guidesVisible: bool(source.guidesVisible, base.guidesVisible),
    guideSpacing: positive(source.guideSpacing, base.guideSpacing, 100000),
    guideAngle: clamp(source.guideAngle, -360, 360, base.guideAngle),
    guideOrigin: finitePoint(source.guideOrigin, base.guideOrigin),
    vanishingPoint1: finitePoint(source.vanishingPoint1, base.vanishingPoint1),
    vanishingPoint2: finitePoint(source.vanishingPoint2, base.vanishingPoint2),
    radialSegmentCount: Math.round(clamp(source.radialSegmentCount, 2, 64, base.radialSegmentCount)),
    guideOpacity: clamp(source.guideOpacity, 0, 1, base.guideOpacity),
    snapStrength: clamp(source.snapStrength, 0, 1, base.snapStrength),
    assistedDrawing: bool(source.assistedDrawing, base.assistedDrawing),
    applyAssistToActiveLayer: bool(source.applyAssistToActiveLayer, base.applyAssistToActiveLayer),

    symmetryMode: stringFromSet(source.symmetryMode, SYMMETRY_MODES, base.symmetryMode),
    symmetryOutputStrategy: stringFromSet(source.symmetryOutputStrategy, SYMMETRY_STRATEGIES, base.symmetryOutputStrategy),
    symmetryAxis: finitePoint(source.symmetryAxis, base.symmetryAxis),
    radialMirrored: bool(source.radialMirrored, base.radialMirrored),

    eraserMode: String(source.eraserMode || base.eraserMode),
  };
}

export function getDrawingAssistSettings(globalObj = globalThis) {
  const merged = {
    ...DEFAULT_DRAWING_ASSIST_SETTINGS,
    ...(globalObj?.NodevisionDrawingAssistSettings || {}),
  };
  const normalized = normalizeDrawingAssistSettings(merged);
  if (globalObj) globalObj.NodevisionDrawingAssistSettings = normalized;
  return normalized;
}

export function setDrawingAssistSettings(patch = {}, globalObj = globalThis) {
  const current = getDrawingAssistSettings(globalObj);
  const next = normalizeDrawingAssistSettings({ ...current, ...(patch || {}) });
  if (globalObj) {
    globalObj.NodevisionDrawingAssistSettings = next;
    try {
      globalObj.dispatchEvent?.(new CustomEvent("nv-svg-drawing-assist-settings-changed", { detail: { settings: next } }));
    } catch {
      // Settings are still updated when events are unavailable.
    }
  }
  return next;
}

export function rememberBrushSize(size, globalObj = globalThis) {
  const current = getDrawingAssistSettings(globalObj);
  const numeric = clamp(size, 0.1, 2048, current.brushSize);
  const recent = current.recentBrushSizes.filter((entry) => Math.abs(entry - numeric) > 1e-6);
  recent.push(Number(numeric.toFixed(3)));
  return setDrawingAssistSettings({
    brushSize: numeric,
    recentBrushSizes: recent.slice(-8),
  }, globalObj);
}

export function readDrawingAssistMetadata(svgRoot) {
  if (!svgRoot?.querySelector) return null;
  const node = svgRoot.querySelector(`:scope > metadata#${DRAWING_ASSIST_METADATA_ID}`);
  if (!node) return null;
  try {
    const parsed = JSON.parse(node.textContent || "{}");
    if (!parsed || typeof parsed !== "object") return null;
    return normalizeDrawingAssistSettings(parsed.settings || parsed);
  } catch {
    return null;
  }
}

export function writeDrawingAssistMetadata(svgRoot, settings) {
  if (!svgRoot || typeof document === "undefined") return null;
  const normalized = normalizeDrawingAssistSettings(settings);
  let node = svgRoot.querySelector?.(`:scope > metadata#${DRAWING_ASSIST_METADATA_ID}`) || null;
  if (!node) {
    node = document.createElementNS("http://www.w3.org/2000/svg", "metadata");
    node.setAttribute("id", DRAWING_ASSIST_METADATA_ID);
    node.setAttribute("data-nv-editor-metadata", "drawing-assist");
    svgRoot.insertBefore(node, svgRoot.firstChild || null);
  }
  node.textContent = JSON.stringify({
    schema: "nodevision-svg-drawing-assist",
    version: DRAWING_ASSIST_SCHEMA_VERSION,
    settings: normalized,
  });
  return node;
}

