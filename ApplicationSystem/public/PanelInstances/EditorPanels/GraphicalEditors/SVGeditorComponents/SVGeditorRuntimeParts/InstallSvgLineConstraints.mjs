// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/InstallSvgLineConstraints.mjs
// This module implements install Svg Line Constraints behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { LINE_TOOL_AXIS_TYPES } from "./CreateBlankSvgRoot.mjs";
import { createApplyLineToolConstraintHandler } from "./CreateUpdateLineToolLengthLabelHandler.mjs";

// Install Svg Line Constraints operations.
export function installSvgLineConstraints(scope) {
  scope.svgSession.updateLineToolPreview = function (rootPoint) {
    if (!scope.svgSession.lineToolState.active || !scope.svgSession.lineToolState.startRoot || !rootPoint) return false;
    const style = scope.svgSession.currentStyleDefaults();
    scope.svgSession.setLineToolOverlayStyle(style);
    scope.svgSession.lineToolPreviewLine.setAttribute("x1", String(scope.svgSession.lineToolState.startRoot.x));
    scope.svgSession.lineToolPreviewLine.setAttribute("y1", String(scope.svgSession.lineToolState.startRoot.y));
    scope.svgSession.lineToolPreviewLine.setAttribute("x2", String(rootPoint.x));
    scope.svgSession.lineToolPreviewLine.setAttribute("y2", String(rootPoint.y));
    scope.svgSession.lineToolPreviewLine.setAttribute("display", "");
    const r = Math.max(2, scope.svgSession.pointerToleranceInSvgUnits(4));
    scope.svgSession.lineToolPreviewEnd.setAttribute("r", String(r));
    scope.svgSession.lineToolPreviewEnd.setAttribute("cx", String(rootPoint.x));
    scope.svgSession.lineToolPreviewEnd.setAttribute("cy", String(rootPoint.y));
    scope.svgSession.lineToolPreviewEnd.setAttribute("display", "");
    scope.svgSession.updateLineToolAngleArc(scope.svgSession.lineToolState.startRoot, rootPoint);
    scope.svgSession.updateLineToolLengthLabel(scope.svgSession.lineToolState.startRoot, rootPoint);
    scope.svgSession.updateLineToolAngleLabel(scope.svgSession.lineToolState.startRoot, rootPoint);
    return true;
  };
  scope.svgSession.parseLineToolCoordinatePair = function (rawValue) {
    const parts = String(rawValue || "").trim().split(/[\s,]+/).filter(Boolean).map(part => Number.parseFloat(part));
    if (parts.length < 2 || !Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) return null;
    return {
      x: parts[0],
      y: parts[1]
    };
  };
  scope.svgSession.parseLineToolNumber = function (rawValue) {
    const n = Number.parseFloat(String(rawValue || "").trim());
    return Number.isFinite(n) ? n : null;
  };
  scope.svgSession.getLineToolAxisDirectionSign = function (constraint = scope.svgSession.lineToolState.constraint) {
    return constraint?.axisDirectionSign === -1 ? -1 : 1;
  };
  scope.svgSession.isLineToolAxisConstraint = function (constraint = scope.svgSession.lineToolState.constraint) {
    return Boolean(constraint && LINE_TOOL_AXIS_TYPES.has(constraint.type));
  };
  scope.svgSession.lineToolAxisConstraintLabel = function (constraint = scope.svgSession.lineToolState.constraint) {
    if (!scope.svgSession.isLineToolAxisConstraint(constraint)) return "";
    const side = scope.svgSession.getLineToolAxisDirectionSign(constraint) < 0 ? "-" : "+";
    const suffix = constraint.type === "z" ? " (depth)" : "";
    return constraint.type.toUpperCase() + " " + side + suffix;
  };
  scope.svgSession.getLineToolAngleDirectionSign = function (constraint = scope.svgSession.lineToolState.constraint) {
    return constraint?.angleDirectionSign === -1 ? -1 : 1;
  };
  scope.svgSession.lineToolAngleUnit = function () {
    return scope.svgSession.lineToolState.angleUnit === "rad" ? "rad" : "deg";
  };
  scope.svgSession.lineToolAngleValueToRadians = function (value, unit = scope.svgSession.lineToolAngleUnit()) {
    if (!Number.isFinite(value)) return null;
    return unit === "rad" ? value : value * Math.PI / 180;
  };
  scope.svgSession.lineToolAngleRadiansToValue = function (angleRad, unit = scope.svgSession.lineToolAngleUnit()) {
    if (!Number.isFinite(angleRad)) return null;
    return unit === "rad" ? angleRad : angleRad * 180 / Math.PI;
  };
  scope.svgSession.formatLineToolAngleNumber = function (value) {
    if (!Number.isFinite(value)) return "";
    return Number(value.toFixed(6)).toString();
  };
  scope.svgSession.axisPercentToRootDistance = function (axis, percent) {
    const value = Number(percent);
    if (!Number.isFinite(value)) return null;
    const vb = scope.svgSession.getViewBox();
    const dimension = axis === "y" ? vb.height : vb.width;
    if (!Number.isFinite(dimension) || dimension <= 0) return null;
    return dimension * value / 100;
  };
  scope.svgSession.lineToolAngleConstraintLabel = function (constraint = scope.svgSession.lineToolState.constraint) {
    if (!constraint || constraint.type !== "angle") return "";
    const value = scope.svgSession.lineToolAngleRadiansToValue(constraint.angleRad, scope.svgSession.lineToolAngleUnit());
    const side = scope.svgSession.getLineToolAngleDirectionSign(constraint) < 0 ? "-" : "+";
    return side + scope.svgSession.formatLineToolAngleNumber(Math.abs(value || 0)) + " " + scope.svgSession.lineToolAngleUnit();
  };
  scope.svgSession.getLineToolAnchorRoot = function () {
    if (scope.svgSession.lineToolState.active && scope.svgSession.lineToolState.startRoot) return scope.svgSession.lineToolState.startRoot;
    return scope.svgSession.lineToolState.lastPlacedRoot || scope.svgSession.lineToolState.startRoot || scope.svgSession.lineToolState.cursorRoot || null;
  };
  scope.svgSession.getLineToolAnchorSpace = function (layer, origin) {
    const activeLayer = layer || scope.svgSession.lineToolState.layer || scope.svgSession.svgRoot;
    if (scope.svgSession.lineToolState.active && scope.svgSession.lineToolState.startSpace && activeLayer === scope.svgSession.lineToolState.layer) {
      return scope.svgSession.lineToolState.startSpace;
    }
    if (scope.svgSession.lineToolState.lastPlacedSpace && activeLayer === scope.svgSession.lineToolState.layer) {
      return scope.svgSession.lineToolState.lastPlacedSpace;
    }
    return scope.svgSession.rootPointToElementPoint(activeLayer, origin);
  };
  scope.svgSession.projectPointToDirectedLine = function (point, origin, angleRad, directionSign = 1) {
    if (!point || !origin || !Number.isFinite(angleRad)) return point;
    const ux = Math.cos(angleRad);
    const uy = Math.sin(angleRad);
    const dx = point.x - origin.x;
    const dy = point.y - origin.y;
    const t = Math.abs(dx * ux + dy * uy) * (directionSign < 0 ? -1 : 1);
    return {
      x: origin.x + ux * t,
      y: origin.y + uy * t
    };
  };
  scope.svgSession.applyLineToolConstraint = createApplyLineToolConstraintHandler({
    get svgSession() {
      return scope.svgSession;
    }
  });
}
