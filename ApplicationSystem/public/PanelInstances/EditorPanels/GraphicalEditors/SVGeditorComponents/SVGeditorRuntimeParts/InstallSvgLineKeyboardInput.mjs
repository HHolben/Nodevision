// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/InstallSvgLineKeyboardInput.mjs
// This module implements install Svg Line Keyboard Input behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { createUpdateLineToolGrabHandler, createHandleLineToolAxisDistanceKeyHandler } from "./CreateSetLineToolPositionAxisConstraintHandler.mjs";
import { createHandleLineToolKeyCommandHandler, createGetSvgNaturalDimensionsHandler, createGetSvgViewBoxHandler } from "./CreateHandleLineToolKeyCommandHandler.mjs";
import { SVG_CANVAS_MIN_ZOOM, SVG_CANVAS_MAX_ZOOM } from "./CreateBlankSvgRoot.mjs";

// Install Svg Line Keyboard Input operations.
export function installSvgLineKeyboardInput(scope) {
  scope.svgSession.startLineToolGrab = function () {
    if (!scope.svgSession.lineToolState.active || !scope.svgSession.lineToolState.pointsSpace.length) {
      scope.svgSession.setStatus("Line tool: place or select a vertex before grabbing");
      return false;
    }
    const index = scope.svgSession.lineToolState.pointsSpace.length - 1;
    const layer = scope.svgSession.lineToolState.layer || scope.svgSession.getActiveLayer() || scope.svgSession.svgRoot;
    scope.svgSession.lineToolState.grab = {
      index,
      layer
    };
    scope.svgSession.lineToolState.constraint = null;
    scope.svgSession.lineToolState.axisDistanceBuffer = "";
    scope.svgSession.lineToolState.angleInputBuffer = "";
    scope.svgSession.setStatus("Grab vertex: move cursor, X/Y locks axis, type percent, click or Enter releases, Esc cancels");
    return true;
  };
  scope.svgSession.updateLineToolGrab = createUpdateLineToolGrabHandler({
    get svgSession() {
      return scope.svgSession;
    }
  });
  scope.svgSession.finishLineToolGrab = function () {
    if (!scope.svgSession.lineToolState.grab) return false;
    scope.svgSession.lineToolState.grab = null;
    scope.svgSession.lineToolState.constraint = null;
    scope.svgSession.lineToolState.axisDistanceBuffer = "";
    scope.svgSession.lineToolState.angleInputBuffer = "";
    scope.svgSession.setStatus("Grabbed vertex released");
    return true;
  };
  scope.svgSession.cancelLineToolTransientOperation = function () {
    if (scope.svgSession.lineToolState.commandBuffer || scope.svgSession.lineToolState.commandTimer) {
      scope.svgSession.clearLineToolPendingCommand();
      scope.svgSession.setStatus("Line command canceled");
      return true;
    }
    if (scope.svgSession.lineToolState.grab) {
      scope.svgSession.lineToolState.grab = null;
      scope.svgSession.setStatus("Line grab canceled");
      return true;
    }
    if (scope.svgSession.lineToolState.constraint) {
      scope.svgSession.lineToolState.constraint = null;
      scope.svgSession.lineToolState.axisDistanceBuffer = "";
      scope.svgSession.lineToolState.angleInputBuffer = "";
      if (scope.svgSession.lineToolState.cursorRoot) scope.svgSession.updateLineToolPreview(scope.svgSession.lineToolState.cursorRoot);
      scope.svgSession.setStatus("Line cursor constraint canceled");
      return true;
    }
    return false;
  };
  scope.svgSession.clearLineToolPendingCommand = function () {
    scope.svgSession.lineToolState.commandBuffer = "";
    if (scope.svgSession.lineToolState.commandTimer) window.clearTimeout(scope.svgSession.lineToolState.commandTimer);
    scope.svgSession.lineToolState.commandTimer = null;
  };
  scope.svgSession.handleLineToolAxisDistanceKey = createHandleLineToolAxisDistanceKeyHandler({
    get svgSession() {
      return scope.svgSession;
    }
  });
  scope.svgSession.handleLineToolAngleKey = function (e) {
    const constraint = scope.svgSession.lineToolState.constraint;
    if (!constraint || constraint.type !== "angle") return false;
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    const key = String(e.key || "");
    if (key === "Tab") return scope.svgSession.toggleLineToolAngleUnit();
    if (key === "Backspace") {
      scope.svgSession.lineToolState.angleInputBuffer = scope.svgSession.lineToolState.angleInputBuffer.slice(0, -1);
      return scope.svgSession.reapplyLineToolAngleBuffer();
    }
    if (key === "-") return scope.svgSession.toggleLineToolAngleDirection();
    if (key === "+") {
      constraint.angleDirectionSign = 1;
      return scope.svgSession.reapplyLineToolAngleBuffer();
    }
    if (!"0123456789.".includes(key)) return false;
    if (key === "." && scope.svgSession.lineToolState.angleInputBuffer.includes(".")) return false;
    scope.svgSession.lineToolState.angleInputBuffer += key;
    return scope.svgSession.reapplyLineToolAngleBuffer();
  };
  scope.svgSession.handleLineToolKeyCommand = createHandleLineToolKeyCommandHandler({
    get svgSession() {
      return scope.svgSession;
    }
  });
  scope.svgSession.getSvgNaturalDimensions = createGetSvgNaturalDimensionsHandler({
    get svgSession() {
      return scope.svgSession;
    }
  });
  scope.svgSession.getSvgViewBox = createGetSvgViewBoxHandler({
    get svgSession() {
      return scope.svgSession;
    }
  });
  scope.svgSession.clampSvgCanvasZoom = function (value, fallback = scope.svgSession.svgCanvasZoom || 1) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(SVG_CANVAS_MIN_ZOOM, Math.min(SVG_CANVAS_MAX_ZOOM, n));
  };
  scope.svgSession.svgCanvasZoomLabel = function () {
    return Math.round(scope.svgSession.svgCanvasZoom * 100) + "%";
  };
}
