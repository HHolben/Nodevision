import assert from "node:assert/strict";
import { createEmptyScadModel, addObject, addLayer, moveObjectToLayer, setLayerVisibility, setLayerLocked, addTimelineStep } from "./ScadModel.mjs";

const model = createEmptyScadModel();
assert.equal(model.version, 1);
assert.equal(model.layers.length, 1);

const circle = addObject(model, { type: "circle", params: { radius: 3 } });
const rect = addObject(model, { type: "rectangle", params: { width: 20, height: 10 } });
const tri = addObject(model, { type: "triangle" });
const poly = addObject(model, { type: "polygon", params: { points: [[0, 0], [2, 0], [2, 2], [0, 2]] } });
assert.equal(model.objects.length, 4);
assert.equal(circle.params.radius, 3);
assert.equal(rect.params.width, 20);
assert.equal(tri.type, "triangle");
assert.equal(poly.params.points.length, 4);

const layer = addLayer(model, { name: "Cuts" });
assert.ok(moveObjectToLayer(model, circle.id, layer.id));
assert.ok(layer.objectIds.includes(circle.id));
assert.ok(setLayerVisibility(model, layer.id, false));
assert.equal(layer.visible, false);
assert.ok(setLayerLocked(model, layer.id, true));
assert.equal(layer.locked, true);

const step = addTimelineStep(model, { type: "extrude", objectIds: [rect.id], label: "Extrude rectangle" });
assert.equal(step.type, "extrude");
assert.ok(model.timeline.length >= 1);
