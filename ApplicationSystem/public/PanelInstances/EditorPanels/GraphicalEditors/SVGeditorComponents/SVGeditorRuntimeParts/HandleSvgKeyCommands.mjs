// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/HandleSvgKeyCommands.mjs
// This module implements handle Svg Key Commands behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { rememberBrushSize, writeDrawingAssistMetadata } from "../DrawingAssistSettings.mjs";

// Handle Svg Key Commands operations.
export function handleSvgKeyCommands(scope) {
  scope.keyCommandState.key = String(scope.e.key || "");
  scope.keyCommandState.meta = scope.e.ctrlKey || scope.e.metaKey;
  if (scope.owner.svgSession.handleSvgCanvasZoomShortcut(scope.e)) {
    scope.e.preventDefault();
    scope.e.stopPropagation();
    return {
      value: void 0
    };
  }
  if (scope.owner.svgSession.freehandStrokeState) {
    if (scope.keyCommandState.key === "Escape") {
      if (scope.owner.svgSession.freehandStrokeState.shapeActive) scope.owner.svgSession.restoreOriginalFreehandPreview();else scope.owner.svgSession.cancelFreehandStroke();
      scope.e.preventDefault();
      return {
        value: void 0
      };
    }
    if (scope.keyCommandState.key === "Enter" && scope.owner.svgSession.freehandStrokeState.shapeActive) {
      scope.owner.svgSession.commitFreehandStroke({
        preferCorrection: true
      });
      scope.e.preventDefault();
      return {
        value: void 0
      };
    }
    if (scope.keyCommandState.meta && scope.keyCommandState.key.toLowerCase() === "z") {
      scope.owner.svgSession.restoreOriginalFreehandPreview();
      scope.e.preventDefault();
      return {
        value: void 0
      };
    }
  }
  if (scope.keyCommandState.key === "Escape" && scope.owner.svgSession.maskEditState) {
    scope.owner.svgSession.editArtworkFromMaskEdit();
    scope.e.preventDefault();
    return {
      value: void 0
    };
  }
  scope.keyCommandState.shortcut = String(scope.owner.svgSession.drawingAssistSettings.quickMenuShortcut || "q").toLowerCase();
  if (!scope.keyCommandState.meta && !scope.e.altKey && !scope.e.shiftKey && scope.keyCommandState.key.toLowerCase() === scope.keyCommandState.shortcut) {
    scope.keyCommandState.rect = scope.owner.svgSession.svgRoot.getBoundingClientRect();
    scope.owner.svgSession.quickMenu.show(scope.owner.svgSession.lastPointerClient?.x || scope.keyCommandState.rect.left + 40, scope.owner.svgSession.lastPointerClient?.y || scope.keyCommandState.rect.top + 40, scope.owner.svgSession.drawingAssistSettings);
    scope.e.preventDefault();
    return {
      value: void 0
    };
  }
  if (!scope.keyCommandState.meta && !scope.e.altKey && (scope.keyCommandState.key === "[" || scope.keyCommandState.key === "]")) {
    scope.keyCommandState.delta = scope.keyCommandState.key === "]" ? 1 : -1;
    scope.keyCommandState.factor = scope.e.shiftKey ? 4 : 1;
    scope.keyCommandState.nextSize = Math.max(0.1, (Number(scope.owner.svgSession.drawingAssistSettings.brushSize) || 1) + scope.keyCommandState.delta * scope.keyCommandState.factor);
    scope.owner.svgSession.drawingAssistSettings = rememberBrushSize(scope.keyCommandState.nextSize, window);
    writeDrawingAssistMetadata(scope.owner.svgSession.svgRoot, scope.owner.svgSession.drawingAssistSettings);
    scope.owner.svgSession.updateBrushCursor(scope.owner.svgSession.lastPointerRoot);
    scope.e.preventDefault();
    return {
      value: void 0
    };
  }
  if (scope.owner.svgSession.toolState.mode === "sketch" && scope.keyCommandState.meta && scope.keyCommandState.key.toLowerCase() === "z") {
    if (!scope.e.shiftKey) scope.owner.svgSession.sketchController.undoLastStroke();
    scope.e.preventDefault();
    return {
      value: void 0
    };
  }
  if (scope.keyCommandState.meta && scope.keyCommandState.key.toLowerCase() === "z") {
    if (scope.e.shiftKey) scope.owner.svgSession.redoSvgHistory();else scope.owner.svgSession.undoSvgHistory();
    scope.e.preventDefault();
    return {
      value: void 0
    };
  }
  if (scope.owner.svgSession.toolState.mode === "sketch") {
    if (scope.keyCommandState.key === "Enter") {
      scope.keyCommandState.element = scope.owner.svgSession.sketchController.finalizeSketch();
      if (scope.keyCommandState.element) {
        window.NodevisionState = window.NodevisionState || {};
        window.NodevisionState.svgDrawTool = "select";
        scope.owner.svgSession.setMode("select");
        scope.owner.svgSession.setSelection([scope.keyCommandState.element], {
          primary: scope.keyCommandState.element
        });
      }
      scope.e.preventDefault();
      return {
        value: void 0
      };
    }
    if (scope.keyCommandState.key === "Escape") {
      if (scope.owner.svgSession.sketchController.isDrawing()) {
        scope.owner.svgSession.sketchController.undoLastStroke();
      } else if (scope.owner.svgSession.sketchController.hasSketchContent()) {
        scope.owner.svgSession.sketchController.cancelSketchSession();
      } else {
        window.NodevisionState.svgDrawTool = "select";
        scope.owner.svgSession.setMode("select");
      }
      scope.e.preventDefault();
      return {
        value: void 0
      };
    }
  }
  if (scope.owner.svgSession.handleSelectionGrabKey(scope.e)) {
    scope.e.preventDefault();
    return {
      value: void 0
    };
  }
  if (scope.owner.svgSession.handleSelectionRotateKey(scope.e)) {
    scope.e.preventDefault();
    return {
      value: void 0
    };
  }
  if (scope.owner.svgSession.toolState.mode === "select" && scope.owner.svgSession.nodeEditor.onKeyDown?.(scope.e)) return {
    value: void 0
  };
  if (!scope.keyCommandState.meta && !scope.e.altKey && scope.keyCommandState.key.toLowerCase() === "e" && scope.owner.svgSession.toolState.mode === "select") {
    scope.owner.svgSession.startLineToolExtrudeFromSelection();
    scope.e.preventDefault();
    return {
      value: void 0
    };
  }
}
