// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/createWorldRenderer.test.mjs
// This test module verifies renderer context selection, antialias fallback, browser diagnostics, and cleanup after failed initialization.

import test from "node:test";
import assert from "node:assert/strict";
import { createWorldRenderer } from "./createWorldRenderer.mjs";

function fixture(acquire) {
  const calls = [];
  let listener;
  const canvas = {
    addEventListener(type, fn) { listener = fn; },
    removeEventListener(type, fn) { assert.equal(fn, listener); listener = null; },
    getContext(type, attributes) {
      calls.push({ type, attributes });
      return acquire(type, attributes, listener);
    },
  };
  class WebGLRenderer { constructor(options) { Object.assign(this, options); } }
  return { canvas, THREE: { WebGLRenderer }, calls, hasListener: () => Boolean(listener) };
}

test("uses the first working context without redundant renderer probes", () => {
  const context = {};
  const f = fixture(() => context);
  const renderer = createWorldRenderer(f);
  assert.equal(renderer.context, context);
  assert.equal(renderer.canvas, f.canvas);
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].type, "webgl2");
  assert.equal(f.calls[0].attributes.failIfMajorPerformanceCaveat, false);
  assert.equal(f.hasListener(), false);
});

test("recovers without antialiasing before downgrading WebGL", () => {
  const context = {};
  const f = fixture((type, attrs) => attrs.antialias ? null : context);
  assert.equal(createWorldRenderer(f).context, context);
  assert.deepEqual(f.calls.map(c => [c.type, c.attributes.antialias]), [["webgl2", true], ["webgl2", false]]);
});

test("falls back to WebGL1 when WebGL2 is unavailable", () => {
  const context = {};
  const f = fixture(type => type === "webgl" ? context : null);
  assert.equal(createWorldRenderer(f).context, context);
  assert.equal(f.calls.length, 3);
});

test("context rejection reports browser diagnostics without constructing Three", () => {
  const f = fixture((type, attrs, listener) => {
    listener({ statusMessage: "BindToCurrentSequence failed" });
    return null;
  });
  f.THREE.WebGLRenderer = class { constructor() { assert.fail("must not construct renderer"); } };
  assert.throws(() => createWorldRenderer(f), error => error.code === "WEBGL_UNAVAILABLE" && error.details === "BindToCurrentSequence failed");
  assert.equal(f.calls.length, 6);
  assert.equal(f.hasListener(), false);
});

test("context exceptions are reported and a failed renderer releases its context", () => {
  const denied = fixture(() => { throw new Error("Context denied"); });
  assert.throws(() => createWorldRenderer(denied), error => error.code === "WEBGL_UNAVAILABLE" && error.details === "Context denied");
  let released = false;
  const f = fixture(() => ({ getExtension: () => ({ loseContext() { released = true; } }) }));
  const failure = new Error("Renderer initialization failed");
  f.THREE.WebGLRenderer = class { constructor() { throw failure; } };
  assert.throws(() => createWorldRenderer(f), error => error === failure);
  assert.equal(released, true);
  assert.equal(f.hasListener(), false);
});
