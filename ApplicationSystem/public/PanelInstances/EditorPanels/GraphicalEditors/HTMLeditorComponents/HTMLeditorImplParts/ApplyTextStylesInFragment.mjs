// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/ApplyTextStylesInFragment.mjs
// This module implements apply Text Styles In Fragment behavior for the HTMLeditorImpl feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { applyTextStylesToElement, normalizeTextStyleProperties, unwrapStyleEmptySpans } from "./ApplyFontStackToFragment.mjs";
import { HTML_TEXT_STYLE_TARGET_CLASS, HTML_TEXT_STYLE_SELECTOR, markHtmlEditorDirty, rememberCurrentSelectionRange, applySelectionRange, getCurrentSelectionRangeInEditor } from "./EnsureHTMLLayoutStyles.mjs";
import { presentHtmlClass } from "/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlPresentation.mjs";
import { nearestStyleTargetForRange, restoreEditorSelectionForStyle } from "./BasenameWithoutFontExtension.mjs";

// Apply Text Styles In Fragment operations.
export function applyTextStylesInFragment(fragment, styles = {}) {
  const textNodes = [];
  const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue) return NodeFilter.FILTER_REJECT;
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_ACCEPT;
      if (["STYLE", "SCRIPT"].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
      if (parent.closest?.("[contenteditable='false']")) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  while (walker.nextNode()) textNodes.push(walker.currentNode);
  for (const node of textNodes) {
    const span = document.createElement("span");
    applyTextStylesToElement(span, styles);
    node.parentNode.insertBefore(span, node);
    span.appendChild(node);
  }
  if (!textNodes.length && fragment.childNodes.length) {
    const span = document.createElement("span");
    applyTextStylesToElement(span, styles);
    while (fragment.firstChild) span.appendChild(fragment.firstChild);
    fragment.appendChild(span);
  }
}

export function clearTextStyleTarget(wysiwyg) {
  if (!wysiwyg) return;
  wysiwyg.querySelectorAll(`.${HTML_TEXT_STYLE_TARGET_CLASS}`).forEach(el => {
    presentHtmlClass(el, HTML_TEXT_STYLE_TARGET_CLASS, false);
    if (!el.getAttribute("class")) el.removeAttribute("class");
  });
}

export function findTextStyleTargetFromRange(wysiwyg, range) {
  if (!range || !wysiwyg) return null;
  const node = range.commonAncestorContainer;
  const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  if (!element || !wysiwyg.contains(element)) return null;
  const target = element.closest?.(HTML_TEXT_STYLE_SELECTOR) || nearestStyleTargetForRange(wysiwyg, range);
  if (!target || !wysiwyg.contains(target)) return null;
  if (target === wysiwyg) return null;
  return target instanceof HTMLElement ? target : null;
}

export function updateTextStyleSelectionState(wysiwyg, target = null) {
  clearTextStyleTarget(wysiwyg);
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.activeHtmlTextStyleTarget = target || null;
  window.NodevisionState.htmlTextSelected = Boolean(target);
  if (target instanceof HTMLElement) presentHtmlClass(target, HTML_TEXT_STYLE_TARGET_CLASS, true);
}

export function selectTextStyleTargetForCurrentSelection(wysiwyg) {
  const range = restoreEditorSelectionForStyle(wysiwyg);
  if (!range) throw new Error("Select text in the HTML editor first.");
  const target = findTextStyleTargetFromRange(wysiwyg, range);
  updateTextStyleSelectionState(wysiwyg, target);
  return target;
}

export function applyTextStylesToWysiwygSelection(wysiwyg, styles = {}) {
  const normalized = normalizeTextStyleProperties(styles);
  if (!Object.keys(normalized).length) return;
  const range = restoreEditorSelectionForStyle(wysiwyg);
  if (!range) throw new Error("Select text in the HTML editor first.");
  if (range.collapsed) {
    const target = selectTextStyleTargetForCurrentSelection(wysiwyg) || nearestStyleTargetForRange(wysiwyg, range);
    if (!target) throw new Error("No editable text target found.");
    applyTextStylesToElement(target, normalized);
    updateTextStyleSelectionState(wysiwyg, target);
    markHtmlEditorDirty(wysiwyg);
    rememberCurrentSelectionRange(wysiwyg);
    return;
  }
  const fragment = range.extractContents();
  applyTextStylesInFragment(fragment, normalized);
  const container = document.createElement("span");
  container.setAttribute("data-nv-temp-text-style-selection", "");
  container.appendChild(fragment);
  range.insertNode(container);
  const firstInserted = container.firstChild;
  const lastInserted = container.lastChild;
  while (container.firstChild) container.parentNode.insertBefore(container.firstChild, container);
  if (firstInserted && lastInserted && firstInserted.parentNode && lastInserted.parentNode) {
    const newRange = document.createRange();
    newRange.setStartBefore(firstInserted);
    newRange.setEndAfter(lastInserted);
    applySelectionRange(newRange);
  }
  container.remove();
  const target = findTextStyleTargetFromRange(wysiwyg, getCurrentSelectionRangeInEditor(wysiwyg));
  updateTextStyleSelectionState(wysiwyg, target);
  rememberCurrentSelectionRange(wysiwyg);
  markHtmlEditorDirty(wysiwyg);
}

export function removeTextStylesFromElement(el) {
  if (!(el instanceof HTMLElement)) return;
  el.style.color = "";
  el.style.backgroundColor = "";
  el.style.webkitTextStrokeColor = "";
  el.style.webkitTextStrokeWidth = "";
  el.style.textShadow = "";
  if (el.getAttribute("style") === "") el.removeAttribute("style");
}

export function removeTextStylesInTree(root) {
  if (root instanceof HTMLElement) removeTextStylesFromElement(root);
  Array.from(root.querySelectorAll?.("[style]") || []).forEach(removeTextStylesFromElement);
  unwrapStyleEmptySpans(root);
}
