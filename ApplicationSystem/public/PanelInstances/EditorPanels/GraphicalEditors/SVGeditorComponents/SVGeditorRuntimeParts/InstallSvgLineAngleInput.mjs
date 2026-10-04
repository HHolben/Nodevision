// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/InstallSvgLineAngleInput.mjs
// This module implements install Svg Line Angle Input behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

// Install Svg Line Angle Input operations.
export function installSvgLineAngleInput(scope) {
  scope.svgSession.getLineToolAnglePreviewLength = function (origin) {
    const endpoint = scope.svgSession.getLineToolPreviewEndpointRoot();
    if (origin && endpoint) {
      const len = Math.hypot(endpoint.x - origin.x, endpoint.y - origin.y);
      if (Number.isFinite(len) && len > 1e-6) return len;
    }
    const cursor = scope.svgSession.lineToolState.cursorRoot;
    if (origin && cursor) {
      const len = Math.hypot(cursor.x - origin.x, cursor.y - origin.y);
      if (Number.isFinite(len) && len > 1e-6) return len;
    }
    const vb = scope.svgSession.getViewBox();
    const fallback = vb && Number.isFinite(vb.width) && vb.width > 0 ? vb.width * 0.15 : scope.svgSession.pointerToleranceInSvgUnits(120);
    return Math.max(1, fallback);
  };
  scope.svgSession.updateLineToolAnglePreview = function (message = "") {
    const constraint = scope.svgSession.lineToolState.constraint;
    if (!constraint || constraint.type !== "angle") return false;
    const origin = constraint.originRoot || scope.svgSession.getLineToolCurrentSegmentOriginRoot();
    if (!origin || !Number.isFinite(constraint.angleRad)) return false;
    const len = Number.isFinite(constraint.previewLength) && constraint.previewLength > 1e-6 ? constraint.previewLength : scope.svgSession.getLineToolAnglePreviewLength(origin);
    constraint.previewLength = len;
    const previewPoint = {
      x: origin.x + Math.cos(constraint.angleRad) * len,
      y: origin.y + Math.sin(constraint.angleRad) * len
    };
    constraint.fixedRoot = {
      ...previewPoint
    };
    scope.svgSession.updateLineToolPreview(previewPoint);
    scope.svgSession.setStatus(message || "Line angle locked to " + scope.svgSession.lineToolAngleConstraintLabel(constraint) + "; click or Enter to place, Tab units, - flips sign");
    return true;
  };
  scope.svgSession.startLineToolAngleInput = function () {
    const origin = scope.svgSession.getLineToolCurrentSegmentOriginRoot();
    if (!origin) {
      scope.svgSession.setStatus("Line tool: place a vertex before using angle lock");
      return false;
    }
    const previewLength = scope.svgSession.getLineToolAnglePreviewLength(origin);
    scope.svgSession.lineToolState.constraint = {
      type: "angle",
      originRoot: {
        ...origin
      },
      angleRad: 0,
      angleDirectionSign: 1,
      previewLength
    };
    scope.svgSession.lineToolState.axisDistanceBuffer = "";
    scope.svgSession.lineToolState.angleInputBuffer = "";
    scope.svgSession.updateLineToolAnglePreview("Line angle locked to 0 " + scope.svgSession.lineToolAngleUnit() + "; type angle, Tab switches units, - flips sign, Enter places point");
    return true;
  };
  scope.svgSession.applyLineToolAngleInputValue = function (value) {
    const constraint = scope.svgSession.lineToolState.constraint;
    if (!constraint || constraint.type !== "angle") return false;
    const angleRad = scope.svgSession.lineToolAngleValueToRadians(Math.abs(value), scope.svgSession.lineToolAngleUnit());
    if (angleRad === null) return false;
    constraint.angleRad = angleRad * scope.svgSession.getLineToolAngleDirectionSign(constraint);
    return scope.svgSession.updateLineToolAnglePreview();
  };
  scope.svgSession.reapplyLineToolAngleBuffer = function () {
    const constraint = scope.svgSession.lineToolState.constraint;
    if (!constraint || constraint.type !== "angle") return false;
    const value = scope.svgSession.parseLineToolNumber(scope.svgSession.lineToolState.angleInputBuffer);
    if (value !== null) return scope.svgSession.applyLineToolAngleInputValue(value);
    constraint.angleRad = 0;
    return scope.svgSession.updateLineToolAnglePreview("Line angle locked to 0 " + scope.svgSession.lineToolAngleUnit() + "; type angle, Tab switches units, - flips sign, Enter places point");
  };
  scope.svgSession.toggleLineToolAngleDirection = function () {
    const constraint = scope.svgSession.lineToolState.constraint;
    if (!constraint || constraint.type !== "angle") return false;
    constraint.angleDirectionSign = scope.svgSession.getLineToolAngleDirectionSign(constraint) < 0 ? 1 : -1;
    return scope.svgSession.reapplyLineToolAngleBuffer();
  };
  scope.svgSession.toggleLineToolAngleUnit = function () {
    const fromUnit = scope.svgSession.lineToolAngleUnit();
    const toUnit = fromUnit === "deg" ? "rad" : "deg";
    const value = scope.svgSession.parseLineToolNumber(scope.svgSession.lineToolState.angleInputBuffer);
    if (value !== null) {
      const angleRad = scope.svgSession.lineToolAngleValueToRadians(Math.abs(value), fromUnit);
      const nextValue = scope.svgSession.lineToolAngleRadiansToValue(angleRad, toUnit);
      scope.svgSession.lineToolState.angleInputBuffer = scope.svgSession.formatLineToolAngleNumber(Math.abs(nextValue || 0));
    }
    scope.svgSession.lineToolState.angleUnit = toUnit;
    return scope.svgSession.reapplyLineToolAngleBuffer();
  };
  scope.svgSession.promptLineToolPosition = function () {
    const value = window.prompt?.("Line cursor position (x y)", "") || "";
    const point = scope.svgSession.parseLineToolCoordinatePair(value);
    if (!point) {
      scope.svgSession.setStatus("Line position canceled");
      return false;
    }
    scope.svgSession.placeLineToolVertex(point, scope.svgSession.lineToolState.layer || scope.svgSession.getActiveLayer() || scope.svgSession.svgRoot);
    return true;
  };
}
