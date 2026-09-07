// Nodevision/ApplicationSystem/public/panels/panelTabsMove.test.mjs
// Regression coverage for moving live panel tabs between workspace cells.

import assert from "node:assert/strict";

class FakeClassList {
  constructor(owner) { this.owner = owner; this.values = new Set(); }
  add(...items) { items.filter(Boolean).forEach((item) => this.values.add(item)); this.owner._className = [...this.values].join(" "); }
  remove(...items) { items.forEach((item) => this.values.delete(item)); this.owner._className = [...this.values].join(" "); }
  contains(item) { return this.values.has(item); }
  toggle(item, force) {
    const next = force === undefined ? !this.values.has(item) : Boolean(force);
    if (next) this.add(item); else this.remove(item);
    return next;
  }
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
    this.classList = new FakeClassList(this);
    this._className = "";
    this.hidden = false;
    this.textContent = "";
    this.cleanup = null;
  }
  get className() { return this._className; }
  set className(value) { this.classList.setFromString(value); }
  get parentNode() { return this.parentElement; }
  get innerHTML() { return ""; }
  set innerHTML(value) { this.children = []; this.textContent = String(value || ""); }
  appendChild(child) {
    if (!child) return child;
    child.remove?.();
    child.parentElement = this;
    this.children.push(child);
    return child;
  }
  append(...nodes) { nodes.forEach((node) => this.appendChild(node)); }
  insertBefore(child, before = null) {
    if (!child) return child;
    child.remove?.();
    child.parentElement = this;
    const index = before ? this.children.indexOf(before) : -1;
    if (index >= 0) this.children.splice(index, 0, child);
    else this.children.push(child);
    return child;
  }
  remove() {
    if (!this.parentElement) return;
    const siblings = this.parentElement.children;
    const index = siblings.indexOf(this);
    if (index >= 0) siblings.splice(index, 1);
    this.parentElement = null;
  }
  replaceChildren(...nodes) { this.children.forEach((child) => { child.parentElement = null; }); this.children = []; this.append(...nodes); }
  setAttribute(name, value) { this.attributes[name] = String(value); if (name === "id") this.id = String(value); }
  getAttribute(name) { return this.attributes[name] || ""; }
  addEventListener() {}
  removeEventListener() {}
  getClientRects() { return [{ width: 100, height: 20 }]; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 20, right: 100, bottom: 20 }; }
  matches(selector) {
    if (selector.startsWith(".")) return this.classList.contains(selector.slice(1));
    return false;
  }
  closest(selector) {
    let node = this;
    while (node) {
      if (selector === ".panel-cell" && node.classList?.contains("panel-cell")) return node;
      if (selector === ".nv-panel-tab-content" && node.classList?.contains("nv-panel-tab-content")) return node;
      if (selector === ".panel" && node.classList?.contains("panel")) return node;
      node = node.parentElement;
    }
    return null;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  querySelectorAll(selector) {
    const selectors = selector.split(",").map((part) => part.trim()).filter(Boolean);
    const out = [];
    const visit = (node) => {
      for (const part of selectors) {
        if (part === ".nv-panel-tab" && node.classList?.contains("nv-panel-tab")) out.push(node);
        else if (part === ".panel-cell" && node.classList?.contains("panel-cell")) out.push(node);
        else if (part === ".panel" && node.classList?.contains("panel")) out.push(node);
        else if (part === ".nv-panel-tab-content[data-id]" && node.classList?.contains("nv-panel-tab-content") && node.dataset?.id) out.push(node);
        else if (part.startsWith("#") && node.id === part.slice(1)) out.push(node);
      }
      node.children.forEach(visit);
    };
    this.children.forEach(visit);
    return [...new Set(out)];
  }
}

class FakeDocument extends FakeElement {
  constructor() { super("document"); this.body = new FakeElement("body"); this.appendChild(this.body); }
  createElement(tagName) { return new FakeElement(tagName); }
  getElementById() { return null; }
  elementsFromPoint() { return []; }
}

if (typeof globalThis.Event !== "function") {
  globalThis.Event = class Event { constructor(type) { this.type = type; } };
}
if (typeof globalThis.CustomEvent !== "function") {
  globalThis.CustomEvent = class CustomEvent extends Event { constructor(type, init = {}) { super(type); this.detail = init.detail; } };
}

globalThis.document = new FakeDocument();
globalThis.window = {
  NodevisionState: { currentMode: "Default" },
  dispatchEvent() {},
  addEventListener() {},
  removeEventListener() {},
  highlightActiveCell() {},
};

const {
  ensurePanelTabs,
  openPanelTabInCell,
  movePanelTab,
  getActivePanelTab,
} = await import("./panelTabs.mjs");

function cell(id = "Cell", panelClass = "InfoPanel") {
  const node = new FakeElement("div");
  node.className = "panel-cell";
  node.dataset.id = id;
  node.dataset.panelId = id;
  node.dataset.panelClass = panelClass;
  document.body.appendChild(node);
  return node;
}

async function addTab(targetCell, panelType, panelClass = "InfoPanel", panelVars = {}) {
  window.activeCell = targetCell;
  return openPanelTabInCell(targetCell, { panelType, panelClass, panelVars }, (host) => {
    host.__liveState = { panelType, token: Symbol(panelType) };
    return () => { host.__cleaned = true; };
  });
}

const source = cell("Source");
const target = cell("Target");
const sourceTab = await addTab(source, "GraphicalEditor", "EditorPanel", { filePath: "Notebook/index.html" });
const targetTab = await addTab(target, "FileManager", "InfoPanel");
const liveElement = sourceTab.contentElement;
const liveState = liveElement.__liveState;

const moved = movePanelTab(source, sourceTab.tabId, target, 1);
assert.equal(moved?.tabId, sourceTab.tabId, "moved tab should become active in destination");
assert.equal(source.__nvPanelTabs, undefined, "source with final moved tab should become empty by convention");
assert.equal(target.__nvPanelTabs.tabs.length, 2, "destination should retain existing tabs and add moved tab");
assert.equal(target.__nvPanelTabs.tabs[0].tabId, targetTab.tabId, "destination tab order should preserve existing tab before insertion point");
assert.equal(target.__nvPanelTabs.tabs[1].contentElement, liveElement, "move should preserve the live content element");
assert.equal(target.__nvPanelTabs.tabs[1].contentElement.__liveState, liveState, "move should preserve live panel state object identity");
assert.equal(getActivePanelTab(target)?.tabId, sourceTab.tabId, "moved tab should be active after transfer");

const invalidSource = cell("InvalidSource");
const invalidTab = await addTab(invalidSource, "WebResourceBrowserPanel", "InfoPanel", { invocation: { returnToken: "keep-me" } });
const beforeInvalidCount = invalidSource.__nvPanelTabs.tabs.length;
assert.equal(movePanelTab(invalidSource, invalidTab.tabId, null), null, "invalid drops should be ignored");
assert.equal(invalidSource.__nvPanelTabs.tabs.length, beforeInvalidCount, "invalid drops should leave source unchanged");
assert.equal(invalidSource.__nvPanelTabs.tabs[0].panelVars.invocation.returnToken, "keep-me", "resource browser invocation state should survive no-op invalid drop");

const reorderCell = cell("Reorder");
const first = await addTab(reorderCell, "FileView", "ViewPanel", { filePath: "Notebook/a.html" });
const second = await addTab(reorderCell, "CodeEditor", "EditorPanel", { filePath: "Notebook/a.html" });
movePanelTab(reorderCell, first.tabId, reorderCell, 2);
assert.deepEqual(reorderCell.__nvPanelTabs.tabs.map((tab) => tab.tabId), [second.tabId, first.tabId], "same-panel reorder should remain distinct from cross-panel transfer");

const legacy = cell("FileManager", "InfoPanel");
const legacyChild = new FakeElement("section");
let legacyCleanupCount = 0;
legacy.cleanup = () => { legacyCleanupCount += 1; };
legacyChild.__liveState = { retained: true };
legacy.appendChild(legacyChild);
const legacyState = ensurePanelTabs(legacy);
assert.equal(legacyState.tabs.length, 1, "legacy direct panel content should be adopted as a live tab");
assert.equal(legacyState.tabs[0].contentElement.children[0], legacyChild, "legacy adoption should preserve live child object identity");
assert.equal(typeof legacyState.tabs[0].cleanup, "function", "legacy adoption should transfer existing cleanup ownership to the tab");
legacyState.tabs[0].cleanup();
assert.equal(legacyCleanupCount, 1, "transferred legacy cleanup should still run");

console.log("ok - panel tabs move live content across panels and preserve state");
