// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/SvgPropertiesPanelLifecycle.test.mjs
// Regression coverage for SVGPropertiesPanel subscription ownership and teardown.

import assert from "node:assert/strict";

class FakeClassList {
  constructor() { this.values = new Set(); }
  add(...items) { items.filter(Boolean).forEach((item) => this.values.add(item)); }
  remove(...items) { items.forEach((item) => this.values.delete(item)); }
  contains(item) { return this.values.has(item); }
}

class FakeElement {
  constructor(tagName = "div") {
    this.tagName = String(tagName).toUpperCase();
    this.children = [];
    this.parentElement = null;
    this.attributes = {};
    this.dataset = {};
    this.style = {};
    this.classList = new FakeClassList();
    this.eventListeners = new Map();
    this.value = "";
    this.checked = false;
    this.disabled = false;
    this.type = "";
    this.id = "";
    this._textContent = "";
  }
  get parentNode() { return this.parentElement; }
  get isConnected() {
    let node = this;
    while (node) {
      if (node === globalThis.document || node === globalThis.document.body) return true;
      node = node.parentElement;
    }
    return false;
  }
  get textContent() { return this._textContent + this.children.map((child) => child.textContent || "").join(""); }
  set textContent(value) { this._textContent = String(value || ""); this.children = []; }
  get innerHTML() { return this.textContent; }
  set innerHTML(value) { this.children = []; this._textContent = String(value || ""); }
  appendChild(child) {
    if (!child) return child;
    child.remove?.();
    child.parentElement = this;
    this.children.push(child);
    return child;
  }
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
  getAttribute(name) { return Object.hasOwn(this.attributes, name) ? this.attributes[name] : null; }
  removeAttribute(name) { delete this.attributes[name]; if (name === "id") this.id = ""; }
  addEventListener(type, listener) {
    if (!this.eventListeners.has(type)) this.eventListeners.set(type, new Set());
    this.eventListeners.get(type).add(listener);
  }
  removeEventListener(type, listener) { this.eventListeners.get(type)?.delete(listener); }
  dispatchEvent(event) {
    for (const listener of this.eventListeners.get(event.type) || []) listener.call(this, event);
    return true;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  querySelectorAll(selector) {
    const out = [];
    const visit = (node) => {
      if (selector === ":scope > defs" && node.parentElement === this && node.tagName?.toLowerCase() === "defs") out.push(node);
      else if (selector === "stop" && node.tagName?.toLowerCase() === "stop") out.push(node);
      else if (selector === "[id]" && node.id) out.push(node);
      else if (selector.startsWith("#") && node.id === selector.slice(1)) out.push(node);
      node.children.forEach(visit);
    };
    this.children.forEach(visit);
    return out;
  }
}

class FakeDocument extends FakeElement {
  constructor() { super("document"); this.body = new FakeElement("body"); this.appendChild(this.body); }
  createElement(tagName) { return new FakeElement(tagName); }
  createElementNS(_ns, tagName) { return new FakeElement(tagName); }
  createTextNode(value) { const node = new FakeElement("#text"); node.textContent = value; return node; }
}

class InstrumentedWindow {
  constructor() { this.listeners = new Map(); this.registrations = []; }
  addEventListener(type, listener, options = {}) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
    this.registrations.push({ type, listener });
    if (options?.signal) {
      options.signal.addEventListener("abort", () => this.removeEventListener(type, listener), { once: true });
    }
  }
  removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
  dispatchEvent(event) {
    for (const listener of [...(this.listeners.get(event.type) || [])]) listener.call(this, event);
    return true;
  }
  activeCount(type) { return this.listeners.get(type)?.size || 0; }
}

const observers = [];
class FakeMutationObserver {
  constructor(callback) { this.callback = callback; this.disconnected = false; this.observeCalls = 0; observers.push(this); }
  observe() { this.observeCalls += 1; }
  disconnect() { this.disconnected = true; }
}

if (typeof globalThis.Event !== "function") {
  globalThis.Event = class Event { constructor(type) { this.type = type; } };
}
if (typeof globalThis.CustomEvent !== "function") {
  globalThis.CustomEvent = class CustomEvent extends Event { constructor(type, init = {}) { super(type); this.detail = init.detail; } };
}

globalThis.document = new FakeDocument();
globalThis.window = new InstrumentedWindow();
globalThis.MutationObserver = FakeMutationObserver;
globalThis.CSS = { escape: (value) => String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&") };

function makeContext(name) {
  const svgRoot = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const selected = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  selected.setAttribute("id", `${name}-rect`);
  selected.setAttribute("x", name === "A" ? "10" : "40");
  selected.setAttribute("y", "20");
  selected.setAttribute("width", "30");
  selected.setAttribute("height", "40");
  selected.setAttribute("fill", name === "A" ? "#112233" : "#778899");
  selected.setAttribute("stroke", "#445566");
  selected.setAttribute("stroke-width", "1");
  svgRoot.appendChild(selected);
  document.body.appendChild(svgRoot);
  const calls = { getSelectedElements: 0, getSelectedElement: 0, getSelectedBounds: 0, notifyElementChanged: 0 };
  return {
    svgRoot,
    selected,
    calls,
    getSelectedElements: () => { calls.getSelectedElements += 1; return [selected]; },
    getSelectedElement: () => { calls.getSelectedElement += 1; return selected; },
    getSelectedBounds: () => { calls.getSelectedBounds += 1; return { x: Number(selected.getAttribute("x")), y: 20, width: 30, height: 40 }; },
    getCurrentStyleDefaults: () => ({ fill: "#80c0ff", stroke: "#000000", strokeWidth: "1" }),
    setSelectedBounds: () => true,
    setFillColor: (value) => selected.setAttribute("fill", value),
    setStrokeColor: (value) => selected.setAttribute("stroke", value),
    setStrokeWidth: (value) => selected.setAttribute("stroke-width", value),
    notifyElementChanged: () => { calls.notifyElementChanged += 1; },
    recordSvgSnapshot: (_label, operation) => operation?.(),
  };
}

const { setupPanel } = await import("./SVGPropertiesPanel.mjs?lifecycle-test=" + Date.now());
const panel = document.createElement("div");
document.body.appendChild(panel);
const selectionEvent = () => new CustomEvent("nv-svg-editor-selection-changed", { detail: { reason: "selection" } });
const geometryEvent = () => new CustomEvent("nv-svg-editor-selection-mutated", { detail: { reason: "geometry" } });
const styleEvent = () => new CustomEvent("nv-svg-editor-selection-mutated", { detail: { reason: "style" } });

const ctxA = makeContext("A");
window.SVGEditorContext = ctxA;
let cleanup = null;
for (let index = 0; index < 5; index += 1) cleanup = await setupPanel(panel, {});
assert.equal(typeof cleanup, "function", "setup returns an idempotent cleanup function");
assert.equal(window.activeCount("nv-svg-editor-selection-changed"), 1, "repeated setup keeps one selection listener");
assert.equal(window.activeCount("nv-svg-editor-selection-mutated"), 1, "repeated setup keeps one mutation listener");
assert.ok(observers.filter((observer) => !observer.disconnected).length <= 1, "repeated setup keeps one active observer");

const beforeSelection = ctxA.calls.getSelectedElements;
window.dispatchEvent(selectionEvent());
const singleSelectionRefresh = ctxA.calls.getSelectedElements - beforeSelection;
assert.ok(singleSelectionRefresh > 0, "selection event refreshes the panel");

const beforeGeometry = ctxA.calls.getSelectedElements;
window.dispatchEvent(geometryEvent());
assert.equal(ctxA.calls.getSelectedElements - beforeGeometry, singleSelectionRefresh, "one geometry mutation causes one intended refresh");

const beforeStyle = ctxA.calls.getSelectedElements;
window.dispatchEvent(styleEvent());
assert.equal(ctxA.calls.getSelectedElements - beforeStyle, singleSelectionRefresh, "one style mutation causes one intended refresh");
assert.match(panel.textContent, /A-rect/, "active panel displays the selected element");

const ctxB = makeContext("B");
window.SVGEditorContext = ctxB;
cleanup = await setupPanel(panel, {});
assert.equal(window.activeCount("nv-svg-editor-selection-changed"), 1, "context switch keeps one selection listener");
assert.equal(window.activeCount("nv-svg-editor-selection-mutated"), 1, "context switch keeps one mutation listener");
assert.match(panel.textContent, /B-rect/, "active panel displays the new SVG context");

const oldContextCalls = ctxA.calls.getSelectedElements;
window.dispatchEvent(new CustomEvent("nv-svg-editor-selection-mutated", { detail: { reason: "geometry", selectedElements: [ctxA.selected], primary: ctxA.selected } }));
assert.equal(ctxA.calls.getSelectedElements, oldContextCalls, "events from the old SVG context do not update after switching");
assert.match(panel.textContent, /B-rect/, "old-context event does not stale the active panel");

cleanup();
cleanup();
assert.equal(window.activeCount("nv-svg-editor-selection-changed"), 0, "cleanup removes selection listener");
assert.equal(window.activeCount("nv-svg-editor-selection-mutated"), 0, "cleanup removes mutation listener");
assert.equal(observers.filter((observer) => !observer.disconnected).length, 0, "cleanup disconnects observers");
const afterCleanupCalls = ctxB.calls.getSelectedElements;
window.dispatchEvent(geometryEvent());
assert.equal(ctxB.calls.getSelectedElements, afterCleanupCalls, "closed panel no longer responds");

cleanup = await setupPanel(panel, {});
assert.equal(window.activeCount("nv-svg-editor-selection-changed"), 1, "reopened panel installs one selection listener");
assert.equal(window.activeCount("nv-svg-editor-selection-mutated"), 1, "reopened panel installs one mutation listener");
const afterReopenCalls = ctxB.calls.getSelectedElements;
window.dispatchEvent(selectionEvent());
assert.equal(ctxB.calls.getSelectedElements - afterReopenCalls, singleSelectionRefresh, "reopened panel responds exactly once");
cleanup();

console.log("ok - SVG Properties panel cleans up lifecycle subscriptions");
