// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlBodySerialization.mjs
// This module clones the HTML editing surface and removes transient editor decorations without changing authored whitespace or document source nodes.

import { serializeInlineEquationsForSave } from "/Equation/HtmlInlineEquation.mjs";
import { CIRCUIT_CANVAS_CLASS } from "../CircuitEditorComponents/CircuitReferenceElement.mjs";
import { syncImageTextPresentation, IMAGE_TEXT_SELECTED_CLASS } from "./HtmlImageText.mjs";

// Existing widget serialization stays separate from document-shell preservation.
export function cloneHtmlBodyForSave(wysiwyg) {
  const bodyClone = wysiwyg.cloneNode(true);
  const selectionClasses = ['nv-html-text-style-target', 'nv-selected-image', 'nv-selected-image-item', 'nv-selected-audio'];
  bodyClone.querySelectorAll(selectionClasses.map(name => '.' + name).join(',')).forEach(element => {
    element.classList.remove(...selectionClasses);
    if (!element.getAttribute('class')) element.removeAttribute('class');
  });
  bodyClone.querySelectorAll('img[data-nv-saved-src]').forEach(image => {
    image.setAttribute('src', image.dataset.nvSavedSrc);
    image.removeAttribute('data-nv-saved-src');
    image.removeAttribute('data-nv-blob-url');
  });
  syncImageTextPresentation(bodyClone);
  bodyClone.querySelectorAll("[data-nv-listen-highlight]").forEach((el) => {
    const parent = el.parentNode;
    if (!parent) return;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    parent.removeChild(el);
    parent.normalize?.();
  });
  window.NodevisionPoetry?.normalizeAllPoemBlocks?.(bodyClone);
  bodyClone.querySelectorAll(".nv-poem-controls").forEach((el) => el.remove());
  bodyClone.querySelectorAll(".nv-editor-only").forEach((el) => el.remove());
  bodyClone.querySelectorAll(".nv-selected-circuit").forEach((el) => {
    el.classList.remove("nv-selected-circuit");
    if (!el.getAttribute("class")) el.removeAttribute("class");
  });
  bodyClone.querySelectorAll(`.${IMAGE_TEXT_SELECTED_CLASS}`).forEach((el) => {
    el.classList.remove(IMAGE_TEXT_SELECTED_CLASS);
    if (!el.getAttribute("class")) el.removeAttribute("class");
  });
  bodyClone.querySelectorAll(`canvas.${CIRCUIT_CANVAS_CLASS}`).forEach((canvas) => {
    canvas.removeAttribute("width");
    canvas.removeAttribute("height");
    canvas.textContent = "";
  });
  bodyClone.querySelectorAll("[data-nv-interactive]").forEach((el) => {
    el.removeAttribute("data-nv-interactive");
  });
  bodyClone.querySelectorAll("[data-nv-resizable]").forEach((el) => {
    el.removeAttribute("data-nv-resizable");
  });
  bodyClone.querySelectorAll("[data-nv-cartoon-resize-handle]").forEach((el) => el.remove());
  bodyClone.querySelectorAll("[data-nv-cartoon-selected]").forEach((el) => {
    el.removeAttribute("data-nv-cartoon-selected");
  });
  bodyClone.querySelectorAll("[data-nv-cartoon-panel], [data-nv-cartoon-layout], [data-nv-cartoon-split], [data-nv-cartoon-frame]").forEach((el) => {
    el.removeAttribute("contenteditable");
  });
  bodyClone.querySelectorAll(".nv-html-table-selected-cell, .nv-html-table-selection-anchor, .nv-html-table-selection-focus, [data-nv-html-table-selected]").forEach((el) => {
    el.classList.remove("nv-html-table-selected-cell", "nv-html-table-selection-anchor", "nv-html-table-selection-focus");
    el.removeAttribute("data-nv-html-table-selected");
    if (!el.getAttribute("class")) el.removeAttribute("class");
  });
  serializeInlineEquationsForSave(bodyClone);
  return bodyClone;
}
