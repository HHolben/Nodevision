// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/CreateSvgToolControllers.mjs
// This module implements create Svg Tool Controllers behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { createPathNodeEditor } from "../PathNodeEditor.mjs";
import { createSketchModeController } from "../SketchMode.mjs";
import { createSvgEl } from "../svgDom.mjs";
import { SVG_UI_ATTR } from "./CreateBlankSvgRoot.mjs";
import { createInternalPngController } from "../internalPng.mjs";
import { createShapeCorrectionPreviewController } from "../ShapeCorrectionPreview.mjs";
import { createEyedropperIndicator } from "../EyedropperTool.mjs";
import { createDrawingGuidesController } from "../DrawingGuides.mjs";
import { createQuickMenuWidget } from "../QuickMenuWidget.mjs";

// Create Svg Tool Controllers operations.
export function createSvgToolControllers(scope) {
  scope.svgSession.nodeEditor = createPathNodeEditor({
    svgRoot: scope.svgSession.svgRoot,
    overlayLayer: scope.svgSession.overlayLayer,
    pointerToleranceInSvgUnits: scope.svgSession.pointerToleranceInSvgUnits,
    setStatus: scope.svgSession.setStatus,
    history: scope.svgSession.history,
    focusEditor: () => {
      try {
        scope.svgSession.wrapper.focus({
          preventScroll: true
        });
      } catch {
        try {
          scope.svgSession.wrapper.focus();
        } catch {}
      }
    }
  });
  scope.svgSession.sketchController = createSketchModeController({
    svgRoot: scope.svgSession.svgRoot,
    createSvgEl,
    getActiveLayer: scope.svgSession.getActiveLayer,
    appendElement: scope.svgSession.appendElement,
    currentStyleDefaults: scope.svgSession.currentStyleDefaults,
    setStatus: scope.svgSession.setStatus,
    setMode: scope.svgSession.setMode,
    markDirty: scope.svgSession.markDocumentDirty,
    pointerToleranceInSvgUnits: scope.svgSession.pointerToleranceInSvgUnits,
    uiAttrName: SVG_UI_ATTR
  });
  scope.svgSession.internalPngController = createInternalPngController({
    svgRoot: scope.svgSession.svgRoot,
    getViewBox: scope.svgSession.getViewBox,
    appendElement: scope.svgSession.appendElement,
    getSelectedElement: () => scope.svgSession.selectedElement,
    setStatus: scope.svgSession.setStatus,
    notifyChanged: scope.svgSession.refreshSelectionAfterMutation,
    markDirty: scope.svgSession.markDocumentDirty
  });
  scope.svgSession.shapeCorrectionPreview = createShapeCorrectionPreviewController({
    overlayLayer: scope.svgSession.overlayLayer,
    createSvgEl,
    uiAttrName: SVG_UI_ATTR,
    onCommit: () => scope.svgSession.commitFreehandStroke({
      preferCorrection: true
    }),
    onCancel: () => scope.svgSession.cancelShapeCorrectionPreview(),
    onRestore: () => scope.svgSession.restoreOriginalFreehandPreview()
  });
  scope.svgSession.eyedropperIndicator = createEyedropperIndicator();
  scope.svgSession.drawingGuidesController = createDrawingGuidesController({
    svgRoot: scope.svgSession.svgRoot,
    overlayLayer: scope.svgSession.overlayLayer,
    createSvgEl,
    getViewBox: scope.svgSession.getViewBox,
    uiAttrName: SVG_UI_ATTR,
    markDirty: scope.svgSession.markDocumentDirty
  });
  scope.svgSession.drawingGuidesController.render(scope.svgSession.drawingAssistSettings);
  scope.svgSession.quickMenu = createQuickMenuWidget({
    actionHandlers: {
      brush: () => scope.svgSession.setMode("freehand"),
      eraser: () => scope.svgSession.setMode("eraser"),
      eyedropper: () => scope.svgSession.setMode("eyedropper"),
      select: () => scope.svgSession.setMode("select"),
      transform: () => scope.svgSession.setMode("select"),
      duplicate: () => scope.svgSession.runSvgSnapshotOperation("duplicate", () => scope.svgSession.duplicateSelection()),
      bringForward: () => scope.svgSession.runSvgSnapshotOperation("bring-forward", () => scope.svgSession.arrangeSelection("front")),
      sendBackward: () => scope.svgSession.runSvgSnapshotOperation("send-backward", () => scope.svgSession.arrangeSelection("back"))
    }
  });
  scope.svgSession.lineToolState = {
    active: false,
    layer: null,
    startRoot: null,
    startSpace: null,
    lastPlacedRoot: null,
    lastPlacedSpace: null,
    pointsSpace: [],
    placedLines: [],
    cursorRoot: null,
    constraint: null,
    commandBuffer: "",
    commandTimer: null,
    axisDistanceBuffer: "",
    angleInputBuffer: "",
    angleUnit: "deg",
    grab: null,
    snapPointsRoot: null,
    vertexMarkers: []
  };
  scope.svgSession.shapeToolState = {
    kind: null,
    active: false,
    layer: null,
    pointsRoot: [],
    pointsSpace: []
  };
  scope.svgSession.svgRulerObserver = new ResizeObserver(scope.svgSession.updateSvgRulers);
  scope.svgSession.svgRulerObserver.observe(scope.svgSession.svgViewportHost);
  window.addEventListener("resize", scope.svgSession.updateSvgRulers);
  scope.svgSession.svgViewport.addEventListener("scroll", scope.svgSession.updateSvgRulers);
}
