// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/CircuitEditorComponents/CircuitWireExtrusion.test.mjs
// Tests directional keyboard wire extrusion target selection for the circuit graphical editor.

import assert from "node:assert/strict";
import {
  buildExtrusionDraftPoints,
  directionFromArrowKey,
  nearestWireInDirection,
  raySegmentIntersection,
  selectedExtrusionNode,
} from "./CircuitWireExtrusion.mjs";

const right = directionFromArrowKey("ArrowRight");
assert.deepEqual(right, { name: "right", x: 1, y: 0 });
assert.equal(directionFromArrowKey("e"), null);

assert.deepEqual(
  raySegmentIntersection({ x: 0, y: 10 }, right, { x: 80, y: 0 }, { x: 80, y: 40 }),
  { distance: 80, point: { x: 80, y: 10 } },
);
assert.equal(raySegmentIntersection({ x: 0, y: 10 }, right, { x: -80, y: 0 }, { x: -80, y: 40 }), null);

const document = {
  components: [{ id: "cmp1", type: "resistor", x: 0, y: 10, rotation: 0, properties: { ref: "R1", value: "1k" } }],
  wires: [
    { id: "far", points: [{ x: 140, y: 0 }, { x: 140, y: 40 }] },
    { id: "near", points: [{ x: 80, y: 0 }, { x: 80, y: 40 }] },
    { id: "behind", points: [{ x: -40, y: 0 }, { x: -40, y: 40 }] },
  ],
  junctions: [],
};
const target = nearestWireInDirection(document, { x: 0, y: 10 }, right);
assert.equal(target.wireId, "near");
assert.deepEqual(target.point, { x: 80, y: 10 });

const selectedPin = selectedExtrusionNode({ document, selection: ["cmp1:pin:2"] });
assert.deepEqual(selectedPin.point, { x: 70, y: 10 });
assert.deepEqual(
  buildExtrusionDraftPoints(selectedPin, target),
  [
    { x: 70, y: 10, __attach: "cmp1:pin:2" },
    { x: 80, y: 10, __attach: "near" },
  ],
);

const wirePointState = {
  document: { components: [], wires: [{ id: "source", points: [{ x: 10, y: 10 }, { x: 10, y: 30 }] }], junctions: [] },
  selection: ["source:pt:1"],
};
assert.deepEqual(selectedExtrusionNode(wirePointState), {
  point: { x: 10, y: 30 },
  hit: { type: "wire-point", id: "source:pt:1", wireId: "source" },
  sourceWireId: "source",
});

console.log("ok - circuit wire extrusion geometry");
