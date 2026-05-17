// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SketchMode.mjs
// Sketch mode controller for SVG editing. Supports multiple independent sketch previews, each representing one evolving interpretation.

import {
  averageStrokes,
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

function safeBool(value, fallback = false) {
  if (typeof value === "boolean") return value;
  return fallback;
}

function makeSketchPreviewId() {
  return `sketch-preview-${Math.random().toString(36).slice(2, 10)}`;
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
      display: "none",
      d: "",
    });
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
      accepted: false,
      groupEl: group,
      previewPathEl: previewPath,
      layerEl: layer,
      layerId: layer?.id || null,
      lastPreviewD: "",
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
    preview.lastPreviewD = "";
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

  function buildPreviewTracks(preview) {
    if (!preview) return [];
    if (preview.rawStrokes.length === 0) return [];
    if (preview.rawStrokes.length === 1) {
      const first = preview.rawStrokes[0]?.points || [];
      return Array.isArray(first) && first.length >= 2 ? [first] : [];
    }

    const lineConsensus = averageLineConsensus(preview.rawStrokes);
    if (lineConsensus) {
      preview.hypotheses = {
        mode: "line-consensus",
        strokeCount: preview.rawStrokes.length,
        confidence: 1,
        discontinuities: 0,
      };
      return [lineConsensus];
    }

    const strokePointLists = preview.rawStrokes.map((stroke) => stroke.points);
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
      discontinuities: 0,
    };

    const d = primaryTrack ? pointsToPathD(primaryTrack) : "";
    preview.lastPreviewD = d;
    preview.previewPathEl?.setAttribute("d", d);

    const visible = normalizedTracks.length > 0 && preview.visible &&
      state.constructionVisible;
    setPreviewVisible(preview.previewPathEl, visible);
  }

  function refreshActivePreview() {
    const preview = ensureActivePreview();
    if (!preview) return;

    if (!preview.rawStrokes.length) {
      preview.activePreviewGeometry = null;
      preview.hypotheses = {};
      preview.lastPreviewD = "";
      preview.previewPathEl?.setAttribute("d", "");
      setPreviewVisible(preview.previewPathEl, false);
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
      emitSketchPreviewsChanged("refresh-preview-stable");
      return;
    }

    setPreviewTracks(preview, tracks);
    emitSketchPreviewsChanged("refresh-preview");
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

  function renderTracksToPathElement(tracks = []) {
    const style = typeof currentStyleDefaults === "function"
      ? (currentStyleDefaults() || {})
      : {};
    const d = tracks.map((points) => pointsToPathD(points)).filter(Boolean)
      .join(" ");
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
    const element = renderTracksToPathElement(tracks);
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
      refreshActivePreview();
      return true;
    }

    preview.rawStrokes.push({
      pathEl: state.currentStroke.pathEl,
      points: state.currentStroke.points.map((pt) => ({ ...pt })),
      length: len,
    });

    preview.accepted = false;
    resetCurrentStroke();
    refreshActivePreview();
    status(`${preview.name}: ${preview.rawStrokes.length} stroke(s)`);
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

    refreshActivePreview();
    status(`${preview.name}: ${preview.rawStrokes.length} stroke(s)`);
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

  function setRoughOpacity(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return state.roughOpacity;
    state.roughOpacity = clamp(parsed, 0.05, 1);

    state.previews.forEach((preview) => {
      preview.rawStrokes.forEach((stroke) => {
        stroke.pathEl?.setAttribute("opacity", String(state.roughOpacity));
      });
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
