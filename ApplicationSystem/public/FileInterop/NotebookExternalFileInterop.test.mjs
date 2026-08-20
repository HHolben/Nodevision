// Nodevision/ApplicationSystem/public/FileInterop/NotebookExternalFileInterop.test.mjs
// This file verifies browser-side Notebook file interoperation path helpers so imported desktop files remain Notebook-relative and traversal-free.

import assert from "node:assert/strict";
import {
  droppedFileTargetPath,
  joinNotebookPath,
  normalizeNotebookPath,
  notebookPathBasename,
  notebookPathDirname,
} from "./NotebookExternalFileInterop.mjs";

assert.equal(normalizeNotebookPath("/Notebook/Notes/example.html"), "Notes/example.html");
assert.equal(normalizeNotebookPath("Library/../outside.txt"), "Library/outside.txt");
assert.equal(normalizeNotebookPath("a//b\\c.txt"), "a/b/c.txt");

assert.equal(joinNotebookPath("Library/Images", "photo.png"), "Library/Images/photo.png");
assert.equal(joinNotebookPath("", "photo.png"), "photo.png");

assert.equal(droppedFileTargetPath("Imports", "folder/../safe.txt"), "Imports/folder/safe.txt");
assert.equal(notebookPathBasename("Imports/photo.png"), "photo.png");
assert.equal(notebookPathDirname("Imports/photo.png"), "Imports");

console.log("Notebook external file interop path tests passed.");
