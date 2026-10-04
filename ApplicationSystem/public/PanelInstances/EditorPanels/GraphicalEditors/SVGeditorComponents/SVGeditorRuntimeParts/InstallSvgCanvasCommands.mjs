// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/InstallSvgCanvasCommands.mjs
// This module implements install Svg Canvas Commands behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { getReferencedSvgId, invertMask } from "../SvgMaskClipCommands.mjs";
import { syncSvgDocumentBackgroundGeometry } from "../SvgDocumentBackground.mjs";
import { createCropEdgesHandler, createRotateCanvas90Handler, createFlipCanvasHandler } from "./CreateBeginMaskOrClipEditHandler.mjs";

// Install Svg Canvas Commands operations.
export function installSvgCanvasCommands(scope) {
  scope.svgSession.invertSelectedMaskCommand = function () {
    const targets = [...scope.svgSession.selectedElements];
    if (scope.svgSession.maskEditState?.artwork?.isConnected && !targets.includes(scope.svgSession.maskEditState.artwork)) targets.push(scope.svgSession.maskEditState.artwork);
    if (!targets.some(el => getReferencedSvgId(el, "mask"))) {
      scope.svgSession.setStatus("Select artwork with a simple black/white mask first");
      return false;
    }
    const changed = scope.svgSession.runSvgSnapshotOperation("invert-mask", () => invertMask(scope.svgSession.svgRoot, targets));
    if (Array.isArray(changed) && changed.length) {
      scope.svgSession.setStatus("Inverted simple mask paint");
      return changed;
    }
    scope.svgSession.setStatus("Mask inversion supports simple black/white mask content in this phase");
    return false;
  };
  scope.svgSession.applyCurrentStyleToSelection = function () {
    if (!scope.svgSession.selectedElements.length) {
      scope.svgSession.setStatus("No selected element");
      return false;
    }
    scope.svgSession.selectedElements.forEach(el => {
      el.setAttribute("fill", scope.svgSession.styleState.fill);
      el.setAttribute("stroke", scope.svgSession.styleState.stroke);
      el.setAttribute("stroke-width", scope.svgSession.styleState.strokeWidth || "0.1");
    });
    scope.svgSession.setStatus("Applied style");
    return true;
  };
  scope.svgSession.resizeCanvas = function (width, height) {
    const w = Math.max(1, Number.parseFloat(width) || 1);
    const h = Math.max(1, Number.parseFloat(height) || 1);
    const current = scope.svgSession.getViewBox();
    scope.svgSession.setViewBox({
      x: current.x,
      y: current.y,
      width: w,
      height: h
    });
    scope.svgSession.setStatus(`Canvas resized to x`);
    return {
      width: w,
      height: h
    };
  };
  scope.svgSession.getCanvasSize = function () {
    const vb = (scope.svgSession.svgRoot.getAttribute("viewBox") || "").trim().split(/\s+/).map(n => Number.parseFloat(n));
    const width = Number.isFinite(vb[2]) ? vb[2] : Number.parseFloat(scope.svgSession.svgRoot.getAttribute("width")) || 800;
    const height = Number.isFinite(vb[3]) ? vb[3] : Number.parseFloat(scope.svgSession.svgRoot.getAttribute("height")) || 600;
    return {
      width,
      height
    };
  };
  scope.svgSession.getViewBox = function () {
    const vb = (scope.svgSession.svgRoot.getAttribute("viewBox") || "").trim().split(/\s+/).map(n => Number.parseFloat(n));
    const fallbackW = Number.parseFloat(scope.svgSession.svgRoot.getAttribute("width")) || 800;
    const fallbackH = Number.parseFloat(scope.svgSession.svgRoot.getAttribute("height")) || 600;
    const x = Number.isFinite(vb[0]) ? vb[0] : 0;
    const y = Number.isFinite(vb[1]) ? vb[1] : 0;
    const w = Number.isFinite(vb[2]) ? vb[2] : fallbackW;
    const h = Number.isFinite(vb[3]) ? vb[3] : fallbackH;
    return {
      x,
      y,
      width: Math.max(1, w || 1),
      height: Math.max(1, h || 1)
    };
  };
  scope.svgSession.setViewBox = function ({
    x = 0,
    y = 0,
    width = 1,
    height = 1
  } = {}) {
    const w = Math.max(1, Number.parseFloat(width) || 1);
    const h = Math.max(1, Number.parseFloat(height) || 1);
    scope.svgSession.svgRoot.setAttribute("viewBox", `${Number(x) || 0} ${Number(y) || 0} ${w} ${h}`);
    scope.svgSession.svgRoot.setAttribute("width", String(w));
    scope.svgSession.svgRoot.setAttribute("height", String(h));
    syncSvgDocumentBackgroundGeometry(scope.svgSession.svgRoot);
    window.dispatchEvent(new CustomEvent("nv-svg-editor-layout-changed", {
      detail: {
        width: w,
        height: h
      }
    }));
    scope.svgSession.updateSvgRulers();
  };
  scope.svgSession.applyTransformToLayers = function (transformFragment = "") {
    const fragment = String(transformFragment || "").trim();
    if (!fragment) return;
    const layers = scope.svgSession.layersMgr.getLayers?.() || [];
    layers.forEach(layer => {
      const existing = String(layer.getAttribute("transform") || "").trim();
      layer.setAttribute("transform", existing ? `${fragment} ${existing}` : fragment);
    });
  };
  scope.svgSession.cropEdges = createCropEdgesHandler({
    get svgSession() {
      return scope.svgSession;
    }
  });
  scope.svgSession.rotateCanvas90 = createRotateCanvas90Handler({
    get svgSession() {
      return scope.svgSession;
    }
  });
  scope.svgSession.flipCanvas = createFlipCanvasHandler({
    get svgSession() {
      return scope.svgSession;
    }
  });
}
