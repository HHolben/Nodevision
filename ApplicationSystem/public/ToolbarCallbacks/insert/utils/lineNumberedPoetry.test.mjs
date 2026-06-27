// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/utils/lineNumberedPoetry.test.mjs
// Tests semantic Line Numbered Poetry generation and line-numbering logic.

import {
  POEM_DEFAULT_INTERVAL,
  buildLineNumberedPoemHtml,
  buildLineNumberedPoemInsertionHtml,
  buildPoemStyleBlockHtml,
  buildPoemStyleCss,
  lineNumberDisplayForEntries,
  normalizeLineNumberInterval,
  parsePositiveInteger,
  poemClassForInterval,
  poemLinesFromPlainText,
  sampleLineCountForInterval,
  normalizeAllPoemBlocks,
  normalizePoemBlock,
  refreshPoemLineNumbers,
} from "./lineNumberedPoetry.mjs";
import { installPoemEditingBehavior } from "../insertLineNumberedPoetry.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertDeepEqual(actual, expected, message) {
  const left = JSON.stringify(actual);
  const right = JSON.stringify(expected);
  assert(left === right, `${message}\nExpected: ${right}\nActual:   ${left}`);
}

function assertIncludes(text, expected, message) {
  assert(String(text).includes(expected), message || `Expected ${expected}`);
}

function assertThrows(label, fn) {
  let didThrow = false;
  try {
    fn();
  } catch {
    didThrow = true;
  }
  assert(didThrow, `${label} should throw`);
}

function lineEntries(count) {
  return Array.from({ length: count }, () => ({ counted: true }));
}

function visibleNumbers(entries, interval) {
  return lineNumberDisplayForEntries(entries, interval)
    .map((record) => record.visibleNumber)
    .filter(Boolean);
}

function actualNumbers(entries, interval) {
  return lineNumberDisplayForEntries(entries, interval)
    .filter((record) => record.counted)
    .map((record) => record.actualLineNumber);
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

function runDomTests() {
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

function main() {
  assert(parsePositiveInteger("1") === 1, "positive integer parse failed");
  assert(parsePositiveInteger("0") === null, "zero should be rejected");
  assert(parsePositiveInteger("-2") === null, "negative should be rejected");
  assert(parsePositiveInteger("3.5") === null, "decimal should be rejected");
  assert(parsePositiveInteger("") === null, "blank should be rejected");
  assert(parsePositiveInteger("abc") === null, "text should be rejected");
  assert(normalizeLineNumberInterval("0") === POEM_DEFAULT_INTERVAL, "invalid interval should fall back to default");
  assert(normalizeLineNumberInterval("abc") === POEM_DEFAULT_INTERVAL, "nonnumeric interval should fall back to default");
  assertDeepEqual(
    poemLinesFromPlainText("\n  First line\nSecond line  \n\nFourth line\n"),
    ["  First line", "Second line", "", "Fourth line"],
    "selected text should preserve internal poem line breaks and stanza breaks",
  );
  assertDeepEqual(
    poemLinesFromPlainText("", []),
    [],
    "empty selected text with empty fallback should stay empty",
  );

  assertDeepEqual(visibleNumbers(lineEntries(3), 1), ["1", "2", "3"], "interval 1 should show every line");
  assertDeepEqual(visibleNumbers(lineEntries(12), 5), ["1", "5", "10"], "interval 5 should show 1, 5, 10");
  assertDeepEqual(actualNumbers([{ counted: true }, { counted: true }, { counted: false }, { counted: true }], 5), [1, 2, 3], "stanza break should not increment count");
  assertDeepEqual(visibleNumbers([{ counted: false }, { counted: true }, { counted: true }], 5), ["1"], "heading should not count before first line");
  assertDeepEqual(actualNumbers([{ counted: true }, { counted: false }, { counted: true }], 5), [1, 2], "rhyme note should not increment count");
  assertDeepEqual(
    visibleNumbers([
      { counted: false },
      ...lineEntries(4),
      { counted: false },
      { counted: false },
      ...lineEntries(6),
    ], 5),
    ["1", "5", "10"],
    "mixed block should count only poem lines",
  );
  assertDeepEqual(visibleNumbers(lineEntries(6), 0), ["1", "5"], "zero interval should fall back to 5");
  assertDeepEqual(visibleNumbers(lineEntries(6), -3), ["1", "5"], "negative interval should fall back to 5");
  assertDeepEqual(visibleNumbers(lineEntries(6), ""), ["1", "5"], "blank interval should fall back to 5");
  assertDeepEqual(visibleNumbers(lineEntries(6), "nope"), ["1", "5"], "nonnumeric interval should fall back to 5");
  assertDeepEqual(visibleNumbers(lineEntries(3), 10), ["1"], "first line should always show number 1");

  const defaultPoem = buildLineNumberedPoemHtml(5);
  assertIncludes(defaultPoem, ">poem<", "default poem should contain exactly one placeholder line");
  assert(!defaultPoem.includes("First line of poetry"), "default poem should not contain sample poetry text");
  assertIncludes(defaultPoem, "<section class=\"nv-poem nodevision-poem poem-lines-every-5\"", "semantic poem root missing");
  assertIncludes(defaultPoem, "data-line-number-step=\"5\"", "line-number step missing");
  assertIncludes(defaultPoem, "class=\"nv-poem-line\" data-poem-line=\"true\"", "counted poem line marker missing");
  assertIncludes(defaultPoem, "class=\"nv-poem-line-number\" contenteditable=\"false\"", "line number span missing");
  assertIncludes(defaultPoem, "class=\"nv-poem-line-text\"", "line text span missing");

  for (const interval of [3, 5, 7, 10, 12, 23, 50]) {
    assert(poemClassForInterval(interval) === `poem-lines-every-${interval}`, `class mismatch for ${interval}`);
    const html = buildLineNumberedPoemHtml(interval);
    assertIncludes(html, `data-line-number-step=\"${interval}\"`, `data interval missing for ${interval}`);
    const lineCount = (html.match(/class="nv-poem-line" data-poem-line="true"/g) || []).length;
    assert(lineCount === sampleLineCountForInterval(interval), `sample line count mismatch for ${interval}`);
  }

  const css = buildPoemStyleCss(5);
  assertIncludes(css, ".nv-poem .nv-poem-line", "semantic line CSS missing");
  assertIncludes(css, ".nv-poem .nv-poem-line-number[data-visible=\"true\"]", "visible line number CSS missing");
  assert(!css.includes("counter-reset"), "poem CSS should not rely on broad CSS counters");
  assert(!css.includes("counter-increment"), "poem CSS should not increment every child");

  const insertion = buildLineNumberedPoemInsertionHtml(5);
  assertIncludes(insertion, buildPoemStyleBlockHtml(), "insertion should include style block");

  const poemWithStanzaBreak = buildLineNumberedPoemHtml(2, { lines: ["one", "", "two", "   ", "three"] });
  const countedLines = (poemWithStanzaBreak.match(/class="nv-poem-line" data-poem-line="true"/g) || []).length;
  const stanzaBreaks = (poemWithStanzaBreak.match(/class="nv-poem-stanza-break" data-poem-noncounted="true"/g) || []).length;
  assert(countedLines === 3, "blank lines should not be emitted as counted poem lines");
  assert(stanzaBreaks === 2, "blank lines should become stanza breaks");

  assertThrows("invalid interval class", () => poemClassForInterval(0));

  runDomTests();

  console.log("PASS");
}

main();
