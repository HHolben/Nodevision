import assert from "node:assert/strict";
import { createEmptyScadModel, addObject } from "./ScadModel.mjs";
import { extrudeObjects, addBooleanOperation } from "./ScadOperations.mjs";
import { serializeScadModel } from "./ScadSerializer.mjs";
import { parseScadText } from "./ScadParser.mjs";

const model = createEmptyScadModel();
const circle = addObject(model, { type: "circle", params: { radius: 5 } });
const rect = addObject(model, { type: "rectangle", params: { width: 20, height: 10 } });
addObject(model, { type: "triangle", params: { points: [[0, 0], [10, 0], [5, 8]] } });
addObject(model, { type: "polygon", params: { points: [[0, 0], [3, 0], [3, 2], [0, 2]] } });
extrudeObjects(model, [rect.id], 10);
addBooleanOperation(model, "cutout", [rect.id, circle.id]);

const scad = serializeScadModel(model);
assert.match(scad, /nodevision-scad-model/);
assert.match(scad, /circle\(r = 5/);
assert.match(scad, /square\(\[20, 10\]/);
assert.match(scad, /polygon\(points = \[\[0, 0\], \[10, 0\], \[5, 8\]\]\)/);
assert.match(scad, /linear_extrude\(height = 10\)/);
assert.match(scad, /difference\(\) \{/);

const parsed = parseScadText(scad);
assert.equal(parsed.source, "metadata");
assert.equal(parsed.model.objects.length, 4);

const imported = parseScadText("linear_extrude(height = 4)\nsquare([8, 6], center = false);\ncircle(r = 2);");
assert.equal(imported.source, "best-effort");
assert.equal(imported.model.objects.length, 2);
assert.equal(imported.model.objects[0].operations[0].params.height, 4);

const unsupported = parseScadText("module custom() { children(); } custom() cube([1,2,3]);");
assert.equal(unsupported.source, "unsupported");
assert.ok(unsupported.model.warnings.length > 0);
