// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/InstallSvgGroupingAndVisibility.mjs
// This module implements install Svg Grouping And Visibility behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { createSoloSelectionHandler } from "./CreateMoveSelectionInHierarchyHandler.mjs";
import { createSvgElementFromSpec } from "../ShapeRecognition.mjs";
import { createSvgEl } from "../svgDom.mjs";
import { getBrushPreset } from "../VectorBrushPresets.mjs";
import { setDrawingAssistSettings, writeDrawingAssistMetadata } from "../DrawingAssistSettings.mjs";
import { stabilizeStroke } from "../StrokeStabilizer.mjs";

// Install Svg Grouping And Visibility operations.
export function installSvgGroupingAndVisibility(scope) {
  scope.svgSession.ungroupSelection = function () {
    if (scope.svgSession.selectedElements.length !== 1) return false;
    const group = scope.svgSession.selectedElements[0];
    if (!group || group.tagName.toLowerCase() !== "g" || group === scope.svgSession.overlayLayer) return false;
    const parent = group.parentNode;
    if (!parent) return false;
    const children = Array.from(group.children);
    children.forEach(child => parent.insertBefore(child, group));
    group.remove();
    scope.svgSession.setSelection(children, {
      primary: children[0] || null
    });
    scope.svgSession.setStatus("Ungrouped selection");
    return true;
  };
  scope.svgSession.selectedGraphicsDescendants = function () {
    const out = [];
    scope.svgSession.selectedElements.forEach(root => {
      Array.from(root?.querySelectorAll?.("*") || []).forEach(child => {
        if (scope.svgSession.isSelectableElement(child) && !out.includes(child)) out.push(child);
      });
    });
    return out;
  };
  scope.svgSession.setSelectionLocked = function (locked = true) {
    if (!scope.svgSession.selectedElements.length) return false;
    scope.svgSession.selectedElements.forEach(el => {
      if (!el) return;
      if (locked) {
        el.setAttribute("data-nv-locked", "true");
        el.style.pointerEvents = "none";
      } else {
        el.removeAttribute("data-nv-locked");
        if (el.style?.pointerEvents === "none") el.style.pointerEvents = "";
      }
    });
    scope.svgSession.refreshSelectionAfterMutation(locked ? "lock" : "unlock");
    scope.svgSession.setStatus(locked ? "Locked selection" : "Unlocked selection");
    return true;
  };
  scope.svgSession.toggleSelectionLocked = function () {
    if (!scope.svgSession.selectedElements.length) return false;
    const shouldLock = scope.svgSession.selectedElements.some(el => el?.getAttribute?.("data-nv-locked") !== "true");
    return scope.svgSession.setSelectionLocked(shouldLock);
  };
  scope.svgSession.selectSelectionContents = function () {
    const descendants = scope.svgSession.selectedGraphicsDescendants();
    if (!descendants.length) return false;
    scope.svgSession.setSelection(descendants, {
      primary: descendants[0] || null
    });
    scope.svgSession.setStatus("Selected layer/group contents");
    return descendants;
  };
  scope.svgSession.restoreSoloHiddenElements = function () {
    const hidden = Array.from(scope.svgSession.svgRoot.querySelectorAll("[data-nv-solo-hidden=\"true\"]"));
    hidden.forEach(el => {
      const prevDisplay = el.getAttribute("data-nv-solo-prev-display");
      if (el.style) el.style.display = prevDisplay || "";
      el.removeAttribute("data-nv-solo-prev-display");
      el.removeAttribute("data-nv-solo-hidden");
    });
    return hidden.length > 0;
  };
  scope.svgSession.soloSelection = createSoloSelectionHandler({
    get svgSession() {
      return scope.svgSession;
    }
  });
  scope.svgSession.currentStyleDefaults = function () {
    return {
      fill: scope.svgSession.styleState.fill || "#80c0ff",
      stroke: scope.svgSession.styleState.stroke || "#000000",
      strokeWidth: scope.svgSession.styleState.strokeWidth || "0.1"
    };
  };
  scope.svgSession.createElementFromSpec = function (spec) {
    return createSvgElementFromSpec(createSvgEl, spec);
  };
  scope.svgSession.currentBrushPreset = function () {
    return getBrushPreset(scope.svgSession.drawingAssistSettings.defaultBrushPreset, window.NodevisionVectorBrushPresets || []);
  };
  scope.svgSession.refreshDrawingAssistSettings = function (patch = {}) {
    scope.svgSession.drawingAssistSettings = setDrawingAssistSettings({
      ...scope.svgSession.drawingAssistSettings,
      ...(patch || {})
    }, window);
    scope.svgSession.drawingGuidesController.setSettings(scope.svgSession.drawingAssistSettings);
    writeDrawingAssistMetadata(scope.svgSession.svgRoot, scope.svgSession.drawingAssistSettings);
    if (scope.svgSession.lastPointerRoot) scope.svgSession.updateBrushCursor(scope.svgSession.lastPointerRoot);
    return scope.svgSession.drawingAssistSettings;
  };
  scope.svgSession.stabilizedFreehandSamples = function (samples = null) {
    const source = samples || scope.svgSession.freehandStrokeState?.samples || [];
    return stabilizeStroke(source, {
      mode: scope.svgSession.drawingAssistSettings.stabilizationMode,
      strength: scope.svgSession.drawingAssistSettings.stabilizationStrength,
      smoothing: scope.svgSession.drawingAssistSettings.smoothing,
      minimumPointDistance: scope.svgSession.drawingAssistSettings.minimumPointDistance,
      curveSimplification: scope.svgSession.drawingAssistSettings.curveSimplification,
      preserveCorners: scope.svgSession.drawingAssistSettings.preserveCorners
    }).samples;
  };
}
