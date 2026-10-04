// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/ApplyFontStackToFragment.mjs
// This module implements apply Font Stack To Fragment behavior for the HTMLeditorImpl feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { buildFontStack } from "./UpdateStoredDocumentBackgroundStyle.mjs";
import { restoreEditorSelectionForStyle, nearestStyleTargetForRange } from "./BasenameWithoutFontExtension.mjs";
import { markHtmlEditorDirty, rememberCurrentSelectionRange, applySelectionRange } from "./EnsureHTMLLayoutStyles.mjs";

// Apply Font Stack To Fragment operations.
export function applyFontStackToFragment(fragment, fontStack) {
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
    span.style.fontFamily = fontStack;
    node.parentNode.insertBefore(span, node);
    span.appendChild(node);
  }
  if (!textNodes.length && fragment.childNodes.length) {
    const span = document.createElement("span");
    span.style.fontFamily = fontStack;
    while (fragment.firstChild) span.appendChild(fragment.firstChild);
    fragment.appendChild(span);
  }
}

export function applyFontFamilyToWysiwygSelection(wysiwyg, fontFamilyOrStack, fallback = "") {
  const fontStack = buildFontStack(fontFamilyOrStack, fallback);
  const range = restoreEditorSelectionForStyle(wysiwyg);
  if (!range) throw new Error("Select text in the HTML editor first.");
  if (range.collapsed) {
    const target = nearestStyleTargetForRange(wysiwyg, range);
    if (!target) throw new Error("No editable text target found.");
    target.style.fontFamily = fontStack;
    markHtmlEditorDirty(wysiwyg);
    rememberCurrentSelectionRange(wysiwyg);
    return;
  }
  const fragment = range.extractContents();
  applyFontStackToFragment(fragment, fontStack);
  const container = document.createElement("span");
  container.setAttribute("data-nv-temp-font-selection", "");
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
  rememberCurrentSelectionRange(wysiwyg);
  markHtmlEditorDirty(wysiwyg);
}

export function removeFontFamilyFromElement(el) {
  if (!(el instanceof Element)) return;
  if (el.style?.fontFamily) el.style.fontFamily = "";
  if (el.getAttribute("style") === "") el.removeAttribute("style");
  if (el.tagName === "FONT" && el.hasAttribute("face")) el.removeAttribute("face");
}

export function unwrapStyleEmptySpans(root) {
  const spans = Array.from(root.querySelectorAll?.("span") || []);
  for (const span of spans) {
    if (span.attributes.length > 0) continue;
    const parent = span.parentNode;
    if (!parent) continue;
    while (span.firstChild) parent.insertBefore(span.firstChild, span);
    span.remove();
  }
}

export function removeFontFamilyInTree(root) {
  if (root instanceof Element) removeFontFamilyFromElement(root);
  const elements = Array.from(root.querySelectorAll?.("[style],font") || []);
  elements.forEach(removeFontFamilyFromElement);
  unwrapStyleEmptySpans(root);
}

export function removeFontFamilyFromWysiwygSelection(wysiwyg) {
  const range = restoreEditorSelectionForStyle(wysiwyg);
  if (!range) throw new Error("Select text in the HTML editor first.");
  if (range.collapsed) {
    const target = nearestStyleTargetForRange(wysiwyg, range);
    if (target) removeFontFamilyFromElement(target);
    markHtmlEditorDirty(wysiwyg);
    rememberCurrentSelectionRange(wysiwyg);
    return;
  }
  const fragment = range.extractContents();
  removeFontFamilyInTree(fragment);
  const container = document.createElement("span");
  container.setAttribute("data-nv-temp-font-selection", "");
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
  rememberCurrentSelectionRange(wysiwyg);
  markHtmlEditorDirty(wysiwyg);
}

export const HTML_TEXT_STYLE_PROPERTIES = new Set(["color", "backgroundColor", "webkitTextStrokeColor", "webkitTextStrokeWidth", "textShadow"]);

export function normalizeTextStyleProperties(styles = {}) {
  const normalized = {};
  for (const [property, value] of Object.entries(styles || {})) {
    if (!HTML_TEXT_STYLE_PROPERTIES.has(property)) continue;
    normalized[property] = String(value ?? "").trim();
  }
  return normalized;
}

export function applyTextStylesToElement(el, styles = {}) {
  if (!(el instanceof HTMLElement)) return;
  const normalized = normalizeTextStyleProperties(styles);
  for (const [property, value] of Object.entries(normalized)) {
    el.style[property] = value;
  }
  if (el.getAttribute("style") === "") el.removeAttribute("style");
}
