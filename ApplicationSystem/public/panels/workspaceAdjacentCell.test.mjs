// Regression coverage for programmatic adjacent workspace cell placement.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

class FakeClassList {
  constructor(owner) { this.owner = owner; this.values = new Set(); }
  add(...items) { items.filter(Boolean).forEach((item) => this.values.add(item)); this.owner._className = [...this.values].join(" "); }
  remove(...items) { items.forEach((item) => this.values.delete(item)); this.owner._className = [...this.values].join(" "); }
  contains(item) { return this.values.has(item); }
  setFromString(value = "") { this.values = new Set(String(value).split(/\s+/).filter(Boolean)); this.owner._className = [...this.values].join(" "); }
}

class FakeElement {
  constructor(tagName = "div") {
    this.tagName = String(tagName).toUpperCase();
    this.children = [];
    this.parentElement = null;
    this.dataset = {};
    this.style = {};
    this.attributes = {};
    this.isConnected = false;
    this.hidden = false;
    this.textContent = "";
    this.classList = new FakeClassList(this);
    this._className = "";
  }
  get className() { return this._className; }
  set className(value) { this.classList.setFromString(value); }
  get parentNode() { return this.parentElement; }
  get nextSibling() {
    if (!this.parentElement) return null;
    const index = this.parentElement.children.indexOf(this);
    return index >= 0 ? this.parentElement.children[index + 1] || null : null;
  }
  appendChild(child) {
    child.remove?.();
    child.parentElement = this;
    child.isConnected = this.isConnected;
    this.children.push(child);
    child.children?.forEach?.(connectTree);
    return child;
  }
  append(...nodes) { nodes.forEach((node) => this.appendChild(node)); }
  insertBefore(child, before = null) {
    child.remove?.();
    child.parentElement = this;
    child.isConnected = this.isConnected;
    const index = before ? this.children.indexOf(before) : -1;
    if (index >= 0) this.children.splice(index, 0, child);
    else this.children.push(child);
    child.children?.forEach?.(connectTree);
    return child;
  }
  replaceChild(next, previous) {
    const index = this.children.indexOf(previous);
    if (index < 0) throw new Error("child not found");
    previous.parentElement = null;
    previous.isConnected = false;
    next.remove?.();
    next.parentElement = this;
    next.isConnected = this.isConnected;
    this.children[index] = next;
    next.children?.forEach?.(connectTree);
    return previous;
  }
  remove() {
    if (!this.parentElement) return;
    const siblings = this.parentElement.children;
    const index = siblings.indexOf(this);
    if (index >= 0) siblings.splice(index, 1);
    this.parentElement = null;
    this.isConnected = false;
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() { return true; }
  contains(node) {
    if (node === this) return true;
    return this.children.some((child) => child.contains?.(node));
  }
  querySelectorAll(selector) {
    const out = [];
    const visit = (node) => {
      if (selector === ".panel-cell" && node.classList?.contains("panel-cell")) out.push(node);
      node.children.forEach(visit);
    };
    this.children.forEach(visit);
    return out;
  }
}

function connectTree(node) {
  node.isConnected = true;
  node.children?.forEach?.(connectTree);
}

function makeDocument() {
  const body = new FakeElement("body");
  body.isConnected = true;
  return {
    body,
    head: new FakeElement("head"),
    createElement: (tagName) => new FakeElement(tagName),
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: (selector) => body.querySelectorAll(selector),
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  };
}

function loadWorkspaceHelper(source) {
  let transformed = source.replace(/import[\s\S]*?from\s+"[^"]+";\n?/g, "");
  transformed = transformed.replace(/import\s+"[^"]+";\n?/g, "");
  transformed = transformed.replace(/export\s+/g, "");
  return new Function(
    "logStatus",
    "setStatus",
    "activatePanelTab",
    "closePanelTabsInCell",
    "findPanelTabMatch",
    "getActivePanelTab",
    "openPanelTabInCell",
    "serializePanelTabsForCell",
    transformed + "\nreturn { ensureAdjacentPanelCell };"
  );
}

const source = await readFile(new URL("./workspace.mjs", import.meta.url), "utf8");
const makeWorkspace = loadWorkspaceHelper(source);

function flexWeight(element) {
  return Number.parseFloat(String(element?.style?.flex || ""));
}

function rounded(value) {
  return Math.round(Number(value) * 100) / 100;
}

function createWorkspaceApi() {
  globalThis.document = makeDocument();
  globalThis.window = {
    NodevisionState: {},
    activeCell: null,
    addEventListener: () => {},
    dispatchEvent: () => {},
    highlightActiveCell: (cell) => { if (cell) cell.classList.add("active-panel"); },
  };
  globalThis.CustomEvent = class CustomEvent { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } };
  return makeWorkspace(
    () => {},
    () => {},
    () => null,
    () => {},
    () => null,
    (cell) => cell?.__nvPanelTabs?.tabs?.find?.((tab) => tab.tabId === cell.__nvPanelTabs.activeTabId) || null,
    () => null,
    () => null
  );
}

{
  const { ensureAdjacentPanelCell } = createWorkspaceApi();
  const row = new FakeElement("div");
  row.className = "panel-row";
  row.dataset.direction = "row";
  row.dataset.isVertical = "0";

  const fileManager = new FakeElement("div");
  fileManager.className = "panel-cell";
  fileManager.dataset.id = "FileManager";
  fileManager.dataset.panelId = "FileManager";
  fileManager.style.flex = "0 0 33%";

  const origin = new FakeElement("div");
  origin.className = "panel-cell";
  origin.dataset.id = "GraphicalEditor";
  origin.dataset.panelId = "GraphicalEditor";
  origin.style.flex = "0 0 67%";

  row.append(fileManager, origin);
  document.body.appendChild(row);
  connectTree(document.body);

  const result = ensureAdjacentPanelCell({
    originCell: origin,
    panelId: "WebResourceBrowserPanel",
    panelClass: "InfoPanel",
    edge: "right",
    splitPercent: 68,
    reuseAdjacentSibling: false,
  });

  assert.equal(result.didCreate, true, "fixed declarative row should create a browser split when no utility sibling is reused");
  assert.equal(rounded(flexWeight(fileManager)), 33, "unrelated sibling keeps its previous allocation weight");
  assert.equal(rounded(flexWeight(origin)), 45.56, "origin is reduced to 67% times the retained 68% split share");
  assert.equal(rounded(flexWeight(result.cell)), 21.44, "browser receives 67% times the 32% split share");
  assert.equal(rounded(flexWeight(fileManager) + flexWeight(origin) + flexWeight(result.cell)), 100, "dynamic split weights should not exceed the row allocation");
  assert.match(fileManager.style.flex, / 1 0px$/, "fixed declarative sibling should be normalized to shrinkable proportional flex");
  assert.match(origin.style.flex, / 1 0px$/, "split origin should be normalized to shrinkable proportional flex");
  assert.match(result.cell.style.flex, / 1 0px$/, "browser split should use shrinkable proportional flex");
}

{
  const { ensureAdjacentPanelCell } = createWorkspaceApi();
  const row = new FakeElement("div");
  row.className = "panel-row";
  row.dataset.direction = "row";
  row.dataset.isVertical = "0";
  const origin = new FakeElement("div");
  origin.className = "panel-cell";
  origin.dataset.id = "GraphicalEditor";
  origin.dataset.panelId = "GraphicalEditor";
  origin.style.flex = "1 1 auto";
  row.appendChild(origin);
  document.body.appendChild(row);
  connectTree(document.body);

  const result = ensureAdjacentPanelCell({ originCell: origin, panelId: "WebResourceBrowserPanel", panelClass: "InfoPanel", edge: "right", splitPercent: 68 });

  assert.equal(result.didCreate, true, "single-cell workspaces should be split for the browser");
  assert.notEqual(result.cell, origin, "browser destination must not be the editor cell");
  assert.equal(result.cell.dataset.panelId, "WebResourceBrowserPanel", "new destination receives browser cell identity");
  assert.equal(row.children.includes(origin), true, "origin editor cell remains in the workspace");
  assert.equal(row.children.includes(result.cell), true, "browser cell is attached beside the origin");
  assert.equal(rounded(flexWeight(origin)), 0.68, "origin keeps the larger side of a unit-weight split");
  assert.equal(rounded(flexWeight(result.cell)), 0.32, "browser receives the smaller side of a unit-weight split");
  assert.match(origin.style.flex, / 1 0px$/, "dynamic split should use shrinkable proportional flex");
  assert.match(result.cell.style.flex, / 1 0px$/, "new split cell should use shrinkable proportional flex");
}

{
  const { ensureAdjacentPanelCell } = createWorkspaceApi();
  const row = new FakeElement("div");
  row.className = "panel-row";
  row.dataset.direction = "row";
  row.dataset.isVertical = "0";
  const origin = new FakeElement("div");
  origin.className = "panel-cell";
  origin.dataset.id = "GraphicalEditor";
  const utility = new FakeElement("div");
  utility.className = "panel-cell";
  utility.dataset.id = "FileManager";
  utility.dataset.panelId = "FileManager";
  utility.__nvPanelTabs = { tabs: [{ tabId: "file-manager", panelType: "FileManager" }], activeTabId: "file-manager" };
  row.append(origin, utility);
  document.body.appendChild(row);
  connectTree(document.body);

  const result = ensureAdjacentPanelCell({ originCell: origin, panelId: "WebResourceBrowserPanel", panelClass: "InfoPanel", edge: "right" });

  assert.equal(result.didCreate, false, "existing adjacent utility cells should be reused");
  assert.equal(result.reused, "adjacent-sibling", "right-hand sibling is the preferred utility destination");
  assert.equal(result.cell, utility, "resource browser should target the utility cell");
  assert.deepEqual(utility.__nvPanelTabs.tabs.map((tab) => tab.panelType), ["FileManager"], "existing utility tabs are preserved before browser tab insertion");
  assert.equal(row.children.includes(origin), true, "origin editor cell remains visible");
}

{
  const { ensureAdjacentPanelCell } = createWorkspaceApi();
  const row = new FakeElement("div");
  row.className = "panel-row";
  row.dataset.direction = "row";
  row.dataset.isVertical = "0";
  const origin = new FakeElement("div");
  origin.className = "panel-cell";
  origin.dataset.id = "GraphicalEditor";
  const otherEditor = new FakeElement("div");
  otherEditor.className = "panel-cell";
  otherEditor.dataset.id = "CodeEditor";
  otherEditor.dataset.panelClass = "EditorPanel";
  row.append(origin, otherEditor);
  document.body.appendChild(row);
  connectTree(document.body);

  const result = ensureAdjacentPanelCell({ originCell: origin, panelId: "WebResourceBrowserPanel", panelClass: "InfoPanel", edge: "right" });

  assert.equal(result.didCreate, true, "adjacent editor cells should not be reused as utility browser destinations");
  assert.notEqual(result.cell, otherEditor, "browser placement must not hide another editor in a sibling tab stack");
  assert.equal(row.children.includes(otherEditor), true, "existing editor sibling remains attached");
  assert.equal(row.children.includes(result.cell), true, "new browser cell is inserted beside the origin");
}

console.log("ok - workspace adjacent panel placement splits or reuses side cells");
