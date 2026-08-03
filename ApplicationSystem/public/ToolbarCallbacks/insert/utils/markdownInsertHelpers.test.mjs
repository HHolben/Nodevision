// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/utils/markdownInsertHelpers.test.mjs
// This test file verifies Markdown text insertion transforms used by Insert Text toolbar commands so Markdown headings and bold text remain separate from HTML insertion behavior.

import assert from "node:assert/strict";
import { applyMarkdownBold, applyMarkdownHeading } from "./markdownInsertHelpers.mjs";

{
  const result = applyMarkdownBold("alpha beta", 6, 10);
  assert.equal(result.value, "alpha **beta**");
  assert.equal(result.selectionStart, "alpha **beta**".length);
  assert.equal(result.selectionEnd, result.selectionStart);
}

{
  const result = applyMarkdownBold("alpha", 5, 5);
  assert.equal(result.value, "alpha****");
  assert.equal(result.selectionStart, 7);
  assert.equal(result.selectionEnd, 7);
}

{
  const result = applyMarkdownHeading("Title", 0, 0, 1);
  assert.equal(result.value, "# Title");
  assert.equal(result.selectionStart, 2);
}

{
  const result = applyMarkdownHeading("one\ntwo\nthree", 0, 7, 3);
  assert.equal(result.value, "### one\n### two\nthree");
  assert.equal(result.selectionStart, 0);
  assert.equal(result.selectionEnd, "### one\n### two".length);
}

{
  const result = applyMarkdownHeading("  ## Existing", 5, 5, 4);
  assert.equal(result.value, "  #### Existing");
  assert.equal(result.selectionStart, 7);
}

{
  const result = applyMarkdownHeading("Title", 0, 0, 99);
  assert.equal(result.value, "###### Title");
}
