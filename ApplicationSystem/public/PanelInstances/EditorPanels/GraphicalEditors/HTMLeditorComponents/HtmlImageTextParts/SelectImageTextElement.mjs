// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlImageTextParts/SelectImageTextElement.mjs
// This module implements select Image Text Element behavior for the HtmlImageText feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { clearImageTextSelection, isImageTextElement, IMAGE_TEXT_SELECTED_CLASS, IMAGE_TEXT_SOURCE_ATTR, cleanCssValue } from "./CleanCssValue.mjs";
import { presentHtmlClass } from "/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlPresentation.mjs";
import { readFallbackReferencesFromElement } from "/utils/referenceFallbacks.mjs";

// Select Image Text Element operations.
export function selectImageTextElement(wysiwyg, element) {
  clearImageTextSelection(wysiwyg);
  if (!isImageTextElement(element)) return null;
  presentHtmlClass(element, IMAGE_TEXT_SELECTED_CLASS, true);
  return element;
}

export function readImageTextContext(element) {
  if (!isImageTextElement(element)) return null;
  const source = element.getAttribute(IMAGE_TEXT_SOURCE_ATTR) || "";
  return {
    element,
    src: source,
    linkedNotebookPath: element.getAttribute("data-nv-linked-path") || "",
    fallbacks: readFallbackReferencesFromElement(element),
    text: element.textContent || "",
    layout: readImageTextLayout(element),
    isInline: source.startsWith("data:image/")
  };
}

export function readImageTextLayout(element) {
  if (!(element instanceof HTMLElement)) return {};
  return {
    width: element.style.width || "",
    height: element.style.height || "",
    minWidth: element.style.minWidth || "",
    minHeight: element.style.minHeight || "",
    margin: element.style.margin || "",
    verticalAlign: element.style.verticalAlign || "",
    display: element.style.display || "",
    float: element.style.cssFloat || "",
    backgroundSize: element.style.backgroundSize || ""
  };
}

export function applyImageTextLayout(element, layout = {}) {
  if (!isImageTextElement(element)) return {};
  const next = {
    width: cleanCssValue(layout.width),
    height: cleanCssValue(layout.height),
    minWidth: cleanCssValue(layout.minWidth),
    minHeight: cleanCssValue(layout.minHeight),
    margin: cleanCssValue(layout.margin),
    verticalAlign: cleanCssValue(layout.verticalAlign),
    display: cleanCssValue(layout.display),
    float: cleanCssValue(layout.float),
    backgroundSize: cleanCssValue(layout.backgroundSize)
  };
  element.style.width = next.width;
  element.style.height = next.height;
  if (next.minWidth) element.style.minWidth = next.minWidth;
  if (next.minHeight) element.style.minHeight = next.minHeight;
  element.style.margin = next.margin;
  if (next.verticalAlign) element.style.verticalAlign = next.verticalAlign;
  if (next.display) element.style.display = next.display;
  element.style.cssFloat = next.float;
  if (next.backgroundSize) element.style.backgroundSize = next.backgroundSize;
  return readImageTextLayout(element);
}

export function unwrapImageTextElement(element) {
  if (!isImageTextElement(element) || !element.parentNode) return false;
  const parent = element.parentNode;
  while (element.firstChild) parent.insertBefore(element.firstChild, element);
  parent.removeChild(element);
  parent.normalize?.();
  return true;
}
