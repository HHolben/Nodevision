// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SvgResizeGeometry.test.mjs
// This test verifies corner resize scaling, including axis-specific reflection when the pointer crosses the resize origin.

import assert from "node:assert/strict";
import { cornerResizeScale, keepScaleOutsideDeadZone } from "./SvgResizeGeometry.mjs";

const bbox = { x: 0, y: 0, width: 100, height: 50 };

function scalesFor(corner, point, preserveAspect = false) {
  const { sx, sy } = cornerResizeScale({ bbox, corner, point, preserveAspect });
  return { sx, sy };
}

assert.deepEqual(scalesFor("se", { x: 150, y: 25 }), { sx: 1.5, sy: 0.5 });
assert.deepEqual(scalesFor("se", { x: 150, y: 25 }, true), { sx: 1.5, sy: 1.5 });

assert.deepEqual(scalesFor("se", { x: -80, y: 70 }, true), { sx: -1.4, sy: 1.4 });
assert.deepEqual(scalesFor("se", { x: 80, y: -70 }, true), { sx: 1.4, sy: -1.4 });
assert.deepEqual(scalesFor("se", { x: -80, y: -70 }, true), { sx: -1.4, sy: -1.4 });

assert.deepEqual(scalesFor("nw", { x: 150, y: 25 }, true), { sx: -0.5, sy: 0.5 });

assert.equal(keepScaleOutsideDeadZone(0), 0.05);
assert.equal(keepScaleOutsideDeadZone(-0.01), -0.05);

console.log("SVG resize geometry test passed");
