// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/CreateHtmlPresentationRestoreHandler.mjs
// This module implements create Html Presentation Restore Handler behavior for the HTMLeditorImpl feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { rehydrateLayoutCanvases } from "./RehydrateLayoutCanvases.mjs";
import { hydrateEditorImages } from "./IsVirtualEditorPath.mjs";
import { syncEditorImageTextPresentation, updateSelectedImageState, updateSelectedImageTextState, markSelectedImageText, buildImageTextContextFromElement } from "./UpdateSelectedImageState.mjs";
import { markSelectedImage, markSelectedAudio } from "./GetImageEditorDescriptor.mjs";
import { clearImageTextSelection, getImageTextRangeError, wrapRangeWithImageText } from "../HtmlImageText.mjs";
import { updateSelectedAudioState, markSelectedCircuit, updateSelectedCircuitState } from "./UpdateImageTextStateFromSelection.mjs";
import { clearTableCellSelection, getSelectedTableCells } from "/ToolbarCallbacks/insert/tableTools.mjs";
import { renderInlineEquationsForEditor } from "./RegisterHTMLFallbackHotkeys.mjs";
import { rememberCurrentSelectionRange, getCurrentSelectionRangeInEditor, getRememberedSelectionRange, isRangeInsideEditor, createRangeAtEditorEnd, applySelectionRange, markHtmlEditorDirty } from "./EnsureHTMLLayoutStyles.mjs";
import { setStatus } from "/StatusBar.mjs";
import { openInsertImageForm } from "./OpenInsertImageForm.mjs";
import { insertHtmlFragmentAtRange } from "../WysiwygProgrammaticHistory.mjs";
import { copyHtmlTableSelection } from "./HtmlTableSelectionGrid.mjs";

// Create Html Presentation Restore Handler operations.
export function createHtmlPresentationRestoreHandler(owner) {
  return ({
    direction
  }) => {
    rehydrateLayoutCanvases(owner.wysiwyg, owner.editorFilePath);
    hydrateEditorImages(owner.wysiwyg, owner.editorFilePath).catch(err => {
      console.warn("Failed to rehydrate images after undo/redo:", err);
    });
    syncEditorImageTextPresentation(owner.wysiwyg, owner.editorFilePath);
    owner.layoutToolsState.refreshCircuitReferences();
    markSelectedImage(owner.wysiwyg, null);
    updateSelectedImageState(null);
    clearImageTextSelection(owner.wysiwyg);
    updateSelectedImageTextState(null, {
      htmlTextSelectionActive: false
    });
    markSelectedAudio(owner.wysiwyg, null);
    updateSelectedAudioState(null);
    markSelectedCircuit(owner.wysiwyg, null);
    updateSelectedCircuitState(null);
    clearTableCellSelection({
      keepActive: false
    });
    renderInlineEquationsForEditor(owner.wysiwyg);
    owner.wysiwyg.__nvHtmlSelection?.clear();
    rememberCurrentSelectionRange(owner.wysiwyg);
  };
}

export function createReplaceSelectedTextWithImageHandler(owner) {
  return async () => {
    const range = getCurrentSelectionRangeInEditor(owner.wysiwyg) || getRememberedSelectionRange(owner.wysiwyg);
    const rangeError = getImageTextRangeError(range);
    if (rangeError) {
      setStatus("Text Image", rangeError);
      alert(rangeError);
      return false;
    }
    const selectedText = String(range.toString() || "");
    const savedRange = range.cloneRange();
    await openInsertImageForm(owner.wysiwyg, owner.editorFilePath, savedRange, {
      title: "Replace Selected Text with Image",
      applyLabel: "Use Image",
      applyInsertion: async insertion => {
        const element = wrapRangeWithImageText(savedRange, insertion, {
          expectedText: selectedText
        });
        markSelectedImageText(owner.wysiwyg, element);
        updateSelectedImageTextState(buildImageTextContextFromElement(element, owner.editorFilePath), {
          clearHtmlImageSelection: true,
          htmlTextSelectionActive: false
        });
        rememberCurrentSelectionRange(owner.wysiwyg);
        return element;
      }
    });
    return true;
  };
}

export function createHtmlTablePasteHandler(owner) {
  return html => {
    const htmlText = String(html || "");
    const preferredRange = getCurrentSelectionRangeInEditor(owner.wysiwyg) || getRememberedSelectionRange(owner.wysiwyg);
    const range = (isRangeInsideEditor(owner.wysiwyg, preferredRange) ? preferredRange.cloneRange() : null) || getRememberedSelectionRange(owner.wysiwyg) || getCurrentSelectionRangeInEditor(owner.wysiwyg) || createRangeAtEditorEnd(owner.wysiwyg);
    const beforeHtml = String(owner.wysiwyg.innerHTML || "");
    applySelectionRange(range);
    owner.wysiwyg.focus();
    let inserted = false;
    try {
      inserted = document.execCommand("insertHTML", false, htmlText);
    } catch {
      inserted = false;
    }
    if (!inserted && String(owner.wysiwyg.innerHTML || "") === beforeHtml) {
      inserted = insertHtmlFragmentAtRange(owner.wysiwyg, htmlText, range);
    }
    if (inserted || String(owner.wysiwyg.innerHTML || "") !== beforeHtml) {
      owner.layoutToolsState.programmaticHistory.record(beforeHtml);
      renderInlineEquationsForEditor(owner.wysiwyg);
      owner.layoutToolsState.refreshCircuitReferences();
      markHtmlEditorDirty(owner.wysiwyg, owner.editorFilePath);
      rememberCurrentSelectionRange(owner.wysiwyg);
      return true;
    }
    return false;
  };
}

export function createHandleHtmlTableCopyHandler(owner) {
  return event => {
    const rawTarget = event?.target?.nodeType === Node.TEXT_NODE ? event.target.parentElement : event?.target;
    const eventNode = rawTarget instanceof Node ? rawTarget : null;
    const activeElement = document.activeElement;
    const activeCell = window.__nvHtmlTableActiveCell;
    const selection = window.getSelection?.();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    const eventInEditor = eventNode ? owner.htmlSession.wysiwyg.contains(eventNode) : false;
    const focusInEditor = activeElement ? owner.htmlSession.wysiwyg.contains(activeElement) : false;
    const activeInEditor = activeCell ? owner.htmlSession.wysiwyg.contains(activeCell) : false;
    const selectionInEditor = range ? owner.htmlSession.wysiwyg.contains(range.commonAncestorContainer) : false;
    const hasTextSelectionInEditor = selectionInEditor && selection && !selection.isCollapsed;
    if (hasTextSelectionInEditor) return false;
    if (!eventInEditor && !focusInEditor && !activeInEditor && !selectionInEditor) return false;
    let selectedCells = getSelectedTableCells();
    const table = (selectedCells[0] || activeCell)?.closest?.("table") || null;
    if (!table || !owner.htmlSession.wysiwyg.contains(table)) return false;
    selectedCells = selectedCells.filter(cell => cell.closest?.("table") === table);
    if (!selectedCells.length && activeInEditor) selectedCells = [activeCell];
    if (!selectedCells.length) return false;
    return copyHtmlTableSelection(event, table, selectedCells);
  };
}
