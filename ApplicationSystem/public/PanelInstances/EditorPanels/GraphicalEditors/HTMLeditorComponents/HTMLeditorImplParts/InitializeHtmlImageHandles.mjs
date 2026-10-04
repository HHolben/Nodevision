// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/InitializeHtmlImageHandles.mjs
// This module implements initialize Html Image Handles behavior for the HTMLeditorImpl feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { createSyncImageHandlesNowHandler } from "./CreateSyncImageHandlesNowHandler.mjs";
import { createStartCornerTransformHandler } from "./CreateStartCornerTransformHandler.mjs";

// Initialize Html Image Handles operations.
export function initializeHtmlImageHandles(scope) {
  scope.imageToolsState.inlineEditorSession = null;
  scope.imageToolsState.selectedImageForHandles = null;
  scope.imageToolsState.selectedImageLoadListener = null;
  scope.imageToolsState.handleSyncRaf = 0;
  scope.imageToolsState.removed = false;
  scope.imageToolsState.cornerHandles = new Map();
  scope.imageToolsState.cornerOrder = ["nw", "ne", "sw", "se"];
  scope.imageToolsState.readImageRotation = imageEl => {
    if (!(imageEl instanceof HTMLImageElement)) return 0;
    const fromDataset = Number.parseFloat(imageEl.dataset.nvImageRotation || "");
    if (Number.isFinite(fromDataset)) return fromDataset;
    const styleTransform = String(imageEl.style.transform || "");
    const match = styleTransform.match(/rotate\(([-\d.]+)deg\)/i);
    if (!match) return 0;
    const parsed = Number.parseFloat(match[1]);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  scope.imageToolsState.applyImageRotation = (imageEl, degrees) => {
    if (!(imageEl instanceof HTMLImageElement)) return;
    const rounded = Math.round(Number(degrees || 0) * 100) / 100;
    imageEl.dataset.nvImageRotation = String(rounded);
    const styleTransform = String(imageEl.style.transform || "");
    const withoutRotate = styleTransform.replace(/rotate\([^)]*\)/gi, "").trim();
    imageEl.style.transformOrigin = "center center";
    imageEl.style.transform = `${withoutRotate}${withoutRotate ? " " : ""}rotate(${rounded}deg)`.trim();
  };
  scope.imageToolsState.hideImageHandles = () => {
    scope.imageToolsState.cornerHandles.forEach(handle => {
      handle.style.display = "none";
    });
  };
  scope.imageToolsState.syncImageHandlesNow = createSyncImageHandlesNowHandler({
    get imageToolsState() {
      return scope.imageToolsState;
    },
    get wysiwyg() {
      return scope.wysiwyg;
    }
  });
  scope.imageToolsState.scheduleImageHandleSync = () => {
    if (scope.imageToolsState.handleSyncRaf) return;
    scope.imageToolsState.handleSyncRaf = window.requestAnimationFrame(scope.imageToolsState.syncImageHandlesNow);
  };
  scope.imageToolsState.setSelectedImageForHandles = imageEl => {
    if (scope.imageToolsState.selectedImageForHandles && scope.imageToolsState.selectedImageLoadListener) {
      scope.imageToolsState.selectedImageForHandles.removeEventListener("load", scope.imageToolsState.selectedImageLoadListener);
    }
    scope.imageToolsState.selectedImageForHandles = null;
    scope.imageToolsState.selectedImageLoadListener = null;
    if (!(imageEl instanceof HTMLImageElement)) {
      scope.imageToolsState.hideImageHandles();
      return;
    }
    if (imageEl.closest(".nv-canvas-item")) {
      scope.imageToolsState.hideImageHandles();
      return;
    }
    scope.imageToolsState.selectedImageForHandles = imageEl;
    scope.imageToolsState.selectedImageLoadListener = () => scope.imageToolsState.scheduleImageHandleSync();
    imageEl.addEventListener("load", scope.imageToolsState.selectedImageLoadListener);
    scope.imageToolsState.scheduleImageHandleSync();
  };
  scope.imageToolsState.clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  scope.imageToolsState.startCornerTransform = createStartCornerTransformHandler({
    get imageToolsState() {
      return scope.imageToolsState;
    }
  });
  scope.imageToolsState.cornerOrder.forEach(corner => {
    const handle = document.createElement("div");
    handle.className = "nv-image-corner-handle nv-editor-only";
    handle.dataset.corner = corner;
    handle.title = "Drag to resize evenly. Shift+drag to rotate. Ctrl+Shift snaps to 45deg.";
    handle.style.display = "none";
    handle.addEventListener("pointerdown", scope.imageToolsState.startCornerTransform);
    document.body.appendChild(handle);
    scope.imageToolsState.cornerHandles.set(corner, handle);
  });
  scope.imageToolsState.onGlobalGeometryChange = () => scope.imageToolsState.scheduleImageHandleSync();
  window.addEventListener("resize", scope.imageToolsState.onGlobalGeometryChange);
  window.addEventListener("scroll", scope.imageToolsState.onGlobalGeometryChange, true);
  scope.wysiwyg.addEventListener("scroll", scope.imageToolsState.onGlobalGeometryChange, true);
  scope.wysiwyg.addEventListener("input", scope.imageToolsState.onGlobalGeometryChange);
  scope.imageToolsState.showEditorSubToolbarForMode = mode => {
    let heading = "";
    if (mode === "PNGediting") heading = "Draw";
    if (mode === "SVG Editing") heading = "Edit";
    if (!heading) return;
    window.dispatchEvent(new CustomEvent("nv-show-subtoolbar", {
      detail: {
        heading,
        force: false,
        toggle: false
      }
    }));
  };
  scope.imageToolsState.restoreGlobalEditorFileContext = (snapshot = {}) => {
    window.NodevisionState = window.NodevisionState || {};
    window.NodevisionState.selectedFile = snapshot.previousSelectedFile || null;
    window.NodevisionState.activeEditorFilePath = snapshot.previousActiveEditorFilePath || null;
    window.currentActiveFilePath = snapshot.previousCurrentActiveFilePath || null;
    window.filePath = snapshot.previousFilePath || null;
    window.selectedFilePath = snapshot.previousSelectedFilePath || null;
  };
  scope.imageToolsState.restoreGlobalEditorRuntime = (snapshot = {}) => {
    window.getEditorHTML = snapshot.previousGetEditorHTML;
    window.setEditorHTML = snapshot.previousSetEditorHTML;
    window.saveWYSIWYGFile = snapshot.previousSaveWYSIWYGFile;
    window.selectSVGElement = snapshot.previousSelectSVGElement;
    window.SVGEditorContext = snapshot.previousSVGEditorContext;
    window.toggleSVGLayersPanel = snapshot.previousToggleSVGLayersPanel;
    window.rasterCanvas = snapshot.previousRasterCanvas || null;
  };
}
