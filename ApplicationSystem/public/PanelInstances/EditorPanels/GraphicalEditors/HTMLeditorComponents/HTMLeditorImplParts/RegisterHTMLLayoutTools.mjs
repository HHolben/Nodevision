// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/RegisterHTMLLayoutTools.mjs
// This module implements register HTMLLayout Tools behavior for the HTMLeditorImpl feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { refreshReferencedCircuits } from "../../CircuitEditorComponents/HtmlReferencedCircuitIntegration.mjs";
import { markHtmlEditorDirty, insertNodeAtCaret, getCurrentSelectionRangeInEditor, getRememberedSelectionRange, rememberCurrentSelectionRange } from "./EnsureHTMLLayoutStyles.mjs";
import { createHtmlDomHistory } from "../HtmlDomHistory.mjs";
import { createHtmlHistoryRestore } from "../HtmlHistoryRestore.mjs";
import { createHtmlPresentationRestoreHandler, createReplaceSelectedTextWithImageHandler, createHtmlTablePasteHandler } from "./CreateHtmlPresentationRestoreHandler.mjs";
import { presentHtmlAttribute } from "/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlPresentation.mjs";
import { attachCanvasTools } from "./AttachCanvasTools.mjs";
import { ensureCanvasResizeHandles, makeCanvasItemInteractive } from "./AppendEditorHandlesToItem.mjs";
import { makeLayoutCanvasResizable, createCanvasItem } from "./MakeLayoutCanvasResizable.mjs";
import { getActiveLayoutCanvas } from "./RemoveTextStylesFromWysiwygSelection.mjs";
import { chooseImageInsertion } from "./GetImageEditorDescriptor.mjs";
import { createImageElementFromInsertion, openInsertImageForm } from "./OpenInsertImageForm.mjs";
import { findActiveImageTextElement, markSelectedImageText, updateSelectedImageTextState, buildImageTextContextFromElement } from "./UpdateSelectedImageState.mjs";
import { applyImageTextPresentation, unwrapImageTextElement, readImageTextLayout, applyImageTextLayout } from "../HtmlImageText.mjs";
import { runUndoCommandWithProgrammaticFallback } from "./RegisterHTMLFallbackHotkeys.mjs";

// Register HTMLLayout Tools operations.
export function registerHTMLLayoutTools(wysiwyg, editorFilePath) {
  const layoutToolsState = {};
  layoutToolsState.refreshCircuitReferences = () => refreshReferencedCircuits(wysiwyg, {
    sourcePath: editorFilePath,
    onPresentationChange: () => markHtmlEditorDirty(wysiwyg, editorFilePath)
  });
  layoutToolsState.programmaticHistory = createHtmlDomHistory(wysiwyg, {
    readBookmark: () => wysiwyg.__nvHtmlSelection?.bookmark(),
    restoreBookmark: bookmark => wysiwyg.__nvHtmlSelection?.restore(bookmark),
    onRestore: createHtmlHistoryRestore(createHtmlPresentationRestoreHandler({
      get wysiwyg() {
        return wysiwyg;
      },
      get editorFilePath() {
        return editorFilePath;
      },
      get layoutToolsState() {
        return layoutToolsState;
      }
    }), wysiwyg)
  });
  wysiwyg.__nvProgrammaticHistory = layoutToolsState.programmaticHistory;
  layoutToolsState.createLayoutCanvas = () => {
    const canvas = document.createElement("div");
    canvas.className = "nv-layout-canvas";
    presentHtmlAttribute(canvas, "contenteditable", "false");
    attachCanvasTools(canvas, editorFilePath);
    ensureCanvasResizeHandles(canvas);
    makeLayoutCanvasResizable(canvas);
    return canvas;
  };
  layoutToolsState.insertLayoutCanvas = () => {
    const canvas = layoutToolsState.createLayoutCanvas();
    insertNodeAtCaret(wysiwyg, canvas);
    return canvas;
  };
  layoutToolsState.insertPositionableImage = async () => {
    let canvas = getActiveLayoutCanvas(wysiwyg);
    if (!canvas) {
      canvas = layoutToolsState.insertLayoutCanvas();
    }
    const insertion = await chooseImageInsertion(editorFilePath);
    const img = createImageElementFromInsertion(insertion);
    if (!img) return;
    const item = createCanvasItem({
      typeLabel: "Media",
      x: 32 + canvas.querySelectorAll(".nv-canvas-item").length * 14,
      y: 44 + canvas.querySelectorAll(".nv-canvas-item").length * 14,
      width: 280,
      height: 200,
      contentNode: img,
      editable: false
    });
    canvas.appendChild(item);
    makeCanvasItemInteractive(item, canvas);
  };
  layoutToolsState.insertImageAtCaret = async () => {
    const preferredRange = getCurrentSelectionRangeInEditor(wysiwyg) || getRememberedSelectionRange(wysiwyg);
    await openInsertImageForm(wysiwyg, editorFilePath, preferredRange);
  };
  layoutToolsState.replaceSelectedTextWithImage = createReplaceSelectedTextWithImageHandler({
    get wysiwyg() {
      return wysiwyg;
    },
    get editorFilePath() {
      return editorFilePath;
    }
  });
  layoutToolsState.changeSelectedTextImage = async () => {
    const element = findActiveImageTextElement(wysiwyg);
    if (!element) {
      alert("Select image-backed text first.");
      return false;
    }
    await openInsertImageForm(wysiwyg, editorFilePath, null, {
      title: "Change Text Image",
      applyLabel: "Update Image",
      applyInsertion: async insertion => {
        applyImageTextPresentation(element, insertion);
        markSelectedImageText(wysiwyg, element);
        updateSelectedImageTextState(buildImageTextContextFromElement(element, editorFilePath), {
          clearHtmlImageSelection: true,
          htmlTextSelectionActive: false
        });
        return element;
      }
    });
    return true;
  };
  layoutToolsState.removeSelectedTextImage = () => {
    const element = findActiveImageTextElement(wysiwyg);
    if (!element) {
      alert("Select image-backed text first.");
      return false;
    }
    const beforeHtml = String(wysiwyg.innerHTML || "");
    const removed = unwrapImageTextElement(element);
    if (!removed) return false;
    layoutToolsState.programmaticHistory.record(beforeHtml);
    markHtmlEditorDirty(wysiwyg, editorFilePath);
    updateSelectedImageTextState(null, {
      htmlTextSelectionActive: false
    });
    rememberCurrentSelectionRange(wysiwyg);
    return true;
  };
  layoutToolsState.readSelectedTextImageLayout = () => {
    const element = findActiveImageTextElement(wysiwyg);
    return element ? readImageTextLayout(element) : null;
  };
  layoutToolsState.applySelectedTextImageLayout = (layout = {}) => {
    const element = findActiveImageTextElement(wysiwyg);
    if (!element) return null;
    const beforeHtml = String(wysiwyg.innerHTML || "");
    const nextLayout = applyImageTextLayout(element, layout);
    if (String(wysiwyg.innerHTML || "") !== beforeHtml) {
      layoutToolsState.programmaticHistory.record(beforeHtml);
      markHtmlEditorDirty(wysiwyg, editorFilePath);
    }
    markSelectedImageText(wysiwyg, element);
    updateSelectedImageTextState(buildImageTextContextFromElement(element, editorFilePath), {
      clearHtmlImageSelection: true,
      htmlTextSelectionActive: false
    });
    return nextLayout;
  };
  window.HTMLWysiwygTools = {
    insertImageAtCaret: layoutToolsState.insertImageAtCaret,
    replaceSelectedTextWithImage: layoutToolsState.replaceSelectedTextWithImage,
    changeSelectedTextImage: layoutToolsState.changeSelectedTextImage,
    removeSelectedTextImage: layoutToolsState.removeSelectedTextImage,
    readSelectedTextImageLayout: layoutToolsState.readSelectedTextImageLayout,
    applySelectedTextImageLayout: layoutToolsState.applySelectedTextImageLayout,
    insertHTMLAtCaret: createHtmlTablePasteHandler({
      get wysiwyg() {
        return wysiwyg;
      },
      get layoutToolsState() {
        return layoutToolsState;
      },
      get editorFilePath() {
        return editorFilePath;
      }
    }),
    undo: () => runUndoCommandWithProgrammaticFallback(wysiwyg, "undo", editorFilePath),
    redo: () => runUndoCommandWithProgrammaticFallback(wysiwyg, "redo", editorFilePath),
    recordProgrammaticChange: beforeHtml => {
      const recorded = layoutToolsState.programmaticHistory.record(beforeHtml);
      if (recorded) markHtmlEditorDirty(wysiwyg, editorFilePath);
      return recorded;
    },
    insertLayoutCanvas: layoutToolsState.insertLayoutCanvas,
    insertPositionableImage: layoutToolsState.insertPositionableImage
  };
}
