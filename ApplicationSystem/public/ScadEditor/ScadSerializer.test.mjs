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
addObject(model, { type: "square", params: { size: 7 } });
addObject(model, { type: "line", params: { points: [[0, 0], [5, 0]], strokeWidth: 1 } });
addObject(model, { type: "text", params: { text: "Label", size: 6 } });
addObject(model, { type: "sphere", params: { radius: 4 } });
addObject(model, { type: "cube", params: { size: [3, 4, 5], center: true } });
addObject(model, { type: "cylinder", params: { height: 9, radius: 2 } });
addObject(model, { type: "polyhedron" });
extrudeObjects(model, [rect.id], 10);
addBooleanOperation(model, "cutout", [rect.id, circle.id]);

const scad = serializeScadModel(model);
assert.match(scad, /nodevision-scad-model/);
assert.match(scad, /circle\(r = 5/);
assert.match(scad, /square\(\[20, 10\]/);
assert.match(scad, /polygon\(points = \[\[0, 0\], \[10, 0\], \[5, 8\]\]\)/);
assert.match(scad, /square\(7, center = false\)/);
assert.match(scad, /hull\(\) \{/);
assert.match(scad, /text\(text = "Label"/);
assert.match(scad, /sphere\(r = 4/);
assert.match(scad, /cube\(\[3, 4, 5\]/);
assert.match(scad, /cylinder\(h = 9, r = 2/);
assert.match(scad, /polyhedron\(points = /);
assert.match(scad, /linear_extrude\(height = 10\)/);
assert.match(scad, /difference\(\) \{/);

const parsed = parseScadText(scad);
assert.equal(parsed.source, "metadata");
assert.equal(parsed.model.objects.length, 11);

const imported = parseScadText("linear_extrude(height = 4)\nsquare([8, 6], center = false);\ncircle(r = 2);\ntext(text = \"Hi\", size = 3);\nsphere(r = 4);\ncube([1, 2, 3], center = true);\ncylinder(h = 8, d = 6);\nsquare(5, center = true);");
assert.equal(imported.source, "best-effort");
assert.equal(imported.model.objects.length, 7);
assert.equal(imported.model.objects[0].operations[0].params.height, 4);
assert.equal(imported.model.objects[2].params.text, "Hi");
assert.deepEqual(imported.model.objects[4].params.size, [1, 2, 3]);
assert.equal(imported.model.objects[5].params.radius, 3);
assert.equal(imported.model.objects[6].type, "square");
assert.equal(imported.model.objects[6].params.size, 5);
assert.equal(imported.model.objects[6].params.center, true);

const empty = parseScadText("");
assert.equal(empty.model.objects.length, 0);
assert.equal(empty.model.warnings.length, 0);

const unsupported = parseScadText("module custom() { children(); } custom();");
assert.equal(unsupported.source, "unsupported");
assert.ok(unsupported.model.warnings.length > 0);
