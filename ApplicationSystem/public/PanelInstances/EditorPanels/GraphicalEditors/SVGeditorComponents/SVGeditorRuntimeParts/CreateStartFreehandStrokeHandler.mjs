// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/CreateStartFreehandStrokeHandler.mjs
// This module implements create Start Freehand Stroke Handler behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { normalizePointerSample } from "../PointerInput.mjs";
import { createSvgEl } from "../svgDom.mjs";
import { SVG_UI_ATTR } from "./CreateBlankSvgRoot.mjs";
import { sampleSvgPaint, applyEyedropperSample } from "../EyedropperTool.mjs";
import { getReferencedSvgId, getSvgDefinitionByReference } from "../SvgMaskClipCommands.mjs";

// Create Start Freehand Stroke Handler operations.
export function createStartFreehandStrokeHandler(owner) {
  return function (event, rootPoint) {
    const style = owner.svgSession.currentStyleDefaults();
    const point = owner.svgSession.drawingGuidesController.snapPoint(rootPoint);
    const sample = normalizePointerSample(event, point, null, owner.svgSession.drawingAssistSettings);
    if (!sample) return false;
    const previewEl = createSvgEl("path", {
      [SVG_UI_ATTR]: "freehand-preview",
      "data-nv-freehand-preview": "true",
      d: "M " + sample.x + " " + sample.y,
      fill: "none",
      stroke: style.stroke,
      "stroke-width": String(owner.svgSession.drawingAssistSettings.brushSize || style.strokeWidth || 1)
    });
    previewEl.style.pointerEvents = "none";
    owner.svgSession.overlayLayer.appendChild(previewEl);
    owner.svgSession.freehandStrokeState = {
      pointerId: event.pointerId,
      samples: [sample],
      previewEl,
      style,
      shapeActive: false,
      shapeResult: null,
      shapeOptions: {},
      holdTimer: 0
    };
    owner.svgSession.toolState.drawing = true;
    owner.svgSession.toolState.tempShape = previewEl;
    owner.svgSession.scheduleFreehandHold();
    owner.svgSession.scheduleFreehandRender();
    return true;
  };
}

export function createScheduleEyedropperHoldHandler(owner) {
  return function (event, target, rootPoint) {
    if (!owner.svgSession.drawingAssistSettings.gestureLongPressEyedropper || !target || owner.svgSession.toolState.mode !== "select") return false;
    const sampleTarget = target;
    const start = {
      x: rootPoint.x,
      y: rootPoint.y,
      clientX: event.clientX,
      clientY: event.clientY
    };
    owner.svgSession.cancelEyedropperHold();
    owner.svgSession.eyedropperHoldState = {
      pointerId: event.pointerId,
      start,
      target: sampleTarget,
      timer: window.setTimeout(() => {
        if (!owner.svgSession.eyedropperHoldState || owner.svgSession.eyedropperHoldState.pointerId !== event.pointerId) return;
        const sample = sampleSvgPaint(sampleTarget);
        if (sample && applyEyedropperSample(window.SVGEditorContext, sample, owner.svgSession.drawingAssistSettings.eyedropperTarget)) {
          owner.svgSession.eyedropperIndicator.show(start.clientX, start.clientY, sample);
          owner.svgSession.setStatus("Sampled SVG paint");
        }
        owner.svgSession.cancelEyedropperHold();
      }, Math.max(180, Number(owner.svgSession.drawingAssistSettings.shapeHoldDelayMs) || 450))
    };
    return true;
  };
}

export function createFindSelectedMaskOrClipDefinitionHandler(owner) {
  return function (attr = "mask") {
    const normalizedAttr = attr === "clip-path" ? "clip-path" : "mask";
    const definitionTag = normalizedAttr === "clip-path" ? "clippath" : "mask";
    const referencedArtwork = owner.svgSession.selectedElements.find(el => getReferencedSvgId(el, normalizedAttr));
    if (referencedArtwork) {
      const id = getReferencedSvgId(referencedArtwork, normalizedAttr);
      const definition = getSvgDefinitionByReference(owner.svgSession.svgRoot, referencedArtwork, normalizedAttr);
      if (definition) return {
        id,
        definition,
        artwork: referencedArtwork,
        attr: normalizedAttr
      };
    }
    for (const candidate of owner.svgSession.selectedElements) {
      if (!candidate) continue;
      const directTag = String(candidate.tagName || "").toLowerCase();
      if (directTag === definitionTag && candidate.id) {
        return {
          id: candidate.id,
          definition: candidate,
          artwork: owner.svgSession.maskEditState?.artwork || null,
          attr: normalizedAttr
        };
      }
      const owner = owner.svgSession.closestSvgElementByTag(candidate, definitionTag);
      if (owner?.id) return {
        id: owner.id,
        definition: owner,
        artwork: owner.svgSession.maskEditState?.artwork || null,
        attr: normalizedAttr
      };
    }
    if (owner.svgSession.maskEditState?.kind === normalizedAttr && owner.svgSession.maskEditState.definition?.isConnected) {
      return {
        id: owner.svgSession.maskEditState.id,
        definition: owner.svgSession.maskEditState.definition,
        artwork: owner.svgSession.maskEditState.artwork?.isConnected ? owner.svgSession.maskEditState.artwork : null,
        attr: normalizedAttr
      };
    }
    return null;
  };
}
