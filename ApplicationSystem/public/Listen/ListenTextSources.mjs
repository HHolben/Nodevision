// Nodevision/ApplicationSystem/public/Listen/ListenTextSources.mjs
// This module gathers readable text from active HTML and PDF panels and returns offset metadata so the rendered page reader can map speech positions back to visible content.

const READABLE_EXTENSIONS = new Set(["html", "htm", "xhtml", "pdf"]);
const PDF_TEXT_CHUNK_SELECTOR = ".nv-pdf-text-chunk[data-nv-listen-start][data-nv-listen-end]";
const WORD_PATTERN = /[\p{L}\p{N}\p{M}]+(?:[\u0027\u2019][\p{L}\p{N}\p{M}]+)*/u;

// Path helpers.
export function normalizeListenPath(value = "") {
  let cleaned = String(value || "").trim();
  if (!cleaned) return "";
  try {
    const origin = globalThis.window?.location?.origin || "http://localhost";
    const parsed = new URL(cleaned, origin);
    cleaned = parsed.pathname || cleaned;
  } catch {
    // Local path-like values are valid inputs here.
  }
  return cleaned
    .replaceAll("\\", "/")
    .replace(/[?#].*$/, "")
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/^\/+/, "")
    .replace(/^Notebook\/+/i, "")
    .trim();
}

export function extensionFromListenPath(value = "") {
  const clean = normalizeListenPath(value).toLowerCase();
  const name = clean.split("/").pop() || clean;
  return name.includes(".") ? (name.split(".").pop() || "") : "";
}

export function activeFileIsReadablePage(value = "") {
  return READABLE_EXTENSIONS.has(extensionFromListenPath(value));
}

function ownerWindow(doc) {
  return doc?.defaultView || globalThis.window || globalThis;
}

function activeFilePath() {
  const state = window.NodevisionState || {};
  const mode = String(state.currentMode || "");
  const viewerModeActive = mode === "HTMLviewing" || mode === "PDF Viewing" || mode.endsWith("viewing") || mode.endsWith("Viewing");
  const candidates = viewerModeActive ? [
    state.activeFileViewPath,
    window.currentActiveFilePath,
    window.selectedFilePath,
    state.selectedFile,
    window.ActiveNode,
    window.filePath,
    state.activeEditorFilePath,
  ] : [
    state.activeEditorFilePath,
    window.currentActiveFilePath,
    window.selectedFilePath,
    state.selectedFile,
    window.ActiveNode,
    window.filePath,
    state.activeFileViewPath,
  ];
  for (const candidate of candidates) {
    const path = normalizeListenPath(candidate);
    if (path) return path;
  }
  return "";
}

function activeCell() {
  if (window.activeCell?.isConnected) return window.activeCell;
  return document.querySelector(".panel-cell.active-panel") || null;
}

// HTML source collection.
function shouldSkipTextParent(parent) {
  if (!parent?.closest) return true;
  const skipped = parent.closest([
    "script", "style", "noscript", "template", "option", "select",
    "textarea", "input", "button", "[hidden]", "[aria-hidden=true]",
    "[data-nv-listen-ignore=true]", "[data-nv-pdf-ui]", "#global-toolbar", "#sub-toolbar",
  ].join(","));
  if (skipped) return true;
  try {
    const style = ownerWindow(parent.ownerDocument).getComputedStyle(parent);
    return style?.display === "none" || style?.visibility === "hidden" || style?.visibility === "collapse" || style?.opacity === "0";
  } catch {
    return false;
  }
}

function appendTextSegment(source, rawText, segment) {
  const text = String(rawText || "");
  if (!text.trim()) return;
  if (source.text && !/\s$/.test(source.text) && !/^\s/.test(text)) source.text += " ";
  const start = source.text.length;
  source.text += text;
  source.segments.push({ ...segment, start, end: source.text.length });
  if (!/\s$/.test(source.text)) source.text += " ";
}

function collectDomTextSource(root, label = "Rendered page") {
  const doc = root?.ownerDocument || document;
  const filter = ownerWindow(doc).NodeFilter || NodeFilter;
  const source = { kind: "html", label, root, doc, text: "", segments: [] };
  const walker = doc.createTreeWalker(root, filter.SHOW_TEXT, {
    acceptNode(node) {
      if (!String(node.nodeValue || "").trim()) return filter.FILTER_REJECT;
      if (shouldSkipTextParent(node.parentElement)) return filter.FILTER_REJECT;
      return filter.FILTER_ACCEPT;
    },
  });
  let node = walker.nextNode();
  while (node) {
    appendTextSegment(source, node.nodeValue, { node });
    node = walker.nextNode();
  }
  source.refresh = () => collectDomTextSource(root, label);
  return source;
}

function readableHtmlEditorRoot(cell) {
  const contextRoot = window.HTMLWysiwygTools?.getEditorElement?.();
  if (contextRoot?.isConnected && (!cell || cell.contains(contextRoot))) return contextRoot;
  return cell?.querySelector?.("#wysiwyg[contenteditable=true], [data-nv-html-editor-root=true]") || null;
}

function readableHtmlViewerRoot(cell) {
  const iframe = cell?.querySelector?.("#element-view iframe, iframe") || document.querySelector(".panel-cell.active-panel #element-view iframe, .panel-cell.active-panel iframe");
  if (!iframe) return null;
  try {
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    return doc?.body || doc?.documentElement || null;
  } catch {
    return null;
  }
}

// PDF source collection.
function collectPdfTextSource(root) {
  const doc = root?.ownerDocument || document;
  const source = { kind: "pdf", label: "PDF page", root, doc, text: "", segments: [] };
  const chunks = Array.from(root.querySelectorAll?.(PDF_TEXT_CHUNK_SELECTOR) || [])
    .sort((a, b) => Number(a.dataset.nvListenStart || 0) - Number(b.dataset.nvListenStart || 0));
  chunks.forEach((el) => {
    const start = Number(el.dataset.nvListenStart);
    const end = Number(el.dataset.nvListenEnd);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end || !String(el.textContent || "").trim()) return;
    source.text = source.text.padEnd(start, " ") + String(el.textContent || "");
    source.segments.push({ start, end, element: el, node: el.firstChild?.nodeType === 3 ? el.firstChild : null });
  });
  const explicitText = root.__nvPdfListenText || root.dataset?.nvListenText || "";
  if (explicitText && explicitText.length >= source.text.length) source.text = explicitText;
  source.refresh = () => collectPdfTextSource(root);
  return source;
}

function readablePdfRoot(cell) {
  return cell?.querySelector?.(".nv-pdf-workspace") || document.querySelector(".panel-cell.active-panel .nv-pdf-workspace") || null;
}

export function collectActiveRenderedTextSource() {
  const cell = activeCell();
  const mode = String(window.NodevisionState?.currentMode || "");
  const ext = extensionFromListenPath(activeFilePath());
  if (ext === "pdf" || mode === "PDF Viewing") {
    const root = readablePdfRoot(cell);
    if (root) return collectPdfTextSource(root);
  }
  if (READABLE_EXTENSIONS.has(ext) || mode === "HTMLviewing" || mode === "HTMLediting" || mode === "EPUBediting") {
    const editorRoot = readableHtmlEditorRoot(cell);
    if (editorRoot) return collectDomTextSource(editorRoot, "HTML editor");
    const viewerRoot = readableHtmlViewerRoot(cell);
    if (viewerRoot) return collectDomTextSource(viewerRoot, "HTML viewer");
  }
  const fallbackPdf = readablePdfRoot(cell);
  return fallbackPdf ? collectPdfTextSource(fallbackPdf) : null;
}

export function boundaryRangeForText(text = "", charIndex = 0, charLength = 0) {
  const source = String(text || "");
  if (!source) return null;
  const start = Math.max(0, Math.min(source.length, Number(charIndex) || 0));
  const length = Number(charLength);
  if (Number.isFinite(length) && length > 0) return { start, end: Math.max(start, Math.min(source.length, start + length)) };
  const suffix = source.slice(start);
  const prefixMatch = suffix.match(/^[^\p{L}\p{N}\p{M}]*/u);
  const offset = prefixMatch ? prefixMatch[0].length : 0;
  const wordMatch = suffix.slice(offset).match(WORD_PATTERN);
  if (!wordMatch || wordMatch.index !== 0) return null;
  return { start: start + offset, end: start + offset + wordMatch[0].length };
}
