// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/insertMediaPanelOriginContext.test.mjs
// Focused coverage for Insert Media origin capture before Browse Web can steal focus.

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
    this.hidden = false;
    this.id = "";
    this._className = "";
    this.classList = new FakeClassList(this);
    this.isConnected = false;
    this._rect = { left: 0, top: 0, right: 640, bottom: 360, width: 640, height: 360 };
  }
  get className() { return this._className; }
  set className(value) { this.classList.setFromString(value); }
  appendChild(child) {
    child.parentElement = this;
    child.isConnected = this.isConnected;
    this.children.push(child);
    child.children.forEach((nested) => { nested.isConnected = child.isConnected; });
    return child;
  }
  closest(selector) {
    let node = this;
    while (node) {
      if (selector === ".panel-cell" && node.classList?.contains("panel-cell")) return node;
      if (selector === ".panel" && node.classList?.contains("panel")) return node;
      if (selector === ".panel-cell.active-panel" && node.classList?.contains("panel-cell") && node.classList?.contains("active-panel")) return node;
      node = node.parentElement;
    }
    return null;
  }
  getBoundingClientRect() { return this._rect; }
  querySelectorAll(selector) {
    const out = [];
    const visit = (node) => {
      if (selector === ".panel-cell" && node.classList?.contains("panel-cell")) out.push(node);
      else if (selector === ".panel-cell.active-panel" && node.classList?.contains("panel-cell") && node.classList?.contains("active-panel")) out.push(node);
      else if (selector.startsWith(".panel-cell[data-nv-workspace-cell-id=")) {
        const id = selector.match(/\"([^\"]+)\"/)?.[1] || "";
        if (node.classList?.contains("panel-cell") && node.dataset?.nvWorkspaceCellId === id) out.push(node);
      }
      node.children.forEach(visit);
    };
    this.children.forEach(visit);
    return out;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
}

class FakeDocument extends FakeElement {
  constructor() {
    super("document");
    this.isConnected = true;
    this.documentElement = new FakeElement("html");
    this.body = new FakeElement("body");
    this.appendChild(this.body);
  }
  createElement(tagName) { return new FakeElement(tagName); }
}

function connectTree(node) {
  node.isConnected = true;
  node.children.forEach(connectTree);
}

function loadModuleSource(source) {
  let transformed = source.replace(/import[\s\S]*?from\s+"[^"]+";\n?/g, "");
  transformed = transformed.replace(/export\s+/g, "");
  return new Function(transformed + "\nreturn { captureInsertMediaOriginContext, resolveInsertMediaOriginCell, isInsertMediaBrowserCell, describeInsertMediaOriginCell, snapshotInsertMediaOriginContext, registerSvgEditorContextForInsertMedia, resolveSvgEditorContextForInsertMedia };" )();
}

function makeCell(panelType, path = "", panelClass = "EditorPanel") {
  const cell = new FakeElement("div");
  cell.className = "panel-cell";
  cell.dataset.panelId = panelType;
  cell.dataset.id = panelType;
  cell.dataset.panelClass = panelClass;
  cell.dataset.currentFilePath = path;
  const tabId = panelType + "-" + Math.random().toString(36).slice(2, 6);
  const contentElement = new FakeElement("div");
  contentElement.dataset.currentFilePath = path;
  cell.__nvPanelTabs = {
    activeTabId: tabId,
    tabs: [{ tabId, panelType, panelClass, resourcePath: path, panelVars: { filePath: path }, contentElement }],
  };
  return cell;
}

const source = await readFile(new URL("./insertMediaPanel.mjs", import.meta.url), "utf8");
const mod = loadModuleSource(source);
const savedWindow = globalThis.window;
const savedDocument = globalThis.document;

{
  globalThis.document = new FakeDocument();
  const workspace = new FakeElement("div");
  workspace.id = "workspace";
  const row = new FakeElement("div");
  row.className = "panel-row";
  const editorA = makeCell("GraphicalEditor", "Notebook/A.html");
  const editorB = makeCell("GraphicalEditor", "Notebook/B.html");
  const browser = makeCell("WebResourceBrowserPanel", "", "InfoPanel");
  browser.className = "panel-cell active-panel";
  row.appendChild(editorA);
  row.appendChild(editorB);
  row.appendChild(browser);
  workspace.appendChild(row);
  document.body.appendChild(workspace);
  connectTree(document);

  let currentEditor = editorA;
  globalThis.window = {
    activeCell: browser,
    NodevisionState: { currentMode: "GraphicalEditing", activeEditorFilePath: "Notebook/A.html" },
    HTMLWysiwygTools: { getEditorElement: () => currentEditor },
  };

  const first = mod.captureInsertMediaOriginContext({ familyKey: "Image", mediaFamily: "Image" });
  assert.equal(first.originCell, editorA, "first capture should use editor A despite active browser focus");
  assert.equal(first.originEditorPath, "A.html", "first capture should store the editor A path");
  assert.equal(mod.resolveInsertMediaOriginCell(first), editorA, "stored cell id should resolve back to editor A");
  assert.equal(mod.isInsertMediaBrowserCell(first.originCell), false, "editor origin should not be treated as a browser origin");

  currentEditor = editorB;
  window.NodevisionState.activeEditorFilePath = "Notebook/B.html";
  const second = mod.captureInsertMediaOriginContext({ familyKey: "Image", mediaFamily: "Image" });
  assert.equal(second.originCell, editorB, "second capture should use editor B, not a stale editor A origin");
  assert.equal(second.originEditorPath, "B.html", "second capture should store the editor B path");
  assert.notEqual(second.originCellId, first.originCellId, "editor B should keep its own stable origin id");
}

{
  globalThis.document = new FakeDocument();
  const workspace = new FakeElement("div");
  workspace.id = "workspace";
  const row = new FakeElement("div");
  row.className = "panel-row";
  const htmlEditor = makeCell("GraphicalEditor", "Notebook/index.html");
  const worldEditor = makeCell("GameView", "Notebook/Worlds/room.meta", "GamePanel");
  const browser = makeCell("WebResourceBrowserPanel", "", "InfoPanel");
  browser.className = "panel-cell active-panel";
  row.appendChild(htmlEditor);
  row.appendChild(worldEditor);
  row.appendChild(browser);
  workspace.appendChild(row);
  document.body.appendChild(workspace);
  connectTree(document);

  globalThis.window = {
    activeCell: browser,
    NodevisionState: { currentMode: "Virtual World Editing", activeEditorFilePath: "" },
    VRWorldContext: { currentWorldPath: "Notebook/Worlds/room.meta" },
    HTMLWysiwygTools: { getEditorElement: () => htmlEditor },
  };

  const context = mod.captureInsertMediaOriginContext({ familyKey: "Model", mediaFamily: "Model" });
  assert.equal(context.originCell, worldEditor, "virtual-world model capture should use the GameView cell");
  assert.equal(context.originPanelType, "GameView", "virtual-world origin should not be hard-coded to GraphicalEditor");
  assert.equal(context.originEditorPath, "Worlds/room.meta", "virtual-world origin should store the world path");
  assert.equal(mod.isInsertMediaBrowserCell(context.originCell), false, "virtual-world origin should not resolve to the browser cell");
}


{
  globalThis.document = new FakeDocument();
  const workspace = new FakeElement("div");
  workspace.id = "workspace";
  const row = new FakeElement("div");
  row.className = "panel-row";
  const editorA = makeCell("GraphicalEditor", "Notebook/A.svg");
  const editorB = makeCell("GraphicalEditor", "Notebook/B.svg");
  const contentA = editorA.__nvPanelTabs.tabs[0].contentElement;
  const contentB = editorB.__nvPanelTabs.tabs[0].contentElement;
  editorA.appendChild(contentA);
  editorB.appendChild(contentB);
  row.appendChild(editorA);
  row.appendChild(editorB);
  workspace.appendChild(row);
  document.body.appendChild(workspace);
  connectTree(document);

  globalThis.window = {
    activeCell: editorA,
    NodevisionState: { currentMode: "SVG Editing", activeEditorFilePath: "Notebook/A.svg" },
  };

  const svgA = { isConnected: true };
  const svgB = { isConnected: true };
  const contextA = { svgRoot: svgA, inserted: [], insertImageFromInsertion(insertion) { this.inserted.push(insertion); return { localName: "image" }; } };
  const contextB = { svgRoot: svgB, inserted: [], insertImageFromInsertion(insertion) { this.inserted.push(insertion); return { localName: "image" }; } };
  const registrationA = mod.registerSvgEditorContextForInsertMedia({ context: contextA, container: contentA, filePath: "Notebook/A.svg" });
  mod.registerSvgEditorContextForInsertMedia({ context: contextB, container: contentB, filePath: "Notebook/B.svg" });
  const originA = mod.snapshotInsertMediaOriginContext(editorA, { targetMode: "SVG Editing", mediaFamily: "Image" });
  assert.equal(originA.originEditorInstanceId, registrationA.instanceId, "SVG origin should capture the editor instance id");

  window.activeCell = editorB;
  window.NodevisionState.activeEditorFilePath = "Notebook/B.svg";
  const resolvedA = mod.resolveSvgEditorContextForInsertMedia(originA);
  assert.equal(resolvedA.ok, true, "SVG A origin should resolve after SVG B becomes active");
  assert.equal(resolvedA.context, contextA, "SVG insertion should target the originating editor instance");
  assert.notEqual(resolvedA.context, contextB, "SVG insertion must not use the newly active SVG editor");

  contentA.isConnected = false;
  svgA.isConnected = false;
  const closedA = mod.resolveSvgEditorContextForInsertMedia(originA);
  assert.equal(closedA.ok, false, "closed originating SVG editor should fail cleanly");
  assert.equal(closedA.code, "origin-closed", "closed SVG origin should report origin-closed");
}

if (savedWindow === undefined) delete globalThis.window;
else globalThis.window = savedWindow;
if (savedDocument === undefined) delete globalThis.document;
else globalThis.document = savedDocument;

console.log("ok - Insert Media origin capture avoids browser focus and tracks editor identity");
