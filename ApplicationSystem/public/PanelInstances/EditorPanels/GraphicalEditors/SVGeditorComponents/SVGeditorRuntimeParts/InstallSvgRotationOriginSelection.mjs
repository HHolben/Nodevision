// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/InstallSvgRotationOriginSelection.mjs
// This module implements install Svg Rotation Origin Selection behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { getAttrNumber } from "../svgDom.mjs";

// Install Svg Rotation Origin Selection operations.
export function installSvgRotationOriginSelection(scope) {
  scope.svgSession.setPendingRotationOriginAxis = function (axis) {
    const command = scope.svgSession.pendingRotateCommand;
    const cleanAxis = axis === "x" || axis === "y" ? axis : null;
    if (!command || !command.originPlacement || !cleanAxis) return false;
    command.originPlacement.axis = cleanAxis;
    command.prefix = "ro" + cleanAxis;
    scope.svgSession.updateRotationOriginPlacementStatus("Rotation origin locked to " + cleanAxis.toUpperCase() + " axis; click selected object to place it");
    return true;
  };
  scope.svgSession.startRotationOriginPlacement = function (axis = null) {
    const command = scope.svgSession.pendingRotateCommand || scope.svgSession.beginPendingRotationCommand("keyboard");
    if (!command) return true;
    if (scope.svgSession.selectedElements.length !== 1) {
      scope.svgSession.setStatus("Rotation origin: select exactly one object first");
      return true;
    }
    const cleanAxis = axis === "x" || axis === "y" ? axis : null;
    command.originPlacement = {
      axis: cleanAxis,
      anchorRoot: command.centerRoot ? {
        ...command.centerRoot
      } : scope.svgSession.getDefaultRotationCenterRoot()
    };
    command.prefix = cleanAxis ? "ro" + cleanAxis : "ro";
    scope.svgSession.updateRotationOriginMarker(command.centerRoot);
    scope.svgSession.updateRotationOriginPlacementStatus();
    return true;
  };
  scope.svgSession.setSelectedRotationOriginRoot = function (rootPoint) {
    const selected = scope.svgSession.getSelectedRotationOriginElement();
    if (!selected) {
      scope.svgSession.setStatus("Rotation origin: select one object first");
      return false;
    }
    if (!scope.svgSession.setElementRotationOriginRoot(selected, rootPoint)) return false;
    scope.svgSession.refreshSelectionAfterMutation("rotation-origin");
    return true;
  };
  scope.svgSession.placePendingRotationOrigin = function (rootPoint) {
    const command = scope.svgSession.pendingRotateCommand;
    if (!command?.originPlacement) return false;
    const point = scope.svgSession.constrainRotationOriginPoint(command, rootPoint);
    if (!point) return false;
    const angleRad = command.angleRad || 0;
    const hadPreview = command.applied || Math.abs(angleRad) > 1e-12;
    if (hadPreview) scope.svgSession.restoreRotationCommandBase(command);
    const changed = scope.svgSession.runSvgSnapshotOperation("set-rotation-origin", () => scope.svgSession.setSelectedRotationOriginRoot(point));
    command.beforeSvgText = scope.svgSession.serializeSvgForSave() || command.beforeSvgText || "";
    command.items = scope.svgSession.buildRotationCommandItems(scope.svgSession.selectedElements);
    command.centerRoot = {
      ...point
    };
    command.originPlacement = null;
    command.originChanged = Boolean(command.originChanged || changed);
    command.prefix = command.unit === "deg" ? "rd" : "r";
    if (hadPreview) scope.svgSession.applyRotationAngleToCommand(command, angleRad, "rotation-origin");else scope.svgSession.refreshSelectionVisuals();
    scope.svgSession.updatePendingRotationStatus(changed ? "Rotation origin placed; type angle, drag selection, Enter commits" : "Rotation origin unchanged; type angle, drag selection, Enter commits");
    return true;
  };
  scope.svgSession.isSelectedLineVertexValid = function () {
    const line = scope.svgSession.selectedLineVertex?.line || null;
    const which = scope.svgSession.selectedLineVertex?.which || "";
    return Boolean(line && line.isConnected && scope.svgSession.selectedElements.length === 1 && scope.svgSession.selectedElements[0] === line && line.tagName?.toLowerCase?.() === "line" && (which === "start" || which === "end"));
  };
  scope.svgSession.clearSelectedLineVertex = function () {
    scope.svgSession.selectedLineVertex = null;
    scope.svgSession.lineStartHandle.setAttribute("fill", "#ffffff");
    scope.svgSession.lineEndHandle.setAttribute("fill", "#ffffff");
  };
  scope.svgSession.setSelectedLineVertex = function (line, which) {
    if (!line || line.tagName?.toLowerCase?.() !== "line" || which !== "start" && which !== "end") return false;
    scope.svgSession.selectedLineVertex = {
      line,
      which
    };
    scope.svgSession.refreshTransformHandles();
    scope.svgSession.setStatus("Selected " + which + " vertex; press E to extrude, X/Y/Z to lock axis");
    return true;
  };
  scope.svgSession.getSelectedLineVertexRoot = function () {
    if (!scope.svgSession.isSelectedLineVertexValid()) return null;
    const line = scope.svgSession.selectedLineVertex.line;
    const isStart = scope.svgSession.selectedLineVertex.which === "start";
    return scope.svgSession.elementPointToRootPoint(line, getAttrNumber(line, isStart ? "x1" : "x2", 0), getAttrNumber(line, isStart ? "y1" : "y2", 0));
  };
  scope.svgSession.getSelectedLineVertexLayer = function () {
    if (!scope.svgSession.isSelectedLineVertexValid()) return scope.svgSession.getActiveLayer() || scope.svgSession.svgRoot;
    const parent = scope.svgSession.selectedLineVertex.line.parentNode;
    return scope.svgSession.isSvgGraphicsElement(parent) ? parent : scope.svgSession.getActiveLayer() || scope.svgSession.svgRoot;
  };
  scope.svgSession.getPathNodeExtrudeContext = function () {
    const context = scope.svgSession.nodeEditor.getSelectedNodeExtrudeContext?.();
    if (!context?.rootPoint) return null;
    const sourceElement = context.sourceElement || null;
    const parent = sourceElement?.parentNode || null;
    return {
      rootPoint: context.rootPoint,
      layer: scope.svgSession.isSvgGraphicsElement(parent) ? parent : scope.svgSession.getActiveLayer() || scope.svgSession.svgRoot
    };
  };
}
