// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/insertLineNumberedPoetry.mjs
// Insert a portable, self-contained CSS-counter poetry block into the active HTML WYSIWYG editor.

import {
  POEM_DEFAULT_INTERVAL,
  POEM_INTERVAL_STORAGE_KEY,
  POEM_STYLE_DATA_ATTR,
  buildLineNumberedPoemHtml,
  buildPoemStyleBlockHtml,
  parsePositiveInteger,
} from "./utils/lineNumberedPoetry.mjs";

const POEM_ENTER_HANDLER_FLAG = "__nodevisionPoemEnterHandlerInstalled";

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

function promptCustomInterval() {
  let fallback = readStoredInterval();
  while (true) {
    const raw = prompt("Number every Nth line. Enter a positive integer:", String(fallback));
    if (raw === null) return null;
    const interval = parsePositiveInteger(raw);
    if (interval) return interval;
    alert("Please enter a positive whole number for the line numbering interval.");
    fallback = POEM_DEFAULT_INTERVAL;
  }
}

function choosePoetryInterval() {
  const choice = prompt([
    "Line Numbered Poetry",
    "",
    "1. Number every line",
    "2. Number every 5th line",
    "3. Number every 10th line",
    "4. Custom interval",
  ].join("\n"), "2");
  if (choice === null) return null;
  const normalized = String(choice).trim().toLowerCase();
  if (normalized === "1") return 1;
  if (normalized === "2") return 5;
  if (normalized === "3") return 10;
  if (normalized === "4" || normalized === "custom") return promptCustomInterval();
  const directInterval = parsePositiveInteger(normalized);
  if (directInterval) return directInterval;
  alert("Choose 1, 2, 3, or 4 for a custom interval.");
  return null;
}

function styleExistsForInterval(wysiwyg, interval) {
  const selector = `style[${POEM_STYLE_DATA_ATTR}=\"${interval}\"]`;
  return Boolean(wysiwyg?.querySelector(selector));
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

function placeCaretAtStart(el) {
  if (!el) return;
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function closestPoemLineFromSelection(wysiwyg) {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) return null;
  const range = selection.getRangeAt(0);
  const node = range.startContainer?.nodeType === Node.ELEMENT_NODE ? range.startContainer : range.startContainer?.parentElement;
  const line = node?.closest?.(".nodevision-poem .poem-line") || null;
  return line && wysiwyg.contains(line) ? line : null;
}

function installPoemEditingBehavior(wysiwyg) {
  if (!wysiwyg || wysiwyg[POEM_ENTER_HANDLER_FLAG]) return;
  wysiwyg[POEM_ENTER_HANDLER_FLAG] = true;
  wysiwyg.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    const line = closestPoemLineFromSelection(wysiwyg);
    if (!line) return;
    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    if (!range) return;

    event.preventDefault();
    if (!range.collapsed) range.deleteContents();

    const trailingRange = document.createRange();
    trailingRange.setStart(range.startContainer, range.startOffset);
    trailingRange.setEnd(line, line.childNodes.length);
    const trailing = trailingRange.extractContents();

    const nextLine = document.createElement("span");
    nextLine.className = "poem-line";
    nextLine.appendChild(trailing);
    if (!nextLine.childNodes.length) nextLine.appendChild(document.createElement("br"));
    line.after(nextLine);
    placeCaretAtStart(nextLine);
  });
}

function insertHtmlAtSelection(wysiwyg, html) {
  const fragment = htmlToFragment(html);
  const poem = fragment.querySelector?.(".nodevision-poem") || null;
  const firstLine = poem?.querySelector?.(".poem-line") || null;
  const range = selectionRangeInside(wysiwyg);
  if (range) {
    range.deleteContents();
    range.insertNode(fragment);
  } else {
    wysiwyg.appendChild(fragment);
  }
  placeCaretAtStart(firstLine || poem);
}

export default function insertLineNumberedPoetry() {
  const wysiwyg = getWysiwyg();
  if (!wysiwyg) {
    alert("Open an HTML document to insert line numbered poetry.");
    return;
  }

  const interval = choosePoetryInterval();
  if (!interval) return;
  storeInterval(interval);

  wysiwyg.focus();
  installPoemEditingBehavior(wysiwyg);

  const includeStyle = !styleExistsForInterval(wysiwyg, interval);
  const html = `${includeStyle ? `${buildPoemStyleBlockHtml(interval)}\n` : ""}${buildLineNumberedPoemHtml(interval)}`;
  insertHtmlAtSelection(wysiwyg, html);
}
