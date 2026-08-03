// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/utils/lineNumberedPoetryDomTests.mjs
// This module runs DOM-dependent tests for semantic line-numbered poetry editing behavior.

import { normalizeAllPoemBlocks, normalizePoemBlock, refreshPoemLineNumbers } from "./lineNumberedPoetry.mjs";
import { installPoemEditingBehavior } from "../insertLineNumberedPoetry.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertDeepEqual(actual, expected, message) {
  const left = JSON.stringify(actual);
  const right = JSON.stringify(expected);
  assert(left === right, `${message}\nExpected: ${right}\nActual:   ${left}`);
}

function hasDom() {
  return typeof document !== "undefined" && typeof window !== "undefined" && typeof Node !== "undefined";
}

function domRoot(html = "") {
  const root = document.createElement("div");
  root.innerHTML = html;
  return root;
}

function poemFromHtml(html) {
  const root = domRoot(html);
  const poem = root.querySelector(".nv-poem, .nodevision-poem");
  assert(poem, "poem fixture missing root element");
  return poem;
}

function countedNumbers(poem) {
  return Array.from(poem.querySelectorAll(".nv-poem-line[data-poem-line='true'][data-poem-line-number]"))
    .map((line) => Number(line.getAttribute("data-poem-line-number")));
}

function visibleNumbersFromDom(poem) {
  return Array.from(poem.querySelectorAll(".nv-poem-line-number[data-visible='true']"))
    .map((span) => span.textContent.trim())
    .filter(Boolean);
}

function placeCaretIn(el) {
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}

export function runLineNumberedPoetryDomTests() {
  if (!hasDom()) {
    console.warn("SKIP DOM poetry tests: document/window are not available in this runtime.");
    return;
  }

  const controlsPoem = poemFromHtml(`<section class="nv-poem"><div class="nv-poem-controls"><button>Add poem line</button></div><div class="nv-poem-line" data-poem-line="true"><span class="nv-poem-line-text">one</span></div></section>`);
  normalizePoemBlock(controlsPoem);
  assert(!controlsPoem.querySelector(".nv-poem-controls"), "normalize/save should remove inline poem controls");

  const directTextPoem = poemFromHtml(`<section class="nv-poem"><div class="nv-poem-line" data-poem-line="true">of the midnight ride of Paul Revere<span class="nv-poem-line-number"></span><span class="nv-poem-line-text"></span></div></section>`);
  normalizePoemBlock(directTextPoem);
  assert(directTextPoem.querySelector(".nv-poem-line-text").textContent.trim() === "of the midnight ride of Paul Revere", "direct text should move into line text span");

  const emptyPoem = poemFromHtml(`<section class="nv-poem"><div class="nv-poem-line" data-poem-line="true"><span class="nv-poem-line-text">one</span></div><div class="nv-poem-line" data-poem-line="true"><span class="nv-poem-line-text"></span></div><div class="nv-poem-line" data-poem-line="true"><span class="nv-poem-line-text">two</span></div></section>`);
  normalizePoemBlock(emptyPoem);
  assertDeepEqual(countedNumbers(emptyPoem), [1, 2], "empty poem line should not be counted");
  assert(emptyPoem.querySelectorAll(".nv-poem-stanza-break").length === 1, "empty poem line should become stanza break");

  const intervalPoem = poemFromHtml(`<section class="nv-poem" data-line-number-step="5">${Array.from({ length: 12 }, (_, i) => `<div class="nv-poem-line" data-poem-line="true"><span class="nv-poem-line-text">line ${i + 1}</span></div>`).join("")}</section>`);
  refreshPoemLineNumbers(intervalPoem);
  assertDeepEqual(visibleNumbersFromDom(intervalPoem), ["1", "5", "10"], "interval 5 should show 1, 5, 10");

  const stanzaPoem = poemFromHtml(`<section class="nv-poem"><div class="nv-poem-line" data-poem-line="true"><span class="nv-poem-line-text">one</span></div><div class="nv-poem-line" data-poem-line="true"><span class="nv-poem-line-text">two</span></div><div class="nv-poem-stanza-break" data-poem-noncounted="true"></div><div class="nv-poem-line" data-poem-line="true"><span class="nv-poem-line-text">three</span></div></section>`);
  refreshPoemLineNumbers(stanzaPoem);
  assertDeepEqual(countedNumbers(stanzaPoem), [1, 2, 3], "stanza break should not increment numbering");

  const headingPoem = poemFromHtml(`<section class="nv-poem"><div class="nv-poem-heading" data-poem-noncounted="true">Canto I</div><div class="nv-poem-line" data-poem-line="true"><span class="nv-poem-line-text">one</span></div><div class="nv-poem-line" data-poem-line="true"><span class="nv-poem-line-text">two</span></div></section>`);
  normalizePoemBlock(headingPoem);
  assertDeepEqual(countedNumbers(headingPoem), [1, 2], "heading should not increment numbering");
  assert(!headingPoem.querySelector(".nv-poem-heading").hasAttribute("data-poem-line-number"), "heading should not have poem line number");

  const rhymePoem = poemFromHtml(`<section class="nv-poem"><div class="nv-poem-line" data-poem-line="true"><span class="nv-poem-line-text">one</span></div><div class="nv-poem-rhyme-note" data-poem-noncounted="true">ABAB</div><div class="nv-poem-line" data-poem-line="true"><span class="nv-poem-line-text">two</span></div></section>`);
  normalizePoemBlock(rhymePoem);
  assertDeepEqual(countedNumbers(rhymePoem), [1, 2], "rhyme note should not increment numbering");
  assert(!rhymePoem.querySelector(".nv-poem-rhyme-note").hasAttribute("data-poem-line-number"), "rhyme note should not have poem line number");

  const malformedOrderPoem = poemFromHtml(`<section class="nv-poem"><div class="nv-poem-line" data-poem-line="true">text before<span class="nv-poem-line-number"></span><span class="nv-poem-line-text"></span></div></section>`);
  normalizePoemBlock(malformedOrderPoem);
  const children = Array.from(malformedOrderPoem.querySelector(".nv-poem-line").children).map((el) => el.className);
  assert(children[0] === "nv-poem-line-number" && children[1] === "nv-poem-line-text", "normalize should restore line-number then text order");

  const editor = domRoot(`<section class="nv-poem"><div class="nv-poem-line" data-poem-line="true"><span class="nv-poem-line-number" contenteditable="false" data-visible="true">1</span><span class="nv-poem-line-text">one</span></div></section>`);
  editor.id = "wysiwyg";
  editor.contentEditable = "true";
  document.body.appendChild(editor);
  const cleanup = installPoemEditingBehavior(editor);
  placeCaretIn(editor.querySelector(".nv-poem-line-text"));
  editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
  assert(editor.querySelectorAll(".nv-poem-line[data-poem-line='true']").length === 2, "Enter should create a new poem line");
  const activeNode = window.getSelection().anchorNode;
  const activeElement = activeNode.nodeType === Node.ELEMENT_NODE ? activeNode : activeNode.parentElement;
  assert(activeElement.closest(".nv-poem-line-text") === editor.querySelectorAll(".nv-poem-line-text")[1], "Enter caret should land in new line text span");
  cleanup();
  editor.remove();

  const stableRoot = domRoot(`<section class="nv-poem" data-line-number-step="5"><div class="nv-poem-line" data-poem-line="true"><span class="nv-poem-line-text">one</span></div><div class="nv-poem-stanza-break" data-poem-noncounted="true"></div><div class="nv-poem-heading" data-poem-noncounted="true"><span class="nv-poem-heading-text">Canto I</span></div><div class="nv-poem-rhyme-note" data-poem-noncounted="true"><span class="nv-poem-rhyme-note-text">ABAB</span></div><div class="nv-poem-line" data-poem-line="true"><span class="nv-poem-line-text">two</span></div><div class="nv-poem-controls"><button>bad</button></div></section>`);
  normalizeAllPoemBlocks(stableRoot);
  const saved = stableRoot.innerHTML;
  const reloadRoot = domRoot(saved);
  normalizeAllPoemBlocks(reloadRoot);
  assertDeepEqual(countedNumbers(reloadRoot.querySelector(".nv-poem")), [1, 2], "save/load should preserve line numbers");
  assert(!reloadRoot.querySelector(".nv-poem-controls"), "saved body should not contain poem controls");
}
