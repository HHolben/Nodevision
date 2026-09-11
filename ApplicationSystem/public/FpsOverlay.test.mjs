// Nodevision/ApplicationSystem/public/FpsOverlay.test.mjs
// Regression coverage for the optional workspace-wide FPS/frame-time overlay lifecycle.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

class FakeTextNode {
  constructor(text = "") {
    this.textContent = text;
    this.parentNode = null;
    this.isConnected = false;
  }
}

class FakeElement {
  constructor(tagName, document) {
    this.tagName = String(tagName || "div").toUpperCase();
    this.ownerDocument = document;
    this.children = [];
    this.childNodes = this.children;
    this.dataset = {};
    this.style = {};
    this.attributes = {};
    this.parentNode = null;
    this.isConnected = false;
    this.textContent = "";
    this.id = "";
  }

  get firstChild() {
    return this.children[0] || null;
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    this.ownerDocument.connectTree(child, this.isConnected);
    return child;
  }

  remove() {
    if (this.parentNode) {
      this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
      this.parentNode.childNodes = this.parentNode.children;
    }
    this.ownerDocument.connectTree(this, false);
    this.parentNode = null;
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  getAttribute(name) {
    return this.attributes[name] || null;
  }
}

class FakeDocument {
  constructor() {
    this.elementsById = new Map();
    this.documentElement = new FakeElement("html", this);
    this.body = new FakeElement("body", this);
    this.documentElement.isConnected = true;
    this.body.isConnected = true;
  }

  createElement(tagName) {
    return new FakeElement(tagName, this);
  }

  createTextNode(text = "") {
    return new FakeTextNode(text);
  }

  getElementById(id) {
    return this.elementsById.get(id) || null;
  }

  connectTree(node, connected) {
    if (!node) return;
    node.isConnected = Boolean(connected);
    if (node.id) {
      if (connected) this.elementsById.set(node.id, node);
      else if (this.elementsById.get(node.id) === node) this.elementsById.delete(node.id);
    }
    for (const child of node.children || []) this.connectTree(child, connected);
  }
}

const scheduledFrames = new Map();
let rafSequence = 0;
const storage = new Map();
const document = new FakeDocument();
const window = {
  document,
  NodevisionState: {},
  localStorage: {
    getItem: (key) => storage.has(key) ? storage.get(key) : null,
    setItem: (key, value) => { storage.set(key, String(value)); },
  },
  requestAnimationFrame(callback) {
    rafSequence += 1;
    scheduledFrames.set(rafSequence, callback);
    return rafSequence;
  },
  cancelAnimationFrame(id) {
    scheduledFrames.delete(id);
  },
  dispatchEvent() {},
};

globalThis.window = window;
globalThis.document = document;
globalThis.CustomEvent = class CustomEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.detail = options.detail;
  }
};

globalThis.performance = { now: () => 0 };

const overlay = await import("./FpsOverlay.mjs?test=" + Date.now());

function runNextFrame(timestamp) {
  const [id, callback] = scheduledFrames.entries().next().value || [];
  assert.ok(id, "expected one pending RAF callback");
  scheduledFrames.delete(id);
  callback(timestamp);
}

function overlayNodes() {
  return document.body.children.filter((node) => node.id === "nv-fps-overlay");
}

assert.equal(overlay.initializeFpsOverlayFromPreference(), false, "overlay starts disabled without stored preference");
assert.equal(window.NodevisionState.fpsOverlayVisible, false, "startup records disabled overlay state");
assert.equal(overlay.enableFpsOverlay(), true, "enable succeeds in a browser-like environment");
assert.equal(scheduledFrames.size, 1, "enable schedules one RAF loop");
assert.equal(overlayNodes().length, 1, "enable creates one overlay node");
assert.equal(storage.get("nodevision.fpsOverlay"), "1", "enable persists the View preference");
assert.equal(window.NodevisionState.fpsOverlayVisible, true, "enable updates toolbar state source");

const firstRafId = [...scheduledFrames.keys()][0];
overlay.enableFpsOverlay();
assert.equal(scheduledFrames.size, 1, "enabling twice does not create duplicate RAF loops");
assert.equal([...scheduledFrames.keys()][0], firstRafId, "enabling twice preserves the pending RAF callback");
assert.equal(overlayNodes().length, 1, "enabling twice does not create duplicate overlay nodes");

for (let i = 0; i < 150; i += 1) {
  runNextFrame(1000 + i * 16.7);
}
const activeSnapshot = overlay.getFpsOverlaySnapshot();
assert.equal(activeSnapshot.enabled, true, "snapshot reports enabled state");
assert.equal(activeSnapshot.rafActive, true, "snapshot reports active RAF loop");
assert.equal(activeSnapshot.overlayConnected, true, "snapshot reports connected overlay");
assert.equal(activeSnapshot.frameHistoryLength, activeSnapshot.frameWindowSize, "frame history remains bounded");
assert.ok(document.getElementById("nv-fps-overlay").firstChild.textContent.includes("FPS:"), "overlay text shows FPS");
assert.ok(document.getElementById("nv-fps-overlay").firstChild.textContent.includes("Frame:"), "overlay text shows frame time");
assert.ok(document.getElementById("nv-fps-overlay").firstChild.textContent.includes("Worst:"), "overlay text shows worst frame time");
assert.ok(document.getElementById("nv-fps-overlay").firstChild.textContent.includes("Slow:"), "overlay text shows slow-frame count");

assert.equal(overlay.disableFpsOverlay(), false, "disable reports disabled state to callers");
assert.equal(scheduledFrames.size, 0, "disable cancels the pending RAF callback");
assert.equal(overlay.getFpsOverlaySnapshot().enabled, false, "disable clears enabled state");
assert.equal(overlay.getFpsOverlaySnapshot().overlayConnected, false, "disable removes the overlay node");
assert.equal(overlayNodes().length, 0, "disable removes the overlay from the document");
assert.equal(storage.get("nodevision.fpsOverlay"), "0", "disable persists the off preference");
assert.equal(window.NodevisionState.fpsOverlayVisible, false, "disable updates toolbar state source");

assert.equal(overlay.enableFpsOverlay(), true, "re-enable works after disable");
assert.equal(scheduledFrames.size, 1, "re-enable starts exactly one RAF loop");
overlay.destroyFpsOverlay();
assert.equal(scheduledFrames.size, 0, "destroy cleanup stops RAF activity");

storage.set("nodevision.fpsOverlay", "1");
assert.equal(overlay.initializeFpsOverlayFromPreference(), true, "stored preference re-enables overlay at startup");
assert.equal(scheduledFrames.size, 1, "preference initialization starts one RAF loop");
overlay.disableFpsOverlay();

const here = path.dirname(fileURLToPath(import.meta.url));
const viewToolbar = JSON.parse(await readFile(path.join(here, "ToolbarJSONfiles/viewToolbar.json"), "utf8"));
const showFpsItem = viewToolbar.find((item) => item.heading === "Show FPS");
assert.ok(showFpsItem, "View menu contains Show FPS item");
assert.equal(showFpsItem.callbackKey, "toggleFpsOverlay", "Show FPS uses the overlay toggle callback");
assert.equal(showFpsItem.checkedStateKey, "fpsOverlayVisible", "Show FPS has declarative checked state");

console.log("ok - FPS overlay toggles cleanly and keeps bounded frame history");
