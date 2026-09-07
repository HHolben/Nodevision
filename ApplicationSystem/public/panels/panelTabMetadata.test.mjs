// Nodevision/ApplicationSystem/public/panels/panelTabMetadata.test.mjs
// This test verifies compact panel tab labels, resource normalization, duplicate identities, and orientation normalization.

import assert from "node:assert/strict";
import {
  buildPanelTabMetadata,
  normalizeNotebookPath,
  normalizeTabOrientation,
  panelContentLabel,
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

console.log("panelTabMetadata tests passed");

