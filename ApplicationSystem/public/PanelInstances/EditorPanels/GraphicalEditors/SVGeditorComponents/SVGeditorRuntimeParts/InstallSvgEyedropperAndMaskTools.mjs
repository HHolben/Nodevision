// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/InstallSvgEyedropperAndMaskTools.mjs
// This module implements install Svg Eyedropper And Mask Tools behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { normalizePointerSample } from "../PointerInput.mjs";
import { createScheduleEyedropperHoldHandler, createFindSelectedMaskOrClipDefinitionHandler } from "./CreateStartFreehandStrokeHandler.mjs";
import { createBeginMaskOrClipEditHandler } from "./CreateBeginMaskOrClipEditHandler.mjs";

// Install Svg Eyedropper And Mask Tools operations.
export function installSvgEyedropperAndMaskTools(scope) {
  scope.svgSession.appendFreehandSample = function (event, rootPoint) {
    const session = scope.svgSession.freehandStrokeState;
    if (!session || session.pointerId !== event.pointerId) return false;
    const point = scope.svgSession.drawingGuidesController.snapPoint(rootPoint);
    const previous = session.samples[session.samples.length - 1] || null;
    const sample = normalizePointerSample(event, point, previous, scope.svgSession.drawingAssistSettings);
    if (!sample) return false;
    const moved = !previous || Math.hypot(sample.x - previous.x, sample.y - previous.y) > Math.max(0.05, scope.svgSession.pointerToleranceInSvgUnits(2));
    if (moved) {
      session.samples.push(sample);
      if (session.shapeActive) scope.svgSession.updateShapeCorrectionFromStroke();
      scope.svgSession.scheduleFreehandHold();
    } else {
      session.samples[session.samples.length - 1] = sample;
    }
    scope.svgSession.scheduleFreehandRender();
    return true;
  };
  scope.svgSession.cancelEyedropperHold = function () {
    if (scope.svgSession.eyedropperHoldState?.timer) window.clearTimeout(scope.svgSession.eyedropperHoldState.timer);
    scope.svgSession.eyedropperHoldState = null;
  };
  scope.svgSession.scheduleEyedropperHold = createScheduleEyedropperHoldHandler({
    get svgSession() {
      return scope.svgSession;
    }
  });
  scope.svgSession.cancelEyedropperHoldIfMoved = function (rootPoint) {
    if (!scope.svgSession.eyedropperHoldState || !rootPoint) return;
    const start = scope.svgSession.eyedropperHoldState.start;
    if (Math.hypot(rootPoint.x - start.x, rootPoint.y - start.y) > Math.max(0.05, scope.svgSession.pointerToleranceInSvgUnits(4))) {
      scope.svgSession.cancelEyedropperHold();
    }
  };
  scope.svgSession.closestSvgElementByTag = function (el, tagName) {
    const wanted = String(tagName || "").toLowerCase();
    let node = el;
    while (node && node !== scope.svgSession.svgRoot) {
      if (node instanceof SVGElement && String(node.tagName || "").toLowerCase() === wanted) return node;
      node = node.parentNode;
    }
    return null;
  };
  scope.svgSession.findSelectedMaskOrClipDefinition = createFindSelectedMaskOrClipDefinitionHandler({
    get svgSession() {
      return scope.svgSession;
    }
  });
  scope.svgSession.maskEditContentElements = function (definition) {
    return Array.from(definition?.children || []).filter(child => scope.svgSession.isSelectableElement(child, {
      allowLocked: true
    }));
  };
  scope.svgSession.selectionInsideMaskEditState = function (elements = []) {
    const definition = scope.svgSession.maskEditState?.definition;
    if (!definition?.isConnected) return false;
    return elements.some(el => el === definition || definition.contains?.(el));
  };
  scope.svgSession.updateMaskEditIndicator = function () {
    if (!scope.svgSession.maskEditState?.definition?.isConnected) {
      scope.svgSession.maskEditState = null;
    }
    if (!scope.svgSession.maskEditState) {
      scope.svgSession.maskEditBanner.style.display = "none";
      scope.svgSession.maskEditBannerText.textContent = "";
      return;
    }
    const label = scope.svgSession.maskEditState.kind === "clip-path" ? "clipping path" : "mask";
    scope.svgSession.maskEditBannerText.textContent = `Editing ${label}: ${scope.svgSession.maskEditState.id || "unnamed"}`;
    scope.svgSession.maskEditBanner.style.display = "flex";
  };
  scope.svgSession.clearMaskEditState = function (options = {}) {
    const hadState = Boolean(scope.svgSession.maskEditState);
    scope.svgSession.maskEditState = null;
    scope.svgSession.updateMaskEditIndicator();
    if (hadState && !options.silent) scope.svgSession.setStatus("Editing artwork");
    return hadState;
  };
  scope.svgSession.beginMaskOrClipEdit = createBeginMaskOrClipEditHandler({
    get svgSession() {
      return scope.svgSession;
    }
  });
  scope.svgSession.editArtworkFromMaskEdit = function () {
    const artwork = scope.svgSession.maskEditState?.artwork;
    scope.svgSession.clearMaskEditState({
      silent: true
    });
    if (artwork?.isConnected) {
      scope.svgSession.setSelection([artwork], {
        primary: artwork,
        allowLocked: true
      });
      scope.svgSession.setStatus("Editing artwork");
      return true;
    }
    scope.svgSession.setStatus("Editing artwork; original masked object is no longer available");
    return false;
  };
}
