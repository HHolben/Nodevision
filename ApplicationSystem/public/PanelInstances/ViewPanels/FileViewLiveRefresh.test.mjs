// Regression coverage for FileView live refresh lifecycle gating.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

class FakeElement {
  constructor() {
    this.dataset = {};
    this.children = [];
    this.parentElement = null;
  }
  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }
  closest(selector) {
    let node = this.parentElement;
    while (node) {
      if (selector === ".nv-panel-tab-content" && node.dataset?.nvPanelTabId) return node;
      if (selector === ".panel-cell" && node.dataset?.panelId) return node;
      node = node.parentElement;
    }
    return null;
  }
  querySelector(selector) {
    if (selector === "[data-nv-file-view-root=\"true\"], #element-view") {
      return this.children.find((child) => child.dataset?.nvFileViewRoot === "true" || child.id === "element-view") || null;
    }
    return null;
  }
}

function loadFileViewHelper(source) {
  let transformed = source.replace(/import[\s\S]*?from\s+"[^"]+";\n?/g, "");
  transformed = transformed.replace(/export\s+/g, "");
  return new Function(
    "guardFileSwitch",
    "getNodevisionNavigationState",
    "getNodevisionRouteBase",
    "normalizeNotebookRelativePath",
    "toNotebookAssetUrl",
    "toPhpDeploymentUrl",
    "applyLinkRecordEdit",
    "csvToList",
    "fetchNotebookText",
    "listToCsv",
    "normalizeSymbols",
    "saveNotebookText",
    "scanFileForLinkRecords",
    "selectedGraphLink",
    "setSelectedGraphLink",
    "summarizeLinkRecord",
    "updateToolbarState",
    "setStatus",
    "getLiveFileContentForPath",
    transformed + "\nreturn { activeFileViewCanRefreshPath };"
  );
}

let activeContent = null;
globalThis.window = {
  localStorage: { getItem: () => "true", setItem: () => {} },
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => {},
  setTimeout,
  clearTimeout,
};
globalThis.document = {
  querySelector(selector) {
    if (selector === ".panel-cell.active-panel .nv-panel-tab-content:not([hidden])") return activeContent;
    return null;
  },
  querySelectorAll: () => [],
  getElementById: () => null,
  body: { contains: () => false },
};
globalThis.CustomEvent = class CustomEvent { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } };

const source = await readFile(new URL("./FileView.mjs", import.meta.url), "utf8");
const makeModule = loadFileViewHelper(source);
const { activeFileViewCanRefreshPath } = makeModule(
  () => {},
  () => ({}),
  () => "",
  (value = "") => String(value || "").replace(/^Notebook\//, ""),
  (value = "") => value,
  (value = "") => value,
  () => {},
  () => [],
  async () => "",
  () => "",
  () => [],
  async () => {},
  async () => [],
  () => null,
  () => {},
  () => "",
  () => {},
  () => {},
  () => null
);

{
  const cell = new FakeElement();
  cell.dataset.panelId = "FileView";
  cell.dataset.currentFilePath = "A.html";
  const content = new FakeElement();
  content.dataset.nvPanelTabId = "tab-file-view";
  content.dataset.currentFilePath = "A.html";
  const root = new FakeElement();
  root.dataset.nvFileViewRoot = "true";
  root.dataset.currentFilePath = "A.html";
  cell.appendChild(content);
  content.appendChild(root);
  activeContent = content;

  assert.equal(activeFileViewCanRefreshPath("A.html"), true, "active matching FileView should accept live refreshes");
  assert.equal(activeFileViewCanRefreshPath("Notebook/A.html"), true, "Notebook-prefixed paths should match the same active FileView");
  assert.equal(activeFileViewCanRefreshPath("B.html"), false, "different files should not refresh the active FileView");
}

{
  activeContent = null;
  assert.equal(activeFileViewCanRefreshPath("A.html"), false, "hidden or unmounted FileView roots should pause live refreshes");
}

console.log("ok - FileView live refresh only runs for a matching active viewer root");
