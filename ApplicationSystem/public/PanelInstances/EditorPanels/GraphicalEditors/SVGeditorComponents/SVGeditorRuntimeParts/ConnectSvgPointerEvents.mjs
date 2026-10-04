// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/ConnectSvgPointerEvents.mjs
// This module implements connect Svg Pointer Events behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { readSvgDocumentMetadata, applySvgDocumentMetadata } from "./CreateBlankSvgRoot.mjs";
import { createAddEventListenerKeydownHandler, createAddEventListenerPointerdownHandler, createAddEventListenerPointermoveHandler } from "./CreateAddEventListenerKeydownHandler.mjs";
import { installSvgClickTraceOnSvgRoot } from "../../../../../SvgClickFeedbackTrace.mjs";
import { createAddEventListenerPointerupHandler } from "./CreateAddEventListenerPointerupHandler.mjs";
import { createAddEventListenerPointercancelHandler } from "./CreateAddEventListenerPointercancelHandler.mjs";

// Connect Svg Pointer Events operations.
export function connectSvgPointerEvents(scope) {
  scope.svgSession.svgViewport.addEventListener("wheel", e => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    e.preventDefault();
    e.stopPropagation();
    const deltaY = Number.isFinite(Number(e.deltaY)) ? Number(e.deltaY) : 0;
    const boundedDelta = Math.max(-600, Math.min(600, deltaY));
    scope.svgSession.zoomSvgCanvasBy(Math.exp(-boundedDelta * 0.0015), {
      clientX: e.clientX,
      clientY: e.clientY
    });
  }, {
    passive: false
  });
  scope.svgSession.updateSvgRulers();
  scope.svgSession.svgDocumentDirty = false;
  scope.svgSession.svgEditorContext = null;
  window.NodevisionMetadataTools = {
    owner: scope.svgSession.svgRoot,
    formatLabel: "SVG document",
    fields: ["title", "description", "author", "tags"],
    readMetadata: () => readSvgDocumentMetadata(scope.svgSession.svgRoot),
    applyMetadata: patch => {
      const metadata = applySvgDocumentMetadata(scope.svgSession.svgRoot, patch);
      scope.svgSession.markDocumentDirty(true);
      return metadata;
    }
  };
  scope.svgSession.selectionChangeRaf = 0;
  scope.svgSession.selectionMutationRaf = 0;
  scope.svgSession.lineStartHandle.addEventListener("pointerdown", e => {
    if (scope.svgSession.toolState.mode !== "select") return;
    e.preventDefault();
    e.stopPropagation();
    try {
      scope.svgSession.wrapper.focus({
        preventScroll: true
      });
    } catch {
      try {
        scope.svgSession.wrapper.focus();
      } catch {}
    }
    scope.svgSession.setSelectedLineVertex(scope.svgSession.selectedElements[0], "start");
    scope.svgSession.startLineHandleDrag("start", e.pointerId);
  });
  scope.svgSession.lineEndHandle.addEventListener("pointerdown", e => {
    if (scope.svgSession.toolState.mode !== "select") return;
    e.preventDefault();
    e.stopPropagation();
    try {
      scope.svgSession.wrapper.focus({
        preventScroll: true
      });
    } catch {
      try {
        scope.svgSession.wrapper.focus();
      } catch {}
    }
    scope.svgSession.setSelectedLineVertex(scope.svgSession.selectedElements[0], "end");
    scope.svgSession.startLineHandleDrag("end", e.pointerId);
  });
  Object.entries(scope.svgSession.resizeHandles).forEach(([corner, handle]) => {
    handle.addEventListener("pointerdown", e => {
      if (scope.svgSession.toolState.mode !== "select") return;
      e.preventDefault();
      e.stopPropagation();
      scope.svgSession.startResizeInteraction(corner, e.pointerId);
    });
  });
  scope.svgSession.wrapper.addEventListener("keydown", createAddEventListenerKeydownHandler({
    get svgSession() {
      return scope.svgSession;
    }
  }));
  scope.svgSession.cleanupSvgClickTrace = installSvgClickTraceOnSvgRoot(scope.svgSession.svgRoot, () => ({
    filePath: scope.filePath,
    activeEditorKind: "svg",
    mode: window.NodevisionState?.currentMode || "SVG Editing",
    tool: scope.svgSession.toolState.mode,
    editorReady: Boolean(window.SVGEditorContext),
    panels: {
      layersPanelConnected: Boolean(scope.svgSession.layersPanelHost?.isConnected)
    }
  }));
  scope.svgSession.svgViewportHost.addEventListener("pointerdown", createAddEventListenerPointerdownHandler({
    get svgSession() {
      return scope.svgSession;
    }
  }));
  scope.svgSession.svgViewportHost.addEventListener("pointermove", createAddEventListenerPointermoveHandler({
    get svgSession() {
      return scope.svgSession;
    }
  }));
  scope.svgSession.svgViewportHost.addEventListener("pointerup", createAddEventListenerPointerupHandler({
    get svgSession() {
      return scope.svgSession;
    }
  }));
  scope.svgSession.svgViewportHost.addEventListener("pointercancel", createAddEventListenerPointercancelHandler({
    get svgSession() {
      return scope.svgSession;
    }
  }));

  // Nodevision hooks
  if (!scope.svgSession.isCurrentRender()) return {
    value: void 0
  };
  window.__nvSvgEditorActivePath = scope.filePath;
  window.__nvWysiwygActivePath = scope.filePath;
  scope.svgSession.svgSnapshotDepth = 0;
  window.getEditorHTML = scope.svgSession.serializeSvgForSave;
  window.setEditorHTML = scope.svgSession.setSvgFromString;
}
