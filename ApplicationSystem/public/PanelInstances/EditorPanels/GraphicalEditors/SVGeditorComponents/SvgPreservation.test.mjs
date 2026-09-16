// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SvgPreservation.test.mjs
// Focused tests for SVG root and save-cleanup preservation helpers.

import assert from "node:assert/strict";
import { applyEditableSvgRootDefaults, cleanupSvgCloneForSave, prepareSvgRootForEditor } from "./SvgPreservation.mjs";

class FakeElement {
  constructor(tagName = "svg", attrs = {}) {
    this.tagName = tagName;
    this.attrs = new Map();
    this.children = [];
    this.parentNode = null;
    this.style = { filter: "" };
    Object.entries(attrs).forEach(([key, value]) => this.setAttribute(key, value));
  }

  getAttribute(name) {
    return this.attrs.has(name) ? this.attrs.get(name) : null;
  }

  setAttribute(name, value) {
    this.attrs.set(String(name), String(value));
  }

  removeAttribute(name) {
    this.attrs.delete(String(name));
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  remove() {
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
    this.parentNode = null;
  }

  descendants() {
    const out = [];
    const visit = (node) => {
      node.children.forEach((child) => {
        out.push(child);
        visit(child);
      });
    };
    visit(this);
    return out;
  }

  querySelectorAll(selector) {
    const all = this.descendants();
    const attr = /^\[([^\]]+)\]$/.exec(selector)?.[1];
    if (!attr) return [];
    return all.filter((node) => node.getAttribute(attr) !== null);
  }
}

{
  const root = new FakeElement("svg", {
    id: "authored-root",
    class: "diagram primary",
    style: "background: transparent",
    width: "10cm",
    height: "8cm",
    viewBox: "-50 -25 100 80",
    "data-nv-custom": "keep-me",
  });
  applyEditableSvgRootDefaults(root);
  assert.equal(root.getAttribute("id"), "authored-root");
  assert.equal(root.getAttribute("class"), "diagram primary");
  assert.equal(root.getAttribute("style"), "background: transparent");
  assert.equal(root.getAttribute("viewBox"), "-50 -25 100 80");
  assert.equal(root.getAttribute("data-nv-custom"), "keep-me");
}

{
  const root = new FakeElement("svg", { width: "320", height: "240" });
  const runtime = prepareSvgRootForEditor(root);
  assert.equal(runtime.generatedRootId, true);
  assert.equal(root.getAttribute("id"), "svg-editor");
  cleanupSvgCloneForSave(root, { generatedRootId: runtime.generatedRootId });
  assert.equal(root.getAttribute("id"), null, "runtime root id is not serialized");
}

{
  const root = new FakeElement("svg", { id: "user-root" });
  const runtime = prepareSvgRootForEditor(root);
  cleanupSvgCloneForSave(root, { generatedRootId: runtime.generatedRootId });
  assert.equal(root.getAttribute("id"), "user-root", "authored root id is preserved");
}

{
  const root = new FakeElement("svg");
  const ui = root.appendChild(new FakeElement("g", { "data-nv-editor-ui": "overlay" }));
  const selected = root.appendChild(new FakeElement("rect", { "data-selected": "true", "data-nv-custom": "keep" }));
  const solo = root.appendChild(new FakeElement("circle", { "data-nv-solo-hidden": "true", "data-nv-solo-prev-display": "inline" }));
  cleanupSvgCloneForSave(root, { generatedRootId: false });
  assert.equal(root.children.includes(ui), false, "editor UI overlay is removed");
  assert.equal(selected.getAttribute("data-selected"), null);
  assert.equal(selected.getAttribute("data-nv-custom"), "keep");
  assert.equal(solo.getAttribute("data-nv-solo-hidden"), null);
  assert.equal(solo.getAttribute("data-nv-solo-prev-display"), null);
}

console.log("SVG preservation helper tests passed");
