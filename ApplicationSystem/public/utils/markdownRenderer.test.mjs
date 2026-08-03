// Nodevision/ApplicationSystem/public/utils/markdownRenderer.test.mjs
// This test file verifies shared Markdown rendering behavior for headings, emphasis, lists, links, images, code, quotes, rules, and unsafe input handling used by the viewer and MD graphical editor.

import assert from "node:assert/strict";
import { renderMarkdown } from "./markdownRenderer.mjs";

const sample = [
  "# Heading",
  "",
  "This is **bold** and *italic* with `code`.",
  "",
  "- one",
  "- two",
  "",
  "1. first",
  "2. second",
  "",
  "> quoted **text**",
  "",
  "---",
  "",
  "[Doc](notes/next.md) ![Alt](images/pic.png)",
  "",
  "```js",
  "const x = 1 < 2;",
  "```",
].join("\n");

const html = renderMarkdown(sample, { filePath: "Folder/readme.md" });

assert.match(html, /<h1>Heading<\/h1>/);
assert.match(html, /<strong>bold<\/strong>/);
assert.match(html, /<em>italic<\/em>/);
assert.match(html, /<code>code<\/code>/);
assert.match(html, /<ul>[\s\S]*<li>one<\/li>[\s\S]*<li>two<\/li>[\s\S]*<\/ul>/);
assert.match(html, /<ol>[\s\S]*<li>first<\/li>[\s\S]*<li>second<\/li>[\s\S]*<\/ol>/);
assert.match(html, /<blockquote>[\s\S]*<strong>text<\/strong>[\s\S]*<\/blockquote>/);
assert.match(html, /<hr>/);
assert.match(html, /href="\/Notebook\/Folder\/notes\/next\.md"/);
assert.match(html, /src="\/Notebook\/Folder\/images\/pic\.png"/);
assert.match(html, /<pre><code class="language-js">const x = 1 &lt; 2;<\/code><\/pre>/);

const unsafe = renderMarkdown("[bad](javascript:alert(1)) <script>alert(1)</script>");
assert.match(unsafe, /href="#"/);
assert.match(unsafe, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);

assert.match(renderMarkdown("#NoSpace"), /<h1>NoSpace<\/h1>/);
