// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/insertLineNumberedPoetry.mjs
// Insert and edit semantic, line-numbered poetry blocks in the active HTML WYSIWYG editor.

import {
  POEM_DEFAULT_INTERVAL,
  POEM_INTERVAL_STORAGE_KEY,
  POEM_LINE_SELECTOR,
  POEM_STYLE_DATA_ATTR,
  buildLineNumberedPoemHtml,
  buildPoemStyleBlockHtml,
  buildPoemStyleCss,
  normalizeAllPoemBlocks,
  normalizeLineNumberInterval,
  normalizePoemBlock,
  parsePositiveInteger,
  poemLinesFromPlainText,
  refreshPoemLineNumbers,
} from "./utils/lineNumberedPoetry.mjs";

const installedPoemEditors = new WeakMap();
const POEM_SELECTION_BLOCK_TAGS = new Set([
  "ADDRESS",
  "ARTICLE",
  "ASIDE",
  "BLOCKQUOTE",
  "DD",
  "DIV",
  "DL",
  "DT",
  "FIGCAPTION",
  "FIGURE",
  "FOOTER",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "HEADER",
  "LI",
  "MAIN",
  "NAV",
  "OL",
  "P",
  "PRE",
  "SECTION",
  "TABLE",
  "TBODY",
  "TD",
  "TFOOT",
  "TH",
  "THEAD",
  "TR",
  "UL",
]);

function getWysiwyg() {
  return document.querySelector("#wysiwyg[contenteditable=\"true\"]");
}

function readStoredInterval() {
  try {
    return parsePositiveInteger(window.localStorage?.getItem(POEM_INTERVAL_STORAGE_KEY)) || POEM_DEFAULT_INTERVAL;
  } catch {
    return POEM_DEFAULT_INTERVAL;
  }
}

function storeInterval(interval) {
  try {
    window.localStorage?.setItem(POEM_INTERVAL_STORAGE_KEY, String(interval));
  } catch {}
}

function promptLineNumberInterval(message = "Show line number 1 and every Nth counted poem line:") {
  const raw = prompt(message, String(readStoredInterval()));
  if (raw === null) return null;
  const interval = parsePositiveInteger(raw);
  if (interval) return interval;
  alert(`Invalid poetry line-number interval. Using ${POEM_DEFAULT_INTERVAL}.`);
  return POEM_DEFAULT_INTERVAL;
}

function ensurePoemStyleBlock(wysiwyg) {
  if (!wysiwyg) return null;
  let style = wysiwyg.querySelector("style[" + POEM_STYLE_DATA_ATTR + "]");
  if (!style) {
    const fragment = htmlToFragment(buildPoemStyleBlockHtml());
    style = fragment.querySelector("style") || null;
    if (style) wysiwyg.insertBefore(style, wysiwyg.firstChild || null);
    return style;
  }
  const currentCss = String(style.textContent || "");
  if (!currentCss.includes(".nv-poem .nv-poem-line") || currentCss.includes(".nv-poem-controls")) {
    style.setAttribute(POEM_STYLE_DATA_ATTR, "semantic");
    style.textContent = buildPoemStyleCss();
  }
  return style;
}

function htmlToFragment(html) {
  const template = document.createElement("template");
  template.innerHTML = String(html || "").trim();
  return template.content;
}

function selectionRangeInside(wysiwyg) {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) return null;
  const range = selection.getRangeAt(0);
  const container = range.commonAncestorContainer?.nodeType === Node.ELEMENT_NODE
    ? range.commonAncestorContainer
    : range.commonAncestorContainer?.parentElement;
  return container && wysiwyg.contains(container) ? range : null;
}

function appendSelectionNewline(parts) {
  if (!parts.length) return;
  const last = parts[parts.length - 1];
  if (String(last).endsWith("\n")) return;
  parts.push("\n");
}

function appendSelectionText(parts, text = "") {
  const normalized = String(text ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (normalized) parts.push(normalized);
}

function extractPlainTextFromNode(node, parts) {
  if (!node) return;
  if (node.nodeType === Node.TEXT_NODE) {
    appendSelectionText(parts, node.nodeValue || "");
    return;
  }
  if (node.nodeType === Node.ELEMENT_NODE) {
    if (node.tagName === "BR") {
      parts.push("\n");
      return;
    }
    const isBlock = POEM_SELECTION_BLOCK_TAGS.has(node.tagName);
    Array.from(node.childNodes || []).forEach((child) => extractPlainTextFromNode(child, parts));
    if (isBlock) appendSelectionNewline(parts);
    return;
  }
  Array.from(node.childNodes || []).forEach((child) => extractPlainTextFromNode(child, parts));
}

function nonblankLineCount(text = "") {
  return String(text || "")
    .split("\n")
    .filter((line) => !isBlankPoemText(line))
    .length;
}

function plainTextFromRange(range) {
  if (!range) return "";
  const fragment = range.cloneContents();
  const parts = [];
  extractPlainTextFromNode(fragment, parts);
  const extracted = parts.join("");
  const fallback = range.toString();
  const extractedNonblank = nonblankLineCount(extracted);
  const fallbackNonblank = nonblankLineCount(fallback);

  if (fallbackNonblank > extractedNonblank) return fallback;
  return extractedNonblank > 0 ? extracted : fallback;
}

function poemLinesFromRange(range) {
  if (!range || range.collapsed) return null;
  const lines = poemLinesFromPlainText(plainTextFromRange(range), []);
  return lines.some((line) => String(line || "").trim()) ? lines : null;
}

function nodeFromSelection() {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) return null;
  const node = selection.getRangeAt(0).startContainer;
  return node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement || null;
}

function closestPoemFromSelection(wysiwyg) {
  const node = nodeFromSelection();
  const poem = node?.closest?.(".nv-poem, .nodevision-poem") || null;
  return poem && wysiwyg.contains(poem) ? poem : null;
}

function closestPoemRowFromSelection(wysiwyg) {
  const node = nodeFromSelection();
  const row = node?.closest?.(`${POEM_LINE_SELECTOR}, .nv-poem-stanza-break, .stanza-break, .nv-poem-heading, .nv-poem-rhyme-note`) || null;
  return row && wysiwyg.contains(row) ? row : null;
}

function closestPoemLineFromSelection(wysiwyg) {
  const row = closestPoemRowFromSelection(wysiwyg);
  return row?.matches?.(POEM_LINE_SELECTOR) ? row : null;
}

function ensureTextSpan(line) {
  let textSpan = line?.querySelector?.(":scope > .nv-poem-line-text") || null;
  if (!textSpan && line) {
    textSpan = document.createElement("span");
    textSpan.className = "nv-poem-line-text";
    Array.from(line.childNodes).forEach((child) => {
      if (child.nodeType === Node.ELEMENT_NODE && child.classList?.contains("nv-poem-line-number")) return;
      textSpan.appendChild(child);
    });
    if (!textSpan.childNodes.length) textSpan.appendChild(document.createTextNode(""));
    line.appendChild(textSpan);
  }
  return textSpan;
}

function ensureEditableTextNode(textSpan) {
  if (!textSpan) return null;
  const existing = Array.from(textSpan.childNodes || []).find((node) => node.nodeType === Node.TEXT_NODE);
  if (existing) return existing;
  textSpan.querySelectorAll?.("br").forEach((br) => br.remove());
  const node = document.createTextNode("");
  textSpan.appendChild(node);
  return node;
}

function setTextSpanText(textSpan, text = "") {
  if (!textSpan) return;
  textSpan.textContent = "";
  const value = String(text ?? "");
  if (value) textSpan.textContent = value;
  else textSpan.appendChild(document.createTextNode(""));
}

function makePoemLine(text = "") {
  const line = document.createElement("div");
  line.className = "nv-poem-line";
  line.setAttribute("data-poem-line", "true");

  const number = document.createElement("span");
  number.className = "nv-poem-line-number";
  number.setAttribute("contenteditable", "false");
  number.dataset.visible = "false";
  number.setAttribute("aria-hidden", "true");

  const textSpan = document.createElement("span");
  textSpan.className = "nv-poem-line-text";
  setTextSpanText(textSpan, text);

  line.append(number, textSpan);
  return line;
}

function makeStanzaBreak() {
  const breakEl = document.createElement("div");
  breakEl.className = "nv-poem-stanza-break stanza-break";
  breakEl.setAttribute("data-poem-noncounted", "true");
  breakEl.setAttribute("aria-hidden", "true");
  return breakEl;
}

function makePoemHeading(text = "Canto I") {
  const heading = document.createElement("div");
  heading.className = "nv-poem-heading";
  heading.setAttribute("data-poem-noncounted", "true");
  const textSpan = document.createElement("span");
  textSpan.className = "nv-poem-heading-text";
  textSpan.textContent = text || "Canto I";
  heading.appendChild(textSpan);
  return heading;
}

function makeRhymeNote(text = "ABAB") {
  const note = document.createElement("div");
  note.className = "nv-poem-rhyme-note";
  note.setAttribute("data-poem-noncounted", "true");
  const textSpan = document.createElement("span");
  textSpan.className = "nv-poem-rhyme-note-text";
  textSpan.textContent = text || "ABAB";
  note.appendChild(textSpan);
  return note;
}


function poemCaretTarget(el) {
  if (el?.matches?.(POEM_LINE_SELECTOR)) return ensureTextSpan(el);
  return el?.querySelector?.(":scope > .nv-poem-heading-text, :scope > .nv-poem-rhyme-note-text") || el;
}

function placeCaretAtStart(el) {
  const target = poemCaretTarget(el);
  if (!target) return;
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  if (target.classList?.contains("nv-poem-line-text") && !String(target.textContent || "")) {
    const node = ensureEditableTextNode(target);
    range.setStart(node, 0);
    range.collapse(true);
  } else {
    range.selectNodeContents(target);
    range.collapse(true);
  }
  selection.removeAllRanges();
  selection.addRange(range);
}

function placeCaretAtEnd(el) {
  const target = poemCaretTarget(el);
  if (!target) return;
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  if (target.classList?.contains("nv-poem-line-text") && !String(target.textContent || "")) {
    const node = ensureEditableTextNode(target);
    range.setStart(node, 0);
    range.collapse(true);
  } else {
    range.selectNodeContents(target);
    range.collapse(false);
  }
  selection.removeAllRanges();
  selection.addRange(range);
}

function notifyEditorChanged(wysiwyg) {
  try {
    wysiwyg.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }));
  } catch {
    wysiwyg.dispatchEvent(new Event("input", { bubbles: true }));
  }
  window.HTMLWysiwygTools?.markDirty?.();
}

function normalizePoemPlainText(text = "") {
  return String(text ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function isBlankPoemText(text = "") {
  return String(text ?? "").replace(/\u00a0/g, " ").trim() === "";
}

function poemNodesForPlainTextLines(lines) {
  return lines.map((line) => isBlankPoemText(line) ? makeStanzaBreak() : makePoemLine(line));
}

function textRangeToString(container, startContainer, startOffset, endContainer, endOffset) {
  const range = document.createRange();
  range.setStart(startContainer || container, startOffset || 0);
  range.setEnd(endContainer || container, endOffset ?? container.childNodes.length);
  const text = range.toString();
  range.detach?.();
  return text;
}

function replacePoemLineRangeWithPlainText(line, range, text) {
  const textSpan = ensureTextSpan(line);
  if (!textSpan || !range || !textSpan.contains(range.startContainer) || !textSpan.contains(range.endContainer)) return false;
  const lines = normalizePoemPlainText(text).split("\n");
  const before = textRangeToString(textSpan, textSpan, 0, range.startContainer, range.startOffset);
  const after = textRangeToString(textSpan, range.endContainer, range.endOffset, textSpan, textSpan.childNodes.length);
  lines[0] = before + lines[0];
  lines[lines.length - 1] = lines[lines.length - 1] + after;
  const nodes = poemNodesForPlainTextLines(lines);
  line.replaceWith(...nodes);
  const lastLine = nodes.slice().reverse().find((node) => node.matches?.(POEM_LINE_SELECTOR)) || nodes[nodes.length - 1];
  const poem = nodes[0]?.closest?.(".nv-poem, .nodevision-poem");
  if (poem) refreshPoemLineNumbers(poem, { convertEmptyLines: false });
  placeCaretAtEnd(lastLine);
  return true;
}

function splitPoemLineAtRange(line, range) {
  const textSpan = ensureTextSpan(line);
  if (!textSpan || !range || !textSpan.contains(range.startContainer) || !textSpan.contains(range.endContainer)) {
    const nextLine = makePoemLine();
    line.after(nextLine);
    return nextLine;
  }
  if (!range.collapsed) range.deleteContents();
  const trailingRange = document.createRange();
  trailingRange.setStart(range.startContainer, range.startOffset);
  trailingRange.setEnd(textSpan, textSpan.childNodes.length);
  const trailing = trailingRange.extractContents();
  trailingRange.detach?.();

  if (!textSpan.childNodes.length) textSpan.appendChild(document.createTextNode(""));

  const nextLine = makePoemLine();
  const nextText = ensureTextSpan(nextLine);
  nextText.textContent = "";
  nextText.appendChild(trailing);
  if (!nextText.childNodes.length) nextText.appendChild(document.createTextNode(""));
  line.after(nextLine);
  return nextLine;
}

function insertPoemNodeAfterCurrent(wysiwyg, poem, node, options = {}) {
  const row = closestPoemRowFromSelection(wysiwyg);
  if (row && poem.contains(row)) {
    row.after(node);
  } else {
    const stanza = poem.querySelector?.(":scope > .nv-poem-stanza") || poem.querySelector?.(".nv-poem-stanza") || poem;
    stanza.appendChild(node);
  }
  refreshPoemLineNumbers(poem, { convertEmptyLines: false });
  if (options.placeCaret !== false) placeCaretAtStart(node);
  notifyEditorChanged(wysiwyg);
}

function activePoemForToolbar(wysiwyg) {
  if (!wysiwyg) return null;
  const poem = closestPoemFromSelection(wysiwyg);
  return poem && wysiwyg.contains(poem) ? poem : null;
}

function handlePoemAction(wysiwyg, action) {
  const poem = activePoemForToolbar(wysiwyg);
  if (!poem) return;
  normalizePoemBlock(poem, { convertEmptyLines: false });
  if (action === "line") {
    insertPoemNodeAfterCurrent(wysiwyg, poem, makePoemLine(""));
    return;
  }
  if (action === "break") {
    const breakEl = makeStanzaBreak();
    insertPoemNodeAfterCurrent(wysiwyg, poem, breakEl, { placeCaret: false });
    const nextLine = makePoemLine("");
    breakEl.after(nextLine);
    refreshPoemLineNumbers(poem, { convertEmptyLines: false });
    placeCaretAtStart(nextLine);
    notifyEditorChanged(wysiwyg);
    return;
  }
  if (action === "heading") {
    const text = prompt("Poem heading:", "Canto I");
    if (text === null) return;
    insertPoemNodeAfterCurrent(wysiwyg, poem, makePoemHeading(text.trim() || "Canto I"));
    return;
  }
  if (action === "rhyme") {
    const text = prompt("Rhyme-scheme note:", "ABAB");
    if (text === null) return;
    insertPoemNodeAfterCurrent(wysiwyg, poem, makeRhymeNote(text.trim() || "ABAB"));
    return;
  }
  if (action === "interval") {
    const current = normalizeLineNumberInterval(poem.getAttribute("data-line-number-step"), readStoredInterval());
    const raw = prompt("Show line number 1 and every Nth counted poem line:", String(current));
    if (raw === null) return;
    const interval = parsePositiveInteger(raw) || POEM_DEFAULT_INTERVAL;
    if (!parsePositiveInteger(raw)) alert(`Invalid poetry line-number interval. Using ${POEM_DEFAULT_INTERVAL}.`);
    poem.setAttribute("data-line-number-step", String(interval));
    poem.setAttribute("data-line-numbering", String(interval));
    storeInterval(interval);
    refreshPoemLineNumbers(poem, { convertEmptyLines: false });
    notifyEditorChanged(wysiwyg);
  }
}

export function performPoemToolbarAction(action, wysiwyg = getWysiwyg()) {
  if (typeof window !== "undefined" && typeof window.HTMLWysiwygTools?.restoreSavedSelection === "function") {
    window.HTMLWysiwygTools.restoreSavedSelection();
  }
  handlePoemAction(wysiwyg, action);
}

function hidePoetrySubToolbar() {
  const subToolbar = document.getElementById("sub-toolbar");
  if (!subToolbar?.querySelector?.("#nv-poetry-toolbar")) return;
  subToolbar.style.display = "none";
  subToolbar.innerHTML = "";
}

function showPoetrySubToolbar() {
  window.dispatchEvent?.(new CustomEvent("nv-show-subtoolbar", {
    detail: { heading: "Poetry", force: true, toggle: false },
  }));
}

function isRangeAtStartOfNode(range, node) {
  if (!range || !node) return false;
  const probe = document.createRange();
  probe.selectNodeContents(node);
  probe.setEnd(range.startContainer, range.startOffset);
  const before = probe.toString();
  probe.detach?.();
  return before.replace(/\u00a0/g, " ").trim() === "";
}

function isNodeTextEmpty(node) {
  return String(node?.textContent || "").replace(/\u00a0/g, " ").trim() === "";
}

function insertInitialTextIntoPoemLine(line, text = "") {
  const value = String(text ?? "");
  if (!line?.isConnected || !value) return false;
  const textSpan = ensureTextSpan(line);
  if (!textSpan) return false;
  textSpan.textContent = value;
  const textNode = textSpan.firstChild;
  const selection = window.getSelection();
  if (selection && textNode?.nodeType === Node.TEXT_NODE) {
    const range = document.createRange();
    range.setStart(textNode, value.length);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }
  window.HTMLWysiwygTools?.saveCurrentSelection?.();
  return true;
}


export function installPoemEditingBehavior(wysiwyg) {
  if (!wysiwyg) return () => {};
  const existing = installedPoemEditors.get(wysiwyg);
  if (existing) return existing;

  let pendingRefresh = false;
  let pendingPoem = null;
  let pendingTextEntryLine = null;

  const reinforcePendingTextEntryLine = () => {
    if (!pendingTextEntryLine?.isConnected) {
      pendingTextEntryLine = null;
      return false;
    }
    placeCaretAtStart(pendingTextEntryLine);
    window.HTMLWysiwygTools?.saveCurrentSelection?.();
    return true;
  };
  const scheduleRefresh = (poem = null) => {
    if (poem) pendingPoem = poem;
    if (pendingRefresh) return;
    pendingRefresh = true;
    requestAnimationFrame(() => {
      pendingRefresh = false;
      const poemToRefresh = pendingPoem;
      pendingPoem = null;
      if (poemToRefresh?.isConnected) refreshPoemLineNumbers(poemToRefresh, { convertEmptyLines: false });
    });
  };

  const onBeforeInput = (event) => {
    if (!pendingTextEntryLine) return;
    const inputType = String(event.inputType || "");
    if (inputType === "insertText" && event.data) {
      event.preventDefault();
      event.stopPropagation();
      const line = pendingTextEntryLine;
      pendingTextEntryLine = null;
      if (insertInitialTextIntoPoemLine(line, event.data)) {
        const poem = line.closest?.(".nv-poem, .nodevision-poem");
        if (poem) refreshPoemLineNumbers(poem, { convertEmptyLines: false });
        notifyEditorChanged(wysiwyg);
      }
      return;
    }
    if (!inputType.startsWith("insert") || inputType === "insertParagraph" || inputType === "insertLineBreak") return;
    reinforcePendingTextEntryLine();
    pendingTextEntryLine = null;
  };

  const onPaste = (event) => {
    const plainText = event.clipboardData?.getData("text/plain") || "";
    if (!/[\r\n]/.test(plainText)) return;
    const line = closestPoemLineFromSelection(wysiwyg);
    if (!line) return;
    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    if (!range) return;
    event.preventDefault();
    if (replacePoemLineRangeWithPlainText(line, range, plainText)) {
      notifyEditorChanged(wysiwyg);
    }
  };

  const onKeyDown = (event) => {
    const row = closestPoemRowFromSelection(wysiwyg);
    if (!row) return;
    const poem = row.closest?.(".nv-poem, .nodevision-poem");
    if (!poem || !poem.classList?.contains("nv-poem")) return;
    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;

    if (event.key === "Backspace") {
      const line = row.matches?.(POEM_LINE_SELECTOR) ? row : null;
      const textSpan = line ? ensureTextSpan(line) : null;
      if (!line || !textSpan || !range?.collapsed || !isRangeAtStartOfNode(range, textSpan) || !isNodeTextEmpty(textSpan)) return;
      event.preventDefault();
      const previousLine = line.previousElementSibling?.matches?.(POEM_LINE_SELECTOR)
        ? line.previousElementSibling
        : line.previousElementSibling?.previousElementSibling?.matches?.(POEM_LINE_SELECTOR)
          ? line.previousElementSibling.previousElementSibling
          : null;
      pendingTextEntryLine = null;
      line.remove();
      refreshPoemLineNumbers(poem, { convertEmptyLines: false });
      if (previousLine) placeCaretAtEnd(previousLine);
      notifyEditorChanged(wysiwyg);
      return;
    }

    if (event.key !== "Enter" || event.shiftKey) {
      if (pendingTextEntryLine && event.key && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        reinforcePendingTextEntryLine();
      }
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const nextLine = row.matches?.(POEM_LINE_SELECTOR)
      ? splitPoemLineAtRange(row, range)
      : makePoemLine("");
    if (!row.matches?.(POEM_LINE_SELECTOR)) row.after(nextLine);
    refreshPoemLineNumbers(poem, { convertEmptyLines: false });
    pendingTextEntryLine = nextLine;
    reinforcePendingTextEntryLine();
    notifyEditorChanged(wysiwyg);
    queueMicrotask(reinforcePendingTextEntryLine);
    requestAnimationFrame(reinforcePendingTextEntryLine);
  };

  let lastToolbarPoem = null;
  const syncPoetryToolbar = () => {
    if (document.activeElement?.closest?.("#nv-poetry-toolbar")) return;
    const poem = closestPoemFromSelection(wysiwyg);
    if (poem && poem !== lastToolbarPoem) {
      lastToolbarPoem = poem;
      showPoetrySubToolbar();
      return;
    }
    if (!poem && lastToolbarPoem) {
      lastToolbarPoem = null;
      hidePoetrySubToolbar();
    }
  };

  const onInput = () => {
    if (pendingTextEntryLine && String(ensureTextSpan(pendingTextEntryLine)?.textContent || "")) {
      pendingTextEntryLine = null;
    }
    const poem = closestPoemFromSelection(wysiwyg);
    if (!poem || !poem.classList?.contains("nv-poem")) return;
    scheduleRefresh(poem);
    syncPoetryToolbar();
  };

  normalizeAllPoemBlocks(wysiwyg);
  wysiwyg.addEventListener("beforeinput", onBeforeInput);
  wysiwyg.addEventListener("paste", onPaste);
  wysiwyg.addEventListener("keydown", onKeyDown);
  wysiwyg.addEventListener("input", onInput);
  wysiwyg.addEventListener("mouseup", syncPoetryToolbar);
  wysiwyg.addEventListener("keyup", syncPoetryToolbar);
  wysiwyg.addEventListener("focus", syncPoetryToolbar);
  document.addEventListener("selectionchange", syncPoetryToolbar);

  const cleanup = () => {
    wysiwyg.removeEventListener("beforeinput", onBeforeInput);
    wysiwyg.removeEventListener("paste", onPaste);
    wysiwyg.removeEventListener("keydown", onKeyDown);
    wysiwyg.removeEventListener("input", onInput);
    wysiwyg.removeEventListener("mouseup", syncPoetryToolbar);
    wysiwyg.removeEventListener("keyup", syncPoetryToolbar);
    wysiwyg.removeEventListener("focus", syncPoetryToolbar);
    document.removeEventListener("selectionchange", syncPoetryToolbar);
    hidePoetrySubToolbar();
    installedPoemEditors.delete(wysiwyg);
  };
  installedPoemEditors.set(wysiwyg, cleanup);
  return cleanup;
}

function insertHtmlAtSelection(wysiwyg, html, preferredRange = null) {
  const fragment = htmlToFragment(html);
  const poem = fragment.querySelector?.(".nv-poem, .nodevision-poem") || null;
  const preferredContainer = preferredRange?.commonAncestorContainer?.nodeType === Node.ELEMENT_NODE
    ? preferredRange.commonAncestorContainer
    : preferredRange?.commonAncestorContainer?.parentElement;
  const range = preferredContainer && wysiwyg.contains(preferredContainer)
    ? preferredRange
    : selectionRangeInside(wysiwyg);
  if (range) {
    range.deleteContents();
    range.insertNode(fragment);
  } else {
    wysiwyg.appendChild(fragment);
  }
  const insertedPoem = poem && wysiwyg.contains(poem) ? poem : wysiwyg.querySelector(".nv-poem:last-of-type");
  if (insertedPoem) {
    normalizePoemBlock(insertedPoem, { convertEmptyLines: false });
    showPoetrySubToolbar();
  }
  const firstLine = insertedPoem?.querySelector?.(POEM_LINE_SELECTOR) || insertedPoem;
  placeCaretAtStart(firstLine);
}

export default function insertLineNumberedPoetry() {
  const wysiwyg = getWysiwyg();
  if (!wysiwyg) {
    alert("Open an HTML document to insert line numbered poetry.");
    return;
  }

  window.HTMLWysiwygTools?.restoreSavedSelection?.();
  const selectedRange = selectionRangeInside(wysiwyg)?.cloneRange() || null;
  const selectedLines = poemLinesFromRange(selectedRange);

  const interval = promptLineNumberInterval();
  if (!interval) return;
  storeInterval(interval);

  wysiwyg.focus();
  installPoemEditingBehavior(wysiwyg);

  ensurePoemStyleBlock(wysiwyg);
  const html = buildLineNumberedPoemHtml(interval, selectedLines ? { lines: selectedLines } : {});
  insertHtmlAtSelection(wysiwyg, html, selectedRange);
  notifyEditorChanged(wysiwyg);
}

if (typeof window !== "undefined") {
  window.NodevisionPoetry = Object.assign(window.NodevisionPoetry || {}, {
    installPoemEditingBehavior,
    normalizeAllPoemBlocks,
    normalizePoemBlock,
    refreshPoemLineNumbers,
    performPoemToolbarAction,
  });
}
