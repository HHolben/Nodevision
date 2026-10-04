// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/InstallSvgLinePlacement.mjs
// This module implements install Svg Line Placement behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { createBeginLineToolAtHandler, createPlaceLineToolVertexHandler } from "./CreateBeginLineToolAtHandler.mjs";
import { createApplyLineToolAxisDistanceHandler, createApplyLineToolAxisPositionHandler, createSetLineToolAxisConstraintHandler } from "./CreateApplyLineToolAxisDistanceHandler.mjs";
import { createSetLineToolPositionAxisConstraintHandler } from "./CreateSetLineToolPositionAxisConstraintHandler.mjs";

// Install Svg Line Placement operations.
export function installSvgLinePlacement(scope) {
  scope.svgSession.resolveLineToolPoint = function (rawPoint, event = null) {
    let next = rawPoint;
    if (event?.shiftKey && scope.svgSession.lineToolState.startRoot) {
      const tol = scope.svgSession.pointerToleranceInSvgUnits(18);
      const snapped = scope.svgSession.findNearestSnapPointInRoot(rawPoint, tol, {
        snapCache: "line-tool"
      });
      next = snapped || scope.svgSession.snapAngleEndpointInRoot(scope.svgSession.lineToolState.startRoot, rawPoint, Math.PI / 12);
    }
    next = scope.svgSession.applyLineToolConstraint(next);
    scope.svgSession.lineToolState.cursorRoot = next;
    return next;
  };
  scope.svgSession.setLineToolCursorRoot = function (rootPoint, {
    updatePreview = true
  } = {}) {
    if (!rootPoint || !Number.isFinite(rootPoint.x) || !Number.isFinite(rootPoint.y)) return false;
    scope.svgSession.lineToolState.cursorRoot = rootPoint;
    if (updatePreview && scope.svgSession.lineToolState.active) scope.svgSession.updateLineToolPreview(scope.svgSession.applyLineToolConstraint(rootPoint));
    return true;
  };
  scope.svgSession.beginLineToolAt = createBeginLineToolAtHandler({
    get svgSession() {
      return scope.svgSession;
    }
  });
  scope.svgSession.placeLineToolVertex = createPlaceLineToolVertexHandler({
    get svgSession() {
      return scope.svgSession;
    }
  });
  scope.svgSession.placeLineToolConstrainedPoint = function () {
    if (!scope.svgSession.lineToolState.active || !scope.svgSession.lineToolState.constraint) return false;
    const layer = scope.svgSession.lineToolState.layer || scope.svgSession.getActiveLayer() || scope.svgSession.svgRoot;
    const rawPoint = scope.svgSession.lineToolState.constraint.fixedRoot || scope.svgSession.lineToolState.cursorRoot || scope.svgSession.getLineToolPreviewEndpointRoot() || scope.svgSession.lineToolState.startRoot;
    if (!rawPoint) return false;
    const rootPoint = scope.svgSession.resolveLineToolPoint(rawPoint);
    return scope.svgSession.placeLineToolVertex(rootPoint, layer);
  };
  scope.svgSession.applyLineToolAxisDistance = createApplyLineToolAxisDistanceHandler({
    get svgSession() {
      return scope.svgSession;
    }
  });
  scope.svgSession.applyLineToolAxisPosition = createApplyLineToolAxisPositionHandler({
    get svgSession() {
      return scope.svgSession;
    }
  });
  scope.svgSession.reapplyLineToolAxisDistanceBuffer = function () {
    const constraint = scope.svgSession.lineToolState.constraint;
    if (!scope.svgSession.isLineToolAxisConstraint(constraint)) return false;
    const value = scope.svgSession.parseLineToolNumber(scope.svgSession.lineToolState.axisDistanceBuffer);
    if (value !== null) {
      return constraint.inputMode === "position" ? scope.svgSession.applyLineToolAxisPosition(value) : scope.svgSession.applyLineToolAxisDistance(value);
    }
    delete constraint.fixedRoot;
    delete constraint.zDistance;
    delete constraint.zPosition;
    if (scope.svgSession.lineToolState.cursorRoot) {
      const constrainedRoot = scope.svgSession.applyLineToolConstraint(scope.svgSession.lineToolState.cursorRoot);
      if (scope.svgSession.lineToolState.grab) scope.svgSession.updateLineToolGrab(constrainedRoot);else scope.svgSession.updateLineToolPreview(constrainedRoot);
    }
    const action = constraint.inputMode === "position" ? "type position" : scope.svgSession.lineToolState.grab ? "type percent, click or Enter to release" : "click or Enter to place";
    scope.svgSession.setStatus((scope.svgSession.lineToolState.grab ? "Line grab" : "Line cursor") + " locked to " + scope.svgSession.lineToolAxisConstraintLabel(constraint) + " axis; " + action);
    return true;
  };
  scope.svgSession.setLineToolAxisDirectionSign = function (sign) {
    const constraint = scope.svgSession.lineToolState.constraint;
    if (!scope.svgSession.isLineToolAxisConstraint(constraint)) return false;
    constraint.axisDirectionSign = sign < 0 ? -1 : 1;
    return scope.svgSession.reapplyLineToolAxisDistanceBuffer();
  };
  scope.svgSession.toggleLineToolAxisDirection = function () {
    const constraint = scope.svgSession.lineToolState.constraint;
    if (!scope.svgSession.isLineToolAxisConstraint(constraint)) return false;
    constraint.axisDirectionSign = scope.svgSession.getLineToolAxisDirectionSign(constraint) < 0 ? 1 : -1;
    return scope.svgSession.reapplyLineToolAxisDistanceBuffer();
  };
  scope.svgSession.setLineToolAxisConstraint = createSetLineToolAxisConstraintHandler({
    get svgSession() {
      return scope.svgSession;
    }
  });
  scope.svgSession.setLineToolPositionAxisConstraint = createSetLineToolPositionAxisConstraintHandler({
    get svgSession() {
      return scope.svgSession;
    }
  });
  scope.svgSession.getLineToolPreviewPointRoot = function (xAttr, yAttr) {
    if (scope.svgSession.lineToolPreviewLine.getAttribute("display") === "none") return null;
    if (!scope.svgSession.lineToolPreviewLine.hasAttribute(xAttr) || !scope.svgSession.lineToolPreviewLine.hasAttribute(yAttr)) return null;
    const x = Number.parseFloat(scope.svgSession.lineToolPreviewLine.getAttribute(xAttr));
    const y = Number.parseFloat(scope.svgSession.lineToolPreviewLine.getAttribute(yAttr));
    return Number.isFinite(x) && Number.isFinite(y) ? {
      x,
      y
    } : null;
  };
  scope.svgSession.getLineToolCurrentSegmentOriginRoot = function () {
    return scope.svgSession.getLineToolPreviewPointRoot("x1", "y1") || scope.svgSession.getLineToolAnchorRoot();
  };
  scope.svgSession.getLineToolPreviewEndpointRoot = function () {
    return scope.svgSession.getLineToolPreviewPointRoot("x2", "y2");
  };
}
