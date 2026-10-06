// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/CreateSetEditorHtmlForPathHandler.mjs
// This module implements create Set Editor Html For Path Handler behavior for the HTMLeditorImpl feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { applyInitialDocumentBodyBackground } from "./UpdateStoredDocumentBackgroundStyle.mjs";
import { renderInlineEquationsForEditor } from "./RegisterHTMLFallbackHotkeys.mjs";
import { rehydrateLayoutCanvases } from "./RehydrateLayoutCanvases.mjs";
import { hydrateEditorImages } from "./IsVirtualEditorPath.mjs";
import { syncEditorImageTextPresentation, updateSelectedImageState, updateSelectedImageTextState } from "./UpdateSelectedImageState.mjs";
import { markSelectedImage, markSelectedAudio } from "./GetImageEditorDescriptor.mjs";
import { clearImageTextSelection } from "../HtmlImageText.mjs";
import { updateSelectedAudioState, markSelectedCircuit, updateSelectedCircuitState } from "./UpdateImageTextStateFromSelection.mjs";

// Create Set Editor Html For Path Handler operations.
export function createSetEditorHtmlForPathHandler(owner) {
  return html => {
    if (owner.htmlSession.htmlEditorDisposed || !owner.container.isConnected || !owner.htmlSession.wysiwyg.isConnected) {
      throw new Error("HTML/WYSIWYG editor is no longer active; refusing to edit stale editor content.");
    }
    owner.htmlSession.htmlEditorContext.__nvPropertiesDocument?.dispose();
    owner.htmlSession.htmlEditorContext.__nvPropertiesDocument = null;
    const doc = owner.htmlSession.sourceDocument.load(html);
    applyInitialDocumentBodyBackground(owner.htmlSession.wysiwyg, doc.body);
    window.NodevisionPoetry?.normalizeAllPoemBlocks?.(owner.htmlSession.wysiwyg);
    renderInlineEquationsForEditor(owner.htmlSession.wysiwyg);
    rehydrateLayoutCanvases(owner.htmlSession.wysiwyg, owner.filePath);
    hydrateEditorImages(owner.htmlSession.wysiwyg, owner.filePath).catch(err => {
      console.warn("Failed to rehydrate images after setEditorHTML:", err);
    });
    syncEditorImageTextPresentation(owner.htmlSession.wysiwyg, owner.filePath);
    markSelectedImage(owner.htmlSession.wysiwyg, null);
    updateSelectedImageState(null);
    clearImageTextSelection(owner.htmlSession.wysiwyg);
    updateSelectedImageTextState(null, {
      htmlTextSelectionActive: false
    });
    markSelectedAudio(owner.htmlSession.wysiwyg, null);
    updateSelectedAudioState(null);
    markSelectedCircuit(owner.htmlSession.wysiwyg, null);
    updateSelectedCircuitState(null);
    owner.htmlSession.refreshCircuitReferences();
    owner.htmlSession.updateWordCount();
    owner.htmlSession.transactions.reset();
  };
}

export function createHtmlEditorCleanup(owner) {
  return () => {
    owner.container.__nvHtmlZoomCleanup?.();
    owner.container.__nvHtmlZoomCleanup = null;
    owner.container.__cleanupHTMLHotkeys?.();
    owner.container.__cleanupHTMLCanvasDeletion?.();
    owner.container.__cleanupHTMLImageTools?.();
    owner.container.__cleanupHTMLImageTextTools?.();
    owner.container.__cleanupHTMLCaretTracking?.();
    owner.container.__cleanupHTMLTypingDiagnostics?.();
    owner.container.__cleanupHTMLTextWrapping?.();
    owner.container.__cleanupHTMLActiveContext?.();
    owner.container.__cleanupHTMLPoetry?.();
    owner.container.__cleanupHTMLTableToolbar?.();
    owner.container.__cleanupHTMLTableDividerResizing?.();
    owner.container.__cleanupHTMLTableDragSelection?.();
    owner.container.__cleanupHTMLCartoonToolbar?.();
    owner.container.__cleanupHTMLCircuits?.();
    owner.htmlSession.htmlAttentionCleanup?.();
    owner.htmlSession.wysiwyg.removeEventListener("input", owner.htmlSession.handleNativeHtmlInput);
    if (owner.htmlSession.pendingWordCountTimer) {
      window.clearTimeout(owner.htmlSession.pendingWordCountTimer);
      owner.htmlSession.pendingWordCountTimer = 0;
    }
    if (owner.htmlSession.pendingRecentEditTimer) {
      window.clearTimeout(owner.htmlSession.pendingRecentEditTimer);
      owner.htmlSession.flushRecentHtmlEdit();
    }
    // Initialization can fail before the transaction/context cleanup is installed.
    owner.htmlSession.wysiwyg.__nvProgrammaticHistory?.dispose();
    owner.htmlSession.wysiwyg.__nvProgrammaticHistory = null;
    owner.container.__cleanupHTMLHotkeys = null;
    owner.container.__cleanupHTMLCanvasDeletion = null;
    owner.container.__cleanupHTMLImageTools = null;
    owner.container.__cleanupHTMLImageTextTools = null;
    owner.container.__cleanupHTMLCaretTracking = null;
    owner.container.__cleanupHTMLTypingDiagnostics = null;
    owner.container.__cleanupHTMLTextWrapping = null;
    owner.container.__cleanupHTMLActiveContext = null;
    owner.container.__cleanupHTMLPoetry = null;
    owner.container.__cleanupHTMLTableToolbar = null;
    owner.container.__cleanupHTMLTableDividerResizing = null;
    owner.container.__cleanupHTMLTableDragSelection = null;
    owner.container.__cleanupHTMLCartoonToolbar = null;
    owner.container.__cleanupHTMLCircuits = null;
    owner.container.__cleanupHTMLAttention = null;
  };
}
