// Nodevision/ApplicationSystem/public/Controls/ControlsMetadata.test.mjs
// This test verifies that the Controls metadata resolver derives rows from shared command definitions and toolbar metadata without relying on a hard-coded Controls-only command table.

import assert from "node:assert/strict";
import { mergeControlsRows, toolbarRowsFromItems } from "./ControlsMetadata.mjs";

const toolbarRows = toolbarRowsFromItems("/ToolbarJSONfiles/settingsToolbar.json", [
  { ToolbarCategory: "Settings", heading: "Control Mappings", callbackKey: "openControlsOverlay", hotkeyText: "" },
  { ToolbarCategory: "File", heading: "Save File", callbackKey: "saveFile", hotkeyText: "Ctrl/Cmd+S" },
]);

assert.deepEqual(toolbarRows.map((row) => row.location), [
  "Settings > Control Mappings",
  "File > Save File",
]);

const rows = mergeControlsRows({
  commands: [
    { id: "viewer.open", label: "Open Viewer", description: "Open a file viewer.", category: "Viewer" },
    { id: "internal.hidden", label: "Hidden", userVisible: false },
  ],
  toolbarRows,
});

const controls = rows.find((row) => row.id === "openControlsOverlay");
assert.equal(controls.label, "Control Mappings");
assert.deepEqual(controls.locations, ["Settings > Control Mappings"]);
assert.deepEqual(controls.shortcuts, []);

const save = rows.find((row) => row.id === "saveFile");
assert.equal(save.label, "Save File");
assert.deepEqual(save.shortcuts, ["Ctrl/Cmd+S"]);
assert.deepEqual(save.locations, ["File > Save File"]);

const viewer = rows.find((row) => row.id === "viewer.open");
assert.equal(viewer.label, "Open Viewer");
assert.equal(viewer.description, "Open a file viewer.");
assert.deepEqual(viewer.locations, []);
assert.equal(rows.some((row) => row.id === "internal.hidden"), false);

console.log("Controls metadata tests passed.");
