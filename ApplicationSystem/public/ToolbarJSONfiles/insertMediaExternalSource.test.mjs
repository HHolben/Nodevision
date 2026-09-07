// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/insertMediaExternalSource.test.mjs
// Behavior coverage for Insert -> Media -> Browse Web handoff.

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
    this.listeners = {};
    this.classList = new FakeClassList(this);
    this._className = "";
    this.textContent = "";
    this.type = "";
    this.value = "";
    this.checked = false;
    this.isConnected = false;
  }
  get className() { return this._className; }
  set className(value) { this.classList.setFromString(value); }
  get parentNode() { return this.parentElement; }
  appendChild(child) {
    child.remove?.();
    child.parentElement = this;
    child.isConnected = this.isConnected;
    this.children.push(child);
    child.children?.forEach?.((nested) => { nested.isConnected = child.isConnected; });
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
    return child;
  }
  removeChild(child) { child.remove(); return child; }
  remove() {
    if (!this.parentElement) return;
    const siblings = this.parentElement.children;
    const index = siblings.indexOf(this);
    if (index >= 0) siblings.splice(index, 1);
    this.parentElement = null;
    this.isConnected = false;
  }
  setAttribute(name, value) { this.attributes[name] = String(value); if (name === "id") this.id = String(value); }
  getAttribute(name) { return this.attributes[name] || ""; }
  addEventListener(type, handler) { (this.listeners[type] ||= []).push(handler); }
  async dispatch(type, init = {}) {
    const event = {
      type,
      target: init.target || this,
      preventDefaultCalled: false,
      stopPropagationCalled: false,
      preventDefault() { this.preventDefaultCalled = true; },
      stopPropagation() { this.stopPropagationCalled = true; },
    };
    for (const handler of this.listeners[type] || []) await handler(event);
    return event;
  }
  matches(selector) {
    if (selector.startsWith(".")) return this.classList.contains(selector.slice(1));
    if (selector === "input,select") return ["INPUT", "SELECT"].includes(this.tagName);
    return false;
  }
  closest(selector) {
    let node = this;
    while (node) {
      if (selector === ".panel" && node.classList?.contains("panel")) return node;
      if (selector === ".panel-cell" && node.classList?.contains("panel-cell")) return node;
      if (selector === ".panel-cell.active-panel" && node.classList?.contains("panel-cell") && node.classList?.contains("active-panel")) return node;
      node = node.parentElement;
    }
    return null;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  querySelectorAll(selector) {
    const out = [];
    const visit = (node) => {
      if (selector === ".panel-cell" && node.classList?.contains("panel-cell")) out.push(node);
      else if (selector === ".panel-cell.active-panel" && node.classList?.contains("panel-cell") && node.classList?.contains("active-panel")) out.push(node);
      else if (selector === "#workspace .panel-row" && node.classList?.contains("panel-row") && node.closestWorkspace?.()) out.push(node);
      else if (/^input\[name=/.test(selector) && node.tagName === "INPUT") out.push(node);
      else if (/^\[data-action=/.test(selector)) {
        const action = selector.match(/"([^"]+)"/)?.[1] || selector.match(/=([^\]]+)/)?.[1]?.replace(/["']/g, "");
        if (node.dataset?.action === action) out.push(node);
      }
      node.children.forEach(visit);
    };
    this.children.forEach(visit);
    return out;
  }
  closestWorkspace() {
    let node = this;
    while (node) {
      if (node.id === "workspace") return node;
      node = node.parentElement;
    }
    return null;
  }
}

class FakeDocument extends FakeElement {
  constructor() {
    super("document");
    this.isConnected = true;
    this.body = new FakeElement("body");
    this.appendChild(this.body);
  }
  createElement(tagName) { return new FakeElement(tagName); }
  querySelector(selector) {
    if (selector === "#workspace .panel-row") {
      return this.querySelectorAll(selector)[0] || null;
    }
    return super.querySelector(selector);
  }
}

function loadModuleSource(source) {
  let transformed = source.replace(/import[\s\S]*?from\s+"[^"]+";\n?/g, "");
  transformed = transformed.replace(/export\s+/g, "");
  return new Function(
    "WEB_RESOURCE_BROWSER_INTENTS",
    "normalizeWebResourceBrowserInvocation",
    "originContextIsAvailable",
    "resourceReferenceToSourceValue",
    "resourceTypeMatchesInvocation",
    "setStatusBar",
    "ensureAdjacentPanelCell",
    "logWebResourcePlacementDiagnostics",
    "scheduleWebResourceVisibilityDiagnostics",
    "serializeWebResourceLayoutTree",
    "describeInsertMediaOriginCell",
    "getInsertMediaOriginContext",
    "isInsertMediaBrowserCell",
    "resolveInsertMediaOriginCell",
    "snapshotInsertMediaOriginContext",
    transformed + "\nreturn { attachInsertMediaBrowseWebHandler, launchInsertMediaWebResourceBrowser, originCellFromPanel };"
  );
}

function connectTree(node) {
  node.isConnected = true;
  node.children.forEach(connectTree);
}

const source = await readFile(new URL("./insertMediaExternalSource.mjs", import.meta.url), "utf8");
let statusBarCalls = [];
let placementCalls = [];
const makeModule = loadModuleSource(source);
const mod = makeModule(
  { INSERT_MEDIA: "insert-media", ACQUIRE_RESOURCE: "acquire-resource" },
  (input) => ({ ...input, returnToken: "test-token" }),
  () => ({ ok: true }),
  (resource) => resource?.src || "",
  (resource, invocation) => resource?.resourceType === invocation.resourceType,
  (...args) => statusBarCalls.push(args),
  (options) => {
    placementCalls.push(options);
    const destination = new FakeElement("div");
    destination.className = "panel-cell";
    destination.dataset.panelId = "WebResourceBrowserPanel";
    destination.dataset.id = "WebResourceBrowserPanel";
    options.originCell.parentElement.insertBefore(destination, options.originCell.nextSibling || null);
    connectTree(destination);
    return { cell: destination, originCell: options.originCell, didCreate: true, reused: "split" };
  },
  () => null,
  () => null,
  () => ({ label: "layout" }),
  (cell) => ({ panelType: cell?.dataset?.panelId || cell?.dataset?.id || "", cellId: cell?.dataset?.nvWorkspaceCellId || "" }),
  (target) => target?.__nvInsertMediaOriginContext || target?.closest?.(".panel")?.__nvInsertMediaOriginContext || null,
  (cell) => cell?.dataset?.panelId === "WebResourceBrowserPanel" || cell?.dataset?.id === "WebResourceBrowserPanel",
  (context = {}) => context.originCell?.isConnected ? context.originCell : null,
  (cell, overrides = {}) => ({
    originCellId: overrides.originCellId || cell?.dataset?.nvWorkspaceCellId || "",
    originTabId: overrides.originTabId || "",
    originPanelType: overrides.originPanelType || cell?.dataset?.panelId || cell?.dataset?.id || "",
    originPanelClass: overrides.originPanelClass || "",
    originEditorPath: overrides.originEditorPath || "",
    targetMode: overrides.targetMode || "",
    mediaFamily: overrides.mediaFamily || overrides.familyKey || "",
  })
);

{
  const button = new FakeElement("button");
  const statuses = [];
  const launchOptions = { resourceType: "image" };
  let launchedWith = null;
  const attached = mod.attachInsertMediaBrowseWebHandler(button, () => launchOptions, {
    setStatus: (message) => statuses.push(message),
    launcher: async (options) => { launchedWith = options; return { ok: true }; },
  });
  assert.equal(attached, true, "button handler should attach");
  assert.equal(button.type, "button", "Browse Web handler should force button type=button");
  const event = await button.dispatch("click");
  assert.equal(event.preventDefaultCalled, true, "Browse Web click should prevent form submission");
  assert.equal(event.stopPropagationCalled, true, "Browse Web click should not bubble into form/panel handlers");
  assert.deepEqual(launchedWith, launchOptions, "Browse Web click should invoke the launcher with built options");
  assert.equal(statuses[0], "Opening Web Resource Browser...", "click should expose an opening status");
}

{
  globalThis.document = new FakeDocument();
  const workspace = new FakeElement("div");
  workspace.id = "workspace";
  const row = new FakeElement("div");
  row.className = "panel-row";
  row.dataset.direction = "row";
  const originCell = new FakeElement("div");
  originCell.className = "panel-cell active-panel";
  const editor = new FakeElement("div");
  originCell.appendChild(editor);
  row.appendChild(originCell);
  workspace.appendChild(row);
  document.body.appendChild(workspace);
  connectTree(document);

  const overlay = new FakeElement("div");
  overlay.className = "panel";
  overlay.dataset.instanceId = "nv-insert-media-image-panel";
  overlay.__nvDefaultDockCell = originCell;
  const root = new FakeElement("form");
  overlay.appendChild(root);
  document.body.appendChild(overlay);
  connectTree(document);

  let savedSelection = 0;
  let openerCall = null;
  globalThis.window = {
    NodevisionState: { currentMode: "GraphicalEditing" },
    activeCell: null,
    HTMLWysiwygTools: {
      getEditorElement: () => editor,
      saveCurrentSelection: () => { savedSelection += 1; },
      restoreSavedSelection: () => true,
    },
    __nvOpenPanelTab: async (cell, panelType, panelClass, panelVars) => {
      const tab = { tabId: "resource-browser", panelType, panelClass, panelVars, contentElement: new FakeElement("div") };
      cell.__nvPanelTabs ||= { tabs: [], activeTabId: null };
      cell.__nvPanelTabs.tabs.push(tab);
      cell.__nvPanelTabs.activeTabId = tab.tabId;
      openerCall = { cell, panelType, panelClass, panelVars, tab };
      return tab;
    },
  };

  const invocation = await mod.launchInsertMediaWebResourceBrowser({
    root,
    resourceType: "image",
    mediaFamily: "Image",
    sourceMode: "existing",
    originEditorPath: "Notebook/index.html",
    insertMediaState: { fields: { existingSource: "" } },
  });

  assert.equal(invocation?.resourceType, "image", "launcher should return the normalized invocation on success");
  assert.equal(savedSelection, 1, "launcher should preserve the editor selection before opening browser");
  assert.equal(openerCall.panelType, "WebResourceBrowserPanel", "launcher should open the WebResourceBrowserPanel type");
  assert.equal(openerCall.panelClass, "InfoPanel", "launcher should open it as an InfoPanel");
  assert.equal(openerCall.cell.classList.contains("panel-cell"), true, "launcher should pass a workspace panel cell to __nvOpenPanelTab");
  assert.notEqual(openerCall.cell, originCell, "launcher should open the browser in a separate workspace cell");
  assert.equal(openerCall.cell.dataset.panelId, "WebResourceBrowserPanel", "workspace placement should provide browser cell identity");
  assert.equal(placementCalls.length, 1, "launcher should request workspace-owned adjacent placement");
  assert.equal(openerCall.panelVars.invocation.originEditorPath, "Notebook/index.html", "launcher should preserve Insert Media return context");
  assert.deepEqual(openerCall.cell.__nvPanelTabs.tabs.map((tab) => tab.panelType), ["WebResourceBrowserPanel"], "destination cell should own the browser tab");
  assert.equal(openerCall.cell.__nvPanelTabs.activeTabId, "resource-browser", "browser tab should be active in its destination cell");
  assert.equal(overlay.parentElement, null, "Insert Media overlay should close only after browser opens");
  assert.equal(row.children.includes(openerCall.cell), true, "workspace placement should attach the destination beside the origin");
}

{
  globalThis.document = new FakeDocument();
  const workspace = new FakeElement("div");
  workspace.id = "workspace";
  const row = new FakeElement("div");
  row.className = "panel-row";
  const originCell = new FakeElement("div");
  originCell.className = "panel-cell";
  row.appendChild(originCell);
  workspace.appendChild(row);
  document.body.appendChild(workspace);
  const overlay = new FakeElement("div");
  overlay.className = "panel";
  overlay.__nvDefaultDockCell = originCell;
  const root = new FakeElement("form");
  overlay.appendChild(root);
  document.body.appendChild(overlay);
  connectTree(document);

  const statuses = [];
  globalThis.window = {
    NodevisionState: { currentMode: "GraphicalEditing" },
    activeCell: originCell,
    HTMLWysiwygTools: { saveCurrentSelection: () => true, getEditorElement: () => null },
  };

  const result = await mod.launchInsertMediaWebResourceBrowser({
    root,
    resourceType: "image",
    mediaFamily: "Image",
    onStatus: (message, error) => statuses.push({ message, error }),
  });

  assert.equal(result, null, "launcher should return null when the workspace opener is unavailable");
  assert.equal(overlay.parentElement, document.body, "failed launch should preserve the Insert Media overlay");
  assert.equal(statuses.at(-1)?.error, true, "failed launch should show a user-visible error state");
  assert.match(statuses.at(-1)?.message || "", /Workspace tab opener is unavailable/, "failure status should include technical detail");
  assert.equal(statusBarCalls.length > 0, true, "failed launch should also report to the status bar");
}

{
  placementCalls = [];
  statusBarCalls = [];
  globalThis.document = new FakeDocument();
  const workspace = new FakeElement("div");
  workspace.id = "workspace";
  const row = new FakeElement("div");
  row.className = "panel-row";
  const originCell = new FakeElement("div");
  originCell.className = "panel-cell";
  originCell.dataset.nvWorkspaceCellId = "origin-a";
  originCell.dataset.panelId = "GraphicalEditor";
  const browserCell = new FakeElement("div");
  browserCell.className = "panel-cell active-panel";
  browserCell.dataset.panelId = "WebResourceBrowserPanel";
  browserCell.dataset.id = "WebResourceBrowserPanel";
  row.appendChild(originCell);
  row.appendChild(browserCell);
  workspace.appendChild(row);
  document.body.appendChild(workspace);
  const overlay = new FakeElement("div");
  overlay.className = "panel";
  overlay.dataset.instanceId = "nv-insert-media-image-panel";
  overlay.__nvDefaultDockCell = browserCell;
  const root = new FakeElement("form");
  root.__nvInsertMediaOriginContext = {
    originCell,
    originCellId: "origin-a",
    originPanelType: "GraphicalEditor",
    originEditorPath: "Notebook/A.html",
    targetMode: "GraphicalEditing",
    mediaFamily: "Image",
  };
  overlay.appendChild(root);
  document.body.appendChild(overlay);
  connectTree(document);

  let savedSelection = 0;
  let openerCall = null;
  globalThis.window = {
    innerWidth: 1440,
    innerHeight: 900,
    NodevisionState: { currentMode: "GraphicalEditing" },
    activeCell: browserCell,
    HTMLWysiwygTools: {
      getEditorElement: () => null,
      saveCurrentSelection: () => { savedSelection += 1; },
      restoreSavedSelection: () => true,
    },
    __nvOpenPanelTab: async (cell, panelType, panelClass, panelVars) => {
      const tab = { tabId: "resource-browser-anchored", panelType, panelClass, panelVars, contentElement: new FakeElement("div") };
      cell.__nvPanelTabs ||= { tabs: [], activeTabId: null };
      cell.__nvPanelTabs.tabs.push(tab);
      cell.__nvPanelTabs.activeTabId = tab.tabId;
      openerCall = { cell, panelType, panelClass, panelVars, tab };
      return tab;
    },
  };

  const invocation = await mod.launchInsertMediaWebResourceBrowser({
    root,
    resourceType: "image",
    mediaFamily: "Image",
    sourceMode: "existing",
    insertMediaState: { fields: { existingSource: "" } },
  });

  assert.equal(invocation?.originCellId, "origin-a", "stored Insert Media origin should beat the active browser cell");
  assert.equal(openerCall?.cell, browserCell, "existing browser cell should be reused only as destination");
  assert.notEqual(openerCall?.cell, originCell, "destination should remain separate from stored origin");
  assert.equal(openerCall?.panelVars.invocation.originCellId, "origin-a", "browser invocation should carry origin cell id");
  assert.equal(openerCall?.panelVars.invocation.insertMediaOriginContext.originCellId, "origin-a", "browser invocation should carry full origin context");
  assert.equal(placementCalls.length, 0, "existing browser destination should avoid repeated splits");
  assert.equal(savedSelection, 1, "selection should be saved after origin validation");
  assert.equal(overlay.parentElement, null, "successful launch should close the old Insert Media overlay");
}

{
  placementCalls = [];
  statusBarCalls = [];
  globalThis.document = new FakeDocument();
  const workspace = new FakeElement("div");
  workspace.id = "workspace";
  const row = new FakeElement("div");
  row.className = "panel-row";
  const browserCell = new FakeElement("div");
  browserCell.className = "panel-cell active-panel";
  browserCell.dataset.nvWorkspaceCellId = "browser-origin";
  browserCell.dataset.panelId = "WebResourceBrowserPanel";
  browserCell.dataset.id = "WebResourceBrowserPanel";
  row.appendChild(browserCell);
  workspace.appendChild(row);
  document.body.appendChild(workspace);
  const overlay = new FakeElement("div");
  overlay.className = "panel";
  overlay.__nvDefaultDockCell = browserCell;
  const root = new FakeElement("form");
  root.__nvInsertMediaOriginContext = {
    originCell: browserCell,
    originCellId: "browser-origin",
    originPanelType: "WebResourceBrowserPanel",
    originEditorPath: "Notebook/A.html",
    targetMode: "GraphicalEditing",
    mediaFamily: "Image",
  };
  overlay.appendChild(root);
  document.body.appendChild(overlay);
  connectTree(document);

  let savedSelection = 0;
  const statuses = [];
  globalThis.window = {
    NodevisionState: { currentMode: "GraphicalEditing" },
    activeCell: browserCell,
    HTMLWysiwygTools: {
      getEditorElement: () => null,
      saveCurrentSelection: () => { savedSelection += 1; },
    },
    __nvOpenPanelTab: async () => {
      throw new Error("should not open browser from browser origin");
    },
  };

  const result = await mod.launchInsertMediaWebResourceBrowser({
    root,
    resourceType: "image",
    mediaFamily: "Image",
    onStatus: (message, error) => statuses.push({ message, error }),
  });

  assert.equal(result, null, "launcher should reject a recursive browser origin");
  assert.equal(savedSelection, 0, "recursive origin should be rejected before saving selection");
  assert.equal(placementCalls.length, 0, "recursive origin should be rejected before workspace placement");
  assert.equal(overlay.parentElement, document.body, "failed recursive launch should preserve the Insert Media overlay");
  assert.match(statuses.at(-1)?.message || "", /refusing recursive browser split/, "failure status should explain the recursive origin refusal");
}

console.log("ok - Insert Media Browse Web click and launcher behavior");
