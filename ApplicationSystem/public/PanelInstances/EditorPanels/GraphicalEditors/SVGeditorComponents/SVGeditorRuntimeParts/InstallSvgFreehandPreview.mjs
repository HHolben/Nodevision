// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/InstallSvgFreehandPreview.mjs
// This module implements install Svg Freehand Preview behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { createRenderFreehandPreviewNowHandler, createCommitFreehandStrokeHandler } from "./CreateMoveSelectionInHierarchyHandler.mjs";
import { recognizeShape } from "../ShapeRecognition.mjs";
import { createSymmetryOutputs } from "../SymmetryGenerator.mjs";
import { createSvgEl } from "../svgDom.mjs";
import { createStartFreehandStrokeHandler } from "./CreateStartFreehandStrokeHandler.mjs";

// Install Svg Freehand Preview operations.
export function installSvgFreehandPreview(scope) {
  scope.svgSession.updateBrushCursor = function (rootPoint) {
    if (!rootPoint || !scope.svgSession.drawingAssistSettings.showBrushCursor || !["freehand", "eraser"].includes(scope.svgSession.toolState.mode)) {
      scope.svgSession.brushCursor.setAttribute("display", "none");
      return;
    }
    const radius = Math.max(0.05, Number(scope.svgSession.drawingAssistSettings.brushSize) || 1) / 2;
    scope.svgSession.brushCursor.setAttribute("cx", String(rootPoint.x));
    scope.svgSession.brushCursor.setAttribute("cy", String(rootPoint.y));
    scope.svgSession.brushCursor.setAttribute("r", String(radius));
    scope.svgSession.brushCursor.setAttribute("display", "");
  };
  scope.svgSession.clearFreehandHoldTimer = function () {
    if (scope.svgSession.freehandStrokeState?.holdTimer) window.clearTimeout(scope.svgSession.freehandStrokeState.holdTimer);
    if (scope.svgSession.freehandStrokeState) scope.svgSession.freehandStrokeState.holdTimer = 0;
  };
  scope.svgSession.scheduleFreehandHold = function () {
    if (!scope.svgSession.freehandStrokeState || !scope.svgSession.drawingAssistSettings.shapeCorrectionEnabled) return;
    scope.svgSession.clearFreehandHoldTimer();
    scope.svgSession.freehandStrokeState.holdTimer = window.setTimeout(() => {
      if (!scope.svgSession.freehandStrokeState || scope.svgSession.freehandStrokeState.shapeActive) return;
      scope.svgSession.triggerShapeCorrectionPreview();
    }, Math.max(120, Number(scope.svgSession.drawingAssistSettings.shapeHoldDelayMs) || 450));
  };
  scope.svgSession.renderFreehandPreviewNow = createRenderFreehandPreviewNowHandler({
    get svgSession() {
      return scope.svgSession;
    }
  });
  scope.svgSession.scheduleFreehandRender = function () {
    if (scope.svgSession.freehandRenderRaf) return;
    scope.svgSession.freehandRenderRaf = window.requestAnimationFrame(scope.svgSession.renderFreehandPreviewNow);
  };
  scope.svgSession.triggerShapeCorrectionPreview = function () {
    const session = scope.svgSession.freehandStrokeState;
    if (!session || session.samples.length < 3) return false;
    const samples = scope.svgSession.stabilizedFreehandSamples(session.samples);
    const result = recognizeShape(samples, {
      sensitivity: scope.svgSession.drawingAssistSettings.shapeRecognitionSensitivity,
      minSize: Math.max(0.5, scope.svgSession.pointerToleranceInSvgUnits(3))
    });
    if (!result?.recognized) return false;
    session.shapeActive = true;
    session.shapeResult = result;
    scope.svgSession.shapeCorrectionPreview.show(result, session.style, session.shapeOptions || {});
    scope.svgSession.renderFreehandPreviewNow();
    scope.svgSession.setStatus("Shape correction preview: " + result.type + " (" + Math.round(result.confidence * 100) + "%)");
    return true;
  };
  scope.svgSession.updateShapeCorrectionFromStroke = function () {
    const session = scope.svgSession.freehandStrokeState;
    if (!session?.shapeActive) return;
    const result = recognizeShape(scope.svgSession.stabilizedFreehandSamples(session.samples), {
      sensitivity: scope.svgSession.drawingAssistSettings.shapeRecognitionSensitivity,
      minSize: Math.max(0.5, scope.svgSession.pointerToleranceInSvgUnits(3))
    });
    if (!result?.recognized) return;
    session.shapeResult = result;
    scope.svgSession.shapeCorrectionPreview.update(result, session.style);
  };
  scope.svgSession.cleanupFreehandStroke = function () {
    scope.svgSession.clearFreehandHoldTimer();
    if (scope.svgSession.freehandRenderRaf) window.cancelAnimationFrame(scope.svgSession.freehandRenderRaf);
    scope.svgSession.freehandRenderRaf = 0;
    scope.svgSession.freehandStrokeState?.previewEl?.remove();
    scope.svgSession.freehandStrokeState = null;
    scope.svgSession.toolState.drawing = false;
    scope.svgSession.toolState.tempShape = null;
    scope.svgSession.shapeCorrectionPreview.hide();
  };
  scope.svgSession.restoreOriginalFreehandPreview = function () {
    if (!scope.svgSession.freehandStrokeState) return false;
    scope.svgSession.freehandStrokeState.shapeActive = false;
    scope.svgSession.freehandStrokeState.shapeResult = null;
    scope.svgSession.shapeCorrectionPreview.hide();
    scope.svgSession.renderFreehandPreviewNow();
    scope.svgSession.setStatus("Shape correction canceled; original stroke retained");
    return true;
  };
  scope.svgSession.cancelShapeCorrectionPreview = function () {
    return scope.svgSession.restoreOriginalFreehandPreview();
  };
  scope.svgSession.appendCommittedElement = function (el, created) {
    if (!el) return;
    const layer = scope.svgSession.getActiveLayer() || scope.svgSession.svgRoot;
    layer.appendChild(el);
    created.push(el);
    const symmetry = createSymmetryOutputs(el, {
      svgRoot: scope.svgSession.svgRoot,
      createSvgEl,
      settings: scope.svgSession.drawingAssistSettings,
      getViewBox: scope.svgSession.getViewBox
    });
    created.push(...symmetry);
  };
  scope.svgSession.commitFreehandStroke = createCommitFreehandStrokeHandler({
    get svgSession() {
      return scope.svgSession;
    }
  });
  scope.svgSession.cancelFreehandStroke = function () {
    scope.svgSession.cleanupFreehandStroke();
    scope.svgSession.setStatus("Stroke canceled");
    return true;
  };
  scope.svgSession.startFreehandStroke = createStartFreehandStrokeHandler({
    get svgSession() {
      return scope.svgSession;
    }
  });
}
