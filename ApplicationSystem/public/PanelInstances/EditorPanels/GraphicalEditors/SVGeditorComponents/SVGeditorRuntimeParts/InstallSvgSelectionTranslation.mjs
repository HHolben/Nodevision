// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/InstallSvgSelectionTranslation.mjs
// This module implements install Svg Selection Translation behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { createTranslateElementHandler, createBeginSelectionGrabCommandHandler, createApplySelectionGrabPercentBufferHandler } from "./CreateTranslateElementHandler.mjs";

// Install Svg Selection Translation operations.
export function installSvgSelectionTranslation(scope) {
  scope.svgSession.selectElement = function (el) {
    if (!el) {
      scope.svgSession.clearSelection();
      return;
    }
    scope.svgSession.setSelection([el], {
      primary: el
    });
  };
  scope.svgSession.appendElement = function (el) {
    scope.svgSession.layersMgr.appendToActiveLayer(el);
    scope.svgSession.setSelection([el], {
      primary: el
    });
  };
  scope.svgSession.translateElement = createTranslateElementHandler({
    get svgSession() {
      return scope.svgSession;
    }
  });
  scope.svgSession.moveSelectionBy = function (dx, dy) {
    if (!scope.svgSession.selectedElements.length) return false;
    scope.svgSession.selectedElements.forEach(el => scope.svgSession.translateElement(el, dx, dy));
    scope.svgSession.refreshSelectionGeometryAfterMutation("move");
    return true;
  };
  scope.svgSession.getSelectionGrabAnchorRoot = function () {
    const bbox = scope.svgSession.getSelectedUnionBBox();
    if (!bbox || !Number.isFinite(bbox.x) || !Number.isFinite(bbox.y)) return null;
    return {
      x: bbox.x + bbox.width / 2,
      y: bbox.y + bbox.height / 2
    };
  };
  scope.svgSession.buildSelectionGrabItems = function (elements = scope.svgSession.selectedElements) {
    return elements.filter(Boolean).map(el => ({
      element: el,
      space: scope.svgSession.getDragSpaceForElement(el),
      base: scope.svgSession.getDragBaseForElement(el)
    }));
  };
  scope.svgSession.restoreSelectionGrabBase = function (grab = scope.svgSession.selectionGrabState) {
    grab?.items?.forEach(item => scope.svgSession.applyDragDeltaToElement(item.element, item.base, 0, 0));
  };
  scope.svgSession.constrainSelectionGrabTarget = function (grab, rawRoot) {
    if (!grab || !rawRoot) return rawRoot;
    const axis = grab.axis;
    if (axis !== "x" && axis !== "y") return rawRoot;
    const sign = grab.axisDirectionSign < 0 ? -1 : 1;
    if (axis === "x") {
      return {
        x: grab.anchorRoot.x + Math.abs(rawRoot.x - grab.anchorRoot.x) * sign,
        y: grab.anchorRoot.y
      };
    }
    return {
      x: grab.anchorRoot.x,
      y: grab.anchorRoot.y + Math.abs(rawRoot.y - grab.anchorRoot.y) * sign
    };
  };
  scope.svgSession.applySelectionGrabTargetRoot = function (rawRoot, reason = "grab-preview") {
    const grab = scope.svgSession.selectionGrabState;
    if (!grab || !rawRoot || !Number.isFinite(rawRoot.x) || !Number.isFinite(rawRoot.y)) return false;
    grab.pointerRoot = {
      ...rawRoot
    };
    const targetRoot = scope.svgSession.constrainSelectionGrabTarget(grab, grab.fixedRoot || rawRoot);
    grab.currentRoot = {
      ...targetRoot
    };
    grab.applied = true;
    grab.items.forEach(item => {
      if (!item?.element || !item.base) return;
      const anchorSpace = item.space && item.space !== scope.svgSession.svgRoot ? scope.svgSession.rootPointToElementPoint(item.space, grab.anchorRoot) : grab.anchorRoot;
      const targetSpace = item.space && item.space !== scope.svgSession.svgRoot ? scope.svgSession.rootPointToElementPoint(item.space, targetRoot) : targetRoot;
      scope.svgSession.applyDragDeltaToElement(item.element, item.base, targetSpace.x - anchorSpace.x, targetSpace.y - anchorSpace.y);
    });
    scope.svgSession.refreshSelectionGeometryAfterMutation(reason);
    return true;
  };
  scope.svgSession.updateSelectionGrabStatus = function (message = "") {
    const grab = scope.svgSession.selectionGrabState;
    if (!grab) return;
    const axis = grab.axis ? grab.axis.toUpperCase() + " axis; " : "";
    const typed = grab.buffer ? grab.buffer + "%" : "move cursor";
    scope.svgSession.setStatus(message || "Grab selection: " + axis + typed + "; X/Y locks axis, type percent, click or Enter releases, Esc cancels");
  };
  scope.svgSession.beginSelectionGrabCommand = createBeginSelectionGrabCommandHandler({
    get svgSession() {
      return scope.svgSession;
    }
  });
  scope.svgSession.setSelectionGrabAxis = function (axis) {
    const grab = scope.svgSession.selectionGrabState;
    if (!grab || axis !== "x" && axis !== "y") return false;
    grab.axis = axis;
    grab.axisDirectionSign = 1;
    grab.buffer = "";
    delete grab.fixedRoot;
    if (grab.pointerRoot || scope.svgSession.lastPointerRoot) scope.svgSession.applySelectionGrabTargetRoot(grab.pointerRoot || scope.svgSession.lastPointerRoot);
    scope.svgSession.updateSelectionGrabStatus("Grab selection locked to " + axis.toUpperCase() + " axis; type percent, click or Enter releases");
    return true;
  };
  scope.svgSession.applySelectionGrabPercentBuffer = createApplySelectionGrabPercentBufferHandler({
    get svgSession() {
      return scope.svgSession;
    }
  });
}
