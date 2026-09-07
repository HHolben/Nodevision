// Regression coverage for Graphical Editor live-buffer mutation boundaries.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

class FakeElement {
  constructor() {
    this.dataset = {};
    this.id = "";
    this.children = [];
    this.parentElement = null;
  }
  contains(node) {
    if (node === this) return true;
    return this.children.some((child) => child.contains?.(node));
  }
  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }
  removeAttribute(name) {
    if (name === "id") this.id = "";
  }
}

function loadGraphicalLiveHelper(source) {
  let transformed = source.replace(/import[\s\S]*?from\s+"[^"]+";\n?/g, "");
  transformed = transformed.replace(/export\s+/g, "");
  return new Function(
    "registerLiveFileContentProvider",
    "touchLiveFileContentProvider",
    "setBusyOperation",
    "setWordCountVisibility",
    "setEditorContext",
    "clearEditorContext",
    "updateToolbarState",
    transformed + "\nreturn { graphicalLiveMutationRecordsContainDocumentChange };"
  );
}

function loadPanelTabContextHelper(source, document) {
  let transformed = source.replace(/import[\s\S]*?from\s+"[^"]+";\n?/g, "");
  transformed = transformed.replace(/export\s+/g, "");
  return new Function(
    "document",
    "window",
    "setStatus",
    "setWordCountVisibility",
    "updateToolbarState",
    transformed + "\nreturn { removeDuplicateActiveIds };"
  )(document, {}, () => {}, () => {}, () => {});
}

globalThis.window = {};
globalThis.document = {
  querySelector: () => null,
  querySelectorAll: () => [],
  getElementById: () => null,
  body: { contains: () => false },
};

const graphicalSource = await readFile(new URL("./GraphicalEditor.mjs", import.meta.url), "utf8");
const makeGraphical = loadGraphicalLiveHelper(graphicalSource);
const { graphicalLiveMutationRecordsContainDocumentChange } = makeGraphical(
  () => () => {},
  () => {},
  () => {},
  () => {},
  () => {},
  () => {},
  () => {}
);

{
  const editorHost = new FakeElement();
  const mutations = [
    { type: "attributes", target: editorHost, attributeName: "data-nv-inactive-element-id" },
    { type: "attributes", target: editorHost, attributeName: "id" },
  ];
  assert.equal(
    graphicalLiveMutationRecordsContainDocumentChange(mutations, editorHost),
    false,
    "Nodevision active-tab metadata on the editor host must not touch the live HTML buffer"
  );
}

{
  const editorHost = new FakeElement();
  const image = new FakeElement();
  editorHost.appendChild(image);
  assert.equal(
    graphicalLiveMutationRecordsContainDocumentChange([
      { type: "attributes", target: image, attributeName: "src" },
    ], editorHost),
    true,
    "real document attribute edits must still touch the live HTML buffer"
  );
  assert.equal(
    graphicalLiveMutationRecordsContainDocumentChange([
      { type: "childList", target: editorHost },
    ], editorHost),
    true,
    "real document tree edits must still touch the live HTML buffer"
  );
}

{
  const graphicalHost = new FakeElement();
  graphicalHost.id = "graphical-editor";
  const activeBrowserContent = new FakeElement();
  const document = {
    querySelectorAll(selector) {
      if (selector === "#graphical-editor") return [graphicalHost];
      return [];
    },
  };
  const panelTabSource = await readFile(new URL("../../panels/panelTabContext.mjs", import.meta.url), "utf8");
  const { removeDuplicateActiveIds } = loadPanelTabContextHelper(panelTabSource, document);

  removeDuplicateActiveIds(new FakeElement(), { contentElement: activeBrowserContent });

  assert.equal(graphicalHost.id, "", "tab activation removes the fixed graphical-editor id from inactive editor hosts");
  assert.equal(graphicalHost.dataset.nvInactiveElementId, "graphical-editor", "tab activation stores the inactive fixed id as data-nv metadata");
  assert.equal(
    graphicalLiveMutationRecordsContainDocumentChange([
      { type: "attributes", target: graphicalHost, attributeName: "data-nv-inactive-element-id" },
      { type: "attributes", target: graphicalHost, attributeName: "id" },
    ], graphicalHost),
    false,
    "the exact removeDuplicateActiveIds mutations must not be treated as HTML content changes"
  );
}

console.log("ok - Graphical Editor live mutations ignore panel-tab metadata but keep document edits");
