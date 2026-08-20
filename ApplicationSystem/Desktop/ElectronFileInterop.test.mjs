// Nodevision/ApplicationSystem/Desktop/ElectronFileInterop.test.mjs
// This file verifies Linux file-manager clipboard parsing helpers used by Nodevision's Electron file interoperation bridge.

import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { __test } from "./ElectronFileInterop.mjs";

const first = "/tmp/nodevision interop A.txt";
const second = "/tmp/nodevision interop B.txt";
const gnome = [
  "cut",
  pathToFileURL(first).href,
  pathToFileURL(second).href,
  "",
].join("\n");

assert.equal(__test.normalizeNotebookRelativePath("/Notebook/Notes/../A.txt"), "Notes/A.txt");
assert.deepEqual(__test.parseGnomeCopiedFilesText(gnome), {
  mode: "cut",
  paths: [first, second],
});
assert.deepEqual(__test.parseUriList(`# comment\n${pathToFileURL(first).href}\n`), {
  mode: "copy",
  paths: [first],
});

const fakeClipboard = {
  readBuffer(format) {
    return format === "x-special/gnome-copied-files" ? Buffer.from(gnome, "utf8") : Buffer.alloc(0);
  },
  readText() {
    return "";
  },
};

assert.deepEqual(__test.summarizeFileClipboard({ clipboard: fakeClipboard, notebookDir: "/tmp" }), {
  success: true,
  hasFiles: true,
  count: 2,
  mode: "cut",
  notebookPaths: ["nodevision interop A.txt", "nodevision interop B.txt"],
});

console.log("Electron file interop clipboard tests passed.");
