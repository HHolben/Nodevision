// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/directoryContents/DirectoryContentsSnippet.test.mjs
// This test verifies directory contents snippet data normalization and safe script generation.

import assert from "node:assert/strict";
import {
  buildDirectoryContentsSnippet,
  buildDirectoryEntries,
  dirname,
  normalizeNotebookPath,
} from "./DirectoryContentsSnippet.mjs";

const sampleEntries = [
  { name: "Beta.php", isDirectory: false },
  { name: ".hidden.html", isDirectory: false },
  { name: "Subdir", isDirectory: true },
  { name: "alpha page.html", isDirectory: false },
];

assert.equal(normalizeNotebookPath("/Notebook/Library/page.php?x=1"), "Library/page.php");
assert.equal(dirname("/Notebook/Library/page.php?x=1"), "Library");

const entries = buildDirectoryEntries(sampleEntries);
assert.deepEqual(entries.map((entry) => entry.name), ["Subdir", "alpha page.html", "Beta.php"]);
assert.equal(entries[1].href, "alpha%20page.html");
assert.equal(entries[0].href, "Subdir/");

const orderedSnippet = buildDirectoryContentsSnippet({
  directoryPath: "Library/&quoted\"",
  entries,
  layout: "ordered",
  listStyle: "lower-alpha",
  hyperlinks: true,
});
assert.match(orderedSnippet, /data-nv-directory-path="Library\/&amp;quoted&quot;"/);
assert.match(orderedSnippet, /"layout":"ordered"/);
assert.match(orderedSnippet, /"listStyle":"lower-alpha"/);
assert.match(orderedSnippet, /"hyperlinks":true/);

const tableSnippet = buildDirectoryContentsSnippet({
  entries,
  layout: "table",
  tableStyle: "bordered",
  hyperlinks: false,
});
assert.match(tableSnippet, /document\.createElement\('table'\)/);
assert.match(tableSnippet, /"tableStyle":"bordered"/);
assert.match(tableSnippet, /"hyperlinks":false/);

const dangerousSnippet = buildDirectoryContentsSnippet({
  entries: [{ name: "bad</script>.html", isDirectory: false }],
});
assert.equal(dangerousSnippet.includes("bad</script>.html"), false);
assert.match(dangerousSnippet, /bad\\u003c\/script\\u003e\.html/);
