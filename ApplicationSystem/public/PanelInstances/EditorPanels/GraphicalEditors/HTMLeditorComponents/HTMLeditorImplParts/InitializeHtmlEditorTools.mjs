// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/InitializeHtmlEditorTools.mjs
// This module implements initialize Html Editor Tools behavior for the HTMLeditorImpl feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { handleTableArrowKeyNavigation } from "/ToolbarCallbacks/insert/tableTools.mjs";
import { createCleanupHTMLTableToolbarHandler, createHtmlNativeInputHandler, createHtmlSaveSerialization } from "./CreateCleanupHTMLTableToolbarHandler.mjs";
import { installCartoonEditingBehavior } from "/ToolbarCallbacks/insert/cartoonTools.mjs";
import { createHtmlLayersContext } from "/PanelInstances/Common/Layers/htmlLayersContext.mjs";
import { registerHTMLLayoutTools } from "./RegisterHTMLLayoutTools.mjs";
import { registerImageInteractionTools } from "./OpenInsertImageForm.mjs";
import { refreshReferencedCircuits, installReferencedCircuitRendering } from "../../CircuitEditorComponents/HtmlReferencedCircuitIntegration.mjs";
import { markHtmlEditorDirty, getCurrentSelectionRangeInEditor, getRememberedSelectionRange } from "./EnsureHTMLLayoutStyles.mjs";
import { loadHtmlEditorDocument } from "./LoadHtmlEditorDocument.mjs";
import { publishHtmlEditorContext } from "./PublishHtmlEditorContext.mjs";
import { connectHtmlDocumentReplacement } from "./ConnectHtmlDocumentReplacement.mjs";
import { setWordCount } from "/StatusBar.mjs";
import { rehydrateLayoutCanvases, registerCanvasDeletionHotkeys } from "./RehydrateLayoutCanvases.mjs";
import { hydrateEditorImages } from "./IsVirtualEditorPath.mjs";
import { syncEditorImageTextPresentation, updateSelectedImageTextState } from "./UpdateSelectedImageState.mjs";
import { registerHTMLFallbackHotkeys, installLineNumberedPoetryTools } from "./RegisterHTMLFallbackHotkeys.mjs";
import { registerImageTextInteractionTools, updateImageTextStateFromSelection } from "./UpdateImageTextStateFromSelection.mjs";
import { updateTextStyleSelectionState, findTextStyleTargetFromRange } from "./ApplyTextStylesInFragment.mjs";

// Initialize Html Editor Tools operations.
export async function initializeHtmlEditorTools(scope) {
  scope.htmlSession.wysiwyg.addEventListener("pointerdown", scope.htmlSession.updateTableSelectionFromEvent);
  scope.htmlSession.wysiwyg.addEventListener("click", scope.htmlSession.updateTableSelectionFromEvent);
  scope.htmlSession.wysiwyg.addEventListener("keyup", scope.htmlSession.updateTableSelectionFromSelection);
  scope.htmlSession.wysiwyg.addEventListener("focusin", scope.htmlSession.updateTableSelectionFromSelection);
  scope.htmlSession.wysiwyg.addEventListener("keydown", handleTableArrowKeyNavigation);
  document.addEventListener("selectionchange", scope.htmlSession.updateTableSelectionFromSelection);
  document.addEventListener("copy", scope.htmlSession.handleHtmlTableCopy);
  scope.container.__cleanupHTMLTableToolbar = createCleanupHTMLTableToolbarHandler({
    get htmlSession() {
      return scope.htmlSession;
    }
  });
  scope.container.__cleanupHTMLCartoonToolbar = installCartoonEditingBehavior(scope.htmlSession.wysiwyg);

  // Expose a layer context so the Layers panel can toggle HTML elements.
  window.HTMLLayersContext = createHtmlLayersContext(scope.htmlSession.wysiwyg, {
    title: "HTML Layers"
  });

  // Ensure table editing tools are available for existing tables.
  if (typeof window.ensureTableToolsInstalled === "function") {
    window.ensureTableToolsInstalled();
  }
  registerHTMLLayoutTools(scope.htmlSession.wysiwyg, scope.filePath);
  scope.htmlSession.imageTools = registerImageInteractionTools(scope.htmlSession.wysiwyg, scope.filePath);
  scope.htmlSession.refreshCircuitReferences = () => refreshReferencedCircuits(scope.htmlSession.wysiwyg, {
    sourcePath: scope.filePath,
    onPresentationChange: () => markHtmlEditorDirty(scope.htmlSession.wysiwyg, scope.filePath)
  });
  scope.container.__cleanupHTMLCircuits = installReferencedCircuitRendering(scope.htmlSession.wysiwyg, {
    sourcePath: scope.filePath,
    onPresentationChange: () => markHtmlEditorDirty(scope.htmlSession.wysiwyg, scope.filePath)
  });
  Object.assign(window.HTMLWysiwygTools || {}, {
    cropSelectedImage: scope.htmlSession.imageTools.cropSelectedImage,
    toggleSelectedImageInlineEditor: scope.htmlSession.imageTools.toggleSelectedImageInlineEditor,
    openSelectedImageEditorUndocked: scope.htmlSession.imageTools.openSelectedImageEditorUndocked,
    finishInlineImageEditor: scope.htmlSession.imageTools.finishInlineImageEditor,
    cancelInlineImageEditor: scope.htmlSession.imageTools.cancelInlineImageEditor,
    isInlineImageEditorOpen: scope.htmlSession.imageTools.isInlineImageEditorOpen,
    hydrateReferencedCircuits: () => scope.htmlSession.refreshCircuitReferences(),
    editSelectedCircuit: createHtmlNativeInputHandler({}),
    editSelectedAudioRecording: createHtmlSaveSerialization({})
  });
  try {
    const stageResult41 = await loadHtmlEditorDocument({
      get htmlSession() {
        return scope.htmlSession;
      },
      get filePath() {
        return scope.filePath;
      }
    });
    if (stageResult41) return {
      value: stageResult41.value
    };
    const stageResult42 = publishHtmlEditorContext({
      get htmlSession() {
        return scope.htmlSession;
      },
      get filePath() {
        return scope.filePath;
      },
      get container() {
        return scope.container;
      }
    });
    if (stageResult42) return {
      value: stageResult42.value
    };
    connectHtmlDocumentReplacement({
      get htmlSession() {
        return scope.htmlSession;
      },
      get container() {
        return scope.container;
      },
      get filePath() {
        return scope.filePath;
      }
    });
  } catch (err) {
    scope.htmlSession.wrapper.innerHTML = `<div style="color:red;padding:12px">Failed to load file: ${err.message}</div>`;
    console.error(err);
    setWordCount(0);
  }
  rehydrateLayoutCanvases(scope.htmlSession.wysiwyg, scope.filePath);
  try {
    await hydrateEditorImages(scope.htmlSession.wysiwyg, scope.filePath);
  } catch (err) {
    console.warn("Failed to hydrate editor images:", err);
  }
  syncEditorImageTextPresentation(scope.htmlSession.wysiwyg, scope.filePath);
  scope.htmlSession.refreshCircuitReferences();

  // --------------------------------------------------
  // Enable fallback hotkeys
  // --------------------------------------------------
  scope.container.__cleanupHTMLHotkeys = registerHTMLFallbackHotkeys(scope.htmlSession.wysiwyg, scope.filePath, scope.htmlSession.wrapper);
  scope.container.__cleanupHTMLCanvasDeletion = registerCanvasDeletionHotkeys(scope.htmlSession.wysiwyg);
  scope.container.__cleanupHTMLImageTools = scope.htmlSession.imageTools.destroy;
  scope.container.__cleanupHTMLImageTextTools = registerImageTextInteractionTools(scope.htmlSession.wysiwyg, scope.filePath);
  scope.container.__cleanupHTMLPoetry = await installLineNumberedPoetryTools(scope.htmlSession.wysiwyg);
  scope.htmlSession.updateTextTargetFromSelection = () => {
    const range = getCurrentSelectionRangeInEditor(scope.htmlSession.wysiwyg) || getRememberedSelectionRange(scope.htmlSession.wysiwyg);
    updateTextStyleSelectionState(scope.htmlSession.wysiwyg, findTextStyleTargetFromRange(scope.htmlSession.wysiwyg, range));
    updateImageTextStateFromSelection(scope.htmlSession.wysiwyg, scope.filePath, range);
  };
  scope.htmlSession.wysiwyg.addEventListener("mouseup", scope.htmlSession.updateTextTargetFromSelection);
  scope.htmlSession.wysiwyg.addEventListener("keyup", scope.htmlSession.updateTextTargetFromSelection);
  scope.htmlSession.wysiwyg.addEventListener("focus", scope.htmlSession.updateTextTargetFromSelection);
  scope.htmlSession.previousCleanupTextWrapping = scope.container.__cleanupHTMLTextWrapping;
  scope.container.__cleanupHTMLTextWrapping = () => {
    scope.htmlSession.previousCleanupTextWrapping?.();
    scope.htmlSession.wysiwyg.removeEventListener("mouseup", scope.htmlSession.updateTextTargetFromSelection);
    scope.htmlSession.wysiwyg.removeEventListener("keyup", scope.htmlSession.updateTextTargetFromSelection);
    scope.htmlSession.wysiwyg.removeEventListener("focus", scope.htmlSession.updateTextTargetFromSelection);
    updateTextStyleSelectionState(scope.htmlSession.wysiwyg, null);
    updateSelectedImageTextState(null, {
      htmlTextSelectionActive: false
    });
  };
  scope.container.__cleanupHTMLAttention = scope.htmlSession.htmlAttentionCleanup;
}
