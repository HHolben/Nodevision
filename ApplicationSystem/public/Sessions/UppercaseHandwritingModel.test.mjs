// Nodevision/ApplicationSystem/public/Sessions/UppercaseHandwritingModel.test.mjs
// These tests verify shared pointer acquisition, interrupted stroke cleanup, clear/reset state, fixture isolation, and registration of the uppercase Session without a browser.

import assert from "node:assert/strict";
import { test } from "node:test";
import { createUppercaseHandwritingModel } from "./UppercaseHandwritingModel.mjs";
import { installSketchPointerInput } from "./SketchFocusInput.mjs";
import { readSession } from "../../Sessions/SessionRegistry.mjs";
import { getNodevisionCommandDefinition } from "../Commands/NodevisionCommandRegistry.mjs";
import { isKnownNodevisionEvent } from "../Commands/NodevisionEventRegistry.mjs";

function setup() {
  let calls = 0;
  const model = createUppercaseHandwritingModel((strokes) => {
    calls++;
    return { letter: strokes.length ? "A" : null, candidates: [] };
  });
  const listeners = new Map();
  const surface = {
    getBoundingClientRect: () => ({ left: 10, top: 20 }),
    setPointerCapture() {}, releasePointerCapture() {},
    addEventListener: (type, handler) => listeners.set(type, handler),
    removeEventListener: (type) => listeners.delete(type),
  };
  const cleanup = installSketchPointerInput(surface, model, { drawStroke() {}, drawActiveSegment() {}, replay() {} });
  const send = (type, options = {}) => listeners.get(type)?.({
    type, pointerId: 1, pointerType: "pen", button: 0, buttons: 1,
    clientX: 30, clientY: 40, timeStamp: 100, preventDefault() {},
    getCoalescedEvents: () => [], ...options,
  });
  return { model, listeners, send, cleanup, calls: () => calls };
}

test("pointer fallback, multi-strokes, pointerup endpoint and fixture snapshot", () => {
  const { model, send, cleanup, calls } = setup();
  send("pointerdown");
  assert.equal(model.recognize(), null);
  send("pointermove", { clientX: 50, clientY: 60 });
  send("pointerup", { clientX: 70, clientY: 80 });
  send("pointerdown", { clientX: 45 });
  send("pointerup", { clientX: 60 });
  assert.equal(model.state.strokes.length, 2);
  assert.equal(model.strokes()[0].points.at(-1).x, 60);
  assert.equal(model.recognize().letter, "A");
  const fixture = model.fixture("B");
  assert.equal(fixture.expectedLetter, "B");
  assert.equal(fixture.observed.letter, "A");
  assert.equal(calls(), 1, "labeling a fixture never invokes recognition");
  fixture.strokes[0].points[0].x = 900;
  assert.equal(model.strokes()[0].points[0].x, 20);
  model.clear();
  assert.equal(model.result, null);
  assert.deepEqual(model.strokes(), []);
  assert.equal(model.state.activeStroke, null);
  assert.equal(model.state.redoStack.length, 0);
  assert.throws(() => model.fixture("A"), /Finish drawing/);
  assert.equal(model.recognize().letter, null);
  send("pointerdown"); send("pointerup");
  assert.equal(model.state.strokes.length, 1);
  cleanup();
});

test("cancellation, lost capture, non-primary input and cleanup", () => {
  const { model, send, listeners, cleanup } = setup();
  send("pointerdown", { button: 2 });
  assert.equal(model.state.activeStroke, null);
  for (const end of ["pointercancel", "lostpointercapture"]) {
    send("pointerdown");
    send("pointermove", { pointerId: 2, pointerType: "touch" });
    assert.equal(model.state.activeStroke.samples.length, 1);
    send(end);
    assert.equal(model.state.activeStroke, null);
    assert.equal(model.state.strokes.length, 0);
  }
  send("pointerdown");
  cleanup();
  assert.equal(model.state.activeStroke, null);
  assert.equal(listeners.size, 0);
});

test("Session discovery, safe command and completion event", async () => {
  const session = await readSession("builtin", "UppercaseHandwriting.NodevisionSession.js");
  assert.match(session.source, /run\("uppercaseHandwriting.open"\)/);
  assert.match(session.source, /wait\("uppercaseHandwriting.finished"\)/);
  assert.equal(getNodevisionCommandDefinition("uppercaseHandwriting.open")?.sessionSafe, true);
  assert.equal(isKnownNodevisionEvent("uppercaseHandwriting.finished"), true);
});
