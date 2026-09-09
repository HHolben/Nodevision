// Nodevision/ApplicationSystem/public/panels/panelTabContextRegression.test.mjs
// Regression coverage for active tab/content toolbar context after FileView -> GraphicalEditor switches.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { evaluateToolbarItemState } from "./toolbarConditions.mjs";

const contextSource = await readFile(new URL("./panelTabContext.mjs", import.meta.url), "utf8");
const graphicalEditorSource = await readFile(new URL("../PanelInstances/EditorPanels/GraphicalEditor.mjs", import.meta.url), "utf8");
const htmlEditorSource = await readFile(new URL("../PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImpl.mjs", import.meta.url), "utf8");
const svgEditorSource = await readFile(new URL("../PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntime.mjs", import.meta.url), "utf8");
const tableToolsSource = await readFile(new URL("../ToolbarCallbacks/insert/tableTools.mjs", import.meta.url), "utf8");
const drawToolbar = JSON.parse(await readFile(new URL("../ToolbarJSONfiles/drawToolbar.json", import.meta.url), "utf8"));
const insertToolbar = JSON.parse(await readFile(new URL("../ToolbarJSONfiles/insertToolbar.json", import.meta.url), "utf8"));

const mediaItem = insertToolbar.find((item) => item.ToolbarCategory === "Insert" && item.heading === "Media");
const structureItem = insertToolbar.find((item) => item.ToolbarCategory === "Insert" && item.heading === "Structure");
const tableItem = insertToolbar.find((item) => item.ToolbarCategory === "Insert" && item.heading === "Insert Table");
assert.ok(mediaItem, "Insert -> Media toolbar item should exist");
assert.ok(structureItem, "Insert -> Structure toolbar item should exist");
assert.ok(tableItem, "Insert -> Insert Table toolbar item should exist");
assert.ok(mediaItem.modes.includes("GraphicalEditing"), "Insert -> Media should be available in GraphicalEditing mode");
assert.ok(mediaItem.modes.includes("HTMLediting"), "Insert -> Media should remain available in HTMLediting mode");
assert.ok(structureItem.modes.includes("HTMLediting"), "Insert -> Structure should be available in HTMLediting mode");
assert.ok(tableItem.modes.includes("HTMLediting"), "Insert -> Insert Table should be available in HTMLediting mode");

const graphicalState = {
  currentMode: "GraphicalEditing",
  selectedFile: "Notebook/projects/site/index.html",
  activeEditorFilePath: "Notebook/projects/site/index.html",
  activeFileViewPath: "Notebook/projects/site/index.html",
};
const htmlState = {
  currentMode: "HTMLediting",
  selectedFile: "Notebook/projects/site/index.html",
  activeEditorFilePath: "Notebook/projects/site/index.html",
};
const fileViewState = {
  currentMode: "Default",
  selectedFile: "Notebook/projects/site/index.html",
  activeFileViewPath: "Notebook/projects/site/index.html",
};
assert.equal(evaluateToolbarItemState(mediaItem, { state: graphicalState }).visible, true, "Media should pass filtering for active GraphicalEditor content");
assert.equal(evaluateToolbarItemState(mediaItem, { state: fileViewState }).visible, false, "Media should not remain visible for Default/FileView context");
assert.equal(evaluateToolbarItemState(structureItem, { state: htmlState }).visible, true, "Structure should pass filtering for active HTML editor content");
assert.equal(evaluateToolbarItemState(tableItem, { state: htmlState }).visible, true, "Insert Table should pass filtering for active HTML editor content");
assert.equal(evaluateToolbarItemState(structureItem, { state: graphicalState }).visible, false, "Structure should be filtered out in generic GraphicalEditing mode");
assert.equal(evaluateToolbarItemState(tableItem, { state: graphicalState }).visible, false, "Insert Table should be filtered out in generic GraphicalEditing mode");
const visibleGraphicalInsertItems = insertToolbar
  .filter((item) => item.modes?.includes?.("GraphicalEditing"))
  .filter((item) => evaluateToolbarItemState(item, { state: graphicalState }).visible)
  .map((item) => item.heading || item.parentHeading || "");
assert.ok(visibleGraphicalInsertItems.some((heading) => heading && heading !== "Media"), "GraphicalEditing should expose non-Media graphical insert commands too");

assert.match(contextSource, /if \(type === "FileView"\) applyFileViewContext\(tab\)/, "FileView tabs should apply viewer context through the active-tab bridge");
assert.match(contextSource, /else if \(type === "GraphicalEditor"\) applyGraphicalEditorContext\(tab\)/, "GraphicalEditor tabs should apply editor context through the active-tab bridge");
assert.match(contextSource, /currentMode:\s*"GraphicalEditing"/, "GraphicalEditor tab activation should refresh toolbar mode to GraphicalEditing");
assert.match(contextSource, /__nvHtmlEditorContext/, "GraphicalEditor tab activation should detect an embedded HTML editor context");
assert.match(contextSource, /htmlContext\.activate\(\)/, "GraphicalEditor tab activation should restore HTMLediting toolbar context when present");
assert.match(contextSource, /currentMode:\s*"Default"/, "FileView tab activation should restore viewer/default toolbar mode");

assert.match(graphicalEditorSource, /function enableGraphicalEditorActivation/, "GraphicalEditor should bind content activation handlers");
assert.match(graphicalEditorSource, /activateGraphicalEditorHost\(editorDiv\)/, "GraphicalEditor content activation should reassert editor context");
assert.match(graphicalEditorSource, /owningCell\.dataset\.id = "GraphicalEditor"/, "GraphicalEditor activation should repair stale FileView cell identity");
assert.match(graphicalEditorSource, /activePanelChanged/, "GraphicalEditor activation should notify shared active-panel listeners");
assert.match(graphicalEditorSource, /__nvPanelTabContentIsActive/, "GraphicalEditor activation should ignore inactive hidden tab content");
assert.match(graphicalEditorSource, /__nvHtmlEditorContext/, "GraphicalEditor activation should detect embedded HTML editor context");
assert.match(graphicalEditorSource, /htmlContext\.activate\(\)/, "GraphicalEditor activation should restore HTMLediting toolbar context when present");
assert.match(graphicalEditorSource, /await updateGraphicalEditor\(initialPath, \{ force: true, host: container \}\);\s*activateGraphicalEditorHost\(container\);/, "GraphicalEditor setup should reapply editor context after initial render");
assert.match(htmlEditorSource, /currentMode:\s*editorMode/, "HTML editor activation should refresh toolbar state with HTMLediting mode");
assert.match(htmlEditorSource, /window.__nvTableEditorRoot = wysiwyg/, "HTML editor activation should publish the active table editor root");
assert.match(htmlEditorSource, /getEditorElement:\s*\(\) => wysiwyg/, "HTML editor context should expose its WYSIWYG element");
assert.match(tableToolsSource, /HTMLWysiwygTools\?\.getEditorElement/, "Table insertion should prefer the active HTML WYSIWYG tools root");
assert.match(tableToolsSource, /__nvActiveHtmlEditorContext/, "Table insertion should fall back to the active HTML editor context before old DOM lookup");

const svgInsertShapeItem = insertToolbar.find((item) => item.heading === "Insert Shape" && item.modes?.includes?.("SVG Editing"));
const svgVectorDrawItem = drawToolbar.find((item) => item.heading === "Vector Draw" && item.parentHeading === "Draw" && item.modes?.includes?.("SVG Editing"));
assert.ok(svgInsertShapeItem, "SVG Insert -> Insert Shape should be available in SVG Editing mode");
assert.ok(svgVectorDrawItem, "SVG Draw -> Vector Draw should be available in SVG Editing mode");
assert.equal(evaluateToolbarItemState(svgInsertShapeItem, { state: { currentMode: "SVG Editing" } }).visible, true, "SVG Insert Shape should pass SVG Editing filtering");
assert.equal(evaluateToolbarItemState(svgVectorDrawItem, { state: { currentMode: "SVG Editing" } }).visible, true, "SVG Vector Draw should pass SVG Editing filtering");
assert.match(svgEditorSource, /activateSvgEditorContext/, "SVG editor should expose a precise activation hook");
assert.match(svgEditorSource, /currentMode:\s*"SVG Editing"/, "SVG activation should refresh toolbar state with SVG Editing mode");
assert.match(svgEditorSource, /container.__nvSvgEditorContext = svgEditorContext/, "SVG editor context should be stored on its host for tab activation");
assert.match(graphicalEditorSource, /__nvSvgEditorContext/, "GraphicalEditor activation should detect embedded SVG editor context");
assert.match(graphicalEditorSource, /svgContext\.activate\(\)/, "GraphicalEditor activation should restore SVG toolbar context when present");
assert.match(contextSource, /svgContext\.activate\(\)/, "Tab activation should restore SVG toolbar context when present");

console.log("ok - active panel tab context switches between FileView and GraphicalEditor toolbar modes");
