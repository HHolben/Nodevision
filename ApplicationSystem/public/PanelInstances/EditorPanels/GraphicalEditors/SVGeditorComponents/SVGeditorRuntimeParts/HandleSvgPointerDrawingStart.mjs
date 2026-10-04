// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/HandleSvgPointerDrawingStart.mjs
// This module implements handle Svg Pointer Drawing Start behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { sampleSvgPaint, applyEyedropperSample } from "../EyedropperTool.mjs";

// Handle Svg Pointer Drawing Start operations.
export function handleSvgPointerDrawingStart(scope) {
  if (scope.owner.svgSession.toolState.mode === "line") {
    scope.owner.svgSession.recordLineProbe("line-branch:start", {
      active: Boolean(scope.owner.svgSession.lineToolState.active)
    });
    if (scope.owner.svgSession.lineToolState.grab) {
      scope.owner.svgSession.finishLineToolGrab();
      scope.e.preventDefault();
      scope.e.stopPropagation();
      return {
        value: void 0
      };
    }
    if (scope.owner.svgSession.lineToolState.active && scope.e.detail >= 2) {
      scope.owner.svgSession.finishLineTool();
      scope.e.preventDefault();
      scope.e.stopPropagation();
      return {
        value: void 0
      };
    }
    scope.pointerStartState.layer = scope.owner.svgSession.lineToolState.layer || scope.owner.svgSession.getActiveLayer() || scope.owner.svgSession.svgRoot;
    scope.owner.svgSession.recordLineProbe("line-branch:after-layer", {
      layerTag: scope.pointerStartState.layer?.tagName || null
    });
    scope.pointerStartState.rootPoint = scope.owner.svgSession.resolveLineToolPoint(scope.pointerStartState.p, scope.e);
    scope.owner.svgSession.recordLineProbe("line-branch:after-resolve", {
      x: scope.pointerStartState.rootPoint.x,
      y: scope.pointerStartState.rootPoint.y
    });
    scope.owner.svgSession.placeLineToolVertex(scope.pointerStartState.rootPoint, scope.pointerStartState.layer);
    scope.owner.svgSession.recordLineProbe("line-branch:after-place", {
      active: Boolean(scope.owner.svgSession.lineToolState.active)
    });
    scope.e.preventDefault();
    scope.e.stopPropagation();
    return {
      value: void 0
    };
  }
  if (scope.owner.svgSession.toolState.mode === "circle" || scope.owner.svgSession.toolState.mode === "arc") {
    scope.owner.svgSession.clearSelection();
    scope.owner.svgSession.placeShapeToolPoint(scope.owner.svgSession.toolState.mode, scope.pointerStartState.p);
    scope.e.preventDefault();
    scope.e.stopPropagation();
    return {
      value: void 0
    };
  }
  if (scope.owner.svgSession.toolState.mode === "bezier") {
    scope.pointerStartState.rootPointLocal = scope.pointerStartState.p;
    if (scope.owner.svgSession.bezierController.isActive() && scope.e.detail >= 2) {
      scope.owner.svgSession.bezierController.finish();
      scope.owner.svgSession.setMode("select");
      scope.e.preventDefault();
      scope.e.stopPropagation();
      return {
        value: void 0
      };
    }
    scope.owner.svgSession.clearSelection();
    scope.owner.svgSession.bezierController.onPointerDown(scope.e, scope.pointerStartState.rootPointLocal);
    scope.e.preventDefault();
    scope.e.stopPropagation();
    return {
      value: void 0
    };
  }
  if (scope.owner.svgSession.toolState.mode === "sketch") {
    scope.owner.svgSession.clearSelection();
    scope.pointerStartState.started = scope.owner.svgSession.sketchController.onPointerDown(scope.e, scope.pointerStartState.p);
    if (!scope.pointerStartState.started) return {
      value: void 0
    };
    scope.owner.svgSession.toolState.drawing = true;
    try {
      scope.owner.svgSession.svgRoot.setPointerCapture(scope.e.pointerId);
    } catch {
      // Ignore unsupported pointer capture errors.
    }
    scope.e.preventDefault();
    scope.e.stopPropagation();
    return {
      value: void 0
    };
  }
  if (scope.owner.svgSession.toolState.mode === "eyedropper") {
    scope.pointerStartState.targetLocal = scope.e.target instanceof SVGElement ? scope.e.target : null;
    scope.pointerStartState.sample = sampleSvgPaint(scope.pointerStartState.targetLocal);
    if (scope.pointerStartState.sample && applyEyedropperSample(window.SVGEditorContext, scope.pointerStartState.sample, scope.owner.svgSession.drawingAssistSettings.eyedropperTarget)) {
      scope.owner.svgSession.eyedropperIndicator.show(scope.e.clientX, scope.e.clientY, scope.pointerStartState.sample);
      scope.owner.svgSession.setStatus("Sampled SVG paint");
    } else {
      scope.owner.svgSession.setStatus("No SVG paint to sample");
    }
    scope.e.preventDefault();
    scope.e.stopPropagation();
    return {
      value: void 0
    };
  }
  if (scope.owner.svgSession.toolState.mode === "eraser") {
    scope.pointerStartState.hit = scope.owner.svgSession.findNearestGeometryAtPoint(scope.pointerStartState.p, scope.owner.svgSession.pointerToleranceInSvgUnits(Math.max(8, Number(scope.owner.svgSession.drawingAssistSettings.brushSize) || 8)));
    scope.pointerStartState.targetLocalLocal = scope.pointerStartState.hit || (scope.e.target instanceof SVGElement && scope.owner.svgSession.isSelectableElement(scope.e.target) ? scope.e.target : null);
    if (!scope.pointerStartState.targetLocalLocal) {
      scope.owner.svgSession.setStatus("Eraser: no SVG object under pointer");
    } else if (scope.owner.svgSession.drawingAssistSettings.eraserMode && scope.owner.svgSession.drawingAssistSettings.eraserMode !== "delete-object") {
      scope.pointerStartState.tag = String(scope.pointerStartState.targetLocalLocal.tagName || "object").toLowerCase();
      scope.owner.svgSession.setStatus(`${scope.owner.svgSession.drawingAssistSettings.eraserMode}: <${scope.pointerStartState.tag}> geometry is unsupported in this phase; no SVG object changed`);
    } else {
      scope.owner.svgSession.history.pushElementRemoval(scope.pointerStartState.targetLocalLocal);
      scope.pointerStartState.targetLocalLocal.remove();
      scope.owner.svgSession.clearSelection();
      scope.owner.svgSession.markDocumentDirty(true);
      scope.owner.svgSession.setStatus("Deleted SVG object");
    }
    scope.e.preventDefault();
    scope.e.stopPropagation();
    return {
      value: void 0
    };
  }
  if (scope.owner.svgSession.toolState.mode === "freehand") {
    if (!scope.owner.svgSession.startFreehandStroke(scope.e, scope.pointerStartState.p)) return {
      value: void 0
    };
    scope.owner.svgSession.clearSelection();
    try {
      scope.owner.svgSession.svgRoot.setPointerCapture(scope.e.pointerId);
    } catch {
      // Ignore unsupported pointer capture errors.
    }
    scope.e.preventDefault();
    scope.e.stopPropagation();
    return {
      value: void 0
    };
  }
}
