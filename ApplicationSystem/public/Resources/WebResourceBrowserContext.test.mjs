// Nodevision/ApplicationSystem/public/Resources/WebResourceBrowserContext.test.mjs
// Focused coverage for the docked Web Resource Browser invocation and return contract.

import assert from "node:assert/strict";
import {
  WEB_RESOURCE_BROWSER_INTENTS,
  normalizeWebResourceBrowserInvocation,
  originContextIsAvailable,
  resourceReferenceToSourceValue,
  resourceTypeMatchesInvocation,
} from "./WebResourceBrowserContext.mjs";

const invocation = normalizeWebResourceBrowserInvocation({
  intent: WEB_RESOURCE_BROWSER_INTENTS.INSERT_MEDIA,
  resourceType: "IMAGE",
  mediaFamily: "Image",
  originEditorPath: "Notebook/Pages/index.html?cache=1",
  originEditorInstanceId: "svg-editor-a",
  originCellId: "origin-cell-a",
  originTabId: "tab-a",
  originPanelType: "GraphicalEditor",
  originPanelClass: "EditorPanel",
  targetMode: "HTMLediting",
  insertMediaOriginContext: { originCellId: "stale-cell", originCell: { nodeType: 1 }, mediaFamily: "Image" },
  insertMediaState: { fields: { existingSource: "old.png" } },
  returnToken: "fixed-token",
});

assert.equal(invocation.intent, WEB_RESOURCE_BROWSER_INTENTS.INSERT_MEDIA);
assert.equal(invocation.resourceType, "image");
assert.equal(invocation.mediaFamily, "Image");
assert.equal(invocation.originCellId, "origin-cell-a");
assert.equal(invocation.originTabId, "tab-a");
assert.equal(invocation.originPanelType, "GraphicalEditor");
assert.equal(invocation.originPanelClass, "EditorPanel");
assert.equal(invocation.originEditorInstanceId, "svg-editor-a");
assert.equal(invocation.insertMediaOriginContext.originCellId, "origin-cell-a");
assert.equal(invocation.insertMediaOriginContext.originEditorPath, "Notebook/Pages/index.html?cache=1");
assert.equal(invocation.insertMediaOriginContext.originEditorInstanceId, "svg-editor-a");
assert.equal(Object.prototype.hasOwnProperty.call(invocation.insertMediaOriginContext, "originCell"), false);
assert.equal(invocation.returnToken, "fixed-token");
assert.deepEqual(invocation.insertMediaState, { fields: { existingSource: "old.png" } });

assert.equal(resourceTypeMatchesInvocation({ resourceType: "image" }, invocation), true);
assert.equal(resourceTypeMatchesInvocation({ resourceType: "model" }, invocation), false);
assert.equal(resourceTypeMatchesInvocation({ typeId: "image" }, invocation), true);

assert.equal(resourceReferenceToSourceValue({ notebookPath: "Notebook/Images/cat.png", src: "ignored" }), "Notebook/Images/cat.png");
assert.equal(resourceReferenceToSourceValue({ source: { value: "https://example.test/cat.png" }, src: "fallback" }), "https://example.test/cat.png");
assert.equal(resourceReferenceToSourceValue({ source: { value: "data:image/png;base64,AA" }, src: "fallback.png" }), "fallback.png");

const savedWindow = globalThis.window;
globalThis.window = {
  NodevisionState: { currentMode: "HTMLediting", activeEditorFilePath: "Notebook/Pages/index.html" },
  HTMLWysiwygTools: { getEditorElement: () => ({ isConnected: true }) },
};
assert.equal(originContextIsAvailable(invocation).ok, true);

globalThis.window.NodevisionState.activeEditorFilePath = "Notebook/Pages/other.html";
assert.equal(originContextIsAvailable(invocation).ok, false);

globalThis.window = {
  VRWorldContext: { currentWorldPath: "Notebook/Worlds/room.meta" },
};
const worldInvocation = normalizeWebResourceBrowserInvocation({
  intent: WEB_RESOURCE_BROWSER_INTENTS.INSERT_MEDIA,
  resourceType: "model",
  targetMode: "Virtual World Editing",
  originEditorPath: "Notebook/Worlds/room.meta",
});
assert.equal(originContextIsAvailable(worldInvocation).ok, true);
globalThis.window.VRWorldContext.currentWorldPath = "Notebook/Worlds/other.meta";
assert.equal(originContextIsAvailable(worldInvocation).ok, false);

if (savedWindow === undefined) delete globalThis.window;
else globalThis.window = savedWindow;

console.log("ok - web resource browser context preserves and validates insert-media handoff state");
