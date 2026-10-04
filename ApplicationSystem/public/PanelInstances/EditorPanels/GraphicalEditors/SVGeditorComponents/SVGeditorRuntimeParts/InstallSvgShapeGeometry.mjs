// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/InstallSvgShapeGeometry.mjs
// This module implements install Svg Shape Geometry behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { createCircleFromThreePointsHandler } from "./PersistSvgAttention.mjs";
import { createBeginShapeToolHandler, createPlaceShapeToolPointHandler, createUpdateLineToolAngleArcHandler } from "./CreateBeginShapeToolHandler.mjs";
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
  scope.svgSession.rootPointDistance = function (a, b) {
    if (!a || !b) return 0;
    return Math.hypot(Number(b.x) - Number(a.x), Number(b.y) - Number(a.y));
  };
  scope.svgSession.circleFromThreePoints = createCircleFromThreePointsHandler({});
  scope.svgSession.normalizePositiveAngle = function (value) {
    const full = Math.PI * 2;
    let next = value % full;
    if (next < 0) next += full;
    return next;
  };
  scope.svgSession.svgArcPathFromThreePoints = function (start, through, end) {
    const circle = scope.svgSession.circleFromThreePoints(start, through, end);
    if (!circle) {
      return `M ${scope.svgSession.formatSvgNumber(start.x)} ${scope.svgSession.formatSvgNumber(start.y)} L ${scope.svgSession.formatSvgNumber(end.x)} ${scope.svgSession.formatSvgNumber(end.y)}`;
    }
    const startAngle = Math.atan2(start.y - circle.y, start.x - circle.x);
    const throughAngle = Math.atan2(through.y - circle.y, through.x - circle.x);
    const endAngle = Math.atan2(end.y - circle.y, end.x - circle.x);
    const positiveDelta = scope.svgSession.normalizePositiveAngle(endAngle - startAngle);
    const throughDelta = scope.svgSession.normalizePositiveAngle(throughAngle - startAngle);
    const usePositiveSweep = throughDelta <= positiveDelta;
    const arcDelta = usePositiveSweep ? positiveDelta : Math.PI * 2 - positiveDelta;
    const largeArc = arcDelta > Math.PI ? 1 : 0;
    const sweep = usePositiveSweep ? 1 : 0;
    const r = scope.svgSession.formatSvgNumber(circle.r);
    return `M ${scope.svgSession.formatSvgNumber(start.x)} ${scope.svgSession.formatSvgNumber(start.y)} A ${r} ${r} 0 ${largeArc} ${sweep} ${scope.svgSession.formatSvgNumber(end.x)} ${scope.svgSession.formatSvgNumber(end.y)}`;
  };
  scope.svgSession.beginShapeTool = createBeginShapeToolHandler({
    get svgSession() {
      return scope.svgSession;
    }
  });
  scope.svgSession.updateShapeToolPreview = function (rootPoint) {
    if (!scope.svgSession.shapeToolState.active || !rootPoint) return false;
    const points = scope.svgSession.shapeToolState.pointsRoot || [];
    if (scope.svgSession.shapeToolState.kind === "circle" && points[0]) {
      scope.svgSession.shapeToolPreviewCircle.setAttribute("cx", String(points[0].x));
      scope.svgSession.shapeToolPreviewCircle.setAttribute("cy", String(points[0].y));
      scope.svgSession.shapeToolPreviewCircle.setAttribute("r", String(scope.svgSession.rootPointDistance(points[0], rootPoint)));
      scope.svgSession.shapeToolPreviewCircle.setAttribute("display", "");
      return true;
    }
    if (scope.svgSession.shapeToolState.kind === "arc" && points[0]) {
      const d = points.length >= 2 ? scope.svgSession.svgArcPathFromThreePoints(points[0], points[1], rootPoint) : `M ${scope.svgSession.formatSvgNumber(points[0].x)} ${scope.svgSession.formatSvgNumber(points[0].y)} L ${scope.svgSession.formatSvgNumber(rootPoint.x)} ${scope.svgSession.formatSvgNumber(rootPoint.y)}`;
      scope.svgSession.shapeToolPreviewPath.setAttribute("d", d);
      scope.svgSession.shapeToolPreviewPath.setAttribute("display", "");
      return true;
    }
    return false;
  };
  scope.svgSession.placeShapeToolPoint = createPlaceShapeToolPointHandler({
    get svgSession() {
      return scope.svgSession;
    }
  });
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
