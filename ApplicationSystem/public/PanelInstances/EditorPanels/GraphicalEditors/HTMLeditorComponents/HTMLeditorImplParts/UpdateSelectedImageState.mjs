// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/UpdateSelectedImageState.mjs
// This module implements update Selected Image State behavior for the HTMLeditorImpl feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { publishHtmlSelectionToolbarState, getCurrentSelectionRangeInEditor, getRememberedSelectionRange } from "./EnsureHTMLLayoutStyles.mjs";
import { readImageTextContext, syncImageTextPresentation, isImageTextElement, IMAGE_TEXT_SOURCE_ATTR, applyImageTextPresentation, IMAGE_TEXT_SELECTOR, selectImageTextElement, findImageTextElementFromRange } from "../HtmlImageText.mjs";
import { normalizeNotebookPathInput } from "./MakeLayoutCanvasResizable.mjs";
import { inferExtensionFromMime, inferExtensionFromPath } from "./IsVirtualEditorPath.mjs";
import { parseDataUrl } from "./PickLocalImageFile.mjs";
import { getNotebookPathFromSourceInput } from "./GetNotebookPathFromSourceInput.mjs";
import { presentHtmlClass } from "/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlPresentation.mjs";

// Update Selected Image State operations.
export function updateSelectedImageState(context) {
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.activeHtmlImageContext = context || null;
  const patch = {
    htmlImageSelected: Boolean(context && context.element),
    htmlImagePath: context?.linkedNotebookPath || null
  };
  if (context?.element) {
    window.NodevisionState.activeHtmlImageTextContext = null;
    patch.htmlImageTextSelected = false;
    patch.htmlImageTextPath = null;
  }
  publishHtmlSelectionToolbarState(patch);
}

export function buildImageTextContextFromElement(element, editorFilePath = "") {
  const context = readImageTextContext(element);
  if (!context) return null;
  const source = String(context.src || "").trim();
  const explicitLinked = normalizeNotebookPathInput(context.linkedNotebookPath || "");
  context.linkedNotebookPath = "";
  context.isInline = false;
  context.isExternal = false;
  context.extension = "";
  if (!source) return context;
  if (source.startsWith("data:image/")) {
    context.isInline = true;
    context.extension = inferExtensionFromMime(parseDataUrl(source)?.mimeType || "");
    return context;
  }
  const notebookPath = getNotebookPathFromSourceInput(source, editorFilePath);
  if (notebookPath) {
    context.linkedNotebookPath = notebookPath;
    context.extension = inferExtensionFromPath(notebookPath);
  } else if (explicitLinked) {
    context.linkedNotebookPath = explicitLinked;
    context.extension = inferExtensionFromPath(explicitLinked);
  } else if (/^(https?:)?\/\//i.test(source)) {
    context.isExternal = true;
  }
  return context;
}

export function syncEditorImageTextPresentation(root, editorFilePath = "") {
  syncImageTextPresentation(root, {
    resolveNotebookPath: source => getNotebookPathFromSourceInput(source, editorFilePath)
  });
}

export function syncEditorImageTextElementPresentation(element, editorFilePath = "") {
  if (!isImageTextElement(element)) return false;
  const source = String(element.getAttribute(IMAGE_TEXT_SOURCE_ATTR) || "").trim();
  if (!source) return false;
  applyImageTextPresentation(element, {
    src: source,
    linkedNotebookPath: getNotebookPathFromSourceInput(source, editorFilePath) || ""
  });
  return true;
}

export function syncEditorImageTextPresentationForNode(wysiwyg, node, editorFilePath = "") {
  if (!wysiwyg || !node) return 0;
  const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  if (!(element instanceof HTMLElement) || !wysiwyg.contains(element)) return 0;
  const candidates = new Set();
  const nearest = element.closest?.(IMAGE_TEXT_SELECTOR);
  if (nearest && wysiwyg.contains(nearest)) candidates.add(nearest);
  if (isImageTextElement(element)) candidates.add(element);
  element.querySelectorAll?.(IMAGE_TEXT_SELECTOR)?.forEach(child => candidates.add(child));
  let synced = 0;
  candidates.forEach(candidate => {
    if (syncEditorImageTextElementPresentation(candidate, editorFilePath)) synced += 1;
  });
  return synced;
}

export const IMAGE_TEXT_PRESENTATION_ATTRIBUTE_NAMES = new Set(["class", "style", IMAGE_TEXT_SOURCE_ATTR, "data-nodevision-image-text", "data-nv-linked-path"]);

export function imageTextMutationNeedsPresentationSync(record) {
  if (!record) return false;
  if (record.type === "attributes") {
    return IMAGE_TEXT_PRESENTATION_ATTRIBUTE_NAMES.has(String(record.attributeName || ""));
  }
  if (record.type === "childList") {
    return Boolean(record.addedNodes?.length || record.removedNodes?.length);
  }
  return false;
}

export function imageTextMutationSyncTargets(record) {
  if (!imageTextMutationNeedsPresentationSync(record)) return [];
  if (record.type === "attributes") return [record.target].filter(Boolean);
  return Array.from(record.addedNodes || []).filter(Boolean);
}

export function markSelectedImageText(wysiwyg, element) {
  if (!wysiwyg) return null;
  wysiwyg.querySelectorAll(".nv-selected-image").forEach(img => {
    presentHtmlClass(img, "nv-selected-image", false);
  });
  wysiwyg.querySelectorAll(".nv-selected-image-item").forEach(item => {
    presentHtmlClass(item, "nv-selected-image-item", false);
  });
  return selectImageTextElement(wysiwyg, element);
}

export function updateSelectedImageTextState(context, options = {}) {
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.activeHtmlImageTextContext = context || null;
  const patch = {
    htmlImageTextSelected: Boolean(context && context.element),
    htmlImageTextPath: context?.linkedNotebookPath || context?.src || null
  };
  if (Object.prototype.hasOwnProperty.call(options, "htmlTextSelectionActive")) {
    patch.htmlTextSelectionActive = Boolean(options.htmlTextSelectionActive);
  }
  if (options.clearHtmlImageSelection) {
    window.NodevisionState.activeHtmlImageContext = null;
    patch.htmlImageSelected = false;
    patch.htmlImagePath = null;
  }
  publishHtmlSelectionToolbarState(patch);
}

export function findActiveImageTextElement(wysiwyg) {
  const active = window.NodevisionState?.activeHtmlImageTextContext?.element || null;
  if (active instanceof HTMLElement && active.isConnected && wysiwyg?.contains(active)) return active;
  const range = getCurrentSelectionRangeInEditor(wysiwyg) || getRememberedSelectionRange(wysiwyg);
  return findImageTextElementFromRange(wysiwyg, range);
}
