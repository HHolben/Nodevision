// Nodevision/ApplicationSystem/public/RecentFiles.test.mjs
// This test validates browser-local recent edited file normalization, ordering, trimming, and Notebook link generation.

import assert from "node:assert/strict";
import {
  MAX_RECENT_EDITED_FILES,
  clearRecentEditedFiles,
  filePathToNotebookHref,
  getRecentEditedFiles,
  normalizeRecentFilePath,
  openRecentFile,
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

{
  const original = {
    CustomEvent: globalThis.CustomEvent,
    document: globalThis.document,
    NodevisionState: globalThis.NodevisionState,
    NodevisionNavigationState: globalThis.NodevisionNavigationState,
    requestNodevisionFileSelection: globalThis.requestNodevisionFileSelection,
    revealPathInFileManager: globalThis.revealPathInFileManager,
    revealPathInGraphManager: globalThis.revealPathInGraphManager,
  };
  const dispatched = [];
  const revealed = [];
  let lastSelectionPanel = "";
  let selectedRequest = null;

  globalThis.CustomEvent = class CustomEvent {
    constructor(type, init = {}) { this.type = type; this.detail = init.detail; }
  };
  globalThis.document = {
    dispatchEvent: (event) => dispatched.push(event),
    getElementById: (id) => id === "cy" ? {} : null,
  };
  globalThis.NodevisionState = { activePanelType: "FileManager" };
  globalThis.NodevisionNavigationState = {
    getLastFileSelectionPanelType: () => "GraphManager",
    getLastInfoPanelType: () => "FileManager",
    setLastFileSelectionPanelType: (panelType) => { lastSelectionPanel = panelType; return panelType; },
  };
  globalThis.requestNodevisionFileSelection = (path, options = {}) => {
    selectedRequest = { path, options };
    options.onSelected?.(path);
  };
  globalThis.revealPathInGraphManager = async (path, options = {}) => {
    revealed.push({ panelType: "GraphManager", path, options });
    return true;
  };
  globalThis.revealPathInFileManager = async () => { throw new Error("FileManager should not be first"); };

  assert.equal(openRecentFile("Notebook/Maps/Chart.html"), true);
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(selectedRequest.path, "Maps/Chart.html");
  assert.equal(selectedRequest.options.isDirectory, false);
  assert.equal(dispatched[0].type, "fileSelected");
  assert.deepEqual(dispatched[0].detail, { filePath: "Maps/Chart.html" });
  assert.deepEqual(revealed, [{
    panelType: "GraphManager",
    path: "Maps/Chart.html",
    options: { isDirectory: false, selectFile: false },
  }]);
  assert.equal(lastSelectionPanel, "GraphManager");

  Object.assign(globalThis, original);
}

console.log("RecentFiles tests passed.");
