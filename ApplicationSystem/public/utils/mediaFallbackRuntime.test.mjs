// Nodevision/ApplicationSystem/public/utils/mediaFallbackRuntime.test.mjs
// Tests for media fallback retry behavior without browser-specific inline handlers.

import assert from "node:assert/strict";

class FakeMediaElement extends EventTarget {
  constructor(src = "") {
    super();
    this.src = src;
    this.attrs = new Map();
  }
  get attributes() {
    return [...this.attrs.entries()].map(([name, value]) => ({ name, value }));
  }
  getAttribute(name) {
    return this.attrs.get(name) ?? null;
  }
  setAttribute(name, value) {
    this.attrs.set(String(name), String(value));
    if (name === "src") this.src = String(value);
  }
  removeAttribute(name) {
    this.attrs.delete(String(name));
  }
}

globalThis.HTMLImageElement = FakeMediaElement;
globalThis.HTMLAudioElement = FakeMediaElement;
globalThis.HTMLVideoElement = FakeMediaElement;

const { applyMediaFallbackToElement } = await import("./mediaFallbackRuntime.mjs");

const image = new FakeMediaElement("primary.png");
image.setAttribute("data-nodevision-fallback-1", "backup-one.png");
image.setAttribute("data-nodevision-fallback-2", "backup-two.png");

assert.equal(applyMediaFallbackToElement(image), true);
assert.equal(image.src, "backup-one.png");
assert.equal(image.getAttribute("src"), "backup-one.png");

image.dispatchEvent(new Event("error"));
assert.equal(image.src, "backup-two.png");

image.dispatchEvent(new Event("error"));
assert.equal(image.src, "backup-two.png");
assert.equal(applyMediaFallbackToElement(image), false);

const loop = new FakeMediaElement("same.png");
loop.setAttribute("data-nodevision-fallback-1", "same.png");
assert.equal(applyMediaFallbackToElement(loop), false);
assert.equal(loop.src, "same.png");

console.log("ok - media fallback runtime retries in order and stops");
