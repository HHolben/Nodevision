// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlImageText.mjs
// Helpers for rendering real DOM text with an image-backed visual presentation.

import {
  applyFallbackReferencesToElement,
  readFallbackReferencesFromElement,
} from "/utils/referenceFallbacks.mjs";

export const IMAGE_TEXT_CLASS = "nodevision-image-text";
export const IMAGE_TEXT_SELECTED_CLASS = "nv-selected-image-text";
export const IMAGE_TEXT_SOURCE_ATTR = "data-nodevision-image-src";
export const IMAGE_TEXT_ENABLED_ATTR = "data-nodevision-image-text";
export const IMAGE_TEXT_SELECTOR = `.${IMAGE_TEXT_CLASS}, [${IMAGE_TEXT_ENABLED_ATTR}="true"], [${IMAGE_TEXT_SOURCE_ATTR}]`;

const BLOCK_TAGS = new Set([
  "ADDRESS", "ARTICLE", "ASIDE", "BLOCKQUOTE", "CANVAS", "DD", "DIV", "DL", "DT",
  "FIELDSET", "FIGCAPTION", "FIGURE", "FOOTER", "FORM", "H1", "H2", "H3", "H4",
  "H5", "H6", "HEADER", "HR", "LI", "MAIN", "NAV", "OL", "P", "PRE", "SECTION",
  "TABLE", "TBODY", "TD", "TFOOT", "TH", "THEAD", "TR", "UL",
]);

const SAFE_CSS_VALUE = /^[^;{}<>]*$/;

function cleanCssValue(value = "") {
  const text = String(value || "").trim();
  if (!text || !SAFE_CSS_VALUE.test(text)) return "";
  return text;
}

function cssUrlToken(value = "") {
  const escaped = String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, "\\\"")
    .replace(/\n/g, "\\A ")
    .replace(/\r/g, "");
  return `url("${escaped}")`;
}

export function imageTextStyleForSource(source = "") {
  const src = String(source || "").trim();
  return src ? cssUrlToken(src) : "";
}

export function isImageTextElement(node) {
  return Boolean(node instanceof HTMLElement && (
    node.classList.contains(IMAGE_TEXT_CLASS) ||
    node.getAttribute(IMAGE_TEXT_ENABLED_ATTR) === "true" ||
    node.hasAttribute(IMAGE_TEXT_SOURCE_ATTR)
  ));
}

export function findImageTextElementFromNode(wysiwyg, node) {
  if (!wysiwyg || !node) return null;
  const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  const match = element?.closest?.(IMAGE_TEXT_SELECTOR) || null;
  if (!match || !wysiwyg.contains(match)) return null;
  return isImageTextElement(match) ? match : null;
}

export function findImageTextElementFromRange(wysiwyg, range) {
  if (!range || !wysiwyg) return null;
  return findImageTextElementFromNode(wysiwyg, range.commonAncestorContainer) ||
    findImageTextElementFromNode(wysiwyg, range.startContainer) ||
    findImageTextElementFromNode(wysiwyg, range.endContainer);
}

export function rangeContainsBlockContent(range) {
  if (!range || range.collapsed) return false;
  const fragment = range.cloneContents();
  const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_ELEMENT);
  let node = walker.nextNode();
  while (node) {
    if (BLOCK_TAGS.has(String(node.tagName || "").toUpperCase())) return true;
    node = walker.nextNode();
  }
  return false;
}

export function getImageTextRangeError(range) {
  if (!range) return "Select text in the HTML editor first.";
  if (range.collapsed || !String(range.toString() || "").length) return "Select non-empty text first.";
  if (rangeContainsBlockContent(range)) return "Image text can only wrap inline text selections.";
  return "";
}

export function applyImageTextPresentation(element, insertion = {}) {
  if (!(element instanceof HTMLElement)) return null;
  const source = String(insertion?.src || "").trim();
  if (!source) return null;

  element.classList.add(IMAGE_TEXT_CLASS);
  element.setAttribute(IMAGE_TEXT_ENABLED_ATTR, "true");
  element.setAttribute(IMAGE_TEXT_SOURCE_ATTR, source);
  if (!element.hasAttribute("data-nodevision-link-label")) {
    element.setAttribute("data-nodevision-link-label", element.textContent || "Image text");
  }
  if (Array.isArray(insertion.fallbacks)) {
    applyFallbackReferencesToElement(element, insertion.fallbacks, { primary: source });
  }
  if (insertion.linkedNotebookPath) {
    element.setAttribute("data-nv-linked-path", insertion.linkedNotebookPath);
  } else {
    element.removeAttribute("data-nv-linked-path");
  }

  element.style.setProperty("--nodevision-image-text-src", imageTextStyleForSource(source));
  element.style.backgroundImage = "var(--nodevision-image-text-src)";
  element.style.backgroundRepeat = "no-repeat";
  element.style.backgroundPosition = "center";
  if (!element.style.backgroundSize) element.style.backgroundSize = "contain";
  element.style.color = "transparent";
  element.style.textShadow = "none";
  element.style.display = element.style.display || "inline-block";
  element.style.verticalAlign = element.style.verticalAlign || "baseline";
  element.style.minWidth = element.style.minWidth || "1em";
  element.style.minHeight = element.style.minHeight || "1em";
  element.style.userSelect = "text";
  return element;
}

export function syncImageTextPresentation(root, options = {}) {
  if (!root?.querySelectorAll) return;
  const resolveNotebookPath = typeof options.resolveNotebookPath === "function"
    ? options.resolveNotebookPath
    : null;
  root.querySelectorAll(IMAGE_TEXT_SELECTOR).forEach((element) => {
    const source = element.getAttribute(IMAGE_TEXT_SOURCE_ATTR) || "";
    if (!source) return;
    const linkedNotebookPath = resolveNotebookPath
      ? resolveNotebookPath(source, element) || ""
      : element.getAttribute("data-nv-linked-path") || "";
    applyImageTextPresentation(element, {
      src: source,
      linkedNotebookPath,
    });
  });
}

export function wrapRangeWithImageText(range, insertion, options = {}) {
  const error = getImageTextRangeError(range);
  if (error) throw new Error(error);

  const expectedText = String(options.expectedText ?? range.toString() ?? "");
  if (expectedText && String(range.toString() || "") !== expectedText) {
    throw new Error("The selected text changed while choosing an image. Select it again and retry.");
  }

  const fragment = range.extractContents();
  const span = document.createElement("span");
  while (fragment.firstChild) span.appendChild(fragment.firstChild);
  applyImageTextPresentation(span, insertion);
  range.insertNode(span);

  const nextRange = document.createRange();
  nextRange.selectNode(span);
  const sel = window.getSelection();
  if (sel) {
    sel.removeAllRanges();
    sel.addRange(nextRange);
  }
  return span;
}

export function clearImageTextSelection(wysiwyg) {
  if (!wysiwyg?.querySelectorAll) return;
  wysiwyg.querySelectorAll(`.${IMAGE_TEXT_SELECTED_CLASS}`).forEach((element) => {
    element.classList.remove(IMAGE_TEXT_SELECTED_CLASS);
    if (!element.getAttribute("class")) element.removeAttribute("class");
  });
}

export function selectImageTextElement(wysiwyg, element) {
  clearImageTextSelection(wysiwyg);
  if (!isImageTextElement(element)) return null;
  element.classList.add(IMAGE_TEXT_SELECTED_CLASS);
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
    isInline: source.startsWith("data:image/"),
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
    backgroundSize: element.style.backgroundSize || "",
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
    backgroundSize: cleanCssValue(layout.backgroundSize),
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
