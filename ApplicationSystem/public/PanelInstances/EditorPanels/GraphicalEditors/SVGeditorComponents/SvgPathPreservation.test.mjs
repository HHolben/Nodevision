// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SvgPathPreservation.test.mjs
// Regression coverage for path-node editing preservation boundaries.

import assert from "node:assert/strict";
import { analyzePathNodeEditSupport, modelToPathD, parsePathToModel } from "./BezierModel.mjs";

function fakePath(d, id = "path") {
  return {
    id,
    tagName: "path",
    getAttribute(name) { return name === "d" ? d : null; },
  };
}

assert.deepEqual(analyzePathNodeEditSupport("M 0 0 L 10 10 c 1 2 3 4 5 6 z"), {
  supported: true,
  unsupportedCommand: "",
});

for (const command of ["Q", "T", "A", "H", "V", "S"]) {
  const support = analyzePathNodeEditSupport(`M 0 0 ${command} 1 2 3 4`);
  assert.equal(support.supported, false, `${command} should be guarded from node editing`);
  assert.equal(support.unsupportedCommand, command);
}

const relative = fakePath("m 1 2 l 3 4 c 5 6 7 8 9 10 z");
assert.equal(analyzePathNodeEditSupport(relative.getAttribute("d")).supported, true);
assert.match(modelToPathD(parsePathToModel(relative)), /^M 1 2 L 4 6 C /);

console.log("SVG path preservation tests passed");
