// Nodevision/ApplicationSystem/public/RecentFiles.test.mjs
// This test validates browser-local recent edited file normalization, ordering, trimming, and Notebook link generation.

import assert from "node:assert/strict";
import {
  MAX_RECENT_EDITED_FILES,
  clearRecentEditedFiles,
  filePathToNotebookHref,
  getRecentEditedFiles,
  normalizeRecentFilePath,
  recordEditedFile,
} from "./RecentFiles.mjs";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

const storage = memoryStorage();
recordEditedFile("/Notebook/Notes/Draft.html", { storage, now: 10 });
recordEditedFile("Notes/Second File.md", { storage, now: 20 });
recordEditedFile("Notebook/Notes/Draft.html?cache=1", { storage, now: 30 });

assert.deepEqual(getRecentEditedFiles(storage), ["Notes/Draft.html", "Notes/Second File.md"]);
assert.equal(filePathToNotebookHref("Notes/Second File.md"), "/Notebook/Notes/Second%20File.md");
assert.equal(normalizeRecentFilePath("../outside.html"), "");
assert.equal(normalizeRecentFilePath("ApplicationSystem/config.json"), "");

for (let i = 0; i < MAX_RECENT_EDITED_FILES + 5; i += 1) {
  recordEditedFile(`Generated/file-${i}.txt`, { storage, now: 100 + i });
}

const trimmed = getRecentEditedFiles(storage);
assert.equal(trimmed.length, MAX_RECENT_EDITED_FILES);
assert.equal(trimmed[0], "Generated/file-24.txt");
assert.equal(trimmed.includes("Notes/Draft.html"), false);

clearRecentEditedFiles(storage);
assert.deepEqual(getRecentEditedFiles(storage), []);

console.log("RecentFiles tests passed.");
