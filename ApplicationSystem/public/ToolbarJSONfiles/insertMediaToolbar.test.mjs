// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/insertMediaToolbar.test.mjs
// Regression coverage for the Insert -> Media toolbar entry and subtoolbar widget contract.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const toolbarPath = new URL("./insertToolbar.json", import.meta.url);
const moduleMapPath = new URL("../PanelInstances/ModuleMap.csv", import.meta.url);
const callbackPath = new URL("../ToolbarCallbacks/insert/insertMedia.mjs", import.meta.url);
const widgetPath = new URL("./insertMediaWidget.mjs", import.meta.url);

const REQUIRED_MEDIA_MODES = [
  "HTMLediting",
  "GraphicalEditing",
  "SVG Editing",
  "Virtual World Editing",
  "VR World Editing",
];

function assertIncludesEvery(actual, expected, label) {
  for (const value of expected) {
    assert.ok(actual.includes(value), `${label} should include ${value}`);
  }
}

function moduleMapFamilies(csv) {
  const lines = csv.split("\n").map((line) => line.trim()).filter(Boolean);
  const header = (lines.shift() || "").split(",").map((column) => column.trim());
  const familyIndex = header.indexOf("Family");
  assert.notEqual(familyIndex, -1, "ModuleMap.csv should include a Family column");
  return new Set(lines.map((line) => (line.split(",")[familyIndex] || "").trim()).filter(Boolean));
}

const toolbar = JSON.parse(await readFile(toolbarPath, "utf8"));
const items = Array.isArray(toolbar) ? toolbar : toolbar.items;
assert.ok(Array.isArray(items), "insertToolbar.json should expose toolbar items");

const mediaItem = items.find((item) => item.ToolbarCategory === "Insert" && item.heading === "Media");
assert.ok(mediaItem, "Insert -> Media toolbar item should exist");
assert.equal(mediaItem.callbackKey, "insertMedia", "Insert -> Media should dispatch the insertMedia callback");
assert.equal(mediaItem.insertGroup, "media", "Insert -> Media should remain in the media insert group");
assertIncludesEvery(mediaItem.modes || [], REQUIRED_MEDIA_MODES, "Insert -> Media modes");

const widgetItem = items.find((item) => item.parentHeading === "Media" && item.script === "insertMediaWidget.mjs");
assert.ok(widgetItem, "Media subtoolbar should include the insertMediaWidget script item");
assert.ok(String(widgetItem.content || "").includes("nv-insert-media-widget"), "Media widget item should mount nv-insert-media-widget");
assert.equal(widgetItem.preventAutoSubToolbar, true, "Media widget should prevent automatic nested subtoolbar rendering");
assertIncludesEvery(widgetItem.modes || [], REQUIRED_MEDIA_MODES, "Media widget modes");

const callbackSource = await readFile(callbackPath, "utf8");
assert.match(callbackSource, /export\s+default\s+function\s+insertMedia/, "insertMedia callback should export the expected default function");
assert.match(callbackSource, /nv-show-subtoolbar/, "insertMedia callback should ask the toolbar to show the Media subtoolbar");
assert.match(callbackSource, /heading:\s*"Media"/, "insertMedia callback should target the Media heading");

const widgetSource = await readFile(widgetPath, "utf8");
assert.match(widgetSource, /loadModuleMapFamilies/, "insertMediaWidget should load available media families from ModuleMap.csv");
assert.match(widgetSource, /currentMode\s*===\s*"Virtual World Editing"/, "insertMediaWidget should detect Virtual World Editing mode");
assert.match(widgetSource, /currentMode\s*===\s*"VR World Editing"/, "insertMediaWidget should detect VR World Editing mode");
assert.match(widgetSource, /family === "Image"[\s\S]*renderImage\(panel\.mount, exts,/, "Image Insert Media should use the shared image renderer with origin context");
assert.match(widgetSource, /captureInsertMediaOriginContext/, "Insert Media widget should capture the origin before opening the floating panel");
assert.doesNotMatch(widgetSource, /insertImageAtCaret/, "Image Insert Media should not bypass the shared image form");

const families = moduleMapFamilies(await readFile(moduleMapPath, "utf8"));
for (const family of ["Image", "Video", "Sound", "Model", "Circuit"]) {
  assert.ok(families.has(family), `ModuleMap.csv should expose the ${family} family for Insert Media`);
}
if (families.has("Font")) {
  assert.ok(families.has("Font"), "ModuleMap.csv should preserve registered Font family support");
}


const imageSource = await readFile(new URL("./insertMediaImage.mjs", import.meta.url), "utf8");
assert.match(imageSource, /browse-web-resource/, "Image Insert Media should expose Browse Web for existing sources");
assert.match(imageSource, /resourceType:\s*"image"/, "Image Browse Web handoff should request image resources");
assert.match(imageSource, /restoreNamedInsertMediaState/, "Image Browse Web return should restore captured form state");
assert.match(imageSource, /originContext/, "Image Browse Web handoff should preserve Insert Media origin context");
assert.match(imageSource, /resolveSvgEditorContextForInsertMedia/, "SVG Image Insert Media should resolve the originating SVG editor instance");
assert.doesNotMatch(imageSource, /window\.SVGEditorContext\?\.insertImageFromInsertion/, "Deferred SVG Image Insert Media should not target mutable global SVGEditorContext");

const modelSource = await readFile(new URL("./insertMediaModel.mjs", import.meta.url), "utf8");
assert.match(modelSource, /browse-web-resource/, "Model Insert Media should expose Browse Web for existing sources");
assert.match(modelSource, /resourceType:\s*"model"/, "Model Browse Web handoff should request model resources");
assert.match(modelSource, /restoreNamedInsertMediaState/, "Model Browse Web return should restore captured form state");
assert.match(modelSource, /originContext/, "Model Browse Web handoff should preserve Insert Media origin context");

const browserPanelSource = await readFile(new URL("../PanelInstances/InfoPanels/WebResourceBrowserPanel.mjs", import.meta.url), "utf8");
assert.match(browserPanelSource, /export\s+async\s+function\s+setupPanel/, "WebResourceBrowserPanel should be openable as a docked workspace panel");
assert.match(browserPanelSource, /acquireResource/, "WebResourceBrowserPanel should reuse ResourceAcquisitionService");
