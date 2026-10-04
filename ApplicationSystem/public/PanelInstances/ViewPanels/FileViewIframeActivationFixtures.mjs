// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewIframeActivationFixtures.mjs
// This module supplies event targets, iframe elements, and source-loading adapters for isolated FileView activation lifecycle tests.

// Minimal browser fixtures preserve listener identity and owner ancestry.
export class FakeEventTarget {
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
  dispatchEvent(event) { this.dispatch(event.type, event); return true; }
  dispatch(type, event = {}) {
    const list = [...(this.listeners.get(type) || [])];
    for (const entry of list) entry.handler({ type, target: this, ...event });
  }
  listenerCount(type) {
    return (this.listeners.get(type) || []).length;
  }
}

export class FakeElement extends FakeEventTarget {
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

export class FakeIFrame extends FakeElement {
  constructor(doc = new FakeEventTarget(), frameWindow = new FakeEventTarget()) {
    super();
    this.contentDocument = doc;
    this.contentWindow = frameWindow;
  }
}

export function loadFileViewHelpers(source) {
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
    "const incrementPerformanceCounter = () => {};\n" + transformed + "\nreturn { installIframeActivation, cleanupViewIframeActivation, activateFileViewHost };"
  );
}

export function makeViewer(path) {
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
