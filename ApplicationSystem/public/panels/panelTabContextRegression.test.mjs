// Nodevision/ApplicationSystem/public/panels/panelTabContextRegression.test.mjs
// Regression coverage for active tab/content toolbar context after FileView -> GraphicalEditor switches.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { evaluateToolbarItemState } from "./toolbarConditions.mjs";

const contextSource = await readFile(new URL("./panelTabContext.mjs", import.meta.url), "utf8");
const graphicalEditorSource = await readFile(new URL("../PanelInstances/EditorPanels/GraphicalEditor.mjs", import.meta.url), "utf8");
const insertToolbar = JSON.parse(await readFile(new URL("../ToolbarJSONfiles/insertToolbar.json", import.meta.url), "utf8"));

const mediaItem = insertToolbar.find((item) => item.ToolbarCategory === "Insert" && item.heading === "Media");
assert.ok(mediaItem, "Insert -> Media toolbar item should exist");
assert.ok(mediaItem.modes.includes("GraphicalEditing"), "Insert -> Media should be available in GraphicalEditing mode");
assert.ok(mediaItem.modes.includes("HTMLediting"), "Insert -> Media should remain available in HTMLediting mode");

const graphicalState = {
  currentMode: "GraphicalEditing",
  selectedFile: "Notebook/projects/site/index.html",
  activeEditorFilePath: "Notebook/projects/site/index.html",
  activeFileViewPath: "Notebook/projects/site/index.html",
};
const fileViewState = {
  currentMode: "Default",
  selectedFile: "Notebook/projects/site/index.html",
  activeFileViewPath: "Notebook/projects/site/index.html",
};
assert.equal(evaluateToolbarItemState(mediaItem, { state: graphicalState }).visible, true, "Media should pass filtering for active GraphicalEditor content");
assert.equal(evaluateToolbarItemState(mediaItem, { state: fileViewState }).visible, false, "Media should not remain visible for Default/FileView context");
const visibleGraphicalInsertItems = insertToolbar
  .filter((item) => item.modes?.includes?.("GraphicalEditing"))
  .filter((item) => evaluateToolbarItemState(item, { state: graphicalState }).visible)
  .map((item) => item.heading || item.parentHeading || "");
assert.ok(visibleGraphicalInsertItems.some((heading) => heading && heading !== "Media"), "GraphicalEditing should expose non-Media graphical insert commands too");

assert.match(contextSource, /if \(type === "FileView"\) applyFileViewContext\(tab\)/, "FileView tabs should apply viewer context through the active-tab bridge");
assert.match(contextSource, /else if \(type === "GraphicalEditor"\) applyGraphicalEditorContext\(tab\)/, "GraphicalEditor tabs should apply editor context through the active-tab bridge");
assert.match(contextSource, /currentMode:\s*"GraphicalEditing"/, "GraphicalEditor tab activation should refresh toolbar mode to GraphicalEditing");
assert.match(contextSource, /currentMode:\s*"Default"/, "FileView tab activation should restore viewer/default toolbar mode");

assert.match(graphicalEditorSource, /function enableGraphicalEditorActivation/, "GraphicalEditor should bind content activation handlers");
assert.match(graphicalEditorSource, /activateGraphicalEditorHost\(editorDiv\)/, "GraphicalEditor content activation should reassert editor context");
assert.match(graphicalEditorSource, /owningCell\.dataset\.id = "GraphicalEditor"/, "GraphicalEditor activation should repair stale FileView cell identity");
assert.match(graphicalEditorSource, /activePanelChanged/, "GraphicalEditor activation should notify shared active-panel listeners");
assert.match(graphicalEditorSource, /__nvPanelTabContentIsActive/, "GraphicalEditor activation should ignore inactive hidden tab content");
assert.match(graphicalEditorSource, /await updateGraphicalEditor\(initialPath, \{ force: true, host: container \}\);\s*activateGraphicalEditorHost\(container\);/, "GraphicalEditor setup should reapply editor context after initial render");

console.log("ok - active panel tab context switches between FileView and GraphicalEditor toolbar modes");
