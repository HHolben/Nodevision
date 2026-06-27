// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/utils/lineNumberedPoetry.mjs
// Helpers for semantic, editable line-numbered poetry blocks.

export const POEM_STYLE_DATA_ATTR = "data-nodevision-poem-style";
export const POEM_DEFAULT_INTERVAL = 5;
export const POEM_INTERVAL_STORAGE_KEY = "nodevision.poetry.lineNumberInterval";
export const POEM_ROOT_CLASS = "nv-poem";
export const LEGACY_POEM_ROOT_CLASS = "nodevision-poem";
export const POEM_LINE_SELECTOR = ".nv-poem-line[data-poem-line=\"true\"]";
export const POEM_NONCOUNTED_SELECTOR = ".nv-poem-stanza-break, .nv-poem-heading, .nv-poem-rhyme-note, [data-poem-noncounted=\"true\"]";

const DEFAULT_POEM_LINES = ["poem"];

export function parsePositiveInteger(value) {
  const text = String(value ?? "").trim();
  if (!/^\d+$/.test(text)) return null;
  const num = Number(text);
  if (!Number.isSafeInteger(num) || num < 1) return null;
  return num;
}

export function normalizeLineNumberInterval(value, fallback = POEM_DEFAULT_INTERVAL) {
  return parsePositiveInteger(value) || parsePositiveInteger(fallback) || POEM_DEFAULT_INTERVAL;
}

export function poemClassForInterval(interval) {
  const normalized = parsePositiveInteger(interval);
  if (!normalized) throw new Error("Poetry line numbering interval must be a positive integer.");
  return `poem-lines-every-${normalized}`;
}

export function sampleLineCountForInterval() {
  return DEFAULT_POEM_LINES.length;
}

export function samplePoemLines() {
  return DEFAULT_POEM_LINES.slice();
}

export function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function isBlankPoemLine(value = "") {
  return String(value ?? "").replace(/\u00a0/g, " ").trim() === "";
}

export function poemLinesFromPlainText(value = "", fallback = DEFAULT_POEM_LINES) {
  const normalized = String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ");
  const lines = normalized.split("\n").map((line) => line.replace(/[ \t]+$/g, ""));
  while (lines.length && isBlankPoemLine(lines[0])) lines.shift();
  while (lines.length && isBlankPoemLine(lines[lines.length - 1])) lines.pop();
  if (lines.length) return lines;
  return Array.isArray(fallback) ? fallback.slice() : [];
}

export function shouldShowLineNumber(actualLineNumber, interval) {
  const normalized = normalizeLineNumberInterval(interval);
  return actualLineNumber === 1 || actualLineNumber % normalized === 0;
}

export function lineNumberDisplayForEntries(entries = [], interval = POEM_DEFAULT_INTERVAL) {
  const normalized = normalizeLineNumberInterval(interval);
  let actualLineNumber = 0;
  return entries.map((entry) => {
    const counted = Boolean(entry?.counted);
    if (!counted) {
      return {
        counted: false,
        actualLineNumber: null,
        visibleNumber: "",
      };
    }
    actualLineNumber += 1;
    return {
      counted: true,
      actualLineNumber,
      visibleNumber: shouldShowLineNumber(actualLineNumber, normalized) ? String(actualLineNumber) : "",
    };
  });
}

export function buildPoemStyleCss() {
  return `.nv-poem,
.nodevision-poem.nv-poem {
  margin: 1em 0;
  max-width: 70ch;
}

.nv-poem .nv-poem-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0 0 0.75em 0;
}

.nv-poem .nv-poem-controls button {
  border: 1px solid #9aa4b2;
  background: #f7f8fa;
  color: #20242a;
  border-radius: 4px;
  padding: 3px 8px;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.nv-poem .nv-poem-stanza {
  margin: 0 0 1em 0;
}

.nv-poem .nv-poem-line {
  display: grid;
  grid-template-columns: 3em minmax(0, 1fr);
  column-gap: 1em;
  min-height: 1.35em;
  align-items: baseline;
}

.nv-poem .nv-poem-line-number {
  display: inline-block;
  min-width: 3em;
  text-align: right;
  color: #6b7280;
  user-select: none;
  white-space: nowrap;
  visibility: hidden;
}

.nv-poem .nv-poem-line-number[data-visible="true"] {
  visibility: visible;
}

.nv-poem .nv-poem-line-text {
  min-width: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.nv-poem .nv-poem-stanza-break {
  min-height: 1.35em;
  margin: 0.35em 0;
}

.nv-poem .nv-poem-heading {
  display: block;
  margin: 0.35em 0 0.5em 4em;
  font-weight: 600;
}

.nv-poem .nv-poem-rhyme-note {
  display: block;
  margin: 0.25em 0 0.5em 4em;
  color: #667085;
  font-style: italic;
}

.nv-poem [data-poem-noncounted="true"] .nv-poem-line-number,
.nv-poem .nv-poem-stanza-break .nv-poem-line-number,
.nv-poem .nv-poem-heading .nv-poem-line-number,
.nv-poem .nv-poem-rhyme-note .nv-poem-line-number {
  display: none;
}

@media print {
  .nv-poem .nv-poem-controls {
    display: none !important;
  }
}`;
}

export function buildPoemStyleBlockHtml() {
  return `<style ${POEM_STYLE_DATA_ATTR}="semantic">\n${buildPoemStyleCss()}\n</style>`;
}

export function buildLineNumberedPoemHtml(interval, options = {}) {
  const normalized = normalizeLineNumberInterval(interval);
  const className = poemClassForInterval(normalized);
  const lines = Array.isArray(options.lines) && options.lines.length ? options.lines : samplePoemLines();
  let actualLineNumber = 0;
  const lineHtml = lines.map((line) => {
    if (isBlankPoemLine(line)) {
      return `    <div class="nv-poem-stanza-break" data-poem-noncounted="true" aria-hidden="true"></div>`;
    }
    actualLineNumber += 1;
    const visible = shouldShowLineNumber(actualLineNumber, normalized);
    return [
      `    <div class="nv-poem-line" data-poem-line="true" data-poem-line-number="${actualLineNumber}">`,
      `      <span class="nv-poem-line-number" contenteditable="false" data-visible="${visible ? "true" : "false"}"${visible ? "" : " aria-hidden=\"true\""}>${visible ? actualLineNumber : ""}</span>`,
      `      <span class="nv-poem-line-text">${escapeHtml(line)}</span>`,
      "    </div>",
    ].join("\n");
  }).join("\n");
  return `<section class="nv-poem nodevision-poem ${className}" data-line-number-step="${normalized}" data-line-numbering="${normalized}">\n  <div class="nv-poem-stanza stanza">\n${lineHtml}\n  </div>\n</section>`;
}

export function buildLineNumberedPoemInsertionHtml(interval, options = {}) {
  const includeStyle = options.includeStyle !== false;
  const style = includeStyle ? `${buildPoemStyleBlockHtml()}\n` : "";
  return `${style}${buildLineNumberedPoemHtml(interval, options)}`;
}

function elementTextWithoutLineNumber(el) {
  if (!el) return "";
  const clone = el.cloneNode(true);
  clone.querySelectorAll?.(".nv-poem-line-number").forEach((node) => node.remove());
  return String(clone.textContent || "").replace(/\u00a0/g, " ").trim();
}

function ensureLineTextSpan(line) {
  let textSpan = line.querySelector?.(":scope > .nv-poem-line-text") || null;
  if (textSpan) return textSpan;
  textSpan = line.ownerDocument.createElement("span");
  textSpan.className = "nv-poem-line-text";
  const keep = [];
  Array.from(line.childNodes).forEach((child) => {
    if (child.nodeType === Node.ELEMENT_NODE && child.classList?.contains("nv-poem-line-number")) return;
    keep.push(child);
  });
  keep.forEach((child) => textSpan.appendChild(child));
  if (!textSpan.childNodes.length) textSpan.appendChild(line.ownerDocument.createElement("br"));
  line.appendChild(textSpan);
  return textSpan;
}

function ensureLineNumberSpan(line) {
  let numberSpan = line.querySelector?.(":scope > .nv-poem-line-number") || null;
  if (!numberSpan) {
    numberSpan = line.ownerDocument.createElement("span");
    numberSpan.className = "nv-poem-line-number";
    line.insertBefore(numberSpan, line.firstChild || null);
  } else if (numberSpan.parentNode !== line) {
    numberSpan.remove();
    line.insertBefore(numberSpan, line.firstChild || null);
  }
  numberSpan.setAttribute("contenteditable", "false");
  return numberSpan;
}

function removeLineNumbersFromNoncounted(poemElement) {
  poemElement.querySelectorAll?.(POEM_NONCOUNTED_SELECTOR).forEach((el) => {
    if (el.matches?.(POEM_LINE_SELECTOR)) return;
    el.querySelectorAll?.(".nv-poem-line-number").forEach((numberSpan) => numberSpan.remove());
  });
}

function markNoncounted(el) {
  el.setAttribute("data-poem-noncounted", "true");
  el.removeAttribute("data-poem-line");
  el.removeAttribute("data-poem-line-number");
  el.classList.remove("nv-poem-line");
  el.querySelectorAll?.(".nv-poem-line-number").forEach((numberSpan) => numberSpan.remove());
}

function convertElementToStanzaBreak(el) {
  const breakEl = el.ownerDocument.createElement("div");
  breakEl.className = "nv-poem-stanza-break stanza-break";
  breakEl.setAttribute("data-poem-noncounted", "true");
  breakEl.setAttribute("aria-hidden", "true");
  el.replaceWith(breakEl);
  return breakEl;
}

function resetIntervalClass(poemElement, interval) {
  const nextClass = poemClassForInterval(interval);
  Array.from(poemElement.classList || []).forEach((className) => {
    if (className.startsWith("poem-lines-every-") && className !== nextClass) poemElement.classList.remove(className);
  });
  poemElement.classList.add(nextClass);
}

function normalizeLegacyLine(el) {
  if (!el.classList?.contains("poem-line") || el.matches?.(POEM_LINE_SELECTOR)) return;
  if (isBlankPoemLine(elementTextWithoutLineNumber(el))) {
    convertElementToStanzaBreak(el);
    return;
  }
  el.classList.add("nv-poem-line");
  el.setAttribute("data-poem-line", "true");
  ensureLineTextSpan(el);
  ensureLineNumberSpan(el);
}

export function refreshPoemLineNumbers(poemElement) {
  if (!poemElement?.querySelectorAll) return poemElement;
  const interval = normalizeLineNumberInterval(
    poemElement.getAttribute("data-line-number-step") || poemElement.getAttribute("data-line-numbering"),
    POEM_DEFAULT_INTERVAL,
  );
  poemElement.setAttribute("data-line-number-step", String(interval));
  poemElement.setAttribute("data-line-numbering", String(interval));
  poemElement.classList?.add(POEM_ROOT_CLASS);
  poemElement.classList?.add(LEGACY_POEM_ROOT_CLASS);
  resetIntervalClass(poemElement, interval);

  removeLineNumbersFromNoncounted(poemElement);
  const lines = Array.from(poemElement.querySelectorAll(POEM_LINE_SELECTOR));
  lines.forEach((line, index) => {
    const actualLineNumber = index + 1;
    line.setAttribute("data-poem-line-number", String(actualLineNumber));
    const numberSpan = ensureLineNumberSpan(line);
    ensureLineTextSpan(line);
    const visible = shouldShowLineNumber(actualLineNumber, interval);
    numberSpan.textContent = visible ? String(actualLineNumber) : "";
    numberSpan.dataset.visible = visible ? "true" : "false";
    numberSpan.setAttribute("contenteditable", "false");
    if (visible) {
      numberSpan.removeAttribute("aria-hidden");
    } else {
      numberSpan.setAttribute("aria-hidden", "true");
    }
  });
  return poemElement;
}

export function normalizePoemBlock(poemElement) {
  if (!poemElement?.querySelectorAll) return poemElement;
  poemElement.classList?.add(POEM_ROOT_CLASS);
  poemElement.classList?.add(LEGACY_POEM_ROOT_CLASS);
  const interval = normalizeLineNumberInterval(
    poemElement.getAttribute("data-line-number-step") || poemElement.getAttribute("data-line-numbering"),
    POEM_DEFAULT_INTERVAL,
  );
  poemElement.setAttribute("data-line-number-step", String(interval));
  poemElement.setAttribute("data-line-numbering", String(interval));

  poemElement.querySelectorAll?.(".stanza").forEach((stanza) => stanza.classList.add("nv-poem-stanza"));
  poemElement.querySelectorAll?.(".stanza-break, .nv-poem-stanza-break").forEach((el) => {
    el.classList.add("nv-poem-stanza-break", "stanza-break");
    markNoncounted(el);
    el.setAttribute("aria-hidden", "true");
  });
  poemElement.querySelectorAll?.(".nv-poem-heading").forEach(markNoncounted);
  poemElement.querySelectorAll?.(".nv-poem-rhyme-note").forEach(markNoncounted);
  poemElement.querySelectorAll?.("[data-poem-noncounted=\"true\"]").forEach((el) => {
    if (!el.matches?.(POEM_LINE_SELECTOR)) markNoncounted(el);
  });
  poemElement.querySelectorAll?.(".poem-line").forEach(normalizeLegacyLine);
  poemElement.querySelectorAll?.(POEM_LINE_SELECTOR).forEach((line) => {
    line.classList.add("nv-poem-line");
    ensureLineTextSpan(line);
    ensureLineNumberSpan(line);
  });

  return refreshPoemLineNumbers(poemElement);
}

export function normalizeAllPoemBlocks(root) {
  if (!root?.querySelectorAll) return [];
  const poems = Array.from(root.querySelectorAll(".nv-poem, .nodevision-poem"));
  poems.forEach(normalizePoemBlock);
  return poems;
}
