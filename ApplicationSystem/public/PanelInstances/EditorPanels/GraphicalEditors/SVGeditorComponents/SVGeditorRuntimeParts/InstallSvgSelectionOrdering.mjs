// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/InstallSvgSelectionOrdering.mjs
// This module implements install Svg Selection Ordering behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { createCommitSelectionGrabCommandHandler, createHandleSelectionGrabKeyHandler } from "./CreateCommitSelectionGrabCommandHandler.mjs";

// Install Svg Selection Ordering operations.
export function installSvgSelectionOrdering(scope) {
  scope.svgSession.toggleSelectionGrabAxisDirection = function (sign = null) {
    const grab = scope.svgSession.selectionGrabState;
    if (!grab) return false;
    grab.axisDirectionSign = sign === 1 ? 1 : sign === -1 ? -1 : grab.axisDirectionSign < 0 ? 1 : -1;
    return grab.buffer ? scope.svgSession.applySelectionGrabPercentBuffer() : grab.pointerRoot || scope.svgSession.lastPointerRoot ? scope.svgSession.applySelectionGrabTargetRoot(grab.pointerRoot || scope.svgSession.lastPointerRoot) : (scope.svgSession.updateSelectionGrabStatus(), true);
  };
  scope.svgSession.updateSelectionLayerOrderStatus = function (message = "") {
    scope.svgSession.setStatus(message || "Layer order: PageUp/ArrowUp moves up, PageDown/ArrowDown moves down, Enter/Esc exits");
  };
  scope.svgSession.beginSelectionLayerOrderCommand = function () {
    const grab = scope.svgSession.selectionGrabState;
    if (!grab) return false;
    if (grab.applied) scope.svgSession.restoreSelectionGrabBase(grab);
    grab.layerOrderMode = true;
    grab.axis = null;
    grab.buffer = "";
    grab.applied = false;
    delete grab.fixedRoot;
    scope.svgSession.refreshSelectionVisuals();
    scope.svgSession.updateSelectionLayerOrderStatus("Layer order: PageUp/ArrowUp moves up one place, PageDown/ArrowDown moves down");
    return true;
  };
  scope.svgSession.finishSelectionLayerOrderCommand = function (options = {}) {
    if (!scope.svgSession.selectionGrabState?.layerOrderMode) return false;
    scope.svgSession.selectionGrabState = null;
    if (!options.silent) scope.svgSession.setStatus("Layer order shortcut ended");
    return true;
  };
  scope.svgSession.moveSelectionLayerOrderShortcut = function (direction) {
    const moved = scope.svgSession.runSvgSnapshotOperation("layer-order", () => scope.svgSession.moveSelectionInHierarchy(direction));
    if (moved) {
      scope.svgSession.updateSelectionLayerOrderStatus(direction >= 0 ? "Moved selection up one place; PageUp/ArrowUp repeats, Enter/Esc exits" : "Moved selection down one place; PageDown/ArrowDown repeats, Enter/Esc exits");
    }
    return true;
  };
  scope.svgSession.commitSelectionGrabCommand = createCommitSelectionGrabCommandHandler({
    get svgSession() {
      return scope.svgSession;
    }
  });
  scope.svgSession.cancelSelectionGrabCommand = function () {
    const grab = scope.svgSession.selectionGrabState;
    if (!grab) return false;
    if (grab.layerOrderMode) {
      scope.svgSession.selectionGrabState = null;
      scope.svgSession.setStatus("Layer order shortcut ended");
      return true;
    }
    scope.svgSession.restoreSelectionGrabBase(grab);
    scope.svgSession.selectionGrabState = null;
    scope.svgSession.refreshSelectionAfterMutation("grab-cancel");
    scope.svgSession.setStatus("Grab canceled");
    return true;
  };
  scope.svgSession.handleSelectionGrabKey = createHandleSelectionGrabKeyHandler({
    get svgSession() {
      return scope.svgSession;
    }
  });
  scope.svgSession.rotatePointAroundCenter = function (point, center, angleRadians) {
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    const cos = Math.cos(angleRadians);
    const sin = Math.sin(angleRadians);
    return {
      x: center.x + (dx * cos - dy * sin),
      y: center.y + (dx * sin + dy * cos)
    };
  };
  scope.svgSession.setTransformFromBase = function (el, baseTransform, operation) {
    const base = String(baseTransform || "").trim();
    el.setAttribute("transform", base ? base + " " + operation : operation);
  };
  scope.svgSession.setParentSpaceTransformFromBase = function (el, baseTransform, operation) {
    const base = String(baseTransform || "").trim();
    el.setAttribute("transform", base ? operation + " " + base : operation);
  };
  scope.svgSession.restoreTransformSnapshot = function (item) {
    const el = item?.element;
    if (!el) return;
    if (item.hadTransform) el.setAttribute("transform", item.baseTransform || "");else el.removeAttribute("transform");
  };
  scope.svgSession.restoreRotationCommandBase = function (command) {
    command?.items?.forEach(item => scope.svgSession.restoreTransformSnapshot(item));
  };
  scope.svgSession.buildRotationCommandItems = function (elements = scope.svgSession.selectedElements) {
    return elements.filter(Boolean).map(el => ({
      element: el,
      space: scope.svgSession.getDragSpaceForElement(el),
      hadTransform: el.hasAttribute("transform"),
      baseTransform: el.getAttribute("transform") || ""
    }));
  };
  scope.svgSession.getRotationCenterRoot = function () {
    const stored = scope.svgSession.readStoredRotationOriginRoot(scope.svgSession.getSelectedRotationOriginElement());
    return stored || scope.svgSession.getDefaultRotationCenterRoot();
  };
  scope.svgSession.applyRotationAngleToCommand = function (command, angleRad, reason = "rotate-preview") {
    if (!command || !command.items?.length || !Number.isFinite(angleRad)) return false;
    command.angleRad = angleRad;
    command.applied = true;
    const angleDeg = angleRad * 180 / Math.PI;
    command.items.forEach(item => {
      if (!item?.element) return;
      const center = item.space && item.space !== scope.svgSession.svgRoot ? scope.svgSession.rootPointToElementPoint(item.space, command.centerRoot) : command.centerRoot;
      scope.svgSession.setParentSpaceTransformFromBase(item.element, item.baseTransform, "rotate(" + angleDeg + " " + center.x + " " + center.y + ")");
    });
    scope.svgSession.refreshSelectionGeometryAfterMutation(reason);
    return true;
  };
  scope.svgSession.rotationCommandUnitLabel = function (command = scope.svgSession.pendingRotateCommand) {
    return command?.unit === "deg" ? "degrees" : "radians";
  };
}
