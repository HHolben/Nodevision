// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/CreateMoveSelectionInHierarchyHandler.mjs
// This module implements create Move Selection In Hierarchy Handler behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { SVG_UI_ATTR } from "./CreateBlankSvgRoot.mjs";
import { buildVectorBrushSpec } from "../VectorBrushRenderer.mjs";
import { shapeToSvgSpec } from "../ShapeRecognition.mjs";

// Create Move Selection In Hierarchy Handler operations.
export function createMoveSelectionInHierarchyHandler(owner) {
  return function (direction = 1) {
    const movable = owner.svgSession.getHierarchyOrderSelection();
    if (!movable.length) {
      owner.svgSession.setStatus("Layer order: select an object first");
      return false;
    }
    const selectedSet = new Set(movable);
    const byParent = new Map();
    movable.forEach(el => {
      const parent = el.parentNode;
      if (!byParent.has(parent)) byParent.set(parent, []);
      byParent.get(parent).push(el);
    });
    let moved = false;
    byParent.forEach((elements, parent) => {
      const siblings = Array.from(parent.children || []).filter(owner.svgSession.isLayerOrderableElement);
      const ordered = elements.slice().sort((a, b) => siblings.indexOf(a) - siblings.indexOf(b));
      if (direction >= 0) ordered.reverse();
      ordered.forEach(el => {
        if (owner.svgSession.moveElementOneHierarchyStep(el, direction, selectedSet)) moved = true;
      });
    });
    if (!moved) {
      owner.svgSession.setStatus(direction >= 0 ? "Selection is already at the top of this hierarchy" : "Selection is already at the bottom of this hierarchy");
      return false;
    }
    owner.svgSession.refreshSelectionAfterMutation("layer-order");
    owner.svgSession.setStatus(direction >= 0 ? "Moved selection up one layer" : "Moved selection down one layer");
    return true;
  };
}

export function createSoloSelectionHandler(owner) {
  return function () {
    if (owner.svgSession.restoreSoloHiddenElements()) {
      owner.svgSession.refreshSelectionAfterMutation("solo-off");
      owner.svgSession.setStatus("Solo cleared");
      return true;
    }
    if (!owner.svgSession.selectedElements.length) return false;
    const selectedSet = new Set(owner.svgSession.selectedElements);
    const layers = owner.svgSession.getLayers();
    layers.forEach(layer => {
      const hasSelection = owner.svgSession.selectedElements.some(el => el === layer || layer.contains(el));
      if (!hasSelection) {
        layer.setAttribute("data-nv-solo-hidden", "true");
        layer.setAttribute("data-nv-solo-prev-display", layer.style?.display || "");
        if (layer.style) layer.style.display = "none";
        return;
      }
      Array.from(layer.children || []).forEach(child => {
        if (child.getAttribute?.(SVG_UI_ATTR)) return;
        const keep = selectedSet.has(child) || owner.svgSession.selectedElements.some(el => child.contains?.(el));
        if (keep) return;
        child.setAttribute("data-nv-solo-hidden", "true");
        child.setAttribute("data-nv-solo-prev-display", child.style?.display || "");
        if (child.style) child.style.display = "none";
      });
    });
    owner.svgSession.refreshSelectionAfterMutation("solo-on");
    owner.svgSession.setStatus("Soloed selection");
    return true;
  };
}

export function createRenderFreehandPreviewNowHandler(owner) {
  return function () {
    owner.svgSession.freehandRenderRaf = 0;
    const session = owner.svgSession.freehandStrokeState;
    if (!session?.previewEl) return;
    const preset = owner.svgSession.currentBrushPreset();
    const spec = buildVectorBrushSpec(session.samples, session.style, owner.svgSession.drawingAssistSettings, {
      preset,
      stabilizedSamples: owner.svgSession.stabilizedFreehandSamples(session.samples)
    });
    if (!spec?.attrs) return;
    const keep = new Set([SVG_UI_ATTR, "data-nv-freehand-preview"]);
    Array.from(session.previewEl.attributes || []).forEach(attr => {
      if (!keep.has(attr.name)) session.previewEl.removeAttribute(attr.name);
    });
    Object.entries(spec.attrs).forEach(([key, value]) => {
      if (key.startsWith("data-nv-brush")) return;
      session.previewEl.setAttribute(key, value);
    });
    session.previewEl.setAttribute(SVG_UI_ATTR, "freehand-preview");
    session.previewEl.setAttribute("data-nv-freehand-preview", "true");
    session.previewEl.setAttribute("pointer-events", "none");
    if (session.shapeActive) session.previewEl.setAttribute("opacity", "0.38");
  };
}

export function createCommitFreehandStrokeHandler(owner) {
  return function (options = {}) {
    const session = owner.svgSession.freehandStrokeState;
    if (!session) return false;
    const created = [];
    const useCorrection = options.preferCorrection !== false && session.shapeActive && session.shapeResult?.recognized;
    if (useCorrection && owner.svgSession.drawingAssistSettings.preserveOriginalStrokeAfterShapeCorrection) {
      const originalSpec = buildVectorBrushSpec(session.samples, session.style, owner.svgSession.drawingAssistSettings, {
        preset: owner.svgSession.currentBrushPreset(),
        stabilizedSamples: owner.svgSession.stabilizedFreehandSamples(session.samples)
      });
      owner.svgSession.appendCommittedElement(owner.svgSession.createElementFromSpec(originalSpec), created);
    }
    if (useCorrection) {
      const spec = shapeToSvgSpec(session.shapeResult, session.style, owner.svgSession.shapeCorrectionPreview.getOptions());
      const corrected = owner.svgSession.createElementFromSpec(spec);
      if (corrected) corrected.setAttribute("data-nv-shape-correction", session.shapeResult.type || "shape");
      owner.svgSession.appendCommittedElement(corrected, created);
    } else {
      const spec = buildVectorBrushSpec(session.samples, session.style, owner.svgSession.drawingAssistSettings, {
        preset: owner.svgSession.currentBrushPreset(),
        stabilizedSamples: owner.svgSession.stabilizedFreehandSamples(session.samples)
      });
      owner.svgSession.appendCommittedElement(owner.svgSession.createElementFromSpec(spec), created);
    }
    owner.svgSession.cleanupFreehandStroke();
    if (!created.length) return false;
    owner.svgSession.history.pushElementCreate(created);
    owner.svgSession.markDocumentDirty(true);
    owner.svgSession.setSelection([created[0]], {
      primary: created[0]
    });
    owner.svgSession.setStatus(useCorrection ? "Corrected shape committed" : "Brush stroke committed");
    return true;
  };
}
