// Nodevision/ApplicationSystem/public/panels/contextualToolbarRegistry.test.mjs
// This test file verifies that contextual toolbar registry entries are created, reused, updated, and disposed without retaining duplicate toolbar instances.

import assert from "node:assert/strict";
import { createContextualToolbarRegistry, ensureSingleContextualToolbarRender } from "./contextualToolbarRegistry.mjs";

const registry = createContextualToolbarRegistry();
const first = registry.upsert("poetry-tools", () => ({ id: 1, updates: 0 }));
const second = registry.upsert("poetry-tools", () => ({ id: 2, updates: 0 }), item => { item.updates += 1; });
assert.equal(first, second, "reselecting uses the same contextual toolbar instance");
assert.equal(registry.size(), 1, "duplicate contextual toolbars are prevented");
assert.equal(first.updates, 1, "existing toolbar receives updates");
registry.clear("poetry-tools");
assert.equal(registry.size(), 0, "toolbar cleanup removes temporary UI");

function fakeContainer() {
  const container = {
    dataset: {},
    children: [],
    get firstElementChild() { return this.children[0] || null; },
    get textContent() { return this.children.map(child => child.textContent || "").join(""); },
    set textContent(value) {
      if (value === "") this.children = [];
    },
  };
  return container;
}

function fakeToolbarChild(container, key, label = "") {
  const attrs = key ? { "data-nv-contextual-toolbar-instance": key } : {};
  const child = {
    id: "",
    title: label,
    textContent: "",
    getAttribute(name) { return attrs[name] || ""; },
    remove() {
      const index = container.children.indexOf(child);
      if (index >= 0) container.children.splice(index, 1);
    },
  };
  container.children.push(child);
  return child;
}

{
  const container = fakeContainer();
  ensureSingleContextualToolbarRender(container, "file-manager", () => {
    fakeToolbarChild(container, "File Manager::New File::NewFile", "New File");
    fakeToolbarChild(container, "File Manager::New Directory::NewDirectory", "New Directory");
    fakeToolbarChild(container, "File Manager::Rename File/Directory::renameFile", "Rename File/Directory");
  }, { force: true });
  assert.equal(container.children.length, 3, "distinct icon-only toolbar buttons are not deduped away");
}

{
  const container = fakeContainer();
  ensureSingleContextualToolbarRender(container, "graph-manager", () => {
    fakeToolbarChild(container, "Graph Manager::New Node::NewFile", "New Node");
    fakeToolbarChild(container, "Graph Manager::New Region::NewDirectory", "New Region");
    fakeToolbarChild(container, "Graph Manager::Delete Node/Region::DeleteFile", "Delete Node/Region");
    fakeToolbarChild(container, "Graph Manager::Rename Node/Region::renameFile", "Rename Node/Region");
    fakeToolbarChild(container, "Graph Manager::Selection as Root::reopenGraphRootFromSelection", "Selection as Root");
    fakeToolbarChild(container, "Graph Manager::Show External Links::graphManagerLayerControlsWidget.mjs", "Show External Links");
    fakeToolbarChild(container, "Graph Manager::Refresh Graph::UpdateEdges", "Refresh Graph");
  }, { force: true });
  assert.equal(container.children.length, 7, "Graph Manager sub-toolbar keeps all distinct icon-only node and region commands");
}
