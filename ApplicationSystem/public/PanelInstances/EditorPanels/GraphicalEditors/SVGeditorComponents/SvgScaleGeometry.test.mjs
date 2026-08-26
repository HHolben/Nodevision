// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SvgScaleGeometry.test.mjs
// This test verifies SVG scale factor helpers for uniform, root-axis, and original-axis keyboard scaling in the graphical SVG editor.

import assert from "node:assert/strict";
import { applyScaleToItems, boundedScale, pointerScaleFactor, scaleFactorsForMode } from "./SvgScaleGeometry.mjs";

// Test fixtures and assertion helpers.
function assertScaleMode(mode, factor, expected) {
  assert.deepEqual(scaleFactorsForMode(mode, factor), expected);
}

function sessionFor(mode, startRoot = { x: 10, y: 0 }) {
  return {
    mode,
    centerRoot: { x: 0, y: 0 },
    startRoot,
    axisX: { x: 1, y: 0 },
    axisY: { x: 0, y: 1 },
    factor: 1,
  };
}

function fakeSvgElement(baseTransform = "") {
  const attrs = new Map(baseTransform ? [["transform", baseTransform]] : []);
  return {
    hasAttribute(name) { return attrs.has(name); },
    getAttribute(name) { return attrs.get(name) || null; },
    setAttribute(name, value) { attrs.set(name, String(value)); },
    removeAttribute(name) { attrs.delete(name); },
  };
}

// Scale mode mapping checks.
assertScaleMode("uniform", 2, { sx: 2, sy: 2, local: false });
assertScaleMode("x", 2, { sx: 2, sy: 1, local: false });
assertScaleMode("y", 2, { sx: 1, sy: 2, local: false });
assertScaleMode("local-x", 2, { sx: 2, sy: 1, local: true });
assertScaleMode("local-y", 2, { sx: 1, sy: 2, local: true });

// Scale clamping checks.
assert.equal(boundedScale(0), 0.05);
assert.equal(boundedScale(0.02), 0.05);
assert.equal(boundedScale(-0.02), -0.05);
assert.equal(boundedScale(1.5), 1.5);

// Pointer factor projection checks.
assert.equal(pointerScaleFactor(sessionFor("uniform"), { x: 20, y: 0 }), 2);
assert.equal(pointerScaleFactor(sessionFor("x"), { x: 20, y: 50 }), 2);
assert.equal(pointerScaleFactor(sessionFor("y", { x: 0, y: 10 }), { x: 50, y: 20 }), 2);
assert.equal(pointerScaleFactor(sessionFor("local-x"), { x: 20, y: 50 }), 2);
assert.equal(pointerScaleFactor(sessionFor("local-y", { x: 0, y: 10 }), { x: 50, y: 20 }), 2);

// Original-transform factor checks.
const el = fakeSvgElement("rotate(45)");
const item = { el, hadTransform: true, baseTransform: "rotate(45)", localCenter: null, space: null };
const scaleSession = { mode: "uniform", svgRoot: null, centerRoot: { x: 5, y: 5 }, items: [item] };
applyScaleToItems(scaleSession, 2);
assert.match(el.getAttribute("transform"), /scale\(2 2\) translate\(-5 -5\) rotate\(45\)/);
applyScaleToItems(scaleSession, 3);
assert.match(el.getAttribute("transform"), /scale\(3 3\) translate\(-5 -5\) rotate\(45\)/);
assert.doesNotMatch(el.getAttribute("transform"), /scale\(2 2\).*scale\(3 3\)/);

console.log("SVG scale geometry test passed");
