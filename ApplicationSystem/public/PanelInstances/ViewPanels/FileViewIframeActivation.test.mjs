// Regression coverage for FileView iframe activation ownership.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

class FakeEventTarget {
  constructor() {
    this.listeners = new Map();
  }
  addEventListener(type, handler, options) {
    const list = this.listeners.get(type) || [];
    list.push({ handler, capture: typeof options === "boolean" ? options : Boolean(options?.capture) });
    this.listeners.set(type, list);
  }
  removeEventListener(type, handler, options) {
    const capture = typeof options === "boolean" ? options : Boolean(options?.capture);
    const list = this.listeners.get(type) || [];
    this.listeners.set(type, list.filter((entry) => entry.handler !== handler || entry.capture !== capture));
  }
  dispatch(type, event = {}) {
    const list = [...(this.listeners.get(type) || [])];
    for (const entry of list) entry.handler({ type, target: this, ...event });
  }
  listenerCount(type) {
    return (this.listeners.get(type) || []).length;
  }
}

class FakeElement extends FakeEventTarget {
  constructor({ id = "", className = "" } = {}) {
    super();
    this.id = id;
    this.dataset = {};
    this.children = [];
    this.parentElement = null;
    this.className = className;
  }
  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }
  contains(target) {
    if (target === this) return true;
    return this.children.some((child) => child.contains?.(target));
  }
  closest(selector) {
    let node = this;
    while (node) {
      if (node.matches?.(selector)) return node;
      node = node.parentElement;
    }
    return null;
  }
  matches(selector) {
    if (selector === ".panel-cell") return this.className.split(/\s+/).includes("panel-cell");
    if (selector === ".nv-panel-tab-content") return this.className.split(/\s+/).includes("nv-panel-tab-content");
    if (selector === "[data-nv-file-view-root=\"true\"]") return this.dataset.nvFileViewRoot === "true";
    if (selector === "#element-view") return this.id === "element-view";
    if (selector === "[data-nv-file-view-root=\"true\"], #element-view") return this.dataset.nvFileViewRoot === "true" || this.id === "element-view";
    return false;
  }
  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }
  querySelectorAll(selector) {
    const found = [];
    const visit = (node) => {
      for (const child of node.children || []) {
        if (selector === "iframe" && child instanceof FakeIFrame) found.push(child);
        if (child.matches?.(selector)) found.push(child);
        visit(child);
      }
    };
    visit(this);
    return found;
  }
}

class FakeIFrame extends FakeElement {
  constructor(doc = new FakeEventTarget(), frameWindow = new FakeEventTarget()) {
    super();
    this.contentDocument = doc;
    this.contentWindow = frameWindow;
  }
}

function loadFileViewHelpers(source) {
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
    transformed + "\nreturn { installIframeActivation, cleanupViewIframeActivation, activateFileViewHost };"
  );
}

function makeViewer(path) {
  const cell = new FakeElement({ className: "panel-cell" });
  cell.dataset.panelClass = "ViewPanel";
  const content = new FakeElement({ className: "nv-panel-tab-content" });
  content.dataset.currentFilePath = path;
  const root = new FakeElement();
  root.dataset.nvFileViewRoot = "true";
  root.dataset.currentFilePath = path;
  cell.appendChild(content);
  content.appendChild(root);
  return { cell, content, root };
}

globalThis.HTMLIFrameElement = FakeIFrame;
const fakeWindow = new FakeEventTarget();
fakeWindow.NodevisionState = {};
fakeWindow.localStorage = { getItem: () => "false", setItem: () => {} };
fakeWindow.setTimeout = setTimeout;
fakeWindow.clearTimeout = clearTimeout;
fakeWindow.highlightActiveCell = (cell) => { fakeWindow.highlightedCell = cell; };
globalThis.window = fakeWindow;
globalThis.document = {
  activeElement: null,
  querySelector: () => null,
  querySelectorAll: () => [],
  getElementById: () => null,
  body: { contains: () => true },
};
globalThis.CustomEvent = class CustomEvent { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } };

const source = await readFile(new URL("./FileView.mjs", import.meta.url), "utf8");
const makeModule = loadFileViewHelpers(source);
const toolbarUpdates = [];
const { installIframeActivation, cleanupViewIframeActivation, activateFileViewHost } = makeModule(
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
  (state) => toolbarUpdates.push(state),
  () => {},
  () => null
);

{
  const viewer = makeViewer("empty.svg");
  const iframe = new FakeIFrame(new FakeEventTarget());
  viewer.root.appendChild(iframe);

  installIframeActivation(iframe, viewer.root);
  iframe.contentDocument.dispatch("pointerdown");

  assert.equal(window.activeCell, viewer.cell, "empty SVG iframe document pointerdown activates its owning FileView cell");
  assert.equal(window.NodevisionState.activeFileViewPath, "empty.svg", "activation updates active FileView path from owner root");
  assert.equal(window.__nvActivePanelElement, viewer.cell, "activation updates the canonical active panel element fallback");
}

{
  const viewer = makeViewer("already-loaded.svg");
  const doc = new FakeEventTarget();
  const iframe = new FakeIFrame(doc);
  viewer.root.appendChild(iframe);

  installIframeActivation(iframe, viewer.root);

  assert.equal(doc.listenerCount("pointerdown"), 1, "already-loaded iframe document receives activation listeners immediately");
}

{
  const viewer = makeViewer("later-loaded.svg");
  const doc = new FakeEventTarget();
  const iframe = new FakeIFrame(null);
  viewer.root.appendChild(iframe);

  installIframeActivation(iframe, viewer.root);
  assert.equal(doc.listenerCount("pointerdown"), 0, "later-loading iframe has no document listeners before contentDocument exists");
  iframe.contentDocument = doc;
  iframe.dispatch("load");

  assert.equal(doc.listenerCount("pointerdown"), 1, "later-loading iframe document receives activation listeners on load");
  doc.dispatch("mousedown");
  assert.equal(window.activeCell, viewer.cell, "later-loaded iframe mousedown activates owner");
}

{
  const viewer = makeViewer("blank-hit-test.svg");
  const iframe = new FakeIFrame(new FakeEventTarget());
  viewer.root.appendChild(iframe);

  installIframeActivation(iframe, viewer.root);
  document.activeElement = iframe;
  window.dispatch("blur");
  await new Promise((resolve) => setTimeout(resolve, 5));

  assert.equal(window.activeCell, viewer.cell, "focused iframe browsing context activates owner when blank SVG emits no document pointer event");
}

{
  const viewer = makeViewer("frame-focus.svg");
  const frameWindow = new FakeEventTarget();
  const iframe = new FakeIFrame(new FakeEventTarget(), frameWindow);
  viewer.root.appendChild(iframe);

  installIframeActivation(iframe, viewer.root);
  frameWindow.dispatch("focus");

  assert.equal(window.activeCell, viewer.cell, "iframe contentWindow focus activates owner");
}

{
  const viewerA = makeViewer("a.svg");
  const viewerB = makeViewer("b.svg");
  const iframeA = new FakeIFrame(new FakeEventTarget());
  const iframeB = new FakeIFrame(new FakeEventTarget());
  viewerA.root.appendChild(iframeA);
  viewerB.root.appendChild(iframeB);

  installIframeActivation(iframeA, viewerA.root);
  installIframeActivation(iframeB, viewerB.root);
  iframeA.contentDocument.dispatch("pointerdown");
  assert.equal(window.activeCell, viewerA.cell, "SVG A activates viewer A");
  iframeB.contentDocument.dispatch("pointerdown");
  assert.equal(window.activeCell, viewerB.cell, "SVG B activates viewer B independently of previous active viewer");
}

{
  const svgViewer = makeViewer("image.svg");
  const htmlViewer = makeViewer("page.html");
  const svgFrame = new FakeIFrame(new FakeEventTarget());
  const htmlFrame = new FakeIFrame(new FakeEventTarget());
  svgViewer.root.appendChild(svgFrame);
  htmlViewer.root.appendChild(htmlFrame);

  installIframeActivation(svgFrame, svgViewer.root);
  installIframeActivation(htmlFrame, htmlViewer.root);
  htmlFrame.contentDocument.dispatch("focusin");
  assert.equal(window.activeCell, htmlViewer.cell, "HTML iframe focus activates its owning viewer");
  svgFrame.contentDocument.dispatch("contextmenu");
  assert.equal(window.activeCell, svgViewer.cell, "SVG iframe context menu activates its owning viewer");
}

{
  const viewer = makeViewer("reload-a.svg");
  const oldDoc = new FakeEventTarget();
  const newDoc = new FakeEventTarget();
  const iframe = new FakeIFrame(oldDoc);
  viewer.root.appendChild(iframe);

  installIframeActivation(iframe, viewer.root);
  assert.equal(oldDoc.listenerCount("pointerdown"), 1, "initial iframe document listener is installed");
  viewer.root.dataset.currentFilePath = "reload-b.svg";
  viewer.content.dataset.currentFilePath = "reload-b.svg";
  iframe.contentDocument = newDoc;
  iframe.dispatch("load");

  assert.equal(oldDoc.listenerCount("pointerdown"), 0, "old iframe document listeners are removed after reload");
  assert.equal(newDoc.listenerCount("pointerdown"), 1, "new iframe document listeners are installed after reload");
  newDoc.dispatch("pointerdown");
  assert.equal(window.activeCell, viewer.cell, "reloaded iframe document still activates owner");
  assert.equal(window.NodevisionState.activeFileViewPath, "reload-b.svg", "same viewer tab reload uses the current owner path");
}

{
  const viewer = makeViewer("move.svg");
  const iframe = new FakeIFrame(new FakeEventTarget());
  viewer.root.appendChild(iframe);
  installIframeActivation(iframe, viewer.root);

  const newCell = new FakeElement({ className: "panel-cell" });
  newCell.dataset.panelClass = "ViewPanel";
  newCell.appendChild(viewer.content);
  iframe.contentDocument.dispatch("pointerdown");

  assert.equal(window.activeCell, newCell, "moved viewer root resolves the new owning cell at activation time");
}

{
  const viewer = makeViewer("closed.svg");
  const doc = new FakeEventTarget();
  const iframe = new FakeIFrame(doc);
  const blurListenersBeforeInstall = window.listenerCount("blur");
  viewer.root.appendChild(iframe);
  installIframeActivation(iframe, viewer.root);
  cleanupViewIframeActivation(viewer.root);

  assert.equal(doc.listenerCount("pointerdown"), 0, "cleanup removes iframe document pointer listeners");
  assert.equal(doc.listenerCount("focusin"), 0, "cleanup removes iframe document focus listeners");
  assert.equal(doc.listenerCount("contextmenu"), 0, "cleanup removes iframe document context menu listeners");
  assert.equal(iframe.listenerCount("pointerdown"), 0, "cleanup removes iframe shell pointer listeners");
  assert.equal(window.listenerCount("blur"), blurListenersBeforeInstall, "cleanup removes this bridge's parent-window focus fallback listener");
}

{
  const viewer = makeViewer("host.svg");
  activateFileViewHost(viewer.root);
  assert.equal(window.activeCell, viewer.cell, "direct host activation also preserves owner cell identity");
}

assert.ok(toolbarUpdates.some((state) => state.activeFileViewPath === "empty.svg"), "activation refreshes toolbar state for owner path");
console.log("ok - FileView iframe activation is owner-bound and cleaned up");
