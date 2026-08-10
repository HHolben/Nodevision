// Nodevision/ApplicationSystem/public/Sessions/SessionUiOwnership.browser-test.mjs
// This browser-oriented test validates that Session UI ownership hides and restores the normal app shell and intercepts Escape for the pause path.

import assert from "node:assert/strict";
import { SessionUiOwnership } from "./SessionUiOwnership.mjs";

if (typeof document === "undefined" || typeof window === "undefined") {
  console.log("SessionUiOwnership browser test skipped because no DOM is available.");
} else {
  let pauseCount = 0;
  const shell = document.createElement("div");
  shell.id = "app-shell";
  document.body.appendChild(shell);
  const ui = new SessionUiOwnership({ title: "Test Session" }, { onEscape: () => { pauseCount += 1; } });
  ui.take();
  assert.equal(document.body.classList.contains("nv-session-mode"), true);
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  assert.equal(pauseCount, 1);
  ui.release();
  assert.equal(document.body.classList.contains("nv-session-mode"), false);
  shell.remove();
  console.log("SessionUiOwnership browser test passed.");
}

