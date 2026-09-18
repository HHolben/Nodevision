// Nodevision/ApplicationSystem/public/SvgClickFeedbackTrace.test.mjs
// Regression coverage for the opt-in SVG click feedback tracing diagnostics.

import assert from "node:assert/strict";
import {
  _resetSvgClickFeedbackTraceForTests,
  armNext,
  clear,
  exportTraceReport,
  initializeSvgClickFeedbackTrace,
  installSvgClickTraceOnSvgRoot,
  svgClickTraceMark,
} from "./SvgClickFeedbackTrace.mjs";

const realWindow = globalThis.window;
const realSVGElement = globalThis.SVGElement;

function installFakeWindow({ enabled = false } = {}) {
  let time = 1000;
  const listeners = [];
  class FakeSvgElement {}
  globalThis.SVGElement = FakeSvgElement;
  const fakeWindow = {
    __nvSvgClickFeedbackTraceEnabled: false,
    NodevisionState: {
      activePanelType: "GraphicalEditor",
      activeEditorFilePath: "/home/henry/CodexPlayground/Nodevision/Notebook/private/shape.svg",
      currentMode: "SVG Editing",
      activeTool: "select",
    },
    currentActiveFilePath: "/home/henry/CodexPlayground/Nodevision/Notebook/private/shape.svg",
    filePath: "/home/henry/CodexPlayground/Nodevision/Notebook/private/shape.svg",
    localStorage: { getItem: () => enabled ? "1" : null, setItem() {}, removeItem() {} },
    location: { search: "", pathname: "/Nodevision" },
    performance: { now: () => (time += 5) },
    setTimeout: () => 1,
    clearTimeout: () => {},
    setInterval: () => 1,
    clearInterval: () => {},
    requestAnimationFrame: (cb) => { time += 16; cb(time); return 1; },
    navigator: { userAgent: "node-test", platform: "test", language: "en" },
    document: { querySelectorAll: () => [], createElement: () => ({ click() {}, remove() {} }), body: { appendChild() {} } },
    getComputedStyle: () => ({ display: "block", visibility: "visible" }),
    URL: { createObjectURL: () => "blob:test", revokeObjectURL() {} },
  };
  globalThis.window = fakeWindow;
  const root = {
    addEventListener(type, listener, options) { listeners.push({ type, listener, options }); },
    removeEventListener(type, listener) {
      const idx = listeners.findIndex((entry) => entry.type === type && entry.listener === listener);
      if (idx >= 0) listeners.splice(idx, 1);
    },
  };
  const target = new FakeSvgElement();
  target.tagName = "rect";
  target.nodeName = "rect";
  target.ownerSVGElement = root;
  target.closest = () => null;
  target.getAttribute = () => null;
  const event = (trusted = false) => ({
    type: "pointerdown",
    timeStamp: time - 20,
    isTrusted: trusted,
    pointerType: trusted ? "mouse" : "synthetic",
    button: 0,
    buttons: 1,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    target,
  });
  return { fakeWindow, root, listeners, event };
}

function dispatchOne(env, trusted = false) {
  const listener = env.listeners.find((entry) => entry.type === "pointerdown")?.listener;
  assert.equal(typeof listener, "function", "capture listener is installed when diagnostics are enabled");
  listener(env.event(trusted));
  svgClickTraceMark("svg-handler:start", { mode: "select" });
  svgClickTraceMark("setSelection:start", { inputCount: 1 });
  svgClickTraceMark("selection-geometry-visuals:end", { selectedCount: 1 });
  svgClickTraceMark("attention:publish:start", { listenerCount: 1 });
  svgClickTraceMark("attention:listener:start", { listenerIndex: 0, label: "test-listener" });
  svgClickTraceMark("attention:listener:end", { listenerIndex: 0, label: "test-listener" });
  svgClickTraceMark("attention:publish:end", { listenerCount: 1 });
  svgClickTraceMark("line:vertex-marker:inserted", { markerCount: 1 });
}

try {
  _resetSvgClickFeedbackTraceForTests();
  let env = installFakeWindow({ enabled: false });
  assert.equal(initializeSvgClickFeedbackTrace(), false, "diagnostics are disabled by default");
  installSvgClickTraceOnSvgRoot(env.root, () => ({}));
  assert.equal(env.listeners.length, 0, "disabled diagnostics install no capture listener");
  assert.equal(globalThis.window.NodevisionSvgClickFeedbackTrace, undefined, "disabled diagnostics expose no global control object");
  assert.deepEqual(exportTraceReport().traces, [], "disabled diagnostics keep no trace buffer");

  _resetSvgClickFeedbackTraceForTests();
  env = installFakeWindow({ enabled: true });
  assert.equal(initializeSvgClickFeedbackTrace(), true, "diagnostics can be enabled by storage flag");
  assert.equal(typeof globalThis.window.NodevisionSvgClickFeedbackTrace.armNext, "function", "enabled diagnostics expose capture controls");
  const cleanup = installSvgClickTraceOnSvgRoot(env.root, () => ({ filePath: globalThis.window.filePath, activeEditorKind: "svg", mode: "SVG Editing", tool: "select", editorReady: true }));
  assert.equal(env.listeners.length, 1, "enabled diagnostics install one capture listener");
  armNext();
  dispatchOne(env, false);
  let report = exportTraceReport();
  assert.equal(report.traceCount, 1, "one armed click creates one trace");
  assert.equal(report.traces[0].event.isTrusted, false, "synthetic events are identified as untrusted");
  assert.ok(report.traces[0].marks.find((mark) => mark.label === "selection-geometry-visuals:end"), "shape-selection overlay insertion/update is recorded");
  assert.ok(report.traces[0].marks.find((mark) => mark.label === "line:vertex-marker:inserted"), "Line vertex-marker insertion is recorded");
  assert.ok(report.summary[0].subscriberInvocations >= 1, "attention subscriber marks are counted");
  assert.ok(!JSON.stringify(report).includes("/home/henry/CodexPlayground"), "full private paths are not exported");
  assert.deepEqual(report.traces[0].marks.map((mark) => mark.offsetMs), [...report.traces[0].marks.map((mark) => mark.offsetMs)].sort((a, b) => a - b), "marks remain ordered");

  for (let i = 0; i < 14; i += 1) {
    armNext();
    dispatchOne(env, i % 2 === 0);
  }
  report = exportTraceReport();
  assert.equal(report.traceCount, 12, "trace ring buffer is bounded");
  assert.ok(report.traces.some((trace) => trace.event.isTrusted === true), "trusted input is distinguished when present");
  cleanup();
  cleanup();
  assert.equal(env.listeners.length, 0, "trace cleanup is idempotent");
  clear();
  assert.equal(exportTraceReport().traceCount, 0, "clear removes old traces");
} finally {
  _resetSvgClickFeedbackTraceForTests();
  if (realWindow === undefined) delete globalThis.window;
  else globalThis.window = realWindow;
  if (realSVGElement === undefined) delete globalThis.SVGElement;
  else globalThis.SVGElement = realSVGElement;
}
