// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/InstallSvgSelectionPublishing.mjs
// This module implements install Svg Selection Publishing behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { createSelectedSvgImageContextHandler, createClearSelectionHandler, createSetSelectionHandler } from "./CreateUpdateLineEndpointHandlesHandler.mjs";
import { updateToolbarState } from "/panels/createToolbar.mjs";
import { reportSvgAttentionSelection } from "./ParseEditableSvgRoot.mjs";

// Install Svg Selection Publishing operations.
export function installSvgSelectionPublishing(scope) {
  scope.svgSession.refreshSelectionVisuals = function () {
    scope.svgSession.refreshSelectionStateVisuals();
  };
  scope.svgSession.isSvgImageElement = function (el) {
    return String(el?.tagName || "").toLowerCase() === "image";
  };
  scope.svgSession.normalizeNotebookPathInput = function (inputPath = "") {
    let clean = String(inputPath || "").trim().replace(/\\/g, "/");
    try {
      clean = decodeURIComponent(clean);
    } catch {
      // keep undecoded text
    }
    clean = clean.replace(/[?#].*$/, "").replace(/^https?:\/\/[^/]+/i, "").replace(/^\/+/, "").replace(/^.*\/Notebook\//i, "").replace(/^Notebook\//i, "");
    return clean.replace(/\/+/g, "/");
  };
  scope.svgSession.dirname = function (pathLike = "") {
    const clean = scope.svgSession.normalizeNotebookPathInput(pathLike);
    const idx = clean.lastIndexOf("/");
    return idx > 0 ? clean.slice(0, idx) : "";
  };
  scope.svgSession.selectedSvgImageContext = createSelectedSvgImageContextHandler({
    get svgSession() {
      return scope.svgSession;
    },
    get filePath() {
      return scope.filePath;
    }
  });
  scope.svgSession.updateSelectedSvgImageState = function () {
    const context = scope.svgSession.selectedSvgImageContext();
    window.NodevisionState = window.NodevisionState || {};
    window.NodevisionState.activeSvgImageContext = context;
    updateToolbarState({
      svgImageSelected: Boolean(context?.element),
      svgImagePath: context?.linkedNotebookPath || null
    }, {
      rebuildDropdowns: false
    });
  };
  scope.svgSession.selectionEventDetail = function (reason = "selection") {
    return {
      reason,
      selectedElements: [...scope.svgSession.selectedElements],
      primary: scope.svgSession.selectedElement
    };
  };
  scope.svgSession.notifySelectionChanged = function () {
    scope.svgSession.recordLineProbe("notifySelectionChanged:start");
    reportSvgAttentionSelection(scope.svgSession.selectedElement);
    scope.svgSession.recordLineProbe("notifySelectionChanged:after-attention");
    if (scope.svgSession.selectionChangeRaf) return;
    scope.svgSession.selectionChangeRaf = window.requestAnimationFrame(() => {
      scope.svgSession.selectionChangeRaf = 0;
      if (!scope.svgSession.isCurrentRender()) return;
      scope.svgSession.recordLineProbe("notifySelectionChanged:raf-start");
      scope.svgSession.nodeEditor.onSelectionChanged?.(scope.svgSession.selectedElements);
      scope.svgSession.recordLineProbe("notifySelectionChanged:after-nodeEditor");
      scope.svgSession.updateSelectedSvgImageState();
      scope.svgSession.recordLineProbe("notifySelectionChanged:after-image-state");
      window.dispatchEvent(new CustomEvent("nv-svg-editor-selection-changed", {
        detail: scope.svgSession.selectionEventDetail("selection")
      }));
      scope.svgSession.recordLineProbe("notifySelectionChanged:raf-end");
    });
    scope.svgSession.recordLineProbe("notifySelectionChanged:scheduled-raf");
  };
  scope.svgSession.notifySelectionMutated = function (reason = "geometry") {
    if (scope.svgSession.selectionMutationRaf) return;
    scope.svgSession.selectionMutationRaf = window.requestAnimationFrame(() => {
      scope.svgSession.selectionMutationRaf = 0;
      if (!scope.svgSession.isCurrentRender()) return;
      scope.svgSession.recordLineProbe("selection-mutated:dispatch", {
        reason
      });
      window.dispatchEvent(new CustomEvent("nv-svg-editor-selection-mutated", {
        detail: scope.svgSession.selectionEventDetail(reason)
      }));
    });
  };
  scope.svgSession.refreshSelectionGeometryAfterMutation = function (reason = "geometry") {
    scope.svgSession.refreshSelectionGeometryVisuals();
    scope.svgSession.notifySelectionMutated(reason);
  };
  scope.svgSession.refreshSelectionAfterMutation = function (reason = "geometry") {
    scope.svgSession.refreshSelectionStateVisuals();
    scope.svgSession.notifySelectionMutated(reason);
  };
  scope.svgSession.clearSelection = createClearSelectionHandler({
    get svgSession() {
      return scope.svgSession;
    }
  });
  scope.svgSession.setSelection = createSetSelectionHandler({
    get svgSession() {
      return scope.svgSession;
    }
  });
  scope.svgSession.toggleSelection = function (el, options = {}) {
    if (!scope.svgSession.isSelectableElement(el, options)) return;
    if (scope.svgSession.selectedElements.includes(el)) {
      scope.svgSession.selectedElements = scope.svgSession.selectedElements.filter(x => x !== el);
    } else {
      scope.svgSession.selectedElements = [el, ...scope.svgSession.selectedElements];
    }
    if (scope.svgSession.maskEditState && !options.keepMaskEditState && !scope.svgSession.selectionInsideMaskEditState(scope.svgSession.selectedElements)) {
      scope.svgSession.clearMaskEditState({
        silent: true
      });
    }
    if (!scope.svgSession.isSelectedLineVertexValid()) scope.svgSession.clearSelectedLineVertex();
    scope.svgSession.refreshSelectionVisuals();
    scope.svgSession.notifySelectionChanged();
  };
}
