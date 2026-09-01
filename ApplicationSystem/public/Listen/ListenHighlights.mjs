// Nodevision/ApplicationSystem/public/Listen/ListenHighlights.mjs
// This module manages temporary gold read-position highlights for rendered HTML and PDF text without saving those highlights into user documents.

export const LISTEN_HIGHLIGHT_COLOR = "#d4af37";

const LISTEN_HIGHLIGHT_NAME = "nv-listen-current";
const LISTEN_HIGHLIGHT_ATTR = "data-nv-listen-highlight";
const LISTEN_STYLE_ID = "nv-listen-highlight-style";

function ownerWindow(doc) {
  return doc?.defaultView || globalThis.window || globalThis;
}

export function ensureListenStyles(doc = document) {
  if (!doc?.documentElement || doc.getElementById?.(LISTEN_STYLE_ID)) return;
  const style = doc.createElement("style");
  style.id = LISTEN_STYLE_ID;
  style.textContent = `
    ::highlight(${LISTEN_HIGHLIGHT_NAME}) {
      color: ${LISTEN_HIGHLIGHT_COLOR};
      background-color: rgba(212, 175, 55, 0.16);
    }
    [${LISTEN_HIGHLIGHT_ATTR}],
    .nv-pdf-text-chunk.nv-listen-highlight {
      color: ${LISTEN_HIGHLIGHT_COLOR} !important;
      -webkit-text-fill-color: ${LISTEN_HIGHLIGHT_COLOR} !important;
      opacity: 1 !important;
      background-color: rgba(212, 175, 55, 0.16) !important;
      border-radius: 2px;
      text-shadow: 0 0 1px rgba(0, 0, 0, 0.35);
    }
  `;
  (doc.head || doc.documentElement).appendChild(style);
}

function unwrapElement(el) {
  const parent = el?.parentNode;
  if (!parent) return;
  while (el.firstChild) parent.insertBefore(el.firstChild, el);
  parent.removeChild(el);
  parent.normalize?.();
}

function clearDocumentHighlights(doc = document) {
  try {
    ownerWindow(doc).CSS?.highlights?.delete?.(LISTEN_HIGHLIGHT_NAME);
  } catch {
    // Highlight cleanup is best-effort.
  }
  doc.querySelectorAll?.(`[${LISTEN_HIGHLIGHT_ATTR}]`).forEach(unwrapElement);
  doc.querySelectorAll?.(".nv-pdf-text-chunk.nv-listen-highlight").forEach((el) => {
    el.classList.remove("nv-listen-highlight");
  });
}

function clearIframeHighlights(root = document) {
  root.querySelectorAll?.("iframe").forEach((iframe) => {
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc) clearDocumentHighlights(doc);
    } catch {
      // Cross-origin frames cannot be inspected.
    }
  });
}

export function clearRenderedPageListenHighlights(root = document) {
  const doc = root.nodeType === 9 ? root : root.ownerDocument || document;
  clearDocumentHighlights(doc);
  clearIframeHighlights(doc);
}

export function clearHighlightRecord(record) {
  const hadWrappers = Boolean(record?.wrappers?.length);
  if (record?.doc) {
    try {
      ownerWindow(record.doc).CSS?.highlights?.delete?.(LISTEN_HIGHLIGHT_NAME);
    } catch {
      // Highlight cleanup is best-effort.
    }
  }
  (record?.elements || []).forEach((el) => el?.classList?.remove("nv-listen-highlight"));
  (record?.wrappers || []).forEach(unwrapElement);
  return { hadWrappers };
}

function rangeSegments(source, start, end) {
  return (source?.segments || []).filter((segment) => segment.end > start && segment.start < end);
}

function applyCssHighlight(source, ranges) {
  const win = ownerWindow(source?.doc || document);
  if (!win.CSS?.highlights || typeof win.Highlight !== "function" || !ranges.length) return false;
  try {
    win.CSS.highlights.delete(LISTEN_HIGHLIGHT_NAME);
    win.CSS.highlights.set(LISTEN_HIGHLIGHT_NAME, new win.Highlight(...ranges));
    return true;
  } catch {
    return false;
  }
}

function applyFallbackRangeHighlight(doc, ranges) {
  const wrappers = [];
  ranges.forEach((range) => {
    try {
      const span = doc.createElement("span");
      span.className = "nv-listen-highlight";
      span.setAttribute(LISTEN_HIGHLIGHT_ATTR, "true");
      range.surroundContents(span);
      wrappers.push(span);
    } catch {
      // Some live ranges cannot be wrapped after DOM edits.
    }
  });
  return wrappers;
}

function textNodeRange(doc, segment, start, end) {
  const node = segment.node;
  if (!node || !node.isConnected || node.nodeType !== 3) return null;
  const text = String(node.nodeValue || "");
  const rangeStart = Math.max(0, Math.min(text.length, start - segment.start));
  const rangeEnd = Math.max(rangeStart, Math.min(text.length, end - segment.start));
  if (rangeStart >= rangeEnd) return null;
  const range = doc.createRange();
  range.setStart(node, rangeStart);
  range.setEnd(node, rangeEnd);
  return range;
}

function scrollHighlightIntoView(record) {
  const element = record?.elements?.find((el) => el?.isConnected) || record?.wrappers?.find((el) => el?.isConnected);
  if (element?.scrollIntoView) {
    element.scrollIntoView({ block: "nearest", inline: "nearest" });
    return;
  }
  const range = record?.ranges?.[0];
  const parent = range?.startContainer?.parentElement || range?.startContainer?.parentNode;
  parent?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
}

export function highlightRenderedRange(source, start, end, previousRecord = null) {
  clearHighlightRecord(previousRecord);
  if (!source) return null;
  ensureListenStyles(source.doc);
  const doc = source.doc || document;
  const ranges = [];
  const elements = [];
  for (const segment of rangeSegments(source, start, end)) {
    if (segment.element?.classList?.contains("nv-pdf-text-chunk")) {
      segment.element.classList.add("nv-listen-highlight");
      elements.push(segment.element);
      continue;
    }
    const range = textNodeRange(doc, segment, start, end);
    if (range) ranges.push(range);
  }
  let wrappers = [];
  const usedCssHighlight = ranges.length ? applyCssHighlight(source, ranges) : false;
  if (ranges.length && !usedCssHighlight) wrappers = applyFallbackRangeHighlight(doc, ranges);
  const record = { doc, ranges: usedCssHighlight ? ranges : [], elements, wrappers };
  scrollHighlightIntoView(record);
  return record;
}
