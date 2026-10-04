// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/UpdateImageTextStateFromSelection.mjs
// This module implements update Image Text State From Selection behavior for the HTMLeditorImpl feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { getCurrentSelectionRangeInEditor, getRememberedSelectionRange, publishHtmlSelectionToolbarState } from "./EnsureHTMLLayoutStyles.mjs";
import { findImageTextElementFromRange, getImageTextRangeError, clearImageTextSelection, findImageTextElementFromNode } from "../HtmlImageText.mjs";
import { markSelectedImageText, updateSelectedImageTextState, buildImageTextContextFromElement, syncEditorImageTextPresentation, syncEditorImageTextPresentationForNode, imageTextMutationSyncTargets, IMAGE_TEXT_PRESENTATION_ATTRIBUTE_NAMES } from "./UpdateSelectedImageState.mjs";
import { markSelectedImage } from "./GetImageEditorDescriptor.mjs";
import { recordHtmlTypingOperation } from "../HTMLTypingLatencyDiagnostics.mjs";
import { presentHtmlClass } from "/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlPresentation.mjs";
import { createHtmlImageFilePicker } from "./CreateHtmlImageFilePicker.mjs";

// Update Image Text State From Selection operations.
export function updateImageTextStateFromSelection(wysiwyg, editorFilePath, range = null) {
  const selectedRange = range || getCurrentSelectionRangeInEditor(wysiwyg) || getRememberedSelectionRange(wysiwyg);
  const imageTextElement = findImageTextElementFromRange(wysiwyg, selectedRange);
  const rangeError = getImageTextRangeError(selectedRange);
  if (imageTextElement) {
    markSelectedImageText(wysiwyg, imageTextElement);
    updateSelectedImageTextState(buildImageTextContextFromElement(imageTextElement, editorFilePath), {
      clearHtmlImageSelection: true,
      htmlTextSelectionActive: false
    });
    return;
  }
  if (!rangeError) markSelectedImage(wysiwyg, null);
  clearImageTextSelection(wysiwyg);
  updateSelectedImageTextState(null, {
    htmlTextSelectionActive: !rangeError,
    clearHtmlImageSelection: !rangeError
  });
}

export function registerImageTextInteractionTools(wysiwyg, editorFilePath) {
  if (!wysiwyg) return () => {};
  let pendingFrame = 0;
  let pendingFullSync = false;
  const pendingTargets = new Set();
  const flushSync = () => {
    pendingFrame = 0;
    if (pendingFullSync) {
      pendingFullSync = false;
      pendingTargets.clear();
      syncEditorImageTextPresentation(wysiwyg, editorFilePath);
      recordHtmlTypingOperation("image-text-full-sync");
      return;
    }
    let synced = 0;
    pendingTargets.forEach(target => {
      synced += syncEditorImageTextPresentationForNode(wysiwyg, target, editorFilePath);
    });
    pendingTargets.clear();
    if (synced > 0) recordHtmlTypingOperation("image-text-local-sync", {
      synced
    });
  };
  const scheduleSync = (target = null, {
    full = false
  } = {}) => {
    if (full) pendingFullSync = true;else if (target) pendingTargets.add(target);
    if (pendingFrame) return;
    pendingFrame = requestAnimationFrame(flushSync);
  };
  const onClick = evt => {
    const element = findImageTextElementFromNode(wysiwyg, evt.target);
    if (!element) return;
    markSelectedImageText(wysiwyg, element);
    updateSelectedImageTextState(buildImageTextContextFromElement(element, editorFilePath), {
      clearHtmlImageSelection: true,
      htmlTextSelectionActive: false
    });
  };
  let observer = null;
  try {
    observer = new MutationObserver(records => {
      let sawRelevantMutation = false;
      for (const record of records || []) {
        const targets = imageTextMutationSyncTargets(record);
        if (!targets.length) continue;
        sawRelevantMutation = true;
        targets.forEach(target => scheduleSync(target));
      }
      if (sawRelevantMutation) recordHtmlTypingOperation("image-text-mutation-batch");
    });
    observer.observe(wysiwyg, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: Array.from(IMAGE_TEXT_PRESENTATION_ATTRIBUTE_NAMES)
    });
  } catch {
    observer = null;
  }
  wysiwyg.addEventListener("click", onClick);
  syncEditorImageTextPresentation(wysiwyg, editorFilePath);
  return () => {
    if (pendingFrame) cancelAnimationFrame(pendingFrame);
    pendingFrame = 0;
    pendingTargets.clear();
    observer?.disconnect?.();
    wysiwyg.removeEventListener("click", onClick);
    clearImageTextSelection(wysiwyg);
    updateSelectedImageTextState(null, {
      htmlTextSelectionActive: false
    });
  };
}

export function updateSelectedAudioState(context) {
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.activeHtmlAudioContext = context || null;
  publishHtmlSelectionToolbarState({
    htmlAudioSelected: Boolean(context && context.element),
    htmlAudioPath: context?.linkedNotebookPath || context?.src || null
  });
}

export function markSelectedCircuit(wysiwyg, circuitEl) {
  wysiwyg.querySelectorAll(".nv-selected-circuit").forEach(el => {
    presentHtmlClass(el, "nv-selected-circuit", false);
  });
  if (circuitEl) presentHtmlClass(circuitEl, "nv-selected-circuit", true);
}

export function updateSelectedCircuitState(context) {
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.activeHtmlCircuitContext = context || null;
  publishHtmlSelectionToolbarState({
    htmlCircuitSelected: Boolean(context && context.element),
    htmlCircuitPath: context?.linkedNotebookPath || null
  });
}

export async function openCropModalForImage(sourceUrl) {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.src = sourceUrl;
  await new Promise((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Unable to load image for crop"));
  });
  return new Promise(createHtmlImageFilePicker({
    get image() {
      return image;
    }
  }));
}
