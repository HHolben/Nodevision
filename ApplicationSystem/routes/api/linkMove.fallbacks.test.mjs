// Nodevision/ApplicationSystem/routes/api/linkMove.fallbacks.test.mjs
// Smoke test that move/rename link scanning includes ordered fallback attributes.

import assert from "node:assert/strict";
import {
  applySpanReplacements,
  collectLinkSpans,
} from "./linkMove.js";

const html = '<a href="../Library/Book.html" data-nodevision-fallback-1="../Archive/Book.html" data-nodevision-fallback-2="https://example.test/book">Book</a>';
const spans = collectLinkSpans(html, "html");

assert.deepEqual(spans.map((span) => span.raw), [
  "../Library/Book.html",
  "../Archive/Book.html",
  "https://example.test/book",
]);

const fallback = spans.find((span) => span.raw === "../Archive/Book.html");
const replaced = applySpanReplacements(html, [{
  start: fallback.start,
  end: fallback.end,
  value: "../Mirrors/Book.html",
}]);

assert.match(replaced, /href="\.\.\/Library\/Book\.html"/);
assert.match(replaced, /data-nodevision-fallback-1="\.\.\/Mirrors\/Book\.html"/);
assert.match(replaced, /data-nodevision-fallback-2="https:\/\/example\.test\/book"/);

console.log("ok - link move scan and replacement covers fallback attributes");
