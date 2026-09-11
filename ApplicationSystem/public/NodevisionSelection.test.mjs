// Nodevision/ApplicationSystem/public/NodevisionSelection.test.mjs
// Regression coverage for canonical global selection and the legacy selectedFilePath facade.

import assert from "node:assert/strict";

if (typeof globalThis.Event !== "function") {
  globalThis.Event = class Event { constructor(type) { this.type = type; } };
}
if (typeof globalThis.CustomEvent !== "function") {
  globalThis.CustomEvent = class CustomEvent extends Event {
    constructor(type, init = {}) { super(type); this.detail = init.detail; }
  };
}

const events = [];
let retargetCount = 0;
globalThis.window = {
  NodevisionState: {},
  dispatchEvent(event) { events.push(event); return true; },
  updateEditorPanel() { retargetCount += 1; },
  isCodeEditorActive() { return true; },
};

const {
  getNodevisionSelectedPath,
  getNodevisionSelection,
  getNodevisionSelectionEntries,
  installNodevisionSelectionCompatibility,
  setNodevisionSelectionEntries,
} = await import("./NodevisionSelection.mjs");

installNodevisionSelectionCompatibility();
window.selectedFilePath = "Notebook/docs/Alpha.md";
assert.equal(getNodevisionSelectedPath(), "docs/Alpha.md");
assert.equal(getNodevisionSelection().kind, "file");
assert.equal(window.NodevisionState.selectedFile, "docs/Alpha.md");
assert.equal(window.NodevisionState.selectedFileIsDirectory, false);
assert.equal(retargetCount, 0, "selection changes must not silently retarget the active editor");
assert.equal(events.at(-1).type, "nodevision-selection-changed");
assert.equal(events.at(-1).detail.path, "docs/Alpha.md");

window.__nvPendingSelectedFileMetadata = { path: "Notebook/Projects", isDirectory: true };
window.selectedFilePath = "Notebook/Projects";
assert.equal(getNodevisionSelection().kind, "directory", "pending selection metadata preserves directory kind through the legacy facade");
assert.equal(window.NodevisionState.selectedFile, "Projects");

const entries = setNodevisionSelectionEntries([
  { path: "Notebook/docs/Alpha.md" },
  { path: "Notebook/docs/Beta.md" },
  { path: "Notebook/Projects", isDirectory: true },
]);
assert.deepEqual(entries.map((ref) => ref.path), ["docs/Alpha.md", "docs/Beta.md", "Projects"]);
assert.deepEqual(window.selectedFilePaths, ["docs/Alpha.md", "docs/Beta.md", "Projects"]);
assert.equal(window.NodevisionState.selectedFileCount, 3);
assert.equal(getNodevisionSelectionEntries().length, 3);
assert.equal(getNodevisionSelection().path, "Projects", "primary selection follows the most recent entry");
assert.equal(getNodevisionSelection().kind, "directory");
assert.equal(retargetCount, 0, "multi-selection changes also leave mounted editors alone");

console.log("ok - Nodevision selection is canonical and non-retargeting");
