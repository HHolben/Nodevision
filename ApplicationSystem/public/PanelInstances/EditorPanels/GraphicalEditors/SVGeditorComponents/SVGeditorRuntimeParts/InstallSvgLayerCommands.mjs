// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/InstallSvgLayerCommands.mjs
// This module implements install Svg Layer Commands behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { createEditSelectedImageHereHandler, createInsertShapeHandler } from "./CreateEditSelectedImageHereHandler.mjs";
import { createSetModeHandler } from "./CreateSetModeHandler.mjs";

// Install Svg Layer Commands operations.
export function installSvgLayerCommands(scope) {
  scope.svgSession.getLayers = function () {
    return scope.svgSession.layersMgr.getLayers();
  };
  scope.svgSession.getActiveLayer = function () {
    return scope.svgSession.layersMgr.getActiveLayer();
  };
  scope.svgSession.setActiveLayer = function (layerId) {
    if (!layerId) return false;
    scope.svgSession.layersMgr.setActiveLayer(layerId);
    return true;
  };
  scope.svgSession.createLayer = function (name = null) {
    const layer = scope.svgSession.layersMgr.createLayer(name);
    scope.svgSession.setStatus(`Layer created: ${layer.getAttribute("data-layer-name") || layer.id}`);
    return layer;
  };
  scope.svgSession.renameActiveLayer = function (name) {
    const layer = scope.svgSession.getActiveLayer();
    if (!layer) return false;
    const next = String(name || "").trim();
    if (!next) return false;
    layer.setAttribute("data-layer-name", next);
    scope.svgSession.layersMgr.renderPanel();
    scope.svgSession.setStatus(`Renamed active layer to "${next}"`);
    return true;
  };
  scope.svgSession.deleteActiveLayer = function () {
    const layer = scope.svgSession.getActiveLayer();
    if (!layer) return false;
    const ok = scope.svgSession.layersMgr.removeLayer(layer.id);
    scope.svgSession.setStatus(ok ? "Deleted active layer" : "Cannot delete the only layer");
    return ok;
  };
  scope.svgSession.stepActiveLayer = function (direction = 1) {
    const layers = scope.svgSession.getLayers();
    const active = scope.svgSession.getActiveLayer();
    if (!layers.length || !active) return null;
    const idx = layers.findIndex(layer => layer.id === active.id);
    if (idx < 0) return null;
    const nextIndex = (idx + direction + layers.length) % layers.length;
    const nextLayer = layers[nextIndex];
    scope.svgSession.setActiveLayer(nextLayer.id);
    scope.svgSession.setStatus(`Active layer: ${nextLayer.getAttribute("data-layer-name") || nextLayer.id}`);
    return nextLayer;
  };
  scope.svgSession.moveActiveLayer = function (direction = 1) {
    const active = scope.svgSession.getActiveLayer();
    if (!active) return false;
    scope.svgSession.layersMgr.moveLayer(active.id, direction);
    scope.svgSession.setStatus(direction < 0 ? "Moved active layer up" : "Moved active layer down");
    return true;
  };
  scope.svgSession.setActiveLayerVisible = function (visible) {
    const active = scope.svgSession.getActiveLayer();
    if (!active) return false;
    scope.svgSession.layersMgr.setLayerVisible(active.id, Boolean(visible));
    scope.svgSession.setStatus(Boolean(visible) ? "Active layer shown" : "Active layer hidden");
    return true;
  };
  scope.svgSession.toggleActiveLayerVisible = function () {
    const active = scope.svgSession.getActiveLayer();
    if (!active) return false;
    const currentlyVisible = active.style.display !== "none";
    return scope.svgSession.setActiveLayerVisible(!currentlyVisible);
  };
  scope.svgSession.insertInternalPng = function () {
    return scope.svgSession.internalPngController.insertInternalPng();
  };
  scope.svgSession.insertImageFromInsertion = async function (insertion) {
    return await scope.svgSession.runSvgSnapshotOperationAsync("insert-image", () => scope.svgSession.internalPngController.insertImageFromInsertion(insertion));
  };
  scope.svgSession.replaceSelectedInternalPng = function () {
    return scope.svgSession.internalPngController.replaceSelectedPng();
  };
  scope.svgSession.editSelectedInternalPng = function () {
    return scope.svgSession.internalPngController.editSelectedPng();
  };
  scope.svgSession.exportSelectedInternalPng = function () {
    return scope.svgSession.internalPngController.exportSelectedPng();
  };
  scope.svgSession.editSelectedImageHere = createEditSelectedImageHereHandler({
    get svgSession() {
      return scope.svgSession;
    }
  });
  scope.svgSession.insertShape = createInsertShapeHandler({
    get svgSession() {
      return scope.svgSession;
    }
  });
  scope.svgSession.setMode = createSetModeHandler({
    get svgSession() {
      return scope.svgSession;
    }
  });
  scope.svgSession.intersectsRect = function (a, b) {
    return a.x <= b.x + b.width && a.x + a.width >= b.x && a.y <= b.y + b.height && a.y + a.height >= b.y;
  };
  scope.svgSession.pointerToleranceInSvgUnits = function (px = 8) {
    const ctm = typeof scope.svgSession.svgRoot.getScreenCTM === "function" ? scope.svgSession.svgRoot.getScreenCTM() : null;
    if (!ctm) return px;
    const sx = Math.hypot(ctm.a, ctm.b);
    const sy = Math.hypot(ctm.c, ctm.d);
    const avg = (sx + sy) / 2;
    if (!Number.isFinite(avg) || avg <= 1e-9) return px;
    return px / avg;
  };
}
