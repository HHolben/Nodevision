// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/InstallSvgRotationOriginGeometry.mjs
// This module implements install Svg Rotation Origin Geometry behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { createGetSelectedUnionBBoxHandler, createUpdateRotationOriginMarkerHandler } from "./CreateGetElementBBoxInSpaceHandler.mjs";
import { SVG_ROTATION_ORIGIN_X_ATTR, SVG_ROTATION_ORIGIN_Y_ATTR } from "./CreateBlankSvgRoot.mjs";

// Install Svg Rotation Origin Geometry operations.
export function installSvgRotationOriginGeometry(scope) {
  scope.svgSession.getSelectedUnionBBox = createGetSelectedUnionBBoxHandler({
    get svgSession() {
      return scope.svgSession;
    }
  });
  scope.svgSession.formatSvgNumber = function (value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "0";
    return Number(n.toFixed(6)).toString();
  };
  scope.svgSession.normalizeRootPoint = function (point) {
    const x = Number(point?.x);
    const y = Number(point?.y);
    return Number.isFinite(x) && Number.isFinite(y) ? {
      x,
      y
    } : null;
  };
  scope.svgSession.getSelectedRotationOriginElement = function () {
    return scope.svgSession.selectedElements.length === 1 ? scope.svgSession.selectedElements[0] : null;
  };
  scope.svgSession.getStoredRotationOriginLocal = function (el) {
    if (!el?.hasAttribute?.(SVG_ROTATION_ORIGIN_X_ATTR) || !el?.hasAttribute?.(SVG_ROTATION_ORIGIN_Y_ATTR)) return null;
    const x = Number.parseFloat(el.getAttribute(SVG_ROTATION_ORIGIN_X_ATTR));
    const y = Number.parseFloat(el.getAttribute(SVG_ROTATION_ORIGIN_Y_ATTR));
    return Number.isFinite(x) && Number.isFinite(y) ? {
      x,
      y
    } : null;
  };
  scope.svgSession.setStoredRotationOriginLocal = function (el, localPoint) {
    const point = scope.svgSession.normalizeRootPoint(localPoint);
    if (!el || !point) return false;
    el.setAttribute(SVG_ROTATION_ORIGIN_X_ATTR, scope.svgSession.formatSvgNumber(point.x));
    el.setAttribute(SVG_ROTATION_ORIGIN_Y_ATTR, scope.svgSession.formatSvgNumber(point.y));
    return true;
  };
  scope.svgSession.readStoredRotationOriginRoot = function (el) {
    const localPoint = scope.svgSession.getStoredRotationOriginLocal(el);
    return localPoint ? scope.svgSession.elementPointToRootPoint(el, localPoint.x, localPoint.y) : null;
  };
  scope.svgSession.setElementRotationOriginRoot = function (el, rootPoint) {
    const point = scope.svgSession.normalizeRootPoint(rootPoint);
    if (!el || !point) return false;
    return scope.svgSession.setStoredRotationOriginLocal(el, scope.svgSession.rootPointToElementPoint(el, point));
  };
  scope.svgSession.translateStoredRotationOriginLocal = function (el, dx, dy) {
    const localPoint = scope.svgSession.getStoredRotationOriginLocal(el);
    if (!localPoint) return false;
    return scope.svgSession.setStoredRotationOriginLocal(el, {
      x: localPoint.x + dx,
      y: localPoint.y + dy
    });
  };
  scope.svgSession.applyDragRotationOriginDelta = function (el, base, dx, dy) {
    const localPoint = base?.rotationOriginLocal || null;
    if (!localPoint) return false;
    return scope.svgSession.setStoredRotationOriginLocal(el, {
      x: localPoint.x + dx,
      y: localPoint.y + dy
    });
  };
  scope.svgSession.getDefaultRotationCenterRoot = function () {
    const bbox = scope.svgSession.getSelectedUnionBBox();
    if (!bbox || !Number.isFinite(bbox.x) || !Number.isFinite(bbox.y)) return null;
    return {
      x: bbox.x + bbox.width / 2,
      y: bbox.y + bbox.height / 2
    };
  };
  scope.svgSession.getCurrentRotationOriginMarkerPoint = function () {
    if (scope.svgSession.pendingRotateCommand?.centerRoot) return scope.svgSession.pendingRotateCommand.centerRoot;
    const stored = scope.svgSession.readStoredRotationOriginRoot(scope.svgSession.getSelectedRotationOriginElement());
    return stored || null;
  };
  scope.svgSession.updateRotationOriginMarker = createUpdateRotationOriginMarkerHandler({
    get svgSession() {
      return scope.svgSession;
    }
  });
  scope.svgSession.targetIsInsideSingleSelection = function (target) {
    const selected = scope.svgSession.getSelectedRotationOriginElement();
    return Boolean(selected && target && (target === selected || selected.contains?.(target)));
  };
  scope.svgSession.rotationOriginAxisLabel = function (axis) {
    return axis === "x" ? "X axis" : axis === "y" ? "Y axis" : "free point";
  };
  scope.svgSession.updateRotationOriginPlacementStatus = function (message = "") {
    const placement = scope.svgSession.pendingRotateCommand?.originPlacement || null;
    if (!placement) return;
    const axisText = placement.axis ? " locked to " + scope.svgSession.rotationOriginAxisLabel(placement.axis) : "";
    scope.svgSession.setStatus(message || "Rotation origin" + axisText + ": click the selected object to place it; X/Y constrains, Enter keeps current, Esc cancels placement");
  };
  scope.svgSession.constrainRotationOriginPoint = function (command, rootPoint) {
    const point = scope.svgSession.normalizeRootPoint(rootPoint);
    if (!command || !point) return point;
    const placement = command.originPlacement || null;
    const anchor = placement?.anchorRoot || command.centerRoot || scope.svgSession.getDefaultRotationCenterRoot();
    if (!placement?.axis || !anchor) return point;
    if (placement.axis === "x") return {
      x: point.x,
      y: anchor.y
    };
    if (placement.axis === "y") return {
      x: anchor.x,
      y: point.y
    };
    return point;
  };
}
