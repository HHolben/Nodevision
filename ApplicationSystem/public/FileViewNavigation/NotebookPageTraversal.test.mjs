// Nodevision/ApplicationSystem/public/FileViewNavigation/NotebookPageTraversal.test.mjs
// This test validates depth-first HTML/PHP page traversal for the FileView navigation sub-toolbar.

import assert from "node:assert/strict";
import { findAdjacentNotebookPage, normalizeNotebookPagePath } from "./NotebookPageTraversal.mjs";

const tree = new Map([
  ["", [
    { name: ".hidden", isDirectory: true, path: ".hidden" },
    { name: "A.html", isDirectory: false, path: "A.html" },
    { name: "B", isDirectory: true, path: "B" },
    { name: "C.php", isDirectory: false, path: "C.php" },
  ]],
  ["B", [
    { name: ".skip.html", isDirectory: false, path: "B/.skip.html" },
    { name: "01.html", isDirectory: false, path: "B/01.html" },
    { name: "Nested", isDirectory: true, path: "B/Nested" },
    { name: "readme.txt", isDirectory: false, path: "B/readme.txt" },
  ]],
  ["B/Nested", [
    { name: "last.php", isDirectory: false, path: "B/Nested/last.php" },
  ]],
]);

async function fetchDirectory(path = "") {
  return tree.get(path) || [];
}

assert.equal(normalizeNotebookPagePath("/Notebook/B/01.html?x=1"), "B/01.html");
assert.equal(await findAdjacentNotebookPage("A.html", "next", fetchDirectory), "B/01.html");
assert.equal(await findAdjacentNotebookPage("B/01.html", "next", fetchDirectory), "B/Nested/last.php");
assert.equal(await findAdjacentNotebookPage("B/Nested/last.php", "next", fetchDirectory), "C.php");
assert.equal(await findAdjacentNotebookPage("C.php", "previous", fetchDirectory), "B/Nested/last.php");
assert.equal(await findAdjacentNotebookPage("A.html", "previous", fetchDirectory), "");

console.log("NotebookPageTraversal tests passed.");
