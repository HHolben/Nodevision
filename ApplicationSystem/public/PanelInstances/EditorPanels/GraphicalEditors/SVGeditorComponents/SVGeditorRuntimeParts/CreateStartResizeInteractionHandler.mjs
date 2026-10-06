// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/CreateStartResizeInteractionHandler.mjs
// This module implements create Start Resize Interaction Handler behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { clearSvgMarquee } from "./ClearSvgMarquee.mjs";

import { getAttrNumber } from "../svgDom.mjs";
import { parseEditableSvgRoot } from "./ParseEditableSvgRoot.mjs";
import { cleanupSvgCloneForSave, applyEditableSvgRootDefaults, prepareSvgRootForEditor } from "../SvgPreservation.mjs";
import { syncSvgDocumentBackgroundGeometry } from "../SvgDocumentBackground.mjs";
import { setDrawingAssistSettings, getDrawingAssistSettings, readDrawingAssistMetadata } from "../DrawingAssistSettings.mjs";

// Create Start Resize Interaction Handler operations.
export function createStartResizeInteractionHandler(owner) {
  return function (corner, pointerId) {
    if (!owner.svgSession.selectedElements.length) return;
    try {
      if (owner.svgSession.selectedElements.length === 1) {
        const el = owner.svgSession.selectedElements[0];
        if (!el || el.tagName.toLowerCase() === "line") return;
        const space = owner.svgSession.getDragSpaceForElement(el);
        const bbox = owner.svgSession.getElementBBoxInSpace(el, space);
        if (!bbox || bbox.width <= 0 || bbox.height <= 0) return;
        owner.svgSession.resizeState = {
          pointerId,
          element: el,
          corner,
          bbox,
          space,
          baseTransform: el.getAttribute("transform") || ""
        };
      } else {
        const bbox = owner.svgSession.getSelectedUnionBBox();
        if (!bbox || bbox.width <= 0 || bbox.height <= 0) return;
        owner.svgSession.resizeState = {
          pointerId,
          multi: true,
          corner,
          bbox,
          items: owner.svgSession.selectedElements.filter(Boolean).map(el => ({
            element: el,
            space: owner.svgSession.getDragSpaceForElement(el),
            baseTransform: el.getAttribute("transform") || ""
          }))
        };
      }
      try {
        owner.svgSession.svgRoot.setPointerCapture(pointerId);
      } catch {
        // Ignore unsupported pointer capture errors.
      }
    } catch {
      // Ignore elements without measurable bbox.
    }
  };
}

export function createStartRotateInteractionHandler(owner) {
  return function (target, pointerId, point) {
    if (!target) return false;
    try {
      const bbox = owner.svgSession.getElementBBoxInRoot(target);
      if (!bbox || !Number.isFinite(bbox.x) || !Number.isFinite(bbox.y)) return false;
      const origin = owner.svgSession.readStoredRotationOriginRoot(target);
      const cx = origin ? origin.x : bbox.x + bbox.width / 2;
      const cy = origin ? origin.y : bbox.y + bbox.height / 2;
      const startAngle = Math.atan2(point.y - cy, point.x - cx);
      const tag = target.tagName.toLowerCase();
      owner.svgSession.rotateState = {
        pointerId,
        element: target,
        cx,
        cy,
        startAngle,
        baseTransform: target.getAttribute("transform") || "",
        baseLine: tag === "line" ? {
          p1: {
            x: getAttrNumber(target, "x1", 0),
            y: getAttrNumber(target, "y1", 0)
          },
          p2: {
            x: getAttrNumber(target, "x2", 0),
            y: getAttrNumber(target, "y2", 0)
          }
        } : null
      };
      try {
        owner.svgSession.svgRoot.setPointerCapture(pointerId);
      } catch {
        // Ignore unsupported pointer capture errors.
      }
      owner.svgSession.setStatus("Rotating selection");
      return true;
    } catch {
      return false;
    }
  };
}

export function createSetSvgFromStringHandler(owner) {
  return function (svgString) {
    clearSvgMarquee(owner.svgSession);
    const parsed = parseEditableSvgRoot(svgString);
    const fresh = cleanupSvgCloneForSave(parsed.root);
    window.cancelAnimationFrame(owner.svgSession.selectionChangeRaf);
    window.cancelAnimationFrame(owner.svgSession.selectionMutationRaf);
    owner.svgSession.selectionChangeRaf = owner.svgSession.selectionMutationRaf = 0;
    Array.from(owner.svgSession.svgRoot.attributes).forEach(attr => {
      owner.svgSession.svgRoot.removeAttribute(attr.name);
    });
    Array.from(fresh.attributes).forEach(attr => {
      owner.svgSession.svgRoot.setAttribute(attr.name, attr.value);
    });
    while (owner.svgSession.svgRoot.firstChild) {
      owner.svgSession.svgRoot.removeChild(owner.svgSession.svgRoot.firstChild);
    }
    Array.from(fresh.childNodes).forEach(node => {
      owner.svgSession.svgRoot.appendChild(node.cloneNode(true));
    });
    owner.svgSession.selectionMarkers.reset();
    owner.svgSession.chrome.sync();
    applyEditableSvgRootDefaults(owner.svgSession.svgRoot);
    owner.svgSession.rootRuntimeState = prepareSvgRootForEditor(owner.svgSession.svgRoot);
    syncSvgDocumentBackgroundGeometry(owner.svgSession.svgRoot);
    if (parsed.warning) owner.svgSession.setStatus(parsed.warning);
    owner.svgSession.drawingAssistSettings = setDrawingAssistSettings({
      ...getDrawingAssistSettings(window),
      ...(readDrawingAssistMetadata(owner.svgSession.svgRoot) || {})
    }, window);
    owner.svgSession.drawingGuidesController.render(owner.svgSession.drawingAssistSettings);
    owner.svgSession.clearMaskEditState({
      silent: true
    });
    owner.svgSession.clearSelection();
    owner.svgSession.updateSvgRulers();
    owner.svgSession.markDocumentDirty(false);
  };
}
