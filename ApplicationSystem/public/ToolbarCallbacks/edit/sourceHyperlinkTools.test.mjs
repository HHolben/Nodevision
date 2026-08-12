// Nodevision/ApplicationSystem/public/ToolbarCallbacks/edit/sourceHyperlinkTools.test.mjs
// This test verifies source-code hyperlink detection for HTML and PHP editor selections.

import assert from "node:assert/strict";
import { findAnchorInSource } from "./sourceHyperlinkTools.mjs";

const html = '<p>Read <a class="nav" href="docs/page.html">the guide</a> today.</p>';
const linkStart = html.indexOf("the guide") + 2;
const context = findAnchorInSource(html, linkStart, linkStart);
assert.equal(context.href, "docs/page.html");
assert.equal(context.innerText, "the guide");
assert.deepEqual(context.range, {
  start: html.indexOf("<a"),
  end: html.indexOf("</a>") + 4,
});

const selected = findAnchorInSource(html, html.indexOf("<a"), html.indexOf("</a>"));
assert.equal(selected.href, "docs/page.html");

const php = '<?php echo "<a href=\\'next.php\\'>Next</a>"; ?>';
const phpContext = findAnchorInSource(php, php.indexOf("Next"), php.indexOf("Next"));
assert.equal(phpContext.href, "next.php");

assert.equal(findAnchorInSource("<p>No link</p>", 3, 3), null);
