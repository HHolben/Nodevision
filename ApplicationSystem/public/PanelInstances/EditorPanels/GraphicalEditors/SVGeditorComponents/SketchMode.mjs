// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SketchMode.mjs
// Sketch mode controller for SVG editing. Supports multiple independent sketch previews, each representing one evolving interpretation.

import {
  averageStrokes,
  distance,
  inferStrokeTracks,
  pointsToPathD,
  strokeLength,
} from "./SketchStrokeMath.mjs";
import { fitTwoSegmentAngleHypothesis } from "./PencilSketchAngleFit.mjs";
import { fitStraightLineHypothesis } from "./PencilSketchLineFit.mjs";
import { fitTriangleHypothesis } from "./PencilSketchTriangleFit.mjs";
import { fitQuadrilateralHypothesis } from "./PencilSketchQuadrilateralFit.mjs";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toPressure(value) {
  const pressure = Number(value);
  if (!Number.isFinite(pressure) || pressure <= 0) return 0.5;
  return clamp(pressure, 0, 1);
}

function safeBool(value, fallback = false) {
  if (typeof value === "boolean") return value;
  return fallback;
}

const NORMAL_SKETCH_STROKE_COLOR = "#808080";

function getStrokeOrderColor(index, total) {
  const count = Math.max(1, Number.parseInt(total, 10) || 1);
  if (count <= 1) return "hsl(270, 90%, 60%)";
  const safeIndex = clamp(Number.parseInt(index, 10) || 0, 0, count - 1);
  const t = safeIndex / (count - 1);
  const hue = Math.round(270 * t);
  return "hsl(" + hue + ", 90%, 58%)";
}

function makeSketchPreviewId() {
  return "sketch-preview-" + Math.random().toString(36).slice(2, 10);
}

export function createSketchModeController(deps = {}) {
  const {
    svgRoot,
    createSvgEl,
    getActiveLayer,
    appendElement,
    currentStyleDefaults,
    setStatus,
    setMode,
    markDirty,
    pointerToleranceInSvgUnits,
    uiAttrName = "data-nv-editor-ui",
  } = deps;

  if (!svgRoot) {
    throw new Error("createSketchModeController: svgRoot is required");
  }
  if (typeof createSvgEl !== "function") {
    throw new Error("createSketchModeController: createSvgEl is required");
  }

  const state = {
    enabled: false,
    activePointerId: null,
    currentStroke: null,
    roughOpacity: 0.28,
    smoothingLevel: 2,
    keepConstruction: false,
    constructionVisible: true,
    enableStrokeOrderColors: Boolean(
      globalThis?.NodevisionState?.enableSketchStrokeOrderColors ||
        globalThis?.NodevisionSketchSettings?.enableSketchStrokeOrderColors,
    ),
    previewCounter: 1,
    previews: [],
    activePreviewId: null,
  };

  function status(text) {
    if (typeof setStatus === "function") setStatus(text);
  }

  function emitSketchPreviewsChanged(reason = "update") {
    try {
      window.dispatchEvent(
        new CustomEvent("nv-sketch-previews-changed", {
          detail: {
            reason,
            activePreviewId: state.activePreviewId,
            previews: getSketchPreviews(),
          },
        }),
      );
    } catch {
      // ignore event dispatch failures
    }
  }

  function sketchPerformanceSettings() {
    const user = globalThis?.NodevisionSketchSettings || {};
    return {
      recognitionDebounceMs: Number(user.recognitionDebounceMs) || 100,
      maxAnalysisPointsPerStroke: Number(user.maxAnalysisPointsPerStroke) || 64,
      maxAnalysisPointsPerPreview: Number(user.maxAnalysisPointsPerPreview) || 512,
      minPointerSampleDistancePx: Number(user.minPointerSampleDistancePx) || 1.5,
      recognitionSimplifyTolerancePx: Number(user.recognitionSimplifyTolerancePx) || 3,
      maxTriangleCandidates: Number(user.maxTriangleCandidates) || 40,
      maxQuadrilateralCandidates: Number(user.maxQuadrilateralCandidates) || 60,
      enableSketchDebugOverlay: Boolean(user.enableSketchDebugOverlay),
    };
  }

  function sketchPerfLogEnabled() {
    return Boolean(globalThis?.NodevisionDebug?.pencilSketchPerformance);
  }

  function nowMs() {
    return typeof performance !== "undefined" && typeof performance.now === "function"
      ? performance.now()
      : Date.now();
  }

  function spacingThreshold() {
    const px = sketchPerformanceSettings().minPointerSampleDistancePx;
    const next = typeof pointerToleranceInSvgUnits === "function"
      ? pointerToleranceInSvgUnits(px)
      : px;
    return Math.max(0.08, Number(next) || px);
  }

  function minimumStrokeLength() {
    const next = typeof pointerToleranceInSvgUnits === "function"
      ? pointerToleranceInSvgUnits(8)
      : 8;
    return Math.max(0.4, Number(next) || 8);
  }

  function toleranceFromScreenPixels(px, fallback = px) {
    const next = typeof pointerToleranceInSvgUnits === "function"
      ? pointerToleranceInSvgUnits(px)
      : fallback;
    return Math.max(0.01, Number(next) || fallback);
  }

  function lineFitAllowedError() {
    const style = typeof currentStyleDefaults === "function"
      ? (currentStyleDefaults() || {})
      : {};
    const strokeWidth = Number.parseFloat(style.strokeWidth) || 1;
    return Math.max(toleranceFromScreenPixels(6, 6), strokeWidth * 2.5);
  }

  function simplifyThreshold() {
    const px = sketchPerformanceSettings().recognitionSimplifyTolerancePx;
    const next = typeof pointerToleranceInSvgUnits === "function"
      ? pointerToleranceInSvgUnits(px)
      : px;
    return Math.max(0, Number(next) || px);
  }

  function smoothingPasses() {
    return 1 + Math.max(0, Number.parseInt(state.smoothingLevel, 10) || 0);
  }

  function trackDistanceThreshold() {
    const next = typeof pointerToleranceInSvgUnits === "function"
      ? pointerToleranceInSvgUnits(24)
      : 24;
    return Math.max(minimumStrokeLength() * 3.5, Number(next) || 24);
  }

  function createStrokePoint(rootPoint, event) {
    return {
      x: Number(rootPoint?.x) || 0,
      y: Number(rootPoint?.y) || 0,
      pressure: toPressure(event?.pressure),
      time: Number(event?.timeStamp) || Date.now(),
    };
  }

  function createPreviewPath() {
    return createSvgEl("path", {
      [uiAttrName]: "sketch-preview",
      fill: "none",
      stroke: "#1f6feb",
      "stroke-width": "1.6",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      opacity: "0.95",
      "pointer-events": "none",
      display: "none",
      d: "",
    });
  }

  function createStrokePath() {
    return createSvgEl("path", {
      [uiAttrName]: "sketch-rough-stroke",
      fill: "none",
      stroke: NORMAL_SKETCH_STROKE_COLOR,
      "stroke-width": "1.0",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      opacity: String(state.roughOpacity),
      "pointer-events": "none",
      d: "",
    });
  }

  function colorForStrokeIndex(index, total) {
    return state.enableStrokeOrderColors
      ? getStrokeOrderColor(index, total)
      : NORMAL_SKETCH_STROKE_COLOR;
  }

  function applyStrokeVisualStyle(pathEl, index, total) {
    if (!pathEl) return;
    pathEl.setAttribute("stroke", colorForStrokeIndex(index, total));
    pathEl.setAttribute("opacity", String(state.roughOpacity));
    pathEl.setAttribute("data-nv-sketch-stroke-index", String(index));
    pathEl.setAttribute("data-nv-sketch-stroke-count", String(total));
  }

  function applyPreviewStrokeColors(preview, options = {}) {
    if (!preview) return;
    const activeStroke = options.activeStroke || null;
    const includeActive = activeStroke && activeStroke.previewId === preview.id;
    const total = preview.rawStrokes.length + (includeActive ? 1 : 0);
    preview.rawStrokes.forEach((stroke, index) => {
      applyStrokeVisualStyle(stroke.pathEl, index, Math.max(1, total));
    });
    if (includeActive) {
      applyStrokeVisualStyle(activeStroke.pathEl, total - 1, Math.max(1, total));
    }
  }

  function applyAllStrokeColors() {
    state.previews.forEach((preview) => applyPreviewStrokeColors(preview, {
      activeStroke: state.currentStroke,
    }));
  }

  function getPreviewById(previewId) {
    if (!previewId) return null;
    return state.previews.find((preview) => preview.id === previewId) || null;
  }

  function getActivePreview() {
    return getPreviewById(state.activePreviewId);
  }

  function applyPreviewDomVisibility(preview) {
    if (!preview?.groupEl) return;
    const visible = safeBool(preview.visible, true) &&
      safeBool(state.constructionVisible, true);
    preview.groupEl.style.display = visible ? "" : "none";
  }

  function previewSummary(preview) {
    return {
      id: preview.id,
      name: preview.name,
      visible: safeBool(preview.visible, true),
      locked: safeBool(preview.locked, false),
      rawStrokes: preview.rawStrokes.map((stroke) => ({
        pointCount: stroke.points.length,
        length: stroke.length,
      })),
      hypotheses: { ...(preview.hypotheses || {}) },
      activePreviewGeometry: preview.activePreviewGeometry
        ? {
          trackCount: preview.activePreviewGeometry.tracks.length,
          pointCount: preview.activePreviewGeometry.pointCount,
          discontinuities: Number(
            preview.activePreviewGeometry.discontinuities,
          ) || 0,
        }
        : null,
      accepted: safeBool(preview.accepted, false),
      strokeCount: preview.rawStrokes.length,
      previewPointCount: Number(preview.activePreviewGeometry?.pointCount) || 0,
      isActive: preview.id === state.activePreviewId,
    };
  }

  function getSketchPreviews() {
    return state.previews.map((preview) => previewSummary(preview));
  }

  function createSketchPreview(name = null, options = {}) {
    const layer = getActiveLayer?.() || svgRoot;
    const id = makeSketchPreviewId();
    const previewName =
      String(name || `Sketch Preview ${state.previewCounter++}`)
        .trim() || `Sketch Preview ${state.previewCounter++}`;

    const group = createSvgEl("g", {
      [uiAttrName]: "sketch-construction",
      "data-nv-sketch-session": "true",
      "data-nv-sketch-preview-id": id,
      "data-element-name": previewName,
      "pointer-events": "none",
    });
    const previewPath = createPreviewPath();
    group.appendChild(previewPath);
    layer.appendChild(group);

    const preview = {
      id,
      name: previewName,
      visible: true,
      locked: false,
      rawStrokes: [],
      hypotheses: {},
      activePreviewGeometry: null,
      straightLineState: null,
      angularPathState: null,
      accepted: false,
      groupEl: group,
      previewPathEl: previewPath,
      layerEl: layer,
      layerId: layer?.id || null,
      lastPreviewD: "",
      recognitionDirty: false,
      lastRecognizedStrokeCount: 0,
      lastRecognizedPointCount: 0,
      recognitionVersion: 0,
      recognitionTimer: null,
      recognitionRunning: false,
      analysisPointCount: 0,
    };

    state.previews.push(preview);
    applyPreviewDomVisibility(preview);

    if (options.activate !== false) {
      state.activePreviewId = preview.id;
    }

    emitSketchPreviewsChanged("create-preview");
    return previewSummary(preview);
  }

  function ensureActivePreview() {
    const existing = getActivePreview();
    if (existing) return existing;
    if (!state.previews.length) {
      createSketchPreview();
      return getActivePreview();
    }
    state.activePreviewId = state.previews[0].id;
    return getActivePreview();
  }

  function setActiveSketchPreview(previewId) {
    const preview = getPreviewById(previewId);
    if (!preview) return false;

    // Do not carry an in-progress stroke across preview boundaries.
    if (state.currentStroke) {
      discardCurrentStroke();
    }

    state.activePreviewId = preview.id;
    refreshActivePreview();
    emitSketchPreviewsChanged("select-preview");
    return true;
  }

  function renameSketchPreview(previewId, nextName) {
    const preview = getPreviewById(previewId);
    if (!preview) return false;
    const trimmed = String(nextName || "").trim();
    if (!trimmed) return false;
    preview.name = trimmed;
    preview.groupEl?.setAttribute?.("data-element-name", trimmed);
    emitSketchPreviewsChanged("rename-preview");
    return true;
  }

  function setSketchPreviewVisible(previewId, visible) {
    const preview = getPreviewById(previewId);
    if (!preview) return false;
    preview.visible = safeBool(visible, preview.visible);
    applyPreviewDomVisibility(preview);
    emitSketchPreviewsChanged("visibility-preview");
    return true;
  }

  function toggleSketchPreviewVisible(previewId) {
    const preview = getPreviewById(previewId);
    if (!preview) return false;
    return setSketchPreviewVisible(preview.id, !preview.visible);
  }

  function setSketchPreviewLocked(previewId, locked) {
    const preview = getPreviewById(previewId);
    if (!preview) return false;
    preview.locked = safeBool(locked, preview.locked);
    emitSketchPreviewsChanged("lock-preview");
    return true;
  }

  function toggleSketchPreviewLocked(previewId) {
    const preview = getPreviewById(previewId);
    if (!preview) return false;
    return setSketchPreviewLocked(preview.id, !preview.locked);
  }

  function clearPreviewGeometryDom(preview) {
    if (!preview) return;
    preview.rawStrokes.forEach((stroke) => {
      try {
        stroke.pathEl?.remove();
      } catch {
        // ignore DOM removal errors
      }
    });
    preview.rawStrokes = [];
    preview.hypotheses = {};
    preview.activePreviewGeometry = null;
    preview.straightLineState = null;
    preview.angularPathState = null;
    preview.lastPreviewD = "";
    preview.recognitionDirty = false;
    preview.lastRecognizedStrokeCount = 0;
    preview.lastRecognizedPointCount = 0;
    preview.recognitionVersion = (Number(preview.recognitionVersion) || 0) + 1;
    preview.analysisPointCount = 0;
    if (preview.recognitionTimer) {
      clearTimeout(preview.recognitionTimer);
      preview.recognitionTimer = null;
    }
    if (preview.previewPathEl) {
      preview.previewPathEl.setAttribute("d", "");
      preview.previewPathEl.setAttribute("display", "none");
    }
  }

  function clearSketchPreview(previewId, options = {}) {
    const preview = getPreviewById(previewId);
    if (!preview) return false;
    clearPreviewGeometryDom(preview);
    preview.accepted = false;
    if (!options.silent) {
      status(`Cleared ${preview.name}`);
    }
    emitSketchPreviewsChanged("clear-preview");
    return true;
  }

  function deleteSketchPreview(previewId) {
    const idx = state.previews.findIndex((preview) => preview.id === previewId);
    if (idx < 0) return false;
    const preview = state.previews[idx];

    if (state.currentStroke && state.currentStroke.previewId === preview.id) {
      discardCurrentStroke();
    }

    try {
      preview.groupEl?.remove();
    } catch {
      // ignore DOM removal errors
    }

    state.previews.splice(idx, 1);
    if (state.activePreviewId === preview.id) {
      state.activePreviewId = state.previews[idx]?.id ||
        state.previews[idx - 1]?.id ||
        state.previews[0]?.id || null;
    }

    emitSketchPreviewsChanged("delete-preview");
    return true;
  }

  function setPreviewVisible(pathEl, visible) {
    if (!pathEl) return;
    pathEl.setAttribute("display", visible ? "" : "none");
  }

  function pushStrokePoint(stroke, point, options = {}) {
    if (!stroke || !point) return false;
    const force = Boolean(options.force);
    const prev = stroke.points[stroke.points.length - 1] || null;
    if (!prev) {
      stroke.points.push(point);
      return true;
    }

    if (!force && distance(prev, point) < spacingThreshold()) return false;

    if (force && distance(prev, point) < spacingThreshold()) {
      stroke.points[stroke.points.length - 1] = point;
      return true;
    }

    stroke.points.push(point);
    return true;
  }

  function updateStrokePath(stroke) {
    if (!stroke?.pathEl) return;
    stroke.pathEl.setAttribute("d", pointsToPathD(stroke.points));
  }

  function scheduleStrokePathUpdate(stroke) {
    if (!stroke?.pathEl) return;
    if (stroke.rafId) return;
    const start = nowMs();
    const run = () => {
      stroke.rafId = null;
      const renderStart = nowMs();
      updateStrokePath(stroke);
      const renderMs = nowMs() - renderStart;
      if (sketchPerfLogEnabled() && renderMs > 4) {
        console.warn("[PencilSketchPerformance] active stroke render slow", { renderMs, pointCount: stroke.points.length });
      }
    };
    if (typeof requestAnimationFrame === "function") {
      stroke.rafId = requestAnimationFrame(run);
    } else {
      run();
    }
    const captureMs = nowMs() - start;
    if (sketchPerfLogEnabled() && captureMs > 4) {
      console.warn("[PencilSketchPerformance] pointermove capture slow", { captureMs, pointCount: stroke.points.length });
    }
  }

  function flushStrokePathUpdate(stroke) {
    if (!stroke) return;
    if (stroke.rafId && typeof cancelAnimationFrame === "function") {
      try {
        cancelAnimationFrame(stroke.rafId);
      } catch {
        // ignore cancel failures
      }
    }
    stroke.rafId = null;
    updateStrokePath(stroke);
  }

  function simplifyPointsForRecognition(points = [], tolerance = simplifyThreshold(), maxPoints = 64) {
    if (!Array.isArray(points) || points.length <= 2) return points.map((pt) => ({ ...pt }));
    const simplified = [];
    let last = null;
    points.forEach((pt, index) => {
      const isEndpoint = index === 0 || index === points.length - 1;
      if (isEndpoint || !last || distance(last, pt) >= tolerance) {
        simplified.push({ ...pt });
        last = pt;
      }
    });
    if (simplified.length < 2) {
      return [points[0], points[points.length - 1]].map((pt) => ({ ...pt }));
    }
    const cap = Math.max(2, Number.parseInt(maxPoints, 10) || 64);
    if (simplified.length <= cap) return simplified;
    const capped = [];
    for (let i = 0; i < cap; i += 1) {
      const sourceIndex = Math.round((i * (simplified.length - 1)) / (cap - 1));
      capped.push({ ...simplified[sourceIndex] });
    }
    return capped;
  }

  function computeStrokeSummary(points = [], analysisPoints = []) {
    const start = points[0] || null;
    const end = points[points.length - 1] || null;
    const midpoint = start && end ? { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 } : null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    points.forEach((pt) => {
      minX = Math.min(minX, pt.x);
      minY = Math.min(minY, pt.y);
      maxX = Math.max(maxX, pt.x);
      maxY = Math.max(maxY, pt.y);
    });
    const dx = end && start ? end.x - start.x : 0;
    const dy = end && start ? end.y - start.y : 0;
    return {
      start,
      end,
      midpoint,
      bbox: Number.isFinite(minX) ? { minX, minY, maxX, maxY } : null,
      directionAngle: Math.atan2(dy, dx) * 180 / Math.PI,
      rawPointCount: points.length,
      analysisPointCount: analysisPoints.length,
    };
  }

  function createAnalysisStroke(stroke, maxPointsOverride = null) {
    const settings = sketchPerformanceSettings();
    const maxPoints = maxPointsOverride || settings.maxAnalysisPointsPerStroke;
    const analysisPoints = simplifyPointsForRecognition(stroke.points || [], simplifyThreshold(), maxPoints);
    return {
      points: analysisPoints,
      length: stroke.length,
      rawPointCount: stroke.points?.length || 0,
      analysisPointCount: analysisPoints.length,
      summary: computeStrokeSummary(stroke.points || [], analysisPoints),
    };
  }

  function getRecognitionStrokes(preview) {
    const rawStrokes = preview?.rawStrokes || [];
    const settings = sketchPerformanceSettings();
    const perStrokeCap = Math.max(2, Math.min(
      settings.maxAnalysisPointsPerStroke,
      Math.floor(settings.maxAnalysisPointsPerPreview / Math.max(1, rawStrokes.length)),
    ));
    const analysisStrokes = rawStrokes.map((stroke) => {
      const base = Array.isArray(stroke.analysisPoints)
        ? { ...stroke, points: stroke.analysisPoints }
        : createAnalysisStroke(stroke, perStrokeCap);
      const points = simplifyPointsForRecognition(base.points || [], simplifyThreshold(), perStrokeCap);
      return {
        ...stroke,
        points,
        length: stroke.length,
        rawPointCount: stroke.points?.length || 0,
        analysisPointCount: points.length,
        summary: stroke.summary || computeStrokeSummary(stroke.points || [], points),
      };
    });
    const analysisPointCount = analysisStrokes.reduce((sum, stroke) => sum + (stroke.points?.length || 0), 0);
    if (sketchPerfLogEnabled() && analysisPointCount > settings.maxAnalysisPointsPerPreview) {
      console.warn("[PencilSketchPerformance] analysis point cap exceeded", {
        analysisPointCount,
        maxAnalysisPointsPerPreview: settings.maxAnalysisPointsPerPreview,
      });
    }
    preview.analysisPointCount = analysisPointCount;
    return analysisStrokes;
  }

  function resetCurrentStroke() {
    state.currentStroke = null;
    state.activePointerId = null;
  }

  function discardCurrentStroke() {
    if (!state.currentStroke) return false;
    if (state.currentStroke.rafId && typeof cancelAnimationFrame === "function") {
      try {
        cancelAnimationFrame(state.currentStroke.rafId);
      } catch {
        // ignore cancel failures
      }
    }
    try {
      state.currentStroke.pathEl?.remove();
    } catch {
      // ignore DOM removal errors
    }
    resetCurrentStroke();
    return true;
  }

  function averagePoint(points = []) {
    if (!Array.isArray(points) || !points.length) return { x: 0, y: 0 };
    const sum = points.reduce(
      (acc, pt) => ({
        x: acc.x + (Number(pt?.x) || 0),
        y: acc.y + (Number(pt?.y) || 0),
      }),
      { x: 0, y: 0 },
    );
    return {
      x: sum.x / points.length,
      y: sum.y / points.length,
    };
  }

  function unitVector(a, b) {
    const dx = (Number(b?.x) || 0) - (Number(a?.x) || 0);
    const dy = (Number(b?.y) || 0) - (Number(a?.y) || 0);
    const len = Math.hypot(dx, dy);
    if (!Number.isFinite(len) || len < 1e-6) return null;
    return { x: dx / len, y: dy / len, len };
  }

  function averageLineConsensus(strokes = []) {
    const segments = strokes
      .map((stroke) => {
        const points = Array.isArray(stroke?.points) ? stroke.points : [];
        if (points.length < 2) return null;
        const start = points[0];
        const end = points[points.length - 1];
        const dir = unitVector(start, end);
        if (!dir) return null;
        return { start, end, dir, len: dir.len };
      })
      .filter(Boolean);

    if (segments.length < 2) return null;

    const reference = segments[0].dir;
    const aligned = segments.map((segment) => {
      const dot = (segment.dir.x * reference.x) + (segment.dir.y * reference.y);
      if (dot >= 0) return segment;
      return {
        ...segment,
        start: segment.end,
        end: segment.start,
        dir: { x: -segment.dir.x, y: -segment.dir.y, len: segment.len },
      };
    });

    const avgDir = averagePoint(aligned.map((segment) => segment.dir));
    const dirLen = Math.hypot(avgDir.x, avgDir.y);
    if (!Number.isFinite(dirLen) || dirLen < 1e-6) return null;
    const axis = { x: avgDir.x / dirLen, y: avgDir.y / dirLen };

    const dirConsistency = aligned.reduce((acc, segment) => {
      const dot = Math.abs((segment.dir.x * axis.x) + (segment.dir.y * axis.y));
      return acc + dot;
    }, 0) / aligned.length;

    if (dirConsistency < 0.9) return null;

    const starts = aligned.map((segment) => segment.start);
    const ends = aligned.map((segment) => segment.end);
    const avgStart = averagePoint(starts);
    const avgEnd = averagePoint(ends);
    const meanLength = aligned.reduce((acc, segment) => acc + segment.len, 0) /
      aligned.length;

    const startSpread =
      starts.reduce((acc, pt) => acc + distance(pt, avgStart), 0) /
      starts.length;
    const endSpread = ends.reduce((acc, pt) => acc + distance(pt, avgEnd), 0) /
      ends.length;
    const spreadLimit = Math.max(spacingThreshold() * 6, meanLength * 0.42);
    if (startSpread > spreadLimit || endSpread > spreadLimit) return null;

    const lengthDeviation = aligned.reduce(
      (acc, segment) => acc + Math.abs(segment.len - meanLength),
      0,
    ) /
      Math.max(1e-6, meanLength * aligned.length);
    if (lengthDeviation > 0.5) return null;

    const averagedDir = unitVector(avgStart, avgEnd);
    if (
      !averagedDir ||
      averagedDir.len < Math.max(0.25, minimumStrokeLength() * 0.35)
    ) {
      return null;
    }

    return [avgStart, avgEnd];
  }

  function sketchEvidenceSummary(strokes = []) {
    const allPoints = strokes.flatMap((stroke) => stroke.points || []);
    if (!allPoints.length) {
      return { sideRegionCount: 0, dominantDirectionCount: 0, sideSupport: {}, diagonal: 0, bbox: null };
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    allPoints.forEach((pt) => {
      minX = Math.min(minX, pt.x);
      minY = Math.min(minY, pt.y);
      maxX = Math.max(maxX, pt.x);
      maxY = Math.max(maxY, pt.y);
    });
    const width = Math.max(0, maxX - minX);
    const height = Math.max(0, maxY - minY);
    const diagonal = Math.hypot(width, height);
    const band = Math.max(toleranceFromScreenPixels(14, 14), diagonal * 0.18);
    const sideSupport = { left: 0, right: 0, top: 0, bottom: 0 };
    const directionBuckets = new Set();

    strokes.forEach((stroke) => {
      const pts = stroke.points || [];
      if (pts.length < 2) return;
      let sMinX = Infinity;
      let sMinY = Infinity;
      let sMaxX = -Infinity;
      let sMaxY = -Infinity;
      pts.forEach((pt) => {
        sMinX = Math.min(sMinX, pt.x);
        sMinY = Math.min(sMinY, pt.y);
        sMaxX = Math.max(sMaxX, pt.x);
        sMaxY = Math.max(sMaxY, pt.y);
      });
      const midX = (sMinX + sMaxX) / 2;
      const midY = (sMinY + sMaxY) / 2;
      const sideHits = [];
      if (midX <= minX + band || sMinX <= minX + band * 0.65) sideHits.push("left");
      if (midX >= maxX - band || sMaxX >= maxX - band * 0.65) sideHits.push("right");
      if (midY <= minY + band || sMinY <= minY + band * 0.65) sideHits.push("top");
      if (midY >= maxY - band || sMaxY >= maxY - band * 0.65) sideHits.push("bottom");
      sideHits.forEach((side) => { sideSupport[side] += 1; });

      const start = pts[0];
      const end = pts[pts.length - 1];
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const len = Math.hypot(dx, dy);
      if (len > 1e-6) {
        const ax = Math.abs(dx / len);
        const ay = Math.abs(dy / len);
        if (ax >= 0.72) directionBuckets.add("horizontal");
        if (ay >= 0.72) directionBuckets.add("vertical");
        if (ax < 0.72 && ay < 0.72) directionBuckets.add("diagonal");
      }
    });

    const sideRegionCount = Object.values(sideSupport).filter((count) => count > 0).length;
    return {
      sideRegionCount,
      dominantDirectionCount: directionBuckets.size,
      sideSupport,
      diagonal,
      bbox: { minX, minY, maxX, maxY, width, height },
    };
  }

  function countExplainedAngleStrokes(angleFit) {
    if (!Array.isArray(angleFit?.strokeAssignments)) return 0;
    return angleFit.strokeAssignments.filter((entry) => entry.assignedSegment && entry.assignedSegment !== "rejected").length;
  }

  function hasClosureEvidence(strokes = []) {
    if (strokes.length < 3) return false;
    const first = strokes[0]?.points?.[0];
    const lastStroke = strokes[strokes.length - 1];
    const lastPoints = lastStroke?.points || [];
    const last = lastPoints[lastPoints.length - 1];
    if (!first || !last) return false;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    strokes.forEach((stroke) => {
      (stroke.points || []).forEach((pt) => {
        minX = Math.min(minX, pt.x);
        minY = Math.min(minY, pt.y);
        maxX = Math.max(maxX, pt.x);
        maxY = Math.max(maxY, pt.y);
      });
    });
    const diagonal = Number.isFinite(minX) ? Math.hypot(maxX - minX, maxY - minY) : 0;
    const closureTolerance = Math.max(toleranceFromScreenPixels(12, 12), diagonal * 0.10);
    return distance(first, last) <= closureTolerance * 3.5;
  }

  function buildPreviewTracks(preview) {
    if (!preview) return [];
    if (preview.rawStrokes.length === 0) return [];
    if (preview.rawStrokes.length === 1) {
      const first = preview.rawStrokes[0]?.points || [];
      return Array.isArray(first) && first.length >= 2 ? [first] : [];
    }

    const recognitionStrokes = getRecognitionStrokes(preview);
    const recognitionPointCount = recognitionStrokes.reduce((sum, stroke) => sum + (stroke.points?.length || 0), 0);
    const evidenceSummary = sketchEvidenceSummary(recognitionStrokes);
    const endpointClosurePossible = hasClosureEvidence(recognitionStrokes);
    const multiSideBandEvidence = evidenceSummary.sideRegionCount >= 3 && evidenceSummary.dominantDirectionCount >= 2;
    const closedShapePossible = endpointClosurePossible || multiSideBandEvidence;
    const quadrilateralPrecheck = recognitionStrokes.length >= 4 &&
      evidenceSummary.sideRegionCount >= 3 &&
      evidenceSummary.diagonal >= Math.max(toleranceFromScreenPixels(32, 32), minimumStrokeLength() * 2);
    const timing = {};

    let recognizerStart = nowMs();
    const straightLineFit = fitStraightLineHypothesis(recognitionStrokes, {
      minAllowedError: lineFitAllowedError(),
      errorLengthRatio: 0.08,
      directionToleranceDegrees: 24,
      linearityThreshold: 0.34,
      confidenceThreshold: 0.56,
      minDirectionAgreement: 0.78,
      existingLineDirectionToleranceDegrees: 20,
      highConfidenceMinAllowedOffset: Math.max(
        toleranceFromScreenPixels(10, 10),
        lineFitAllowedError() * 1.25,
      ),
      minProjectedLength: minimumStrokeLength() * 1.1,
      previousLine: preview.straightLineState,
    });
    timing.lineRecognizerMs = nowMs() - recognizerStart;
    recognizerStart = nowMs();
    const angleFit = fitTwoSegmentAngleHypothesis(recognitionStrokes, {
      minAllowedError: Math.max(toleranceFromScreenPixels(8, 8), lineFitAllowedError()),
      errorLengthRatio: 0.08,
      minAngleDegrees: 25,
      maxImprovementRatio: 0.65,
      minSegmentLength: minimumStrokeLength() * 1.35,
      confidenceThreshold: 0.6,
    });
    timing.angleRecognizerMs = nowMs() - recognizerStart;
    recognizerStart = nowMs();
    const triangleFit = closedShapePossible && recognitionStrokes.length >= 3
      ? fitTriangleHypothesis(recognitionStrokes, {
      minClosureTolerance: toleranceFromScreenPixels(12, 12),
      minSideLength: Math.max(toleranceFromScreenPixels(20, 20), minimumStrokeLength() * 1.8),
      minSideLengthRatio: 0.15,
      closureDiagonalRatio: 0.10,
      rightAngleToleranceDegrees: 15,
      minCornerAngleDegrees: 20,
      maxImprovementRatio: 0.75,
      confidenceThreshold: 0.58,
      twoSegmentError: angleFit.bestTwoLineError,
      maxTriangleCandidates: Number(globalThis?.NodevisionSketchSettings?.maxTriangleCandidates) || 40,
    })
      : { triangle: false, reason: "closure-gate", strokeCount: recognitionStrokes.length, activeSegmentCount: 0 };
    timing.triangleRecognizerMs = nowMs() - recognizerStart;
    recognizerStart = nowMs();
    const quadrilateralFit = quadrilateralPrecheck
      ? fitQuadrilateralHypothesis(recognitionStrokes, {
      minClosureTolerance: toleranceFromScreenPixels(12, 12),
      minSideLength: Math.max(toleranceFromScreenPixels(18, 18), minimumStrokeLength() * 1.45),
      minSideLengthRatio: 0.12,
      closureDiagonalRatio: 0.10,
      assignmentDiagonalRatio: 0.10,
      parallelToleranceDegrees: 15,
      rightAngleToleranceDegrees: 15,
      minCornerAngleDegrees: 18,
      minClosureScore: 0.38,
      confidenceThreshold: 0.56,
      maxTriangleErrorRatio: 1.18,
      triangleError: triangleFit.threeSegmentError,
      maxQuadrilateralCandidates: Number(globalThis?.NodevisionSketchSettings?.maxQuadrilateralCandidates) || 60,
    })
      : { quadrilateral: false, rectangleLike: false, reason: "precheck-gate", strokeCount: recognitionStrokes.length, activeSegmentCount: 0 };
    timing.quadrilateralRecognizerMs = nowMs() - recognizerStart;
    const angleExplainedStrokes = countExplainedAngleStrokes(angleFit);
    const lineExplainedStrokes = Number(straightLineFit.supportedStrokeCount) || (straightLineFit.straight ? 1 : 0);
    const totalRecognitionStrokes = Math.max(1, recognitionStrokes.length);
    const angleExplainedRatio = angleExplainedStrokes / totalRecognitionStrokes;
    const lineExplainedRatio = lineExplainedStrokes / totalRecognitionStrokes;
    const simpleHypothesisBlockedByGlobalEvidence = quadrilateralPrecheck &&
      evidenceSummary.sideRegionCount >= 3 &&
      Math.max(angleExplainedRatio, lineExplainedRatio) < 0.68;

    preview.recognitionTiming = {
      ...timing,
      analysisPointCount: recognitionPointCount,
      closedShapePossible,
      endpointClosurePossible,
      multiSideBandEvidence,
      quadrilateralPrecheck,
      evidenceSummary,
    };
    const triangleIgnoredFourthSideSupport = quadrilateralFit.quadrilateral
      ? Math.max(
        Number(quadrilateralFit.sideLengthA) || 0,
        Number(quadrilateralFit.sideLengthB) || 0,
        Number(quadrilateralFit.sideLengthC) || 0,
        Number(quadrilateralFit.sideLengthD) || 0,
      )
      : 0;
    const quadrilateralBeatsTriangle = quadrilateralFit.quadrilateral && (
      !triangleFit.triangle ||
      quadrilateralFit.confidence >= triangleFit.confidence - 0.10 ||
      triangleIgnoredFourthSideSupport > Math.max(toleranceFromScreenPixels(20, 20), quadrilateralFit.closureTolerance * 1.5)
    );
    const triangleBeatsOpenAngle = triangleFit.triangle && !quadrilateralBeatsTriangle;
    if (quadrilateralBeatsTriangle) {
      const previousAngularMode = preview.angularPathState?.mode || angleFit.winningHypothesis;
      preview.straightLineState = null;
      preview.angularPathState = {
        mode: quadrilateralFit.rectangleLike ? "rectangle" : "quadrilateral",
        points: quadrilateralFit.points.map((pt) => ({ ...pt })),
        strokeCount: quadrilateralFit.strokeCount,
        confidence: quadrilateralFit.confidence,
      };
      preview.hypotheses = {
        mode: quadrilateralFit.rectangleLike ? "rectangle" : "quadrilateral",
        strokeCount: quadrilateralFit.strokeCount,
        activeSegmentCount: quadrilateralFit.activeSegmentCount,
        pointCount: quadrilateralFit.pointCount,
        confidence: quadrilateralFit.confidence,
        triangleConfidence: triangleFit.confidence,
        quadrilateralConfidence: quadrilateralFit.confidence,
        rectangleSubtypeConfidence: quadrilateralFit.rectangleSubtypeConfidence,
        triangleIgnoredStrokeCount: Number(triangleFit.rejectedStrokes?.length) || 0,
        triangleIgnoredStrokeSupportLength: triangleIgnoredFourthSideSupport,
        triangleReason: triangleFit.reason,
        quadrilateralReason: quadrilateralFit.reason,
        triangleClosureScore: triangleFit.closureScore,
        closureScore: quadrilateralFit.closureScore,
        closureError: quadrilateralFit.closureError,
        closureTolerance: quadrilateralFit.closureTolerance,
        assignmentTolerance: quadrilateralFit.assignmentTolerance,
        fourSegmentError: quadrilateralFit.fourSegmentError,
        threeSegmentError: triangleFit.threeSegmentError,
        improvementRatio: quadrilateralFit.improvementRatio,
        parallelScore: quadrilateralFit.parallelScore,
        rightAngleScore: quadrilateralFit.rightAngleScore,
        sideAngles: quadrilateralFit.sideAngles,
        cornerAngles: quadrilateralFit.cornerAngles,
        detectedSideCount: quadrilateralFit.detectedSideCount,
        supportA: quadrilateralFit.supportA,
        supportB: quadrilateralFit.supportB,
        supportC: quadrilateralFit.supportC,
        supportD: quadrilateralFit.supportD,
        sideLengthA: quadrilateralFit.sideLengthA,
        sideLengthB: quadrilateralFit.sideLengthB,
        sideLengthC: quadrilateralFit.sideLengthC,
        sideLengthD: quadrilateralFit.sideLengthD,
        strokeAssignments: quadrilateralFit.strokeAssignments,
        rejectedStrokes: quadrilateralFit.rejectedStrokes,
        vertices: quadrilateralFit.vertices,
        winningHypothesis: quadrilateralFit.winningHypothesis,
        previousWinningHypothesis: previousAngularMode,
        triangleWouldHaveWon: Boolean(triangleFit.triangle),
        quadrilateralBeatsTriangle,
        endpointClosurePossible,
        multiSideBandEvidence,
        quadrilateralPrecheck,
        evidenceSummary,
        angleExplainedStrokes,
        lineExplainedStrokes,
        simpleHypothesisBlockedByGlobalEvidence,
        discontinuities: 4,
        closed: true,
      };
      if (globalThis?.NodevisionDebug?.pencilSketchQuadrilateralFit || globalThis?.NodevisionDebug?.pencilSketchTriangleFit) {
        console.debug("[PencilSketchQuadrilateralFit]", preview.hypotheses);
      }
      return [quadrilateralFit.points];
    }

    if (triangleBeatsOpenAngle) {
      const previousAngularMode = preview.angularPathState?.mode || angleFit.winningHypothesis;
      preview.straightLineState = null;
      preview.angularPathState = {
        mode: "triangle",
        points: triangleFit.points.map((pt) => ({ ...pt })),
        strokeCount: triangleFit.strokeCount,
        confidence: triangleFit.confidence,
      };
      preview.hypotheses = {
        mode: "triangle",
        strokeCount: triangleFit.strokeCount,
        activeSegmentCount: triangleFit.activeSegmentCount,
        pointCount: triangleFit.pointCount,
        confidence: triangleFit.confidence,
        triangleConfidence: triangleFit.confidence,
        quadrilateralConfidence: quadrilateralFit.confidence,
        rectangleSubtypeConfidence: quadrilateralFit.rectangleSubtypeConfidence,
        quadrilateralReason: quadrilateralFit.reason,
        quadrilateralRejectedReason: quadrilateralFit.reason,
        quadrilateralSideSupportA: quadrilateralFit.supportA,
        quadrilateralSideSupportB: quadrilateralFit.supportB,
        quadrilateralSideSupportC: quadrilateralFit.supportC,
        quadrilateralSideSupportD: quadrilateralFit.supportD,
        quadrilateralStrokeAssignments: quadrilateralFit.strokeAssignments,
        quadrilateralRejectedStrokes: quadrilateralFit.rejectedStrokes,
        triangleIgnoredStrokeSupportLength: triangleIgnoredFourthSideSupport,
        endpointClosurePossible,
        multiSideBandEvidence,
        quadrilateralPrecheck,
        evidenceSummary,
        angleExplainedStrokes,
        lineExplainedStrokes,
        simpleHypothesisBlockedByGlobalEvidence,
        twoSegmentError: triangleFit.twoSegmentError,
        threeSegmentError: triangleFit.threeSegmentError,
        improvementRatio: triangleFit.improvementRatio,
        closureScore: triangleFit.closureScore,
        closureError: triangleFit.closureError,
        closureTolerance: triangleFit.closureTolerance,
        assignmentTolerance: triangleFit.assignmentTolerance,
        rightTriangleCandidateEvaluated: triangleFit.rightTriangleCandidateEvaluated,
        rightTriangleCompatible: triangleFit.rightTriangleCompatible,
        rightAngleScore: triangleFit.rightAngleScore,
        detectedSideCount: triangleFit.detectedSideCount,
        sideAngles: triangleFit.sideAngles,
        strokeAssignments: triangleFit.strokeAssignments,
        rejectedStrokes: triangleFit.rejectedStrokes,
        supportA: triangleFit.supportA,
        supportB: triangleFit.supportB,
        supportC: triangleFit.supportC,
        sideLengthA: triangleFit.sideLengthA,
        sideLengthB: triangleFit.sideLengthB,
        sideLengthC: triangleFit.sideLengthC,
        cornerAngles: triangleFit.cornerAngles,
        vertices: triangleFit.vertices,
        winningHypothesis: triangleFit.winningHypothesis,
        previousWinningHypothesis: previousAngularMode,
        discontinuities: 3,
        closed: true,
      };
      if (globalThis?.NodevisionDebug?.pencilSketchTriangleFit) {
        console.debug("[PencilSketchTriangleFit]", preview.hypotheses);
      }
      return [triangleFit.points];
    }

    const previousAngleState = preview.angularPathState?.mode === "two-segment-angle"
      ? preview.angularPathState
      : null;
    const latestStrokeAngleAssignment = Array.isArray(angleFit.strokeAssignments)
      ? angleFit.strokeAssignments.find((entry) =>
        entry.strokeId === preview.rawStrokes.length - 1
      )
      : null;
    const angleFitExtendsPreviousSegmentB = previousAngleState && angleFit.angle && (
      latestStrokeAngleAssignment?.assignedSegment === "B" ||
      distance(angleFit.endpointB, previousAngleState.points?.[2]) >
        Math.max(toleranceFromScreenPixels(10, 10), angleFit.assignmentTolerance || 0)
    );
    const keepPreviousAngleStable = previousAngleState &&
      !angleFitExtendsPreviousSegmentB &&
      preview.rawStrokes.length > previousAngleState.strokeCount &&
      !triangleFit.triangle &&
      triangleFit.activeSegmentCount === 3 &&
      triangleFit.closureScore >= 0.25 &&
      triangleFit.supportC >= 1;
    if (keepPreviousAngleStable) {
      preview.straightLineState = null;
      preview.hypotheses = {
        mode: "two-segment-angle",
        strokeCount: preview.rawStrokes.length,
        confidence: previousAngleState.confidence,
        winningHypothesis: "two-segment-angle",
        candidateTriangleReason: triangleFit.reason,
        candidateTriangleConfidence: triangleFit.confidence,
        twoSegmentError: triangleFit.twoSegmentError,
        threeSegmentError: triangleFit.threeSegmentError,
        closureScore: triangleFit.closureScore,
        rightTriangleCandidateEvaluated: triangleFit.rightTriangleCandidateEvaluated,
        rightTriangleCompatible: triangleFit.rightTriangleCompatible,
        rightAngleScore: triangleFit.rightAngleScore,
        detectedSideCount: triangleFit.detectedSideCount,
        sideAngles: triangleFit.sideAngles,
        strokeAssignments: triangleFit.strokeAssignments,
        rejectedStrokes: triangleFit.rejectedStrokes,
        supportA: triangleFit.supportA,
        supportB: triangleFit.supportB,
        supportC: triangleFit.supportC,
        vertices: triangleFit.vertices,
        preservedForCandidateThirdSide: true,
        latestStrokeAngleAssignment,
        angleFitExtendsPreviousSegmentB,
        discontinuities: 1,
      };
      if (globalThis?.NodevisionDebug?.pencilSketchTriangleFit) {
        console.debug("[PencilSketchTriangleFit:pending]", preview.hypotheses);
      }
      return [previousAngleState.points.map((pt) => ({ ...pt }))];
    }

    const angleBeatsStraight = angleFit.angle && !simpleHypothesisBlockedByGlobalEvidence && (
      !straightLineFit.straight ||
      (angleFit.improvementRatio <= 0.58 &&
        angleFit.confidence >= Math.max(0.62, straightLineFit.confidence - 0.08))
    );
    if (angleBeatsStraight) {
      preview.straightLineState = null;
      preview.angularPathState = {
        mode: "two-segment-angle",
        points: angleFit.points.map((pt) => ({ ...pt })),
        strokeCount: angleFit.strokeCount,
        confidence: angleFit.confidence,
      };
      preview.hypotheses = {
        mode: "two-segment-angle",
        strokeCount: angleFit.strokeCount,
        pointCount: angleFit.pointCount,
        confidence: angleFit.confidence,
        oneLineError: angleFit.oneLineError,
        bestTwoLineError: angleFit.bestTwoLineError,
        improvementRatio: angleFit.improvementRatio,
        angleBetweenSegments: angleFit.angleBetweenSegments,
        cornerPoint: angleFit.cornerPoint,
        segmentLengthA: angleFit.segmentLengthA,
        segmentLengthB: angleFit.segmentLengthB,
        supportA: angleFit.supportA,
        supportB: angleFit.supportB,
        assignedCountA: angleFit.assignedCountA,
        assignedCountB: angleFit.assignedCountB,
        projectionMinA: angleFit.projectionMinA,
        projectionMaxA: angleFit.projectionMaxA,
        projectionMinB: angleFit.projectionMinB,
        projectionMaxB: angleFit.projectionMaxB,
        endpointA: angleFit.endpointA,
        endpointB: angleFit.endpointB,
        rejectedFarPointsA: angleFit.rejectedFarPointsA,
        rejectedFarPointsB: angleFit.rejectedFarPointsB,
        strokeAssignments: angleFit.strokeAssignments,
        segmentAAssignedStrokeCount: angleFit.segmentAAssignedStrokeCount,
        segmentBAssignedStrokeCount: angleFit.segmentBAssignedStrokeCount,
        segmentBFarthestProjectedEndpoint: angleFit.segmentBFarthestProjectedEndpoint,
        segmentBEndpointSourceStrokeId: angleFit.segmentBEndpointSourceStrokeId,
        assignmentTolerance: angleFit.assignmentTolerance,
        roughAssignmentTolerance: angleFit.roughAssignmentTolerance,
        splitIndex: angleFit.splitIndex,
        winningHypothesis: angleFit.winningHypothesis,
        previousWinningHypothesis: straightLineFit.previousWinningHypothesis,
        straightLineConfidence: straightLineFit.confidence,
        straightLineReason: straightLineFit.reason,
        candidateTriangleReason: triangleFit.reason,
        candidateTriangleConfidence: triangleFit.confidence,
        quadrilateralConfidence: quadrilateralFit.confidence,
        rectangleSubtypeConfidence: quadrilateralFit.rectangleSubtypeConfidence,
        quadrilateralReason: quadrilateralFit.reason,
        endpointClosurePossible,
        multiSideBandEvidence,
        quadrilateralPrecheck,
        evidenceSummary,
        angleExplainedStrokes,
        lineExplainedStrokes,
        simpleHypothesisBlockedByGlobalEvidence,
        discontinuities: 1,
      };
      if (globalThis?.NodevisionDebug?.pencilSketchAngleFit) {
        console.debug("[PencilSketchAngleFit]", preview.hypotheses);
      }
      return [angleFit.points];
    }

    if (straightLineFit.straight && !simpleHypothesisBlockedByGlobalEvidence) {
      preview.hypotheses = {
        mode: "open-straight-line",
        strokeCount: straightLineFit.strokeCount,
        pointCount: straightLineFit.pointCount,
        confidence: straightLineFit.confidence,
        fittedLineAngle: straightLineFit.angleDegrees,
        projectedLength: straightLineFit.projectedLength,
        perpendicularRmsError: straightLineFit.perpendicularRmsError,
        allowedError: straightLineFit.allowedError,
        allowedOffset: straightLineFit.allowedOffset,
        linearity: straightLineFit.linearity,
        directionAgreement: straightLineFit.directionAgreement,
        alignedRatio: straightLineFit.alignedRatio,
        supportRatio: straightLineFit.supportRatio,
        supportedStrokeCount: straightLineFit.supportedStrokeCount,
        outlierPointCount: straightLineFit.outlierPointCount,
        allPointRmsError: straightLineFit.allPointRmsError,
        reinforcementClassification: straightLineFit.reinforcementClassification,
        reinforcementOverlapRatio: straightLineFit.reinforcementOverlapRatio,
        reinforcementRmsError: straightLineFit.reinforcementRmsError,
        previousWinningHypothesis: straightLineFit.previousWinningHypothesis,
        currentWinningHypothesis: straightLineFit.currentWinningHypothesis,
        stablePreviousLine: straightLineFit.stablePreviousLine,
        latestStrokeCompatible: straightLineFit.latestStrokeCompatible,
        latestDirectionCompatible: straightLineFit.latestDirectionCompatible,
        latestOffsetCompatible: straightLineFit.latestOffsetCompatible,
        latestSpanCompatible: straightLineFit.latestSpanCompatible,
        latestStrongViolation: straightLineFit.latestStrongViolation,
        coverageRatio: straightLineFit.coverageRatio,
        maxGapRatio: straightLineFit.maxGapRatio,
        winningHypothesis: straightLineFit.winningHypothesis,
        quadrilateralConfidence: quadrilateralFit.confidence,
        quadrilateralReason: quadrilateralFit.reason,
        endpointClosurePossible,
        multiSideBandEvidence,
        quadrilateralPrecheck,
        evidenceSummary,
        angleExplainedStrokes,
        lineExplainedStrokes,
        simpleHypothesisBlockedByGlobalEvidence,
        discontinuities: 0,
      };
      preview.straightLineState = straightLineFit.state;
      preview.angularPathState = null;
      if (globalThis?.NodevisionDebug?.pencilSketchLineFit) {
        console.debug("[PencilSketchLineFit]", preview.hypotheses);
      }
      return [straightLineFit.points];
    }

    if (globalThis?.NodevisionDebug?.pencilSketchLineFit) {
      console.debug("[PencilSketchLineFit:rejected]", {
        previousWinningHypothesis: straightLineFit.previousWinningHypothesis,
        currentWinningHypothesis: straightLineFit.currentWinningHypothesis,
        strokeCount: straightLineFit.strokeCount,
        fittedLineAngle: straightLineFit.angleDegrees,
        directionAgreement: straightLineFit.directionAgreement,
        perpendicularRmsError: straightLineFit.perpendicularRmsError,
        allowedOffset: straightLineFit.allowedOffset,
        projectedLength: straightLineFit.projectedLength,
        confidence: straightLineFit.confidence,
        latestStrongViolation: straightLineFit.latestStrongViolation,
        reason: straightLineFit.reason,
      });
    }
    if (globalThis?.NodevisionDebug?.pencilSketchAngleFit) {
      console.debug("[PencilSketchAngleFit:rejected]", {
        winningHypothesis: angleFit.winningHypothesis,
        strokeCount: angleFit.strokeCount,
        oneLineError: angleFit.oneLineError,
        bestTwoLineError: angleFit.bestTwoLineError,
        improvementRatio: angleFit.improvementRatio,
        cornerPoint: angleFit.cornerPoint,
        angleBetweenSegments: angleFit.angleBetweenSegments,
        segmentLengthA: angleFit.segmentLengthA,
        segmentLengthB: angleFit.segmentLengthB,
        assignedCountA: angleFit.assignedCountA,
        assignedCountB: angleFit.assignedCountB,
        projectionMinA: angleFit.projectionMinA,
        projectionMaxA: angleFit.projectionMaxA,
        projectionMinB: angleFit.projectionMinB,
        projectionMaxB: angleFit.projectionMaxB,
        endpointA: angleFit.endpointA,
        endpointB: angleFit.endpointB,
        rejectedFarPointsA: angleFit.rejectedFarPointsA,
        rejectedFarPointsB: angleFit.rejectedFarPointsB,
        strokeAssignments: angleFit.strokeAssignments,
        segmentAAssignedStrokeCount: angleFit.segmentAAssignedStrokeCount,
        segmentBAssignedStrokeCount: angleFit.segmentBAssignedStrokeCount,
        segmentBFarthestProjectedEndpoint: angleFit.segmentBFarthestProjectedEndpoint,
        segmentBEndpointSourceStrokeId: angleFit.segmentBEndpointSourceStrokeId,
        assignmentTolerance: angleFit.assignmentTolerance,
        roughAssignmentTolerance: angleFit.roughAssignmentTolerance,
        confidence: angleFit.confidence,
        reason: angleFit.reason,
      });
    }
    if (globalThis?.NodevisionDebug?.pencilSketchTriangleFit) {
      console.debug("[PencilSketchTriangleFit:rejected]", {
        winningHypothesis: triangleFit.winningHypothesis,
        strokeCount: triangleFit.strokeCount,
        activeSegmentCount: triangleFit.activeSegmentCount,
        twoSegmentError: triangleFit.twoSegmentError,
        threeSegmentError: triangleFit.threeSegmentError,
        confidence: triangleFit.confidence,
        closureScore: triangleFit.closureScore,
        rightTriangleCandidateEvaluated: triangleFit.rightTriangleCandidateEvaluated,
        rightTriangleCompatible: triangleFit.rightTriangleCompatible,
        rightAngleScore: triangleFit.rightAngleScore,
        detectedSideCount: triangleFit.detectedSideCount,
        sideAngles: triangleFit.sideAngles,
        strokeAssignments: triangleFit.strokeAssignments,
        rejectedStrokes: triangleFit.rejectedStrokes,
        supportA: triangleFit.supportA,
        supportB: triangleFit.supportB,
        supportC: triangleFit.supportC,
        vertices: triangleFit.vertices,
        reason: triangleFit.reason,
      });
    }
    if (globalThis?.NodevisionDebug?.pencilSketchQuadrilateralFit) {
      console.debug("[PencilSketchQuadrilateralFit:rejected]", {
        winningHypothesis: quadrilateralFit.winningHypothesis,
        strokeCount: quadrilateralFit.strokeCount,
        activeSegmentCount: quadrilateralFit.activeSegmentCount,
        triangleConfidence: triangleFit.confidence,
        quadrilateralConfidence: quadrilateralFit.confidence,
        rectangleSubtypeConfidence: quadrilateralFit.rectangleSubtypeConfidence,
        fourSegmentError: quadrilateralFit.fourSegmentError,
        threeSegmentError: triangleFit.threeSegmentError,
        closureScore: quadrilateralFit.closureScore,
        parallelScore: quadrilateralFit.parallelScore,
        rightAngleScore: quadrilateralFit.rightAngleScore,
        detectedSideCount: quadrilateralFit.detectedSideCount,
        sideAngles: quadrilateralFit.sideAngles,
        cornerAngles: quadrilateralFit.cornerAngles,
        supportA: quadrilateralFit.supportA,
        supportB: quadrilateralFit.supportB,
        supportC: quadrilateralFit.supportC,
        supportD: quadrilateralFit.supportD,
        strokeAssignments: quadrilateralFit.strokeAssignments,
        rejectedStrokes: quadrilateralFit.rejectedStrokes,
        vertices: quadrilateralFit.vertices,
        reason: quadrilateralFit.reason,
      });
    }
    preview.straightLineState = null;
    preview.angularPathState = null;

    if (simpleHypothesisBlockedByGlobalEvidence) {
      preview.hypotheses = {
        mode: "global-evidence-unresolved",
        strokeCount: preview.rawStrokes.length,
        confidence: 0,
        lineConfidence: straightLineFit.confidence,
        angleConfidence: angleFit.confidence,
        triangleConfidence: triangleFit.confidence,
        quadrilateralConfidence: quadrilateralFit.confidence,
        rectangleSubtypeConfidence: quadrilateralFit.rectangleSubtypeConfidence,
        quadrilateralReason: quadrilateralFit.reason,
        reason: "simple-hypothesis-explains-too-little-global-evidence",
        endpointClosurePossible,
        multiSideBandEvidence,
        quadrilateralPrecheck,
        evidenceSummary,
        angleExplainedStrokes,
        lineExplainedStrokes,
        totalRecognitionStrokes,
        ignoredStrokeCount: Math.max(
          0,
          totalRecognitionStrokes - Math.max(angleExplainedStrokes, lineExplainedStrokes),
        ),
        discontinuities: 0,
      };
      if (
        globalThis?.NodevisionDebug?.pencilSketchAngleFit ||
        globalThis?.NodevisionDebug?.pencilSketchQuadrilateralFit
      ) {
        console.debug("[PencilSketchGlobalEvidence:blocked-local]", preview.hypotheses);
      }
      return [];
    }

    const lineConsensus = averageLineConsensus(recognitionStrokes);
    if (lineConsensus) {
      preview.hypotheses = {
        mode: "line-consensus",
        strokeCount: preview.rawStrokes.length,
        confidence: 1,
        discontinuities: 0,
      };
      return [lineConsensus];
    }

    const strokePointLists = recognitionStrokes.map((stroke) => stroke.points);
    const sharedOptions = {
      sampleCount: 44,
      minLength: minimumStrokeLength(),
      smoothingRadius: 2,
      smoothingPasses: smoothingPasses(),
      simplifyDistance: simplifyThreshold(),
      // Single-preview interpretation: permissive continuity, no multi-object intent.
      trackDistanceThreshold: trackDistanceThreshold() * 1.8,
      clusterSpreadFactor: 5.2,
      lengthThresholdFactor: 0.3,
      continuityGapThreshold: trackDistanceThreshold() * 1.45,
      continuitySpreadFactor: 3.2,
      continuityLengthFactor: 0.12,
      directionSimilarityThreshold: 0.68,
      minDirectionReliability: 0.16,
      minDirectionCoherence: 0.64,
      directionPenaltyFactor: 0.35,
      reverseDirectionPenalty: 0.12,
      sameDirectionThreshold: 0.2,
      recentStrokeWindow: 4,
      farStrokeWindow: 10,
      recentDistanceThreshold: trackDistanceThreshold() * 0.65,
      recentSameDirectionBonus: 0.7,
      shadingReverseMinDot: 0.45,
      shadingBonus: 0.62,
      oldStrokePenalty: 0.2,
      lineIntentThreshold: 0.92,
      linearityThreshold: 0.9,
      lineFitThreshold: 0.74,
      lineErrorScale: 0.075,
      lineDirectionMinDot: 0.92,
      lineBackAndForthBoost: 0.12,
      lineMinStrokeCount: 5,
      progressiveMinStrokeCount: 4,
      progressiveTravelThreshold: trackDistanceThreshold() * 0.23,
      progressiveOverlapThreshold: trackDistanceThreshold() * 0.14,
      progressiveContinuityThreshold: trackDistanceThreshold() * 0.62,
      stitchJoinTolerance: minimumStrokeLength() * 0.22,
      turnMinAxial: 0.72,
      turnContinuityThreshold: trackDistanceThreshold() * 0.56,
      turnRecentWindow: 5,
      tailDirectionWindow: 6,
      mergeTrackGapThreshold: trackDistanceThreshold() * 1.2,
      mergeTrackTurnMinAxial: 0.76,
      mergeTrackIndexGap: 12,
      parallelCheckMinAxial: 0.9,
      parallelOffsetThreshold: trackDistanceThreshold() * 0.45,
      parallelOffsetSpreadFactor: 1.8,
      parallelAlongGapThreshold: trackDistanceThreshold() * 0.5,
      parallelAlongGapLengthFactor: 0.42,
    };

    const averaged = averageStrokes(strokePointLists, sharedOptions);
    if (Array.isArray(averaged) && averaged.length >= 2) {
      preview.hypotheses = {
        mode: "single-average-track",
        strokeCount: preview.rawStrokes.length,
        confidence: 1,
        discontinuities: 0,
      };
      return [averaged];
    }

    const inferredTracks = inferStrokeTracks(strokePointLists, sharedOptions)
      .filter((track) =>
        Array.isArray(track?.points) && track.points.length >= 2
      );
    if (!inferredTracks.length) {
      preview.hypotheses = {
        mode: "none",
        strokeCount: preview.rawStrokes.length,
        inferredTrackCount: 0,
        confidence: 0,
      };
      return [];
    }

    // One-preview-one-interpretation rule: pick the single strongest inferred
    // track (most supporting strokes, then longest geometric extent).
    const chosen = [...inferredTracks].sort((a, b) => {
      const bySupport = (Number(b.strokeCount) || 0) -
        (Number(a.strokeCount) || 0);
      if (bySupport !== 0) return bySupport;
      return strokeLength(b.points || []) - strokeLength(a.points || []);
    })[0];

    preview.hypotheses = {
      mode: "fallback-inferred-track",
      strokeCount: preview.rawStrokes.length,
      inferredTrackCount: inferredTracks.length,
      chosenSupport: Number(chosen?.strokeCount) || 0,
      confidence: 0.5,
      discontinuities: 0,
    };

    return [chosen.points];
  }

  function setPreviewTracks(preview, tracks = []) {
    const safeTracks = tracks.filter((points) =>
      Array.isArray(points) && points.length >= 2
    );
    const primaryTrack = safeTracks.length
      ? [...safeTracks].sort((a, b) => strokeLength(b) - strokeLength(a))[0]
      : null;
    const normalizedTracks = primaryTrack ? [primaryTrack] : [];
    preview.activePreviewGeometry = {
      tracks: normalizedTracks,
      pointCount: normalizedTracks.reduce(
        (sum, points) => sum + points.length,
        0,
      ),
      discontinuities: Number(preview.hypotheses?.discontinuities) || 0,
      hypothesis: preview.hypotheses?.mode || "none",
    };

    const closedPreview = Boolean(preview.hypotheses?.closed) &&
      Array.isArray(primaryTrack) && primaryTrack.length >= 3;
    const d = primaryTrack
      ? `${pointsToPathD(primaryTrack)}${closedPreview ? " Z" : ""}`
      : "";
    preview.lastPreviewD = d;
    preview.previewPathEl?.setAttribute("d", d);

    const visible = normalizedTracks.length > 0 && preview.visible &&
      state.constructionVisible;
    setPreviewVisible(preview.previewPathEl, visible);
  }

  function markRecognitionDirty(preview) {
    if (!preview) return 0;
    preview.recognitionDirty = true;
    preview.recognitionVersion = (Number(preview.recognitionVersion) || 0) + 1;
    return preview.recognitionVersion;
  }

  function scheduleRecognition(preview, reason = "schedule") {
    if (!preview) return false;
    const version = Number(preview.recognitionVersion) || markRecognitionDirty(preview);
    if (preview.recognitionTimer) clearTimeout(preview.recognitionTimer);
    const delay = Math.max(0, sketchPerformanceSettings().recognitionDebounceMs);
    preview.recognitionTimer = setTimeout(() => {
      preview.recognitionTimer = null;
      const run = () => {
        const latest = getPreviewById(preview.id);
        if (!latest || version !== latest.recognitionVersion || state.currentStroke) return;
        refreshPreviewRecognition(latest, { expectedVersion: version, reason });
      };
      if (typeof requestIdleCallback === "function") {
        requestIdleCallback(run, { timeout: 120 });
      } else {
        run();
      }
    }, delay);
    return true;
  }

  function refreshPreviewRecognition(preview, options = {}) {
    if (!preview) return;
    const expectedVersion = Number(options.expectedVersion) || null;
    if (expectedVersion && expectedVersion !== preview.recognitionVersion) return;
    if (preview.recognitionTimer) {
      clearTimeout(preview.recognitionTimer);
      preview.recognitionTimer = null;
    }
    const recognitionStart = nowMs();
    preview.recognitionRunning = true;
    const finishRecognition = (eventReason) => {
      preview.recognitionDirty = false;
      preview.lastRecognizedStrokeCount = preview.rawStrokes.length;
      preview.lastRecognizedPointCount = preview.rawStrokes.reduce((sum, stroke) => sum + (stroke.points?.length || 0), 0);
      preview.recognitionRunning = false;
      const recognitionMs = nowMs() - recognitionStart;
      preview.lastRecognitionMs = recognitionMs;
      if (sketchPerfLogEnabled() || recognitionMs > 20) {
        const payload = {
          recognitionMs,
          strokeCount: preview.rawStrokes.length,
          rawPointCount: preview.lastRecognizedPointCount,
          analysisPointCount: preview.analysisPointCount || 0,
          hypothesis: preview.hypotheses?.mode || "none",
          timing: preview.recognitionTiming || null,
          reason: eventReason || options.reason || "refresh",
        };
        if (recognitionMs > 20) console.warn("[PencilSketchPerformance] recognition slow", payload);
        else console.debug("[PencilSketchPerformance] recognition", payload);
      }
    };

    if (!preview.rawStrokes.length) {
      preview.activePreviewGeometry = null;
      preview.hypotheses = {};
      preview.straightLineState = null;
      preview.angularPathState = null;
      preview.lastPreviewD = "";
      preview.previewPathEl?.setAttribute("d", "");
      setPreviewVisible(preview.previewPathEl, false);
      finishRecognition("refresh-preview-empty");
      emitSketchPreviewsChanged("refresh-preview-empty");
      return;
    }

    const previousD = String(preview.previewPathEl?.getAttribute("d") || "");
    const tracks = buildPreviewTracks(preview);

    if (!tracks.length) {
      // Stability guard for transient recognition dips.
      if (previousD && preview.rawStrokes.length >= 2) {
        preview.previewPathEl?.setAttribute("d", previousD);
        setPreviewVisible(
          preview.previewPathEl,
          preview.visible && state.constructionVisible,
        );
      } else {
        preview.previewPathEl?.setAttribute("d", "");
        setPreviewVisible(preview.previewPathEl, false);
      }
      preview.activePreviewGeometry = {
        tracks: [],
        pointCount: 0,
        discontinuities: 0,
      };
      preview.straightLineState = null;
      preview.angularPathState = null;
      finishRecognition("refresh-preview-stable");
      emitSketchPreviewsChanged("refresh-preview-stable");
      return;
    }

    setPreviewTracks(preview, tracks);
    finishRecognition("refresh-preview");
    emitSketchPreviewsChanged("refresh-preview");
  }

  function refreshActivePreview() {
    const preview = ensureActivePreview();
    if (!preview) return;
    refreshPreviewRecognition(preview, { reason: "sync-refresh" });
  }

  function resolvePreviewLayer(preview) {
    if (!preview) return getActiveLayer?.() || svgRoot;
    const explicit = preview.layerEl;
    if (explicit?.isConnected) return explicit;
    const byId = preview.layerId
      ? Array.from(
        svgRoot.querySelectorAll?.(":scope > g[data-layer='true']") || [],
      ).find((layer) => layer.id === preview.layerId) || null
      : null;
    return byId || getActiveLayer?.() || svgRoot;
  }

  function renderTracksToPathElement(tracks = [], preview = null) {
    const style = typeof currentStyleDefaults === "function"
      ? (currentStyleDefaults() || {})
      : {};
    const isStraightLine = preview?.hypotheses?.mode === "open-straight-line" &&
      tracks.length === 1 &&
      Array.isArray(tracks[0]) &&
      tracks[0].length === 2;
    if (isStraightLine) {
      const [start, end] = tracks[0];
      return createSvgEl("line", {
        x1: start.x,
        y1: start.y,
        x2: end.x,
        y2: end.y,
        fill: "none",
        stroke: "#000000",
        "stroke-width": style.strokeWidth || "1",
        "stroke-linecap": "round",
      });
    }

    const closedPreview = Boolean(preview?.hypotheses?.closed);
    const d = tracks.map((points) => {
      const nextD = pointsToPathD(points);
      return nextD && closedPreview && points.length >= 3 ? `${nextD} Z` : nextD;
    }).filter(Boolean).join(" ");
    if (!d) return null;
    return createSvgEl("path", {
      d,
      fill: "none",
      stroke: "#000000",
      "stroke-width": style.strokeWidth || "1",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    });
  }

  function renderSketchPreview(previewId, options = {}) {
    const preview = getPreviewById(previewId);
    if (!preview) return null;

    const preservePreview = "preservePreview" in options
      ? safeBool(options.preservePreview, true)
      : true;

    if (preview.recognitionDirty) {
      refreshPreviewRecognition(preview, { reason: "render-sync" });
    }

    if (
      !preview.activePreviewGeometry ||
      !preview.activePreviewGeometry.tracks.length
    ) {
      const tracks = buildPreviewTracks(preview);
      if (!tracks.length) {
        status(`${preview.name}: no confident interpretation to render`);
        return null;
      }
      setPreviewTracks(preview, tracks);
    }

    const tracks = preview.activePreviewGeometry?.tracks || [];
    const element = renderTracksToPathElement(tracks, preview);
    if (!element) {
      status(`${preview.name}: unable to render`);
      return null;
    }

    const layer = resolvePreviewLayer(preview);
    if (typeof appendElement === "function" && layer === getActiveLayer?.()) {
      appendElement(element);
    } else {
      layer.appendChild(element);
    }

    preview.accepted = true;

    if (!preservePreview) {
      deleteSketchPreview(preview.id);
    } else {
      emitSketchPreviewsChanged("render-preview");
    }

    if (typeof markDirty === "function") markDirty(true);
    status(`Rendered ${preview.name}`);
    return element;
  }

  function renderVisibleSketchPreviews(options = {}) {
    const visible = state.previews.filter((preview) => preview.visible);
    if (!visible.length) {
      status("No visible sketch previews to render");
      return [];
    }

    const rendered = [];
    const ids = visible.map((preview) => preview.id);
    ids.forEach((id) => {
      const out = renderSketchPreview(id, options);
      if (out) rendered.push(out);
    });

    if (!rendered.length) {
      status("No sketch previews could be rendered");
      return rendered;
    }

    status(`Rendered ${rendered.length} sketch preview(s)`);
    return rendered;
  }

  function onModeEnter() {
    state.enabled = true;
    ensureActivePreview();
    status("Sketch mode: draw rough strokes in the active sketch preview");
    emitSketchPreviewsChanged("mode-enter");
  }

  function onModeExit() {
    state.enabled = false;
    if (state.currentStroke) discardCurrentStroke();
    emitSketchPreviewsChanged("mode-exit");
  }

  function onPointerDown(event, rootPoint) {
    if (!state.enabled) return false;
    if (state.activePointerId !== null) return false;
    if (event && typeof event.button === "number" && event.button !== 0) {
      return false;
    }

    const preview = ensureActivePreview();
    if (!preview) return false;
    if (preview.locked) {
      status(`${preview.name} is locked`);
      return false;
    }
    if (!preview.visible || !state.constructionVisible) {
      status(`${preview.name} is hidden`);
      return false;
    }

    const pathEl = createStrokePath();
    if (preview.previewPathEl?.parentNode === preview.groupEl) {
      preview.groupEl.insertBefore(pathEl, preview.previewPathEl);
    } else {
      preview.groupEl.appendChild(pathEl);
    }

    const stroke = {
      previewId: preview.id,
      pathEl,
      points: [],
    };
    pushStrokePoint(stroke, createStrokePoint(rootPoint, event), {
      force: true,
    });
    updateStrokePath(stroke);
    applyPreviewStrokeColors(preview, { activeStroke: stroke });

    state.currentStroke = stroke;
    state.activePointerId = event?.pointerId ?? 0;
    return true;
  }

  function onPointerMove(event, rootPoint) {
    if (!state.enabled || !state.currentStroke) return false;
    if ((event?.pointerId ?? 0) !== state.activePointerId) return false;

    const changed = pushStrokePoint(
      state.currentStroke,
      createStrokePoint(rootPoint, event),
      { force: false },
    );
    if (!changed) return true;
    scheduleStrokePathUpdate(state.currentStroke);
    return true;
  }

  function onPointerUp(event, rootPoint) {
    if (!state.enabled || !state.currentStroke) return false;
    if ((event?.pointerId ?? 0) !== state.activePointerId) return false;

    pushStrokePoint(state.currentStroke, createStrokePoint(rootPoint, event), {
      force: true,
    });
    flushStrokePathUpdate(state.currentStroke);

    const preview = getPreviewById(state.currentStroke.previewId);
    if (!preview) {
      discardCurrentStroke();
      return false;
    }

    const len = strokeLength(state.currentStroke.points);
    if (
      !Number.isFinite(len) || len < minimumStrokeLength() ||
      state.currentStroke.points.length < 2
    ) {
      discardCurrentStroke();
      status("Sketch stroke ignored (too short)");
      return true;
    }

    const rawPoints = state.currentStroke.points.map((pt) => ({ ...pt }));
    const analysisPoints = simplifyPointsForRecognition(
      rawPoints,
      simplifyThreshold(),
      sketchPerformanceSettings().maxAnalysisPointsPerStroke,
    );
    preview.rawStrokes.push({
      pathEl: state.currentStroke.pathEl,
      points: rawPoints,
      analysisPoints,
      length: len,
      summary: computeStrokeSummary(rawPoints, analysisPoints),
    });

    preview.accepted = false;
    applyPreviewStrokeColors(preview);
    markRecognitionDirty(preview);
    resetCurrentStroke();
    scheduleRecognition(preview, "stroke-complete");
    status(preview.name + ": " + preview.rawStrokes.length + " stroke(s)");
    return true;
  }

  function undoLastStroke() {
    const preview = getActivePreview();
    if (!preview) return false;

    if (state.currentStroke && state.currentStroke.previewId === preview.id) {
      discardCurrentStroke();
      status(`Canceled active stroke in ${preview.name}`);
      return true;
    }

    if (!preview.rawStrokes.length) return false;
    const removed = preview.rawStrokes.pop();
    try {
      removed?.pathEl?.remove();
    } catch {
      // ignore DOM removal errors
    }

    applyPreviewStrokeColors(preview);
    markRecognitionDirty(preview);
    scheduleRecognition(preview, "undo-stroke");
    status(preview.name + ": " + preview.rawStrokes.length + " stroke(s)");
    return true;
  }

  function clearSketch(options = {}) {
    const preview = getActivePreview();
    if (!preview) return false;
    const hadContent = Boolean(
      (state.currentStroke && state.currentStroke.previewId === preview.id) ||
        preview.rawStrokes.length || preview.activePreviewGeometry?.pointCount,
    );
    if (!hadContent) return false;

    if (state.currentStroke && state.currentStroke.previewId === preview.id) {
      discardCurrentStroke();
    }

    clearSketchPreview(preview.id, { silent: true });
    if (!options.silent) status(`${preview.name} cleared`);
    return true;
  }

  function finalizeSketch(options = {}) {
    const preview = getActivePreview();
    if (!preview) {
      status("No active sketch preview");
      return null;
    }

    const preservePreview = "preservePreview" in options
      ? safeBool(options.preservePreview, true)
      : safeBool(state.keepConstruction, false);

    return renderSketchPreview(preview.id, { preservePreview });
  }

  function cancelSketchMode() {
    if (state.currentStroke) discardCurrentStroke();
    if (typeof setMode === "function") setMode("select");
    status("Sketch mode canceled");
    return true;
  }

  function cancelSketchSession() {
    return clearSketch();
  }

  function setKeepConstruction(nextValue) {
    state.keepConstruction = safeBool(nextValue, !state.keepConstruction);
    status(
      state.keepConstruction
        ? "Sketch: keep preview on render ON"
        : "Sketch: keep preview on render OFF",
    );
    return state.keepConstruction;
  }

  function toggleConstructionVisibility(forceValue) {
    state.constructionVisible = typeof forceValue === "boolean"
      ? forceValue
      : !state.constructionVisible;
    state.previews.forEach((preview) => applyPreviewDomVisibility(preview));
    emitSketchPreviewsChanged("toggle-construction-visibility");
    status(
      state.constructionVisible
        ? "Sketch previews shown"
        : "Sketch previews hidden",
    );
    return true;
  }

  function setStrokeOrderColorsEnabled(nextValue) {
    state.enableStrokeOrderColors = safeBool(nextValue, !state.enableStrokeOrderColors);
    globalThis.NodevisionState = globalThis.NodevisionState || {};
    globalThis.NodevisionState.enableSketchStrokeOrderColors = state.enableStrokeOrderColors;
    globalThis.NodevisionSketchSettings = globalThis.NodevisionSketchSettings || {};
    globalThis.NodevisionSketchSettings.enableSketchStrokeOrderColors = state.enableStrokeOrderColors;
    applyAllStrokeColors();
    emitSketchPreviewsChanged("stroke-order-colors");
    status(
      state.enableStrokeOrderColors
        ? "Sketch stroke order colors ON"
        : "Sketch stroke order colors OFF",
    );
    return state.enableStrokeOrderColors;
  }

  function setRoughOpacity(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return state.roughOpacity;
    state.roughOpacity = clamp(parsed, 0.05, 1);

    applyAllStrokeColors();
    return state.roughOpacity;
  }

  function setSmoothingLevel(value) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return state.smoothingLevel;
    state.smoothingLevel = clamp(parsed, 0, 6);
    refreshActivePreview();
    return state.smoothingLevel;
  }

  function hasSketchContent() {
    const preview = getActivePreview();
    if (!preview) return Boolean(state.currentStroke);
    return Boolean(
      (state.currentStroke && state.currentStroke.previewId === preview.id) ||
        preview.rawStrokes.length || preview.activePreviewGeometry?.pointCount,
    );
  }

  function activePreviewPointCount() {
    const preview = getActivePreview();
    if (!preview) return 0;
    return Number(preview.activePreviewGeometry?.pointCount) || 0;
  }

  function activePreviewStrokeCount() {
    const preview = getActivePreview();
    if (!preview) return 0;
    return preview.rawStrokes.length;
  }

  return {
    onModeEnter,
    onModeExit,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    clearSketch,
    finalizeSketch,
    cancelSketchMode,
    cancelSketchSession,
    undoLastStroke,
    setKeepConstruction,
    toggleConstructionVisibility,
    setStrokeOrderColorsEnabled,
    getStrokeOrderColorsEnabled: () => state.enableStrokeOrderColors,
    setRoughOpacity,
    setSmoothingLevel,
    hasSketchContent,
    isDrawing: () => Boolean(state.currentStroke),
    getPreviewPointCount: () => activePreviewPointCount(),
    getStrokeCount: () => activePreviewStrokeCount(),
    getKeepConstruction: () => state.keepConstruction,

    // Multi-preview architecture API
    getSketchPreviews,
    getActiveSketchPreviewId: () => state.activePreviewId,
    createSketchPreview,
    setActiveSketchPreview,
    renameSketchPreview,
    setSketchPreviewVisible,
    toggleSketchPreviewVisible,
    setSketchPreviewLocked,
    toggleSketchPreviewLocked,
    clearSketchPreview,
    deleteSketchPreview,
    renderSketchPreview,
    renderVisibleSketchPreviews,
  };
}
