// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SvgScaleHotkeys.test.mjs
// This test verifies exact numeric factor parsing for modal SVG scale hotkey sequences in the graphical SVG editor.

import assert from "node:assert/strict";
import { appendScaleFactorKey, parseScaleBuffer, scaleModeFromPrefix } from "./SvgScaleHotkeys.mjs";

// Test fixtures and command sequence helpers.
function typedFactor(keys) {
  const session = { buffer: "" };
  let factor = null;
  for (const key of keys) {
    const input = appendScaleFactorKey(session, key);
    assert.equal(input.handled, true, "accepted key " + key);
    if (input.factor !== null) factor = input.factor;
  }
  return { buffer: session.buffer, factor };
}

function exactScaleCommand(localPrefix, axis, keys) {
  return {
    mode: axis ? scaleModeFromPrefix(localPrefix, axis) : "uniform",
    ...typedFactor(keys),
  };
}

// Prefix and typed factor checks.
assert.deepEqual(exactScaleCommand(false, null, ["2"]), { mode: "uniform", buffer: "2", factor: 2 });
assert.deepEqual(exactScaleCommand(false, "x", ["2"]), { mode: "x", buffer: "2", factor: 2 });
assert.deepEqual(exactScaleCommand(false, "y", ["2"]), { mode: "y", buffer: "2", factor: 2 });
assert.deepEqual(exactScaleCommand(true, "x", ["2"]), { mode: "local-x", buffer: "2", factor: 2 });
assert.deepEqual(exactScaleCommand(true, "y", ["2"]), { mode: "local-y", buffer: "2", factor: 2 });

// Partial and decimal factor checks.
assert.equal(parseScaleBuffer("."), null);
assert.equal(parseScaleBuffer("-"), null);
assert.deepEqual(typedFactor([".", "5"]), { buffer: ".5", factor: 0.5 });
assert.deepEqual(typedFactor(["-", "2"]), { buffer: "-2", factor: -2 });
assert.equal(appendScaleFactorKey({ buffer: "2" }, "x").handled, false);

console.log("SVG scale hotkey exact factor test passed");
