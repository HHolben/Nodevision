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
} from "./lineNumberedPoetry.mjs";

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

  console.log("PASS");
}

main();
