// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/CreateSvgSelectionContext.mjs
// This module implements create Svg Selection Context behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { clearEditorContext } from "../../../../../EditorAttentionState.mjs";

// Create Svg Selection Context operations.
export function createSvgSelectionContext(owner) {
  return () => ({
    notifyElementChanged(reason = "properties") {
      owner.svgSession.refreshSelectionAfterMutation(reason);
    },
    moveSelectionBy(dx, dy) {
      return owner.svgSession.runSvgSnapshotOperation("move-selection", () => owner.svgSession.moveSelectionBy(dx, dy));
    },
    deleteSelection() {
      return owner.svgSession.runSvgSnapshotOperation("delete-selection", () => owner.svgSession.deleteSelection());
    },
    duplicateSelection(offsetX = 20, offsetY = 20) {
      return owner.svgSession.runSvgSnapshotOperation("duplicate-selection", () => owner.svgSession.duplicateSelection(offsetX, offsetY));
    },
    copySelection: owner.svgSession.copySelection,
    pasteSelection(offsetX = 20, offsetY = 20) {
      return owner.svgSession.runSvgSnapshotOperation("paste-selection", () => owner.svgSession.pasteSelection(offsetX, offsetY));
    },
    alignSelection(mode = "left") {
      return owner.svgSession.runSvgSnapshotOperation("align-selection", () => owner.svgSession.alignSelection(mode));
    },
    arrangeSelection(mode = "front") {
      return owner.svgSession.runSvgSnapshotOperation("arrange-selection", () => owner.svgSession.arrangeSelection(mode));
    },
    groupSelection() {
      return owner.svgSession.runSvgSnapshotOperation("group-selection", () => owner.svgSession.groupSelection());
    },
    ungroupSelection() {
      return owner.svgSession.runSvgSnapshotOperation("ungroup-selection", () => owner.svgSession.ungroupSelection());
    },
    selectAll() {
      owner.svgSession.setSelection(owner.svgSession.getSelectableElements());
      owner.svgSession.setStatus(`Selected ${owner.svgSession.selectedElements.length} element(s)`);
    }
  });
}

export function createSvgEditorCleanup(owner) {
  return () => {
    owner.svgSession.disposed = true;
    window.cancelAnimationFrame(owner.svgSession.selectionChangeRaf);
    window.cancelAnimationFrame(owner.svgSession.selectionMutationRaf);
    window.cancelAnimationFrame(owner.svgSession.freehandRenderRaf);
    window.clearTimeout(owner.svgSession.freehandStrokeState?.holdTimer);
    window.clearTimeout(owner.svgSession.eyedropperHoldState?.timer);
    owner.svgSession.clearLineToolPendingCommand();
    owner.svgSession.selectionObserver.disconnect();
    owner.svgSession.selectionMarkers.dispose();
    owner.svgSession.svgRulerObserver.disconnect();
    window.removeEventListener("resize", owner.svgSession.updateSvgRulers);
    owner.svgSession.svgViewport.removeEventListener("scroll", owner.svgSession.updateSvgRulers);
    owner.svgSession.drawingGuidesController.destroy();
    owner.svgSession.chrome.dispose();
    owner.svgSession.selectedElements = [];
    if (window.selectedSVGElement === owner.svgSession.selectedElement) window.selectedSVGElement = null;
    owner.svgSession.layersMgr.dispose();
    owner.svgSession.cleanupSvgClickTrace?.();
    owner.svgSession.cancelDeferredSvgModeLayout();
    owner.container.removeEventListener("scroll", owner.svgSession.persistCurrentSvgAttention);
    owner.svgSession.persistCurrentSvgAttention();
    owner.svgSession.svgInsertMediaRegistration?.dispose?.();
    if (window.SVGEditorContext?.__nvInsertMediaIdentity?.instanceId === owner.svgSession.svgInsertMediaRegistration?.instanceId) {
      window.SVGEditorContext = null;
    }
    if (owner.container.__nvSvgEditorContext === owner.svgSession.svgEditorContext) owner.container.__nvSvgEditorContext = null;
    if (owner.svgSession.svgEditorCell?.__nvSvgEditorContext === owner.svgSession.svgEditorContext) owner.svgSession.svgEditorCell.__nvSvgEditorContext = null;
    clearEditorContext(owner.filePath);
    owner.svgSession.quickMenu.destroy?.();
    owner.svgSession.eyedropperIndicator.destroy?.();
    owner.svgSession.wrapper.remove();
  };
}
