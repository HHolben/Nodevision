// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/InstallSvgShapeGeometry.mjs
// This module implements install Svg Shape Geometry behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { createUpdateLineToolAngleArcHandler } from "./CreateBeginShapeToolHandler.mjs";
import { createUpdateLineToolLengthLabelHandler, createUpdateLineToolAngleLabelHandler } from "./CreateUpdateLineToolLengthLabelHandler.mjs";

// Install Svg Shape Geometry operations.
export function installSvgShapeGeometry(scope) {
  scope.svgSession.cancelLineToolAndDeletePlaced = function () {
    if (!scope.svgSession.lineToolState.active && scope.svgSession.lineToolState.placedLines.length === 0) return false;
    scope.svgSession.lineToolState.placedLines.forEach(el => {
      try {
        el.remove();
      } catch {
        // ignore
      }
    });
    scope.svgSession.clearLineToolState();
    scope.svgSession.setStatus("Line tool canceled (cleared placed lines)");
    return true;
  };
  scope.svgSession.hideShapeToolPreview = function () {
    scope.svgSession.shapeToolPreviewCircle.setAttribute("display", "none");
    scope.svgSession.shapeToolPreviewPath.setAttribute("display", "none");
  };
  scope.svgSession.clearShapeToolState = function () {
    scope.svgSession.shapeToolState.kind = null;
    scope.svgSession.shapeToolState.active = false;
    scope.svgSession.shapeToolState.layer = null;
    scope.svgSession.shapeToolState.pointsRoot = [];
    scope.svgSession.shapeToolState.pointsSpace = [];
    scope.svgSession.hideShapeToolPreview();
  };
  scope.svgSession.cancelShapeTool = function () {
    if (!scope.svgSession.shapeToolState.active) return false;
    scope.svgSession.clearShapeToolState();
    scope.svgSession.setStatus("Shape drawing canceled");
    return true;
  };
  scope.svgSession.updateLineToolAngleArc = createUpdateLineToolAngleArcHandler({
    get svgSession() {
      return scope.svgSession;
    }
  });
  scope.svgSession.updateLineToolLengthLabel = createUpdateLineToolLengthLabelHandler({
    get svgSession() {
      return scope.svgSession;
    }
  });
  scope.svgSession.updateLineToolAngleLabel = createUpdateLineToolAngleLabelHandler({
    get svgSession() {
      return scope.svgSession;
    }
  });
}
