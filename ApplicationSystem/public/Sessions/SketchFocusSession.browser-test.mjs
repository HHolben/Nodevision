// Nodevision/ApplicationSystem/public/Sessions/SketchFocusSession.browser-test.mjs
// This browser-oriented test validates that Sketch Focus mounts into the existing Session root and removes its Session-owned surface during cleanup.

import assert from "node:assert/strict";
import { startSketchFocus } from "./SketchFocusSession.mjs";

if (typeof document === "undefined" || typeof window === "undefined") {
  console.log("SketchFocusSession browser test skipped because no DOM is available.");
} else {
  const root = document.createElement("div");
  root.id = "nv-session-root";
  document.body.appendChild(root);
  const cleanups = [];
  await startSketchFocus({ executionContext: { addCleanup: (fn) => cleanups.push(fn), emit: () => null } });
  assert.equal(root.querySelectorAll(".nv-sketch-focus").length, 1);
  assert.equal(root.querySelectorAll("canvas").length, 1);
  cleanups.forEach((fn) => fn());
  assert.equal(root.querySelectorAll(".nv-sketch-focus").length, 0);
  root.remove();
  console.log("SketchFocusSession browser test passed.");
}
