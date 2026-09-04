// Nodevision/ApplicationSystem/public/ToolbarCallbacks/edit/sourceHyperlinkTools.mjs
// This module detects and edits literal HTML anchor tags in source-style HTML and PHP editors.

import {
  parseFallbackAttributesFromTagSource,
  replaceFallbackAttributesInHtmlTag
} from "../../utils/referenceFallbacks.mjs";

const SOURCE_LINK_MODES = new Set(["CodeEditing", "PHPediting"]);
const SOURCE_LINK_EXTENSIONS = new Set(["html", "htm", "xhtml", "php"]);
const ANCHOR_PATTERN = /<a\b[^>]*\bhref\s*=\s*(["'])(.*?)\1[^>]*>[\s\S]*?<\/a>/gi;
const HREF_PATTERN = /\bhref\s*=\s*(["'])(.*?)\1/i;

function currentMode() {
  return String(window.NodevisionState?.currentMode || window.currentMode || "");
}

function normalizePath(value = "") {
  return String(value || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/[?#].*$/, "")
    .replace(/^\/+/, "")
    .replace(/^Notebook\//i, "");
}

function activeFilePath() {
  const candidates = [
    window.NodevisionState?.activeEditorFilePath,
    window.__nvCodeEditorActivePath,
    window.currentActiveFilePath,
    window.selectedFilePath,
    window.NodevisionState?.selectedFile,
  ];
  for (const value of candidates) {
    const path = normalizePath(value);
    if (path) return path;
  }
  return "";
}

function activeFileCanContainLinks() {
  const ext = (activeFilePath().split(".").pop() || "").toLowerCase();
  return SOURCE_LINK_EXTENSIONS.has(ext);
}

function textFromEditor() {
  const mode = currentMode();
  if (!SOURCE_LINK_MODES.has(mode) || !activeFileCanContainLinks()) return null;
  if (mode === "CodeEditing" && window.monacoEditor?.getModel) {
    const editor = window.monacoEditor;
    const model = editor.getModel();
    const selection = editor.getSelection?.();
    if (!model || !selection) return null;
    return {
      kind: "monaco",
      editor,
      model,
      text: model.getValue(),
      start: model.getOffsetAt(selection.getStartPosition()),
      end: model.getOffsetAt(selection.getEndPosition()),
      filePath: activeFilePath(),
    };
  }
  if (mode === "PHPediting") {
    const input = document.querySelector(".nv-php-input");
    if (!(input instanceof HTMLTextAreaElement)) return null;
    return {
      kind: "textarea",
      input,
      text: input.value,
      start: input.selectionStart,
      end: input.selectionEnd,
      filePath: activeFilePath(),
    };
  }
  return null;
}

function selectionTouchesRange(start, end, rangeStart, rangeEnd) {
  if (start === end) return start >= rangeStart && start <= rangeEnd;
  return end > rangeStart && start < rangeEnd;
}

function stripTags(value = "") {
  return String(value || "").replace(/<[^>]*>/g, "").trim();
}

function anchorContext(match, textRange) {
  const source = match[0];
  const hrefMatch = source.match(HREF_PATTERN);
  if (!hrefMatch) return null;
  const start = match.index;
  const end = start + source.length;
  const openEnd = source.indexOf(">");
  const closeStart = source.toLowerCase().lastIndexOf("</a>");
  const openTagSource = openEnd >= 0 ? source.slice(0, openEnd + 1) : source;
  return {
    ...textRange,
    source,
    href: hrefMatch[2] || "",
    quote: hrefMatch[1] || '"',
    range: { start, end },
    fallbacks: parseFallbackAttributesFromTagSource(openTagSource, start).map((fallback) => fallback.rawTarget),
    innerText: openEnd >= 0 && closeStart > openEnd ? stripTags(source.slice(openEnd + 1, closeStart)) : "",
  };
}

export function findAnchorInSource(text = "", start = 0, end = start) {
  ANCHOR_PATTERN.lastIndex = 0;
  let match = ANCHOR_PATTERN.exec(String(text || ""));
  while (match) {
    const matchStart = match.index;
    const matchEnd = matchStart + match[0].length;
    if (selectionTouchesRange(start, end, matchStart, matchEnd)) {
      return anchorContext(match, {});
    }
    match = ANCHOR_PATTERN.exec(String(text || ""));
  }
  return null;
}

export function findSourceHyperlinkContext() {
  const textRange = textFromEditor();
  if (!textRange) return null;
  const anchor = findAnchorInSource(textRange.text, textRange.start, textRange.end);
  return anchor ? { ...textRange, ...anchor, text: anchor.innerText || anchor.href } : null;
}

function escapeAttribute(value = "", quote = '"') {
  const escaped = String(value).replace(/[&<>]/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
  }[ch]));
  return quote === "'" ? escaped.replace(/'/g, "&#39;") : escaped.replace(/"/g, "&quot;");
}

function escapeText(value = "") {
  return String(value).replace(/[&<>]/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
  }[ch]));
}

function replaceAnchorSource(context, href, text, fallbacks = null) {
  const quote = context.quote || '"';
  let source = String(context.source || "").replace(HREF_PATTERN, "href=" + quote + escapeAttribute(href, quote) + quote);
  if (Array.isArray(fallbacks)) {
    const openEnd = source.indexOf(">");
    if (openEnd >= 0) {
      const openTag = source.slice(0, openEnd + 1);
      source = replaceFallbackAttributesInHtmlTag(openTag, fallbacks, { primary: href }) + source.slice(openEnd + 1);
    }
  }
  if (text !== null && text !== undefined && text !== context.innerText) {
    source = source.replace(/(<a\b[^>]*>)[\s\S]*?(<\/a>)/i, "$1" + escapeText(text) + "$2");
  }
  return source;
}

export function applySourceHyperlinkEdit(context, { href = "", text = null, fallbacks = null } = {}) {
  if (!context?.range) return false;
  const replacement = replaceAnchorSource(context, href, text, fallbacks);
  if (context.kind === "monaco" && context.editor?.executeEdits && context.model?.getPositionAt) {
    const start = context.model.getPositionAt(context.range.start);
    const end = context.model.getPositionAt(context.range.end);
    const range = new window.monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column);
    context.editor.executeEdits("edit-hyperlink", [{ range, text: replacement, forceMoveMarkers: true }]);
    context.editor.setSelection?.(range);
    context.editor.focus?.();
    window.__nvCodeEditorDirty = true;
    return true;
  }
  if (context.kind === "textarea" && context.input instanceof HTMLTextAreaElement) {
    const input = context.input;
    input.value = input.value.slice(0, context.range.start) + replacement + input.value.slice(context.range.end);
    input.setSelectionRange(context.range.start, context.range.start + replacement.length);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.focus();
    return true;
  }
  return false;
}
