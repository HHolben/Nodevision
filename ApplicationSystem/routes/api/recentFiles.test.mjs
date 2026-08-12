// Nodevision/ApplicationSystem/routes/api/recentFiles.test.mjs
// This test verifies that the UserData recent-files manifest accepts only safe Notebook-relative file references.

import assert from "node:assert/strict";
import path from "node:path";
import {
  RECENT_FILES_LIMIT,
  normalizeRecentManifestPath,
  recentManifestPath,
  sanitizeRecentManifestEntries,
} from "./recentFiles.js";

assert.equal(normalizeRecentManifestPath("/Notebook/Notes/Draft.html?cache=1"), "Notes/Draft.html");
assert.equal(normalizeRecentManifestPath("Notebook/Notes/Second File.md"), "Notes/Second File.md");
assert.equal(normalizeRecentManifestPath("../../outside.html"), "");
assert.equal(normalizeRecentManifestPath("ApplicationSystem/config.json"), "");
assert.equal(normalizeRecentManifestPath("Folders/OnlyDirectory"), "");

const rawEntries = [
  { path: "Notes/Draft.html", editedAt: 10 },
  { path: "Notes/Draft.html", editedAt: 5 },
  { path: "../outside.md", editedAt: 15 },
  { path: "Notes/Second.md", editedAt: Number.NaN },
];
assert.deepEqual(sanitizeRecentManifestEntries(rawEntries), [
  { path: "Notes/Draft.html", editedAt: 10 },
  { path: "Notes/Second.md", editedAt: 0 },
]);

const manyEntries = Array.from({ length: RECENT_FILES_LIMIT + 5 }, (_, index) => `Generated/${index}.html`);
assert.equal(sanitizeRecentManifestEntries(manyEntries).length, RECENT_FILES_LIMIT);

const manifestPath = recentManifestPath({ userDataDir: "/tmp/Nodevision/UserData" });
assert.equal(manifestPath, path.join("/tmp/Nodevision/UserData", "RecentFiles", "manifest.json"));

console.log("recentFiles route tests passed.");
