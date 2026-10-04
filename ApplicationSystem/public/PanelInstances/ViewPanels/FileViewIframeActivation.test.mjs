// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewIframeActivation.test.mjs
// This module verifies that iframe input activates the owning FileView panel and that removing a viewer releases its event listeners.
import { readModularSource } from '../../../../scripts/read-modular-source.mjs';
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { FakeEventTarget, FakeElement, FakeIFrame, loadFileViewHelpers, makeViewer } from './FileViewIframeActivationFixtures.mjs';

// Exercise activation and cleanup against the owning panel.
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

const source = await readModularSource(new URL("./FileView.mjs", import.meta.url));
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
