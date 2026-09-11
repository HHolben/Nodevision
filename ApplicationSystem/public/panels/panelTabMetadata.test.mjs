// Nodevision/ApplicationSystem/public/panels/panelTabMetadata.test.mjs
// This test verifies compact panel tab labels, canonical references, resource normalization, duplicate identities, and orientation normalization.

import assert from "node:assert/strict";
import {
  buildPanelTabMetadata,
  normalizeNotebookPath,
  normalizeTabOrientation,
  panelContentLabel,
  serializePanelTab,
} from "./panelTabMetadata.mjs";

globalThis.window = {
  location: { origin: "http://localhost" },
  NodevisionState: { selectedFile: "Notebook/global.md" },
};

assert.equal(normalizeTabOrientation("left"), "left");
assert.equal(normalizeTabOrientation("sideways"), "top");
assert.equal(normalizeNotebookPath("/Notebook/docs/readme.md?draft=1#intro"), "docs/readme.md");
assert.equal(panelContentLabel("GraphicalEditor"), "Graphical Editor");

const fileTab = buildPanelTabMetadata({
  panelType: "FileView",
  panelClass: "ViewPanel",
  panelVars: { filePath: "Notebook/docs/readme.md" },
  tabId: "file",
});
assert.equal(fileTab.displayName, "File Viewer: readme.md");
assert.equal(fileTab.fullDisplayName, "File Viewer: docs/readme.md");
assert.equal(fileTab.resourcePath, "docs/readme.md");
assert.equal(fileTab.reference.path, "docs/readme.md");

const codeTab = buildPanelTabMetadata({
  panelType: "CodeEditor",
  panelClass: "EditorPanel",
  panelVars: { filePath: "Notebook/docs/readme.md" },
});
assert.notEqual(codeTab.identityKey, fileTab.identityKey);

const globalFileTab = buildPanelTabMetadata({ panelType: "FileView" });
assert.equal(globalFileTab.resourcePath, "global.md");

window.NodevisionState = {
  selectedFile: "Notebook/projects/other/index.html",
  activeFileViewPath: "Notebook/index.html",
};
window.currentActiveFilePath = "Notebook/index.html";
window.selectedFilePath = "Notebook/projects/other/index.html";
window.activePanel = "FileManager";
window.activePanelClass = "InfoPanel";
const selectedCodeTab = buildPanelTabMetadata({ panelType: "CodeEditor", panelClass: "EditorPanel" });
assert.equal(selectedCodeTab.resourcePath, "projects/other/index.html");
assert.equal(selectedCodeTab.fullDisplayName, "Code Editor: projects/other/index.html");

window.NodevisionState = {
  selectedFile: "Notebook/projects/other/index.html",
  activeEditorFilePath: "Notebook/current.js",
};
window.__nvCodeEditorActivePath = "Notebook/current.js";
window.currentActiveFilePath = "Notebook/projects/other/index.html";
window.activePanel = "CodeEditor";
window.activePanelClass = "EditorPanel";
const activeCodeTab = buildPanelTabMetadata({ panelType: "CodeEditor", panelClass: "EditorPanel" });
assert.equal(activeCodeTab.resourcePath, "current.js");

const fileManagerTab = buildPanelTabMetadata({ panelType: "FileManager" });
assert.equal(fileManagerTab.displayName, "File Manager");
assert.equal(fileManagerTab.resourcePath, "");

const graphTab = buildPanelTabMetadata({ panelType: "GraphManager" });
assert.equal(graphTab.displayName, "Graph View: Notebook");
assert.equal(graphTab.resourcePath, "");

const sameNameA = buildPanelTabMetadata({
  panelType: "FileView",
  panelClass: "ViewPanel",
  panelVars: { filePath: "Notebook/a/Readme.md" },
});
const sameNameB = buildPanelTabMetadata({
  panelType: "FileView",
  panelClass: "ViewPanel",
  panelVars: { filePath: "Notebook/b/Readme.md" },
});
assert.notEqual(sameNameA.identityKey, sameNameB.identityKey, "same basename in different folders needs distinct tab identity");

const caseA = buildPanelTabMetadata({
  panelType: "FileView",
  panelClass: "ViewPanel",
  panelVars: { filePath: "Notebook/Case/Alpha.md" },
});
const caseB = buildPanelTabMetadata({
  panelType: "FileView",
  panelClass: "ViewPanel",
  panelVars: { filePath: "Notebook/case/Alpha.md" },
});
assert.notEqual(caseA.identityKey, caseB.identityKey, "case-sensitive Notebook paths must remain distinct");

const directoryTab = buildPanelTabMetadata({
  panelType: "FileView",
  panelClass: "ViewPanel",
  panelVars: { filePath: "Notebook/projects/site", isDirectory: true },
});
assert.equal(directoryTab.reference.kind, "directory");
assert.equal(directoryTab.identityKey.includes("notebook:local-notebook:directory:projects/site"), true);

const serialized = serializePanelTab(directoryTab);
assert.deepEqual(serialized.reference, {
  type: "notebook",
  rootId: "local-notebook",
  kind: "directory",
  path: "projects/site",
});
assert.deepEqual(serialized.panelVars.reference, serialized.reference);

console.log("panelTabMetadata tests passed");
