// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/InstallSvgViewportControls.mjs
// This module implements install Svg Viewport Controls behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { createSetSvgCanvasZoomHandler, createDrawSvgTopRulerHandler, createDrawSvgLeftRulerHandler } from "./CreateSetSvgCanvasZoomHandler.mjs";
import { SVG_CANVAS_KEYBOARD_ZOOM_FACTOR } from "./CreateBlankSvgRoot.mjs";
import { createActivateSvgEditorContextHandler } from "./CreateActivateSvgEditorContextHandler.mjs";
import { updateToolbarState } from "/panels/createToolbar.mjs";

// Install Svg Viewport Controls operations.
export function installSvgViewportControls(scope) {
  scope.svgSession.getSvgZoomAnchorClientPoint = function (options = {}) {
    const rect = scope.svgSession.svgViewport.getBoundingClientRect?.();
    const clientX = Number(options.clientX);
    const clientY = Number(options.clientY);
    return {
      clientX: Number.isFinite(clientX) ? clientX : rect ? rect.left + rect.width / 2 : 0,
      clientY: Number.isFinite(clientY) ? clientY : rect ? rect.top + rect.height / 2 : 0
    };
  };
  scope.svgSession.updateSvgSizeToFitWidth = function () {
    const vb = scope.svgSession.getSvgViewBox();
    const viewportWidthPx = scope.svgSession.svgViewport.clientWidth || Math.round(scope.svgSession.svgViewportHost.getBoundingClientRect().width) || 0;
    if (!viewportWidthPx || !vb.width || !vb.height) return;
    const widthPx = Math.max(1, Math.round(viewportWidthPx));
    const heightPx = Math.max(1, Math.round(widthPx * (vb.height / vb.width)));
    const zoom = scope.svgSession.svgCanvasZoom;
    scope.svgSession.svgCanvasSpacer.style.width = `${widthPx * zoom}px`;
    scope.svgSession.svgCanvasSpacer.style.height = `${heightPx * zoom}px`;
    scope.svgSession.svgCanvasLayer.style.width = `${widthPx}px`;
    scope.svgSession.svgCanvasLayer.style.height = `${heightPx}px`;
    scope.svgSession.svgCanvasLayer.style.transform = `scale(${zoom})`;
    scope.svgSession.svgRoot.style.width = `${widthPx}px`;
    scope.svgSession.svgRoot.style.height = `${heightPx}px`;
    scope.svgSession.svgRoot.style.minWidth = "0";
    scope.svgSession.svgRoot.style.minHeight = "0";
    scope.svgSession.svgRoot.setAttribute("preserveAspectRatio", "xMinYMin meet");
  };
  scope.svgSession.setSvgCanvasZoom = createSetSvgCanvasZoomHandler({
    get svgSession() {
      return scope.svgSession;
    }
  });
  scope.svgSession.zoomSvgCanvasBy = function (factor, options = {}) {
    const f = Number(factor);
    return scope.svgSession.setSvgCanvasZoom(scope.svgSession.svgCanvasZoom * (Number.isFinite(f) && f > 0 ? f : 1), options);
  };
  scope.svgSession.getSvgCanvasZoomShortcutAction = function (e) {
    if (!(e?.ctrlKey || e?.metaKey) || e.altKey) return null;
    const key = String(e.key || "").toLowerCase();
    const code = String(e.code || "");
    if (key === "+" || key === "=" || code === "Equal" || code === "NumpadAdd") return "in";
    if (key === "-" || key === "_" || code === "Minus" || code === "NumpadSubtract") return "out";
    if (key === "0" || code === "Digit0" || code === "Numpad0") return "reset";
    return null;
  };
  scope.svgSession.handleSvgCanvasZoomShortcut = function (e) {
    const action = scope.svgSession.getSvgCanvasZoomShortcutAction(e);
    if (!action) return false;
    if (action === "reset") scope.svgSession.setSvgCanvasZoom(1);else scope.svgSession.zoomSvgCanvasBy(action === "in" ? SVG_CANVAS_KEYBOARD_ZOOM_FACTOR : 1 / SVG_CANVAS_KEYBOARD_ZOOM_FACTOR);
    return true;
  };
  scope.svgSession.setupRulerCanvas = function (canvas, cssWidth, cssHeight) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.floor(cssWidth));
    const h = Math.max(1, Math.floor(cssHeight));
    canvas.width = Math.max(1, Math.floor(w * dpr));
    canvas.height = Math.max(1, Math.floor(h * dpr));
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  };
  scope.svgSession.chooseRulerMinorStep = function (pxPerUnit) {
    const targetPx = 8;
    const steps = [0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
    for (const step of steps) {
      if (step * pxPerUnit >= targetPx) return step;
    }
    return steps[steps.length - 1];
  };
  scope.svgSession.formatRulerLabel = function (value, minorStep) {
    if (Number.isInteger(minorStep)) return String(Math.round(value));
    const rounded = Number(value.toFixed(2));
    return String(rounded);
  };
  scope.svgSession.drawSvgTopRuler = createDrawSvgTopRulerHandler({
    get svgSession() {
      return scope.svgSession;
    }
  });
  scope.svgSession.drawSvgLeftRuler = createDrawSvgLeftRulerHandler({
    get svgSession() {
      return scope.svgSession;
    }
  });
  scope.svgSession.updateSvgRulers = function () {
    if (!scope.svgSession.isCurrentRender()) return;
    scope.svgSession.svgTopRuler.style.transform = "";
    scope.svgSession.updateSvgSizeToFitWidth();
    scope.svgSession.drawSvgTopRuler();
    scope.svgSession.drawSvgLeftRuler();
    scope.svgSession.chrome.sync();
  };
  scope.svgSession.setStatus = function (text) {
    scope.svgSession.status.textContent = text;
  };
  scope.svgSession.isActiveSvgEditorRuntime = function () {
    return !scope.svgSession.svgEditorContext || window.SVGEditorContext === scope.svgSession.svgEditorContext || window.__nvSvgEditorActivePath === scope.filePath;
  };
  scope.svgSession.activateSvgEditorContext = createActivateSvgEditorContextHandler({
    get svgSession() {
      return scope.svgSession;
    },
    get filePath() {
      return scope.filePath;
    }
  });
  scope.svgSession.markDocumentDirty = function (dirty = true) {
    scope.svgSession.svgDocumentDirty = Boolean(dirty);
    if (scope.svgSession.svgEditorContext) scope.svgSession.svgEditorContext.dirty = scope.svgSession.svgDocumentDirty;
    if (scope.svgSession.isActiveSvgEditorRuntime()) updateToolbarState({
      fileIsDirty: scope.svgSession.svgDocumentDirty
    }, {
      rebuildDropdowns: false
    });
  };
}
