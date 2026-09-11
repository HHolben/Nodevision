// Nodevision/ApplicationSystem/public/panels/panelTabsLifecycle.test.mjs
// Regression coverage for panel tab lifecycle hooks and canonical tab references.

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
    this.eventLog = [];
  }
  get className() { return this._className; }
  set className(value) { this.classList.setFromString(value); }
  get parentNode() { return this.parentElement; }
  get isConnected() {
    let node = this;
    while (node) {
      if (node === globalThis.document) return true;
      node = node.parentElement;
    }
    return false;
  }
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
  setAttribute(name, value) { this.attributes[name] = String(value); if (name === "id") this.id = String(value); }
  getAttribute(name) { return this.attributes[name] || ""; }
  removeAttribute(name) { delete this.attributes[name]; if (name === "id") delete this.id; }
  addEventListener() {}
  removeEventListener() {}
  dispatchEvent(event) { this.eventLog.push(event); return true; }
  getClientRects() { return [{ width: 100, height: 20 }]; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 20, right: 100, bottom: 20 }; }
  matches(selector) {
    if (selector.startsWith(".")) return this.classList.contains(selector.slice(1));
    if (selector.startsWith("#")) return this.id === selector.slice(1);
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
  getElementById(id) { return this.querySelector(`#${id}`); }
  elementsFromPoint() { return []; }
}

if (typeof globalThis.Event !== "function") {
  globalThis.Event = class Event { constructor(type) { this.type = type; } };
}
if (typeof globalThis.CustomEvent !== "function") {
  globalThis.CustomEvent = class CustomEvent extends Event {
    constructor(type, init = {}) { super(type); this.detail = init.detail; this.bubbles = Boolean(init.bubbles); }
  };
}

globalThis.document = new FakeDocument();
const windowEvents = [];
globalThis.window = {
  NodevisionState: { currentMode: "Default" },
  dispatchEvent(event) { windowEvents.push(event); return true; },
  addEventListener() {},
  removeEventListener() {},
  highlightActiveCell() {},
};

const {
  closePanelTab,
  getActivePanelTab,
  movePanelTab,
  openPanelTabInCell,
} = await import("./panelTabs.mjs");
const { setNodevisionSelectedPath } = await import("../NodevisionSelection.mjs");

function cell(id = "Cell", panelClass = "InfoPanel") {
  const node = new FakeElement("div");
  node.className = "panel-cell";
  node.dataset.id = id;
  node.dataset.panelId = id;
  node.dataset.panelClass = panelClass;
  document.body.appendChild(node);
  return node;
}

function counters() { return { activate: 0, deactivate: 0, destroy: 0 }; }

async function addLifecycleTab(targetCell, filePath, calls = counters()) {
  return openPanelTabInCell(targetCell, {
    panelType: "FileView",
    panelClass: "ViewPanel",
    panelVars: { filePath },
  }, (host) => {
    host.__liveState = { filePath, token: Symbol(filePath) };
    return {
      activate: () => { calls.activate += 1; host.__liveState.active = true; },
      deactivate: () => { calls.deactivate += 1; host.__liveState.active = false; },
      destroy: () => { calls.destroy += 1; host.__liveState.destroyed = true; },
    };
  });
}

const primary = cell("Primary", "ViewPanel");
const alphaCalls = counters();
const betaCalls = counters();
const alpha = await addLifecycleTab(primary, "Notebook/docs/Alpha.md", alphaCalls);
assert.equal(alphaCalls.activate, 1, "opening an active tab runs its activate hook after mount");
assert.equal(alpha.lifecycleState, "active");
assert.equal(alpha.reference.path, "docs/Alpha.md");
assert.equal(alpha.contentElement.__nvNodevisionReference.path, "docs/Alpha.md");

const alphaIdentity = alpha.identityKey;
setNodevisionSelectedPath("Notebook/docs/SomeoneElse.md");
assert.equal(alpha.reference.path, "docs/Alpha.md", "global selection changes do not retarget existing tab references");
assert.equal(alpha.identityKey, alphaIdentity, "global selection changes do not rewrite tab identity");

const beta = await addLifecycleTab(primary, "Notebook/other/Beta.md", betaCalls);
assert.equal(betaCalls.activate, 1);
assert.equal(alphaCalls.deactivate, 1, "opening a second tab quiets the first tab");
assert.equal(getActivePanelTab(primary).tabId, beta.tabId);

const beforeRepeat = { ...betaCalls };
await openPanelTabInCell(primary, {
  panelType: "FileView",
  panelClass: "ViewPanel",
  panelVars: { filePath: "Notebook/other/Beta.md" },
}, () => { throw new Error("duplicate tab should not remount"); });
assert.equal(betaCalls.activate, beforeRepeat.activate, "unchanged repeated refresh does not duplicate activate hooks");
assert.equal(betaCalls.deactivate, beforeRepeat.deactivate);

const activatedAlpha = await openPanelTabInCell(primary, {
  panelType: "FileView",
  panelClass: "ViewPanel",
  panelVars: { filePath: "Notebook/docs/Alpha.md" },
}, () => { throw new Error("existing Alpha tab should be reused"); });
assert.equal(activatedAlpha.tabId, alpha.tabId);
assert.equal(alphaCalls.activate, 2);
assert.equal(betaCalls.deactivate, 1);

closePanelTab(primary, beta.tabId, { force: true });
assert.equal(betaCalls.destroy, 1, "closing an inactive tab destroys it once");
closePanelTab(primary, beta.tabId, { force: true });
assert.equal(betaCalls.destroy, 1, "closing an already removed tab is unchanged");

const source = cell("Source", "ViewPanel");
const destination = cell("Destination", "ViewPanel");
const movedCalls = counters();
const movedTab = await addLifecycleTab(source, "Notebook/move/KeepState.md", movedCalls);
const liveElement = movedTab.contentElement;
const liveState = liveElement.__liveState;
const moved = movePanelTab(source, movedTab.tabId, destination, 0);
assert.equal(moved.tabId, movedTab.tabId);
assert.equal(moved.contentElement, liveElement, "moving a tab preserves the content element");
assert.equal(moved.contentElement.__liveState, liveState, "moving a tab preserves mounted content state");
assert.equal(moved.reference.path, "move/KeepState.md");
assert.equal(movedCalls.destroy, 0, "moving a tab does not destroy preserved content");
assert.equal(getActivePanelTab(destination).tabId, movedTab.tabId);

console.log("ok - panel tabs preserve lifecycle, state, and canonical references");
