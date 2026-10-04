// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/RemoveTextStylesFromWysiwygSelection.mjs
// This module implements remove Text Styles From Wysiwyg Selection behavior for the HTMLeditorImpl feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { restoreEditorSelectionForStyle, nearestStyleTargetForRange, parseFontFaceEntries, inferGoogleFontFamilyFromHref, ensureFontFaceRule, ensureFontStylesheetLink } from "./BasenameWithoutFontExtension.mjs";
import { selectTextStyleTargetForCurrentSelection, removeTextStylesFromElement, updateTextStyleSelectionState, removeTextStylesInTree, findTextStyleTargetFromRange } from "./ApplyTextStylesInFragment.mjs";
import { markHtmlEditorDirty, rememberCurrentSelectionRange, applySelectionRange, getCurrentSelectionRangeInEditor, getRememberedSelectionRange } from "./EnsureHTMLLayoutStyles.mjs";
import { sanitizeSingleFontFamily } from "./HtmlTableSelectionGrid.mjs";
import { quoteFontFamilyIfNeeded } from "./UpdateStoredDocumentBackgroundStyle.mjs";
import { applyFontFamilyToWysiwygSelection } from "./ApplyFontStackToFragment.mjs";
import { markHtmlEditorChrome } from "../HtmlSourceProvenance.mjs";

// Remove Text Styles From Wysiwyg Selection operations.
export function removeTextStylesFromWysiwygSelection(wysiwyg) {
  const range = restoreEditorSelectionForStyle(wysiwyg);
  if (!range) throw new Error("Select text in the HTML editor first.");
  if (range.collapsed) {
    const target = selectTextStyleTargetForCurrentSelection(wysiwyg) || nearestStyleTargetForRange(wysiwyg, range);
    if (target) removeTextStylesFromElement(target);
    updateTextStyleSelectionState(wysiwyg, target);
    markHtmlEditorDirty(wysiwyg);
    rememberCurrentSelectionRange(wysiwyg);
    return;
  }
  const fragment = range.extractContents();
  removeTextStylesInTree(fragment);
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

export function readTextStyleSelection(wysiwyg) {
  const range = getCurrentSelectionRangeInEditor(wysiwyg) || getRememberedSelectionRange(wysiwyg);
  const target = findTextStyleTargetFromRange(wysiwyg, range) || window.NodevisionState?.activeHtmlTextStyleTarget || null;
  if (!(target instanceof HTMLElement)) return {};
  const computed = window.getComputedStyle(target);
  return {
    color: target.style.color || computed.color || "",
    backgroundColor: target.style.backgroundColor || computed.backgroundColor || "",
    outlineColor: target.style.webkitTextStrokeColor || computed.webkitTextStrokeColor || "",
    outlineWidth: target.style.webkitTextStrokeWidth || computed.webkitTextStrokeWidth || "",
    shadow: target.style.textShadow || computed.textShadow || ""
  };
}

export function collectDocumentFonts(headContainer, wysiwyg) {
  const fonts = [];
  const add = (family, stack = "") => {
    const safe = sanitizeSingleFontFamily(family || "");
    if (!safe) return;
    if (fonts.some(item => item.family === safe)) return;
    fonts.push({
      family: safe,
      label: safe,
      stack: stack || quoteFontFamilyIfNeeded(safe)
    });
  };
  parseFontFaceEntries(headContainer).forEach(entry => add(entry.family));
  Array.from(headContainer?.querySelectorAll?.("link[data-nodevision-font-stylesheet],link[rel~='stylesheet']") || []).forEach(link => add(link.getAttribute("data-nodevision-font-family") || inferGoogleFontFamilyFromHref(link.getAttribute("href") || "")));
  Array.from(wysiwyg?.querySelectorAll?.("[style]") || []).forEach(el => {
    const stack = el.style?.fontFamily || "";
    if (!stack) return;
    const first = stack.split(",")[0].replace(/^['"]|['"]$/g, "");
    add(first, stack);
  });
  return fonts;
}

export function applyFontReferenceToWysiwygSelection({
  wysiwyg,
  headContainer,
  filePath = "",
  ref = {}
} = {}) {
  if (!ref || typeof ref !== "object") throw new Error("Missing font reference.");
  let family = "";
  let fallback = ref.fallback || "sans-serif";
  if (ref.kind === "notebook-font") {
    family = ensureFontFaceRule(headContainer, {
      src: ref.src,
      format: ref.format,
      sourceName: ref.sourceName || ref.notebookPath || ref.src,
      fontFamily: ref.fontFamily,
      sourceKind: "notebook"
    });
  } else if (ref.kind === "resource-font-file") {
    family = ensureFontFaceRule(headContainer, {
      src: ref.src || ref.url,
      format: ref.format,
      sourceName: ref.sourceName || ref.resourceId || ref.src,
      fontFamily: ref.fontFamily,
      sourceKind: "resource"
    });
  } else if (ref.kind === "web-font-file") {
    family = ensureFontFaceRule(headContainer, {
      src: ref.src || ref.url,
      format: ref.format,
      sourceName: ref.sourceName || ref.url || ref.src,
      fontFamily: ref.fontFamily,
      sourceKind: "web"
    });
  } else if (ref.kind === "web-font-stylesheet") {
    family = sanitizeSingleFontFamily(ref.fontFamily || inferGoogleFontFamilyFromHref(ref.href || ""));
    if (!family) throw new Error("Missing web font family name.");
    ensureFontStylesheetLink(headContainer, {
      href: ref.href,
      fontFamily: family
    });
  } else {
    throw new Error("Unsupported font reference.");
  }
  applyFontFamilyToWysiwygSelection(wysiwyg, quoteFontFamilyIfNeeded(family), fallback);
  markHtmlEditorDirty(wysiwyg, filePath);
  return family;
}

export function getActiveLayoutCanvas(wysiwyg) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const node = sel.getRangeAt(0).commonAncestorContainer;
  const el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  const canvas = el && el.closest ? el.closest(".nv-layout-canvas") : null;
  return canvas && wysiwyg.contains(canvas) ? canvas : null;
}

export function markEditorOnly(el) {
  if (!el) return el;
  markHtmlEditorChrome(el);
  el.classList.add("nv-editor-only");
  el.setAttribute("data-editor-only", "true");
  return el;
}
