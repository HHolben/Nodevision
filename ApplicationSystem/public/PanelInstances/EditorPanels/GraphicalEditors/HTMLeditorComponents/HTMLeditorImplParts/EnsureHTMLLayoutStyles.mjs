// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/EnsureHTMLLayoutStyles.mjs
// This module implements ensure HTMLLayout Styles behavior for the HTMLeditorImpl feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { createHtmlToolbarPublisher } from "../HtmlToolbarPublishing.mjs";
import { updateToolbarState } from "../../../../../panels/createToolbar.mjs";
import { HTMLeditorImplStyleSection1 } from "./HTMLeditorImplStyleSection1.mjs";
import { HTMLeditorImplStyleSection2, HTMLeditorImplStyleSection3, HTMLeditorImplStyleSection4, HTMLeditorImplStyleSection5, HTMLeditorImplStyleSection6 } from "./HTMLeditorImplStyleSection2.mjs";
import { IMAGE_TEXT_CLASS, IMAGE_TEXT_SELECTED_CLASS } from "../HtmlImageText.mjs";
import { HTMLeditorImplStyleSection7 } from "./HTMLeditorImplStyleSection7.mjs";
import { HTMLeditorImplStyleSection8 } from "./CreateCanvasItemMoveHandler.mjs";

// Ensure HTMLLayout Styles operations.
export const publishHtmlSelectionToolbarState = createHtmlToolbarPublisher(updateToolbarState, () => window.NodevisionState);

export const NOTEBOOK_PREFIX = "/Notebook/";

export const RASTER_IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp", "ico"]);

export const SVG_IMAGE_EXTENSIONS = new Set(["svg"]);

export const NEW_IMAGE_MIME_BY_EXTENSION = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  svg: "image/svg+xml"
};

export const NEW_IMAGE_DEFAULT_DISPLAY_WIDTH = 320;

export const NEW_IMAGE_DEFAULT_DISPLAY_HEIGHT = 240;

export const HTML_TEXT_STYLE_TARGET_CLASS = "nv-html-text-style-target";

export const HTML_DOCUMENT_BACKGROUND_PROPERTIES = ["backgroundColor", "backgroundImage", "backgroundSize", "backgroundPosition", "backgroundRepeat", "backgroundAttachment"];

export const HTML_TEXT_STYLE_SELECTOR = ["p", "h1", "h2", "h3", "h4", "h5", "h6", "span", "a", "li", "dt", "dd", "td", "th", "caption", "blockquote", "pre", "code", "label", "button", "figcaption", ".nv-item-content"].join(",");

export const HTML_TABLE_DIVIDER_HIT_PX = 6;

export const HTML_TABLE_SELECTION_EDGE_PX = 14;

export const HTML_TABLE_SELECTION_DRAG_THRESHOLD_PX = 4;

export const HTML_TABLE_MIN_COLUMN_WIDTH = 32;

export const HTML_TABLE_MIN_ROW_HEIGHT = 24;

export function ensureHTMLLayoutStyles() {
  if (document.getElementById("nv-html-layout-style")) return;
  const style = document.createElement("style");
  style.id = "nv-html-layout-style";
  style.textContent = [HTMLeditorImplStyleSection1, HTMLeditorImplStyleSection2, `${IMAGE_TEXT_CLASS}`, HTMLeditorImplStyleSection3, `${IMAGE_TEXT_CLASS}`, HTMLeditorImplStyleSection4, `${IMAGE_TEXT_CLASS}`, HTMLeditorImplStyleSection5, `${IMAGE_TEXT_SELECTED_CLASS}`, HTMLeditorImplStyleSection6, `${HTML_TEXT_STYLE_TARGET_CLASS}`, HTMLeditorImplStyleSection7, HTMLeditorImplStyleSection8].join("");
  document.head.appendChild(style);
}

export function isNodeInsideEditor(wysiwyg, node) {
  if (!wysiwyg || !node) return false;
  return node === wysiwyg || node instanceof Node && wysiwyg.contains(node);
}

export function isRangeInsideEditor(wysiwyg, range) {
  if (!wysiwyg || !range) return false;
  return isNodeInsideEditor(wysiwyg, range.startContainer) && isNodeInsideEditor(wysiwyg, range.endContainer);
}

export function getCurrentSelectionRangeInEditor(wysiwyg) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!isRangeInsideEditor(wysiwyg, range)) return null;
  return range.cloneRange();
}

export function rememberCurrentSelectionRange(wysiwyg) {
  wysiwyg.__nvHtmlSelection?.capture();
}

export function getRememberedSelectionRange(wysiwyg) {
  return wysiwyg.__nvHtmlSelection?.getRange() || null;
}

export function applySelectionRange(range) {
  if (!range) return false;
  const sel = window.getSelection();
  if (!sel) return false;
  sel.removeAllRanges();
  sel.addRange(range);
  return true;
}

export function insertNodeAtCaret(wysiwyg, node, options = {}) {
  const preferredRange = options?.preferredRange || null;
  const range = (isRangeInsideEditor(wysiwyg, preferredRange) ? preferredRange.cloneRange() : null) || getRememberedSelectionRange(wysiwyg) || getCurrentSelectionRangeInEditor(wysiwyg);
  if (range) {
    try {
      applySelectionRange(range);
      wysiwyg.focus();
      range.deleteContents();
      range.insertNode(node);
      range.setStartAfter(node);
      range.setEndAfter(node);
      applySelectionRange(range);
      rememberCurrentSelectionRange(wysiwyg);
      return;
    } catch (err) {
      console.warn("insertNodeAtCaret fallback append due to range error:", err);
    }
  }
  wysiwyg.appendChild(node);
  const fallbackRange = document.createRange();
  fallbackRange.setStartAfter(node);
  fallbackRange.setEndAfter(node);
  applySelectionRange(fallbackRange);
  rememberCurrentSelectionRange(wysiwyg);
}

export function createRangeAtEditorEnd(wysiwyg) {
  if (!wysiwyg) return null;
  const range = document.createRange();
  range.selectNodeContents(wysiwyg);
  range.collapse(false);
  return range;
}

export function markHtmlEditorDirty(wysiwyg, filePath = "") {
  window.NodevisionState = window.NodevisionState || {};
  wysiwyg.__nvHtmlDirty = true;
  const ownsActive = window.__nvActiveHtmlEditorContext?.editorElement === wysiwyg;
  if (ownsActive) window.NodevisionState.fileIsDirty = true;
  if (filePath && ownsActive) {
    window.NodevisionState.selectedFile = filePath;
    window.NodevisionState.activeEditorFilePath = filePath;
  }
  try {
    wysiwyg?.dispatchEvent?.(new Event("input", {
      bubbles: true
    }));
  } catch {
    // Older browsers may not support Event options in all contexts.
  }
  try {
    window.dispatchEvent(new CustomEvent("nodevision-editor-dirty", {
      detail: {
        filePath: filePath || window.NodevisionState.selectedFile || ""
      }
    }));
  } catch {
    // Non-critical notification only.
  }
}
