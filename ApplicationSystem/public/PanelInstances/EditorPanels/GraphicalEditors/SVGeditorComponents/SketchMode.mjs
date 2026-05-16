// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SketchMode.mjs
// Sketch mode controller for SVG editing. It captures rough construction strokes, computes an averaged preview curve, and can finalize that curve into a normal editable <path>.

import {
  distance,
  inferStrokeTracks,
  pointsToPathD,
  strokeLength,
} from "./SketchStrokeMath.mjs";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toPressure(value) {
  const pressure = Number(value);
  if (!Number.isFinite(pressure) || pressure <= 0) return 0.5;
  return clamp(pressure, 0, 1);
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
    activeLayer: null,
    roughGroup: null,
    previewPath: null,
    currentStroke: null,
    roughStrokes: [],
    previewTracks: [],
    roughOpacity: 0.28,
    smoothingLevel: 2,
    keepConstruction: false,
    constructionVisible: false,
  };

  function spacingThreshold() {
    const next = typeof pointerToleranceInSvgUnits === "function"
      ? pointerToleranceInSvgUnits(0.7)
      : 0.7;
    return Math.max(0.08, Number(next) || 0.7);
  }

  function minimumStrokeLength() {
    const next = typeof pointerToleranceInSvgUnits === "function"
      ? pointerToleranceInSvgUnits(8)
      : 8;
    return Math.max(0.4, Number(next) || 8);
  }

  function simplifyThreshold() {
    const next = typeof pointerToleranceInSvgUnits === "function"
      ? pointerToleranceInSvgUnits(0.45)
      : 0.45;
    return Math.max(0, Number(next) || 0.45);
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

  function previewPointCount() {
    return state.previewTracks.reduce(
      (acc, points) => acc + (Array.isArray(points) ? points.length : 0),
      0,
    );
  }

  function status(text) {
    if (typeof setStatus === "function") setStatus(text);
  }

  function ensureSessionGroup() {
    if (state.roughGroup?.isConnected && state.previewPath?.isConnected) {
      return state.roughGroup;
    }

    const layer = state.activeLayer?.isConnected
      ? state.activeLayer
      : (getActiveLayer?.() || svgRoot);
    state.activeLayer = layer;

    const group = createSvgEl("g", {
      [uiAttrName]: "sketch-construction",
      "data-nv-sketch-session": "true",
    });

    const preview = createSvgEl("path", {
      [uiAttrName]: "sketch-preview",
      fill: "none",
      stroke: "#4a4a4a",
      "stroke-width": "1.6",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      opacity: "0.95",
      display: "none",
    });

    group.appendChild(preview);
    layer.appendChild(group);

    state.roughGroup = group;
    state.previewPath = preview;
    return group;
  }

  function createStrokePath() {
    return createSvgEl("path", {
      [uiAttrName]: "sketch-rough-stroke",
      fill: "none",
      stroke: "#808080",
      "stroke-width": "1.0",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      opacity: String(state.roughOpacity),
      d: "",
    });
  }

  function setPreviewVisible(visible) {
    if (!state.previewPath) return;
    state.previewPath.setAttribute("display", visible ? "" : "none");
  }

  function createStrokePoint(rootPoint, event) {
    return {
      x: Number(rootPoint?.x) || 0,
      y: Number(rootPoint?.y) || 0,
      pressure: toPressure(event?.pressure),
      time: Number(event?.timeStamp) || Date.now(),
    };
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

  function resetCurrentStroke() {
    state.currentStroke = null;
    state.activePointerId = null;
  }

  function discardCurrentStroke() {
    if (!state.currentStroke) return false;
    try {
      state.currentStroke.pathEl?.remove();
    } catch {
      // ignore DOM removal errors
    }
    resetCurrentStroke();
    return true;
  }

  function refreshPreview() {
    if (!state.previewPath) return;
    if (!state.roughStrokes.length) {
      state.previewTracks = [];
      state.previewPath.setAttribute("d", "");
      setPreviewVisible(false);
      return;
    }

    // Cluster rough strokes before averaging, using proximity, direction,
    // continuity, and stroke-order heuristics. This keeps distant or
    // differently intended strokes from pulling an existing inferred section.
    const tracks = inferStrokeTracks(
      state.roughStrokes.map((entry) => entry.points),
      {
        sampleCount: 44,
        minLength: minimumStrokeLength(),
        smoothingRadius: 2,
        smoothingPasses: smoothingPasses(),
        simplifyDistance: simplifyThreshold(),
        trackDistanceThreshold: trackDistanceThreshold(),
        clusterSpreadFactor: 2.8,
        lengthThresholdFactor: 0.3,
        continuityGapThreshold: trackDistanceThreshold() * 0.8,
        continuitySpreadFactor: 1.7,
        continuityLengthFactor: 0.12,
        directionSimilarityThreshold: 0.68,
        minDirectionReliability: 0.16,
        minDirectionCoherence: 0.64,
        directionPenaltyFactor: 1.1,
        reverseDirectionPenalty: 0.6,
        sameDirectionThreshold: 0.2,
        recentStrokeWindow: 4,
        farStrokeWindow: 10,
        recentDistanceThreshold: trackDistanceThreshold() * 0.65,
        recentSameDirectionBonus: 0.7,
        shadingReverseMinDot: 0.45,
        shadingBonus: 0.62,
        oldStrokePenalty: 0.2,
        lineIntentThreshold: 0.84,
        linearityThreshold: 0.9,
        lineFitThreshold: 0.64,
        lineErrorScale: 0.075,
        lineDirectionMinDot: 0.88,
        lineBackAndForthBoost: 0.12,
        lineMinStrokeCount: 3,
        progressiveMinStrokeCount: 3,
        progressiveTravelThreshold: trackDistanceThreshold() * 0.23,
        progressiveOverlapThreshold: trackDistanceThreshold() * 0.14,
        progressiveContinuityThreshold: trackDistanceThreshold() * 0.62,
        stitchJoinTolerance: minimumStrokeLength() * 0.22,
        turnMinAxial: 0.72,
        turnContinuityThreshold: trackDistanceThreshold() * 0.56,
        turnRecentWindow: 5,
        tailDirectionWindow: 6,
        mergeTrackGapThreshold: trackDistanceThreshold() * 0.34,
        mergeTrackTurnMinAxial: 0.76,
        mergeTrackIndexGap: 2,
        parallelCheckMinAxial: 0.9,
        parallelOffsetThreshold: trackDistanceThreshold() * 0.45,
        parallelOffsetSpreadFactor: 1.8,
        parallelAlongGapThreshold: trackDistanceThreshold() * 0.5,
        parallelAlongGapLengthFactor: 0.42,
      },
    );

    state.previewTracks = tracks.map((track) => track.points).filter((points) =>
      Array.isArray(points) && points.length >= 2
    );
    if (!state.previewTracks.length) {
      state.previewPath.setAttribute("d", "");
      setPreviewVisible(false);
      return;
    }

    const d = state.previewTracks.map((points) => pointsToPathD(points)).filter(
      Boolean,
    ).join(" ");
    state.previewPath.setAttribute("d", d);
    setPreviewVisible(true);
  }

  function clearSessionVisuals() {
    try {
      state.roughGroup?.remove();
    } catch {
      // ignore DOM removal errors
    }

    state.roughGroup = null;
    state.previewPath = null;
    state.activeLayer = null;
    state.roughStrokes = [];
    state.previewTracks = [];
    resetCurrentStroke();
  }

  function maybePersistConstructionGroup() {
    const group = state.roughGroup;
    if (!group || !state.keepConstruction) return;

    state.previewPath?.remove();
    state.previewPath = null;

    if (!group.querySelector("path")) return;

    group.removeAttribute(uiAttrName);
    group.removeAttribute("data-nv-sketch-session");
    group.setAttribute("data-nv-sketch-construction", "true");
    group.style.display = state.constructionVisible ? "" : "none";
    group.querySelectorAll(`[${uiAttrName}]`).forEach((el) =>
      el.removeAttribute(uiAttrName)
    );
  }

  function clearSketch(options = {}) {
    const hadContent = Boolean(
      state.currentStroke || state.roughStrokes.length ||
        state.previewTracks.length || state.roughGroup,
    );
    if (!hadContent) return false;

    clearSessionVisuals();

    if (!options.silent) status("Sketch cleared");
    return true;
  }

  function onModeEnter() {
    state.enabled = true;
    status("Sketch mode: draw rough strokes, Enter to finalize, Esc to cancel");
  }

  function onModeExit() {
    state.enabled = false;
    clearSketch({ silent: true });
  }

  function onPointerDown(event, rootPoint) {
    if (!state.enabled) return false;
    if (state.activePointerId !== null) return false;
    if (event && typeof event.button === "number" && event.button !== 0) {
      return false;
    }

    ensureSessionGroup();

    const pathEl = createStrokePath();
    if (state.previewPath?.parentNode === state.roughGroup) {
      state.roughGroup.insertBefore(pathEl, state.previewPath);
    } else {
      state.roughGroup.appendChild(pathEl);
    }

    const stroke = { pathEl, points: [] };
    pushStrokePoint(stroke, createStrokePoint(rootPoint, event), {
      force: true,
    });
    updateStrokePath(stroke);

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
    updateStrokePath(state.currentStroke);
    return true;
  }

  function onPointerUp(event, rootPoint) {
    if (!state.enabled || !state.currentStroke) return false;
    if ((event?.pointerId ?? 0) !== state.activePointerId) return false;

    pushStrokePoint(state.currentStroke, createStrokePoint(rootPoint, event), {
      force: true,
    });
    updateStrokePath(state.currentStroke);

    const len = strokeLength(state.currentStroke.points);
    if (
      !Number.isFinite(len) || len < minimumStrokeLength() ||
      state.currentStroke.points.length < 2
    ) {
      discardCurrentStroke();
      status("Sketch stroke ignored (too short)");
      refreshPreview();
      return true;
    }

    state.roughStrokes.push({
      pathEl: state.currentStroke.pathEl,
      points: state.currentStroke.points.map((pt) => ({ ...pt })),
    });

    resetCurrentStroke();
    refreshPreview();

    if (state.previewTracks.length >= 1) {
      status(
        `Sketch strokes: ${state.roughStrokes.length} (Enter to finalize)`,
      );
    } else {
      status(`Sketch strokes: ${state.roughStrokes.length}`);
    }
    return true;
  }

  function undoLastStroke() {
    if (state.currentStroke) {
      discardCurrentStroke();
      status("Canceled active sketch stroke");
      return true;
    }
    if (!state.roughStrokes.length) return false;

    const removed = state.roughStrokes.pop();
    try {
      removed?.pathEl?.remove();
    } catch {
      // ignore DOM removal errors
    }
    refreshPreview();
    status(`Sketch strokes: ${state.roughStrokes.length}`);
    return true;
  }

  function finalizeSketch() {
    const validTracks = state.previewTracks.filter((points) =>
      Array.isArray(points) && points.length >= 2
    );
    if (!validTracks.length) {
      status("Sketch finalize: draw more strokes first");
      return null;
    }

    const style = typeof currentStyleDefaults === "function"
      ? (currentStyleDefaults() || {})
      : {};
    const makePath = (points) =>
      createSvgEl("path", {
        d: pointsToPathD(points),
        fill: "none",
        stroke: "#000000",
        "stroke-width": style.strokeWidth || "1",
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
      });

    let committed = null;
    if (validTracks.length === 1) {
      const path = makePath(validTracks[0]);
      committed = path;
      if (typeof appendElement === "function") appendElement(path);
      else (getActiveLayer?.() || svgRoot).appendChild(path);
    } else {
      const layer = getActiveLayer?.() || svgRoot;
      const paths = validTracks.map((points) => makePath(points));
      paths.forEach((path) => layer.appendChild(path));
      committed = paths;
    }

    maybePersistConstructionGroup();

    // If construction strokes are not being persisted, remove all temporary preview/stroke DOM.
    if (!state.keepConstruction) {
      clearSessionVisuals();
    } else {
      state.roughGroup = null;
      state.previewPath = null;
      state.activeLayer = null;
      state.roughStrokes = [];
      state.previewTracks = [];
      resetCurrentStroke();
    }

    if (typeof markDirty === "function") markDirty(true);
    status(
      validTracks.length > 1
        ? `Sketch finalized into ${validTracks.length} path sections`
        : "Sketch finalized into path",
    );
    return committed;
  }

  function cancelSketchMode() {
    clearSketch({ silent: true });
    if (typeof setMode === "function") setMode("select");
    status("Sketch mode canceled");
    return true;
  }

  function cancelSketchSession() {
    const didClear = clearSketch({ silent: true });
    status(didClear ? "Sketch session canceled" : "Sketch session empty");
    return didClear;
  }

  function setKeepConstruction(nextValue) {
    const next = typeof nextValue === "boolean"
      ? nextValue
      : !state.keepConstruction;
    state.keepConstruction = next;
    status(
      next
        ? "Sketch: keep construction strokes ON"
        : "Sketch: keep construction strokes OFF",
    );
    return next;
  }

  function toggleConstructionVisibility(forceValue) {
    const groups = Array.from(
      svgRoot.querySelectorAll("g[data-nv-sketch-construction='true']"),
    );
    if (!groups.length) {
      status("No saved construction strokes to toggle");
      return false;
    }

    const next = typeof forceValue === "boolean"
      ? forceValue
      : !state.constructionVisible;
    state.constructionVisible = next;
    groups.forEach((group) => {
      group.style.display = next ? "" : "none";
    });
    status(next ? "Construction strokes shown" : "Construction strokes hidden");
    return true;
  }

  function setRoughOpacity(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return state.roughOpacity;
    state.roughOpacity = clamp(parsed, 0.05, 1);
    state.roughStrokes.forEach((stroke) => {
      stroke.pathEl?.setAttribute("opacity", String(state.roughOpacity));
    });
    state.currentStroke?.pathEl?.setAttribute(
      "opacity",
      String(state.roughOpacity),
    );
    return state.roughOpacity;
  }

  function setSmoothingLevel(value) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return state.smoothingLevel;
    state.smoothingLevel = clamp(parsed, 0, 6);
    refreshPreview();
    return state.smoothingLevel;
  }

  function hasSketchContent() {
    return Boolean(
      state.currentStroke || state.roughStrokes.length ||
        state.previewTracks.length,
    );
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
    setRoughOpacity,
    setSmoothingLevel,
    hasSketchContent,
    isDrawing: () => Boolean(state.currentStroke),
    getPreviewPointCount: () => previewPointCount(),
    getStrokeCount: () => state.roughStrokes.length,
    getKeepConstruction: () => state.keepConstruction,
  };
}
