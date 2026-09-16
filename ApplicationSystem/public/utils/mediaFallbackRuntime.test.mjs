// Nodevision/ApplicationSystem/public/utils/mediaFallbackRuntime.test.mjs
// Tests for media fallback retry behavior without browser-specific inline handlers.

import assert from "node:assert/strict";

class FakeMediaElement extends EventTarget {
  constructor(tagName = "img", src = "") {
    super();
    this.tagName = String(tagName).toUpperCase();
    this.src = src;
    this.attrs = new Map([["src", String(src)]]);
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

const { applyMediaFallbackToElement, installNodevisionMediaFallbackRuntime } = await import("./mediaFallbackRuntime.mjs");

const image = new FakeMediaElement("img", "primary.png");
image.setAttribute("data-nodevision-fallback-1", "backup-one.png");
image.setAttribute("data-nodevision-fallback-2", "backup-two.png");

assert.equal(applyMediaFallbackToElement(image), true);
assert.equal(image.src, "backup-one.png");
assert.equal(image.getAttribute("src"), "backup-one.png");

assert.equal(applyMediaFallbackToElement(image), true);
assert.equal(image.src, "backup-two.png");

assert.equal(applyMediaFallbackToElement(image), false);
assert.equal(image.src, "backup-two.png");

const loop = new FakeMediaElement("img", "same.png");
loop.setAttribute("data-nodevision-fallback-1", "same.png");
assert.equal(applyMediaFallbackToElement(loop), false);
assert.equal(loop.src, "same.png");

const handlers = {};
assert.equal(installNodevisionMediaFallbackRuntime({ addEventListener: (type, handler) => { handlers[type] = handler; } }), true);
const video = new FakeMediaElement("video", "bad.mp4");
video.setAttribute("data-nodevision-fallback-1", "also-bad.mp4");
video.setAttribute("data-nodevision-fallback-2", "ok.mp4");
let loadCalls = 0;
video.load = () => { loadCalls += 1; };
const sameError = { target: video };
handlers.error(sameError);
handlers.error(sameError);
assert.equal(video.src, "also-bad.mp4");
assert.equal(loadCalls, 1);
handlers.error({ target: video });
assert.equal(video.src, "ok.mp4");
assert.equal(loadCalls, 2);
handlers.error({ target: video });
assert.equal(video.src, "ok.mp4");
handlers.load({ target: video });

console.log("ok - media fallback runtime retries in order and stops");
