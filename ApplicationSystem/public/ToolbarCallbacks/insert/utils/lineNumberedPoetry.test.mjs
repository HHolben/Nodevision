// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/utils/lineNumberedPoetry.test.mjs
// Tests portable Line Numbered Poetry HTML and CSS generation.

import {
  buildLineNumberedPoemHtml,
  buildLineNumberedPoemInsertionHtml,
  buildPoemStyleBlockHtml,
  buildPoemStyleCss,
  parsePositiveInteger,
  poemClassForInterval,
  sampleLineCountForInterval,
} from "./lineNumberedPoetry.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
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

function main() {
  assert(parsePositiveInteger("1") === 1, "positive integer parse failed");
  assert(parsePositiveInteger("0") === null, "zero should be rejected");
  assert(parsePositiveInteger("3.5") === null, "decimal should be rejected");
  assert(parsePositiveInteger("abc") === null, "text should be rejected");

  for (const interval of [3, 5, 7, 10, 12, 23, 50]) {
    assert(poemClassForInterval(interval) === `poem-lines-every-${interval}`, `class mismatch for ${interval}`);
    const css = buildPoemStyleCss(interval);
    assertIncludes(css, `.nodevision-poem.poem-lines-every-${interval}`, `root selector missing for ${interval}`);
    assertIncludes(css, `.poem-line:nth-of-type(${interval}n)::before`, `nth selector missing for ${interval}`);
    assertIncludes(css, "counter-reset: poem-line", `counter reset missing for ${interval}`);
    assertIncludes(css, "counter-increment: poem-line", `counter increment missing for ${interval}`);

    const html = buildLineNumberedPoemHtml(interval);
    assertIncludes(html, `class="nodevision-poem poem-lines-every-${interval}"`, `poem class missing for ${interval}`);
    assertIncludes(html, `data-line-numbering="${interval}"`, `data interval missing for ${interval}`);
    const lineCount = (html.match(/class="poem-line"/g) || []).length;
    assert(lineCount === sampleLineCountForInterval(interval), `sample line count mismatch for ${interval}`);
  }

  const cssEveryLine = buildPoemStyleCss(1);
  assertIncludes(cssEveryLine, ".poem-line::before {\n  content: counter(poem-line);", "every-line content rule missing");
  assert(!cssEveryLine.includes("nth-of-type(1n)"), "every-line CSS should not need nth-of-type(1n)");

  const insertion3 = buildLineNumberedPoemInsertionHtml(3);
  const insertion7 = buildLineNumberedPoemInsertionHtml(7);
  assertIncludes(insertion3, buildPoemStyleBlockHtml(3), "insertion should include style block");
  assertIncludes(insertion7, "poem-lines-every-7", "different intervals should coexist by class");
  assert(insertion3.includes("poem-lines-every-3") && insertion7.includes("poem-lines-every-7"), "multiple interval blocks should be distinct");

  const poemWithStanzaBreak = buildLineNumberedPoemHtml(2, { lines: ["one", "", "two", "   ", "three"] });
  const countedLines = (poemWithStanzaBreak.match(/class="poem-line"/g) || []).length;
  const stanzaBreaks = (poemWithStanzaBreak.match(/class="stanza-break"/g) || []).length;
  assert(countedLines === 3, "blank lines should not be emitted as counted poem lines");
  assert(stanzaBreaks === 2, "blank lines should become stanza breaks");
  assertIncludes(buildPoemStyleCss(2), ".stanza-break", "stanza break CSS missing");

  assertThrows("invalid interval class", () => poemClassForInterval(0));
  assertThrows("invalid interval CSS", () => buildPoemStyleCss("nope"));

  console.log("PASS");
}

main();
