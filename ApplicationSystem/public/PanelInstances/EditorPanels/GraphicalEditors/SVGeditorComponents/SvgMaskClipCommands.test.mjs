// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SvgMaskClipCommands.test.mjs
// Focused tests for SVG mask/clip reference helpers that can run without a browser DOM.

import assert from "node:assert/strict";
import { extractSvgUrlReferenceId, getReferencedSvgId, invertMask, makeUniqueSvgId, setMaskOrClipEnabled } from "./SvgMaskClipCommands.mjs";

class FakeElement {
  constructor(tagName, attrs = {}) {
    this.tagName = tagName;
    this.children = [];
    this.parentNode = null;
    this.attrs = new Map();
    Object.entries(attrs).forEach(([key, value]) => this.setAttribute(key, value));
  }

  get id() {
    return this.getAttribute("id") || "";
  }

  setAttribute(name, value) {
    this.attrs.set(String(name), String(value));
  }

  getAttribute(name) {
    return this.attrs.has(String(name)) ? this.attrs.get(String(name)) : null;
  }

  hasAttribute(name) {
    return this.attrs.has(String(name));
  }

  removeAttribute(name) {
    this.attrs.delete(String(name));
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
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
    if (selector === "*") return all;
    if (selector === "[id]") return all.filter((node) => node.id);
    return [];
  }

  querySelector(selector) {
    if (!String(selector).startsWith("#")) return null;
    const id = String(selector).slice(1).replace(/\\(.)/g, "$1");
    return this.descendants().find((node) => node.id === id) || null;
  }
}

{
  assert.equal(extractSvgUrlReferenceId("url(#mask-1)"), "mask-1");
  assert.equal(extractSvgUrlReferenceId("url(#mask.1)"), "mask.1");
  assert.equal(extractSvgUrlReferenceId("none"), "");
}

{
  const el = new FakeElement("rect", { mask: "url(#mask-1)", "clip-path": "url(#clip-1)" });
  assert.equal(getReferencedSvgId(el, "mask"), "mask-1");
  assert.equal(getReferencedSvgId(el, "clip-path"), "clip-1");
}

{
  const root = new FakeElement("svg");
  root.appendChild(new FakeElement("mask", { id: "nv-mask-existing" }));
  const id = makeUniqueSvgId(root, "nv-mask");
  assert.match(id, /^nv-mask-[a-z0-9]+$/);
  assert.notEqual(id, "nv-mask-existing");
}

{
  const el = new FakeElement("rect", { mask: "url(#mask-1)" });
  setMaskOrClipEnabled([el], "mask", false);
  assert.equal(el.getAttribute("mask"), null);
  assert.equal(el.getAttribute("data-nv-disabled-mask"), "url(#mask-1)");
  setMaskOrClipEnabled([el], "mask", true);
  assert.equal(el.getAttribute("mask"), "url(#mask-1)");
  assert.equal(el.getAttribute("data-nv-disabled-mask"), null);
}

{
  const root = new FakeElement("svg");
  const mask = root.appendChild(new FakeElement("mask", { id: "mask-1" }));
  mask.appendChild(new FakeElement("rect", { fill: "white", stroke: "black" }));
  const artwork = root.appendChild(new FakeElement("rect", { mask: "url(#mask-1)" }));
  const changed = invertMask(root, [artwork]);
  assert.equal(changed.length, 1);
  assert.equal(mask.children[0].getAttribute("fill"), "black");
  assert.equal(mask.children[0].getAttribute("stroke"), "white");
  assert.equal(mask.getAttribute("data-nv-mask-inverted"), "true");
}

{
  const root = new FakeElement("svg");
  const mask = root.appendChild(new FakeElement("mask", { id: "mask-1" }));
  mask.appendChild(new FakeElement("rect", { fill: "red" }));
  const artwork = root.appendChild(new FakeElement("rect", { mask: "url(#mask-1)" }));
  assert.deepEqual(invertMask(root, [artwork]), []);
  assert.equal(mask.children[0].getAttribute("fill"), "red");
}
