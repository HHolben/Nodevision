// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/PublishSvgEditorContext.mjs
// This module implements publish Svg Editor Context behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { registerPanelZoomCapabilities } from "../../../../../panels/panelZoomCapabilities.mjs";
import { createSaveWYSIWYGFileHandler } from "./CreateAddEventListenerPointercancelHandler.mjs";
import { createSvgCoreContext } from "./CreateSvgCoreContext.mjs";
import { createSvgMaskAndSketchContext } from "./CreateSvgMaskAndSketchContext.mjs";
import { createSvgSketchContext } from "./CreateSvgSketchContext.mjs";
import { createSvgLayerContext } from "./CreateSvgLayerContext.mjs";
import { createSvgSelectionContext, createSvgEditorCleanup } from "./CreateSvgSelectionContext.mjs";
import { registerSvgEditorContextForInsertMedia } from "/ToolbarJSONfiles/insertMediaPanel.mjs";
import { getEditingContext } from "../../../../../EditorAttentionState.mjs";
import { persistSvgAttention } from "./PersistSvgAttention.mjs";

// Publish Svg Editor Context operations.
export function publishSvgEditorContext(scope) {
  window.saveWYSIWYGFile = createSaveWYSIWYGFileHandler({
    get filePath() {
      return scope.filePath;
    },
    get svgSession() {
      return scope.svgSession;
    }
  });
  window.selectSVGElement = scope.svgSession.selectElement;
  window.toggleSVGElementSelection = scope.svgSession.toggleSelection;
  window.SVGEditorContext = {
    save: window.saveWYSIWYGFile,
    ...createSvgCoreContext({
      get filePath() {
        return scope.filePath;
      },
      get svgSession() {
        return scope.svgSession;
      }
    })(),
    ...createSvgMaskAndSketchContext({
      get svgSession() {
        return scope.svgSession;
      }
    })(),
    ...createSvgSketchContext({
      get svgSession() {
        return scope.svgSession;
      }
    })(),
    ...createSvgLayerContext({
      get svgSession() {
        return scope.svgSession;
      }
    })(),
    ...createSvgSelectionContext({
      get svgSession() {
        return scope.svgSession;
      }
    })()
  };
  scope.svgSession.unregisterZoom = registerPanelZoomCapabilities(scope.container, {
    metadata: { geometric: { actions: ["zoom", "set", "reset"], unit: "canvas scale" } },
    semantic: false, fisheye: false,
    getState: () => ({ zoom: scope.svgSession.svgCanvasZoom }),
    geometric(command) {
      scope.svgSession.setSvgCanvasZoom((command.action === "reset") ? 1 : (command.zoom ?? scope.svgSession.svgCanvasZoom * (command.factor || 1)), command);
      return true;
    }
  });
  scope.svgSession.svgEditorContext = window.SVGEditorContext;
  scope.container.__nvSvgEditorContext = scope.svgSession.svgEditorContext;
  scope.svgSession.svgEditorCell = scope.container?.closest?.(".panel-cell") || null;
  if (scope.svgSession.svgEditorCell) scope.svgSession.svgEditorCell.__nvSvgEditorContext = scope.svgSession.svgEditorContext;
  window.toggleSVGLayersPanel = scope.svgSession.toggleLayersPanel;
  scope.svgSession.svgInsertMediaRegistration = registerSvgEditorContextForInsertMedia({
    context: window.SVGEditorContext,
    container: scope.container,
    wrapper: scope.svgSession.wrapper,
    filePath: scope.filePath
  });
  scope.svgSession.svgModeLayoutRaf = 0;
  scope.svgSession.svgModeLayoutTimer = 0;
  scope.svgSession.svgModeLayoutCanceled = false;
  scope.svgSession.savedSvgAttention = getEditingContext(scope.filePath);
  scope.svgSession.setMode(scope.svgSession.savedSvgAttention?.activeTool || window.NodevisionState?.svgDrawTool || "select");
  requestAnimationFrame(() => {
    if (!scope.svgSession.isCurrentRender()) return;
    if (scope.svgSession.savedSvgAttention?.scroll) {
      scope.container.scrollTop = scope.svgSession.savedSvgAttention.scroll.top || 0;
      scope.container.scrollLeft = scope.svgSession.savedSvgAttention.scroll.left || 0;
    }
  });
  window.dispatchEvent(new CustomEvent("nv-svg-editor-context-ready", {
    detail: {
      filePath: scope.filePath,
      context: window.SVGEditorContext
    }
  }));
  scope.svgSession.scheduleSvgEditorModeLayout();
  console.log("SVG editor loaded for:", scope.filePath);
  scope.svgSession.selectionObserver = new MutationObserver(() => {
    if (!scope.svgSession.isCurrentRender() || !scope.svgSession.selectedElements.some(el => !scope.svgSession.svgRoot.contains(el))) return;
    scope.svgSession.setSelection(scope.svgSession.selectedElements.filter(el => scope.svgSession.svgRoot.contains(el)));
  });
  scope.svgSession.selectionObserver.observe(scope.svgSession.svgRoot, {
    childList: true,
    subtree: true
  });
  scope.svgSession.persistCurrentSvgAttention = () => persistSvgAttention(scope.filePath, scope.container, scope.svgSession.toolState.mode);
  scope.container.addEventListener("scroll", scope.svgSession.persistCurrentSvgAttention, {
    passive: true
  });
  return {
    value: createSvgEditorCleanup({
      get svgSession() {
        return scope.svgSession;
      },
      get container() {
        return scope.container;
      },
      get filePath() {
        return scope.filePath;
      }
    })
  };
}
