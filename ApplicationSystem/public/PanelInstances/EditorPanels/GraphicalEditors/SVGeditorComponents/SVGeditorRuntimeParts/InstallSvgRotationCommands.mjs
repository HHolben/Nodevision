// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/InstallSvgRotationCommands.mjs
// This module implements install Svg Rotation Commands behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { createBeginPendingRotationCommandHandler } from "./CreateCommitSelectionGrabCommandHandler.mjs";
import { createCommitPendingRotationCommandHandler, createHandleSelectionRotateKeyHandler } from "./CreateCommitPendingRotationCommandHandler.mjs";

// Install Svg Rotation Commands operations.
export function installSvgRotationCommands(scope) {
  scope.svgSession.pendingRotationDisplayValue = function (command = scope.svgSession.pendingRotateCommand) {
    if (!command) return "";
    if (command.buffer) {
      const sign = command.directionSign < 0 ? "-" : "";
      return sign + command.buffer + " " + scope.svgSession.rotationCommandUnitLabel(command);
    }
    const value = command.unit === "deg" ? command.angleRad * 180 / Math.PI : command.angleRad;
    if (!Number.isFinite(value) || Math.abs(value) <= 1e-12) return "0 " + scope.svgSession.rotationCommandUnitLabel(command);
    return scope.svgSession.formatLineToolAngleNumber(value) + " " + scope.svgSession.rotationCommandUnitLabel(command);
  };
  scope.svgSession.updatePendingRotationStatus = function (message = "") {
    if (!scope.svgSession.pendingRotateCommand) return;
    if (scope.svgSession.pendingRotateCommand.originPlacement) {
      scope.svgSession.updateRotationOriginPlacementStatus(message);
      return;
    }
    scope.svgSession.setStatus(message || "Rotate preview: " + scope.svgSession.pendingRotationDisplayValue(scope.svgSession.pendingRotateCommand) + "; type a number, ro origin, rr radians, rd degrees, - flips, Enter commits, Esc cancels");
  };
  scope.svgSession.beginPendingRotationCommand = createBeginPendingRotationCommandHandler({
    get svgSession() {
      return scope.svgSession;
    }
  });
  scope.svgSession.reapplyPendingRotationBuffer = function () {
    const command = scope.svgSession.pendingRotateCommand;
    if (!command) return false;
    const value = scope.svgSession.parseLineToolNumber(command.buffer);
    if (value === null) {
      scope.svgSession.restoreRotationCommandBase(command);
      command.applied = false;
      command.angleRad = 0;
      scope.svgSession.refreshSelectionVisuals();
      scope.svgSession.updatePendingRotationStatus();
      return true;
    }
    const angleRad = scope.svgSession.lineToolAngleValueToRadians(Math.abs(value), command.unit) * (command.directionSign < 0 ? -1 : 1);
    const applied = scope.svgSession.applyRotationAngleToCommand(command, angleRad);
    scope.svgSession.updatePendingRotationStatus();
    return applied;
  };
  scope.svgSession.setPendingRotationUnit = function (unit) {
    const command = scope.svgSession.pendingRotateCommand;
    if (!command || command.buffer) return false;
    command.unit = unit === "deg" ? "deg" : "rad";
    command.prefix = command.unit === "deg" ? "rd" : "rr";
    scope.svgSession.updatePendingRotationStatus("Rotate input set to " + scope.svgSession.rotationCommandUnitLabel(command));
    return true;
  };
  scope.svgSession.togglePendingRotationDirection = function () {
    const command = scope.svgSession.pendingRotateCommand;
    if (!command) return false;
    command.directionSign = command.directionSign < 0 ? 1 : -1;
    if (command.buffer) return scope.svgSession.reapplyPendingRotationBuffer();
    if (command.applied || Math.abs(command.angleRad) > 1e-12) {
      scope.svgSession.applyRotationAngleToCommand(command, -command.angleRad);
      scope.svgSession.updatePendingRotationStatus();
      return true;
    }
    scope.svgSession.updatePendingRotationStatus("Rotate sign flipped; type an angle");
    return true;
  };
  scope.svgSession.commitPendingRotationCommand = createCommitPendingRotationCommandHandler({
    get svgSession() {
      return scope.svgSession;
    }
  });
  scope.svgSession.cancelPendingRotationCommand = function () {
    const command = scope.svgSession.pendingRotateCommand;
    if (!command) return false;
    scope.svgSession.restoreRotationCommandBase(command);
    scope.svgSession.pendingRotateCommand = null;
    scope.svgSession.rotateState = null;
    scope.svgSession.refreshSelectionAfterMutation("rotate-cancel");
    scope.svgSession.setStatus("Rotate preview canceled");
    return true;
  };
  scope.svgSession.startPendingRotationDrag = function (target, pointerId, point) {
    if (!target || !scope.svgSession.selectedElements.includes(target)) return false;
    const command = scope.svgSession.beginPendingRotationCommand("drag");
    if (!command) return false;
    const center = command.centerRoot;
    scope.svgSession.rotateState = {
      pointerId,
      command,
      cx: center.x,
      cy: center.y,
      startAngle: Math.atan2(point.y - center.y, point.x - center.x),
      baseAngleRad: command.angleRad || 0
    };
    try {
      scope.svgSession.svgRoot.setPointerCapture(pointerId);
    } catch {
      // Ignore unsupported pointer capture errors.
    }
    scope.svgSession.setStatus("Rotate drag: release to preview, Enter commits, Esc cancels");
    return true;
  };
  scope.svgSession.handleSelectionRotateKey = createHandleSelectionRotateKeyHandler({
    get svgSession() {
      return scope.svgSession;
    }
  });
  scope.svgSession.deleteSelection = function () {
    if (!scope.svgSession.selectedElements.length) return false;
    scope.svgSession.selectedElements.forEach(el => el.remove());
    scope.svgSession.clearSelection();
    scope.svgSession.setStatus("Selection deleted");
    return true;
  };
}
