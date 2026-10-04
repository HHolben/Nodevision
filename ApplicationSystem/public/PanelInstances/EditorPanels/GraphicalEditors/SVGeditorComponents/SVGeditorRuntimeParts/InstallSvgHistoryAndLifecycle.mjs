// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/InstallSvgHistoryAndLifecycle.mjs
// This module implements install Svg History And Lifecycle behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { getAttrNumber } from "../svgDom.mjs";
import { createStartResizeInteractionHandler, createStartRotateInteractionHandler, createSetSvgFromStringHandler } from "./CreateStartResizeInteractionHandler.mjs";
import { cleanupSvgCloneForSave } from "../SvgPreservation.mjs";
import { SVG_UI_ATTR } from "./CreateBlankSvgRoot.mjs";
import { createRunSvgSnapshotOperationHandler, createRunSvgSnapshotOperationAsyncHandler } from "./CreateRunSvgSnapshotOperationHandler.mjs";
import { createCreateSvgBackgroundAppearanceAdapterHandler } from "./CreateCreateSvgBackgroundAppearanceAdapterHandler.mjs";
import { openNodevisionOverlayPanel } from "/TemplateSystem/NodevisionOverlayPanel.mjs";
import { ensureSvgEditorModeLayout } from "/panels/workspace.mjs";

// Install Svg History And Lifecycle operations.
export function installSvgHistoryAndLifecycle(scope) {
  scope.svgSession.startLineHandleDrag = function (which, pointerId) {
    if (scope.svgSession.selectedElements.length !== 1) return;
    const line = scope.svgSession.selectedElements[0];
    if (!line || line.tagName.toLowerCase() !== "line") return;
    scope.svgSession.lineHandleDragState = {
      pointerId,
      line,
      which,
      base: {
        x1: getAttrNumber(line, "x1", 0),
        y1: getAttrNumber(line, "y1", 0),
        x2: getAttrNumber(line, "x2", 0),
        y2: getAttrNumber(line, "y2", 0)
      }
    };
    try {
      scope.svgSession.svgRoot.setPointerCapture(pointerId);
    } catch {
      // Ignore unsupported pointer capture errors.
    }
  };
  scope.svgSession.startResizeInteraction = createStartResizeInteractionHandler({
    get svgSession() {
      return scope.svgSession;
    }
  });
  scope.svgSession.startRotateInteraction = createStartRotateInteractionHandler({
    get svgSession() {
      return scope.svgSession;
    }
  });
  scope.svgSession.serializeSvgForSave = function () {
    const clone = scope.svgSession.svgRoot.cloneNode(true);
    cleanupSvgCloneForSave(clone, {
      generatedRootId: Boolean(scope.svgSession.rootRuntimeState?.generatedRootId),
      uiAttr: SVG_UI_ATTR
    });
    return new XMLSerializer().serializeToString(clone);
  };
  scope.svgSession.setSvgFromString = createSetSvgFromStringHandler({
    get svgSession() {
      return scope.svgSession;
    }
  });
  scope.svgSession.runSvgSnapshotOperation = createRunSvgSnapshotOperationHandler({
    get svgSession() {
      return scope.svgSession;
    }
  });
  scope.svgSession.applySvgHistoryResult = function (result, direction = "undo") {
    if (!result) {
      scope.svgSession.setStatus(direction === "redo" ? "Nothing to redo" : "Nothing to undo");
      return false;
    }
    if (result.element) scope.svgSession.setSelection([result.element], {
      primary: result.element
    });else if (result.removed) scope.svgSession.clearSelection();else scope.svgSession.refreshSelectionAfterMutation("history-" + direction);
    scope.svgSession.markDocumentDirty(true);
    scope.svgSession.setStatus(direction === "redo" ? "Redid SVG action" : "Undid SVG action");
    return true;
  };
  scope.svgSession.undoSvgHistory = function () {
    return scope.svgSession.applySvgHistoryResult(scope.svgSession.history.undo(), "undo");
  };
  scope.svgSession.redoSvgHistory = function () {
    return scope.svgSession.applySvgHistoryResult(scope.svgSession.history.redo(), "redo");
  };
  scope.svgSession.runSvgSnapshotOperationAsync = createRunSvgSnapshotOperationAsyncHandler({
    get svgSession() {
      return scope.svgSession;
    }
  });
  scope.svgSession.createSvgBackgroundAppearanceAdapter = createCreateSvgBackgroundAppearanceAdapterHandler({
    get svgSession() {
      return scope.svgSession;
    }
  });
  scope.svgSession.openSvgBackgroundAppearanceOverlay = function () {
    const adapter = scope.svgSession.createSvgBackgroundAppearanceAdapter();
    return openNodevisionOverlayPanel("SvgBackgroundAppearanceOverlay", {
      title: "SVG Background",
      displayName: "SVG Background",
      adapter
    }, {
      panelClass: "InfoPanel"
    });
  };
  scope.svgSession.cancelDeferredSvgModeLayout = function () {
    scope.svgSession.svgModeLayoutCanceled = true;
    if (scope.svgSession.svgModeLayoutRaf) window.cancelAnimationFrame(scope.svgSession.svgModeLayoutRaf);
    if (scope.svgSession.svgModeLayoutTimer) window.clearTimeout(scope.svgSession.svgModeLayoutTimer);
    scope.svgSession.svgModeLayoutRaf = 0;
    scope.svgSession.svgModeLayoutTimer = 0;
  };
  scope.svgSession.scheduleSvgEditorModeLayout = function () {
    const editorCell = scope.container?.closest?.(".panel-cell");
    if (!editorCell) return;
    const scheduledToken = scope.svgSession.renderToken;
    scope.svgSession.svgModeLayoutRaf = window.requestAnimationFrame(() => {
      scope.svgSession.svgModeLayoutRaf = 0;
      scope.svgSession.svgModeLayoutTimer = window.setTimeout(async () => {
        scope.svgSession.svgModeLayoutTimer = 0;
        if (scope.svgSession.svgModeLayoutCanceled || scope.container.__nvEditorRenderToken !== scheduledToken || !scope.svgSession.wrapper.isConnected || !editorCell.isConnected) return;
        try {
          await ensureSvgEditorModeLayout({
            editorCell
          });
        } catch (err) {
          console.warn("SVG editor: failed to apply SVG editor mode layout:", err);
        }
      }, 0);
    });
  };
}
