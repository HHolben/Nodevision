// Nodevision/ApplicationSystem/public/ScadEditor/ScadSerializer.test.mjs
// This test module verifies ScadEditor serialization for parsed and programmatically constructed SCAD models.
import assert from "node:assert/strict";
import { createEmptyScadModel, addObject, setParameter } from "./ScadModel.mjs";
import { extrudeObjects, addBooleanOperation, scaleObjects } from "./ScadOperations.mjs";
import { serializeScadModel } from "./ScadSerializer.mjs";
import { parseBasicScad, parseScadText } from "./ScadParser.mjs";

const model = createEmptyScadModel();
setParameter(model, "wall_thickness", 2);
const circle = addObject(model, { type: "circle", params: { radius: 5 } });
const rect = addObject(model, { type: "rectangle", params: { width: 20, height: 10 } });
addObject(model, { type: "triangle", params: { points: [[0, 0], [10, 0], [5, 8]] } });
addObject(model, { type: "polygon", params: { points: [[0, 0], [3, 0], [3, 2], [0, 2]] } });
addObject(model, { type: "square", params: { size: 7 } });
addObject(model, { type: "line", params: { points: [[0, 0], [5, 0]], strokeWidth: 1 } });
addObject(model, { type: "text", params: { text: "Label", size: 6 } });
addObject(model, { type: "sphere", params: { radius: 4 } });
const cube = addObject(model, { type: "cube", params: { size: [3, 4, 5], center: true } });
addObject(model, { type: "cylinder", params: { height: 9, radius: 2 } });
addObject(model, { type: "polyhedron" });
extrudeObjects(model, [rect.id], 10);
assert.deepEqual(extrudeObjects(model, [cube.id], 5), []);
assert.equal(addBooleanOperation(model, "boolean", [rect.id, circle.id]), null);

const orderedDifferenceModel = createEmptyScadModel();
const flatFirst = addObject(orderedDifferenceModel, { type: "circle", params: { radius: 2 } });
const solidSecond = addObject(orderedDifferenceModel, { type: "cube", params: { size: [4, 4, 4], center: true } });
const orderedDifferenceStep = addBooleanOperation(orderedDifferenceModel, "difference", [flatFirst.id, solidSecond.id]);
assert.deepEqual(orderedDifferenceStep.objectIds, [solidSecond.id, flatFirst.id]);
assert.equal(orderedDifferenceStep.params.baseObjectId, solidSecond.id);

const foldedScaleModel = createEmptyScadModel();
const foldedScaleCube = addObject(foldedScaleModel, { type: "cube", params: { size: [4, 4, 4], center: true } });
scaleObjects(foldedScaleModel, [foldedScaleCube.id], [4, 4, 4]);
const timelineLengthAfterFirstScale = foldedScaleModel.timeline.length;
scaleObjects(foldedScaleModel, [foldedScaleCube.id], [0.5, 0.5, 0.5]);
assert.equal(foldedScaleModel.timeline.length, timelineLengthAfterFirstScale);
assert.deepEqual(foldedScaleModel.timeline.at(-1).params.factors, [2, 2, 2]);
assert.deepEqual(foldedScaleCube.transform.scale, [2, 2, 2]);

addBooleanOperation(model, "cutout", [rect.id, circle.id]);

const scad = serializeScadModel(model);
assert.match(scad, /nodevision-scad-model/);
assert.match(scad, /wall_thickness = 2;/);
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

const mixedDifference = createEmptyScadModel();
const mixedBase = addObject(mixedDifference, { type: "rectangle", params: { width: 20, height: 10 } });
const mixedCutter = addObject(mixedDifference, { type: "circle", params: { radius: 4 }, transform: { translate: [8, 5, 0] } });
extrudeObjects(mixedDifference, [mixedBase.id], 8);
addBooleanOperation(mixedDifference, "difference", [mixedBase.id, mixedCutter.id]);
const mixedDifferenceScad = serializeScadModel(mixedDifference);
assert.match(mixedDifferenceScad, /difference\(\) \{/);
assert.match(mixedDifferenceScad, /linear_extrude\(height = 8\)[\s\S]*square\(\[20, 10\]/);
assert.match(mixedDifferenceScad, /linear_extrude\(height = 8\)[\s\S]*circle\(r = 4/);

const mixedIntersection = createEmptyScadModel();
const intersectionCube = addObject(mixedIntersection, { type: "cube", params: { size: [6, 7, 9], center: true } });
const intersectionSquare = addObject(mixedIntersection, { type: "square", params: { size: 5 } });
const intersectionStep = addBooleanOperation(mixedIntersection, "intersection", [intersectionCube.id, intersectionSquare.id]);
assert.equal(intersectionStep.params.baseObjectId, intersectionCube.id);
const mixedIntersectionScad = serializeScadModel(mixedIntersection);
assert.match(mixedIntersectionScad, /intersection\(\) \{/);
assert.match(mixedIntersectionScad, /translate\(\[0, 0, -4.5\]\)[\s\S]*linear_extrude\(height = 9\)[\s\S]*square\(5, center = false\)/);

const centeredDifference = createEmptyScadModel();
const centeredBase = addObject(centeredDifference, { type: "cube", params: { size: [10, 10, 10], center: true } });
const centeredCutter = addObject(centeredDifference, { type: "circle", params: { radius: 3 } });
addBooleanOperation(centeredDifference, "difference", [centeredBase.id, centeredCutter.id]);
const centeredDifferenceScad = serializeScadModel(centeredDifference);
assert.match(centeredDifferenceScad, /difference\(\) \{/);
assert.match(centeredDifferenceScad, /translate\(\[0, 0, -5\]\)[\s\S]*linear_extrude\(height = 10\)[\s\S]*circle\(r = 3/);

const transformedModel = createEmptyScadModel();
addObject(transformedModel, {
  type: "cube",
  params: { size: [2, 2, 2], center: true },
  transform: { translate: [1, 2, 3], rotate: [0, 0, 45], scale: [2, 1, 1] },
});
const transformedScad = serializeScadModel(transformedModel);
assert.match(transformedScad, /translate\(\[1, 2, 3\]\)\s*rotate\(\[0, 0, 45\]\)\s*scale\(\[2, 1, 1\]\)\s*cube\(\[2, 2, 2\]/);

const parsed = parseScadText(scad);
assert.equal(parsed.source, "metadata");
assert.equal(parsed.model.objects.length, 11);

const staleMetadataModel = createEmptyScadModel();
addObject(staleMetadataModel, { type: "cube", params: { size: [3, 3, 3] } });
const staleMetadataScad = serializeScadModel(staleMetadataModel).replace(/cube\([^;]+;/, "sphere(10, $fn = 24);");
assert.equal(parseScadText(staleMetadataScad).model.objects[0].type, "cube");
const visibleSourceParsed = parseBasicScad(staleMetadataScad);
assert.equal(visibleSourceParsed.objects.length, 1);
assert.equal(visibleSourceParsed.objects[0].type, "sphere");
assert.equal(visibleSourceParsed.objects[0].params.radius, 10);
assert.equal(visibleSourceParsed.objects[0].params.segments, 24);

const imported = parseScadText("width = 40;\nlinear_extrude(height = 4)\nsquare([8, 6], center = false);\ncircle(r = 2);\ntext(text = \"Hi\", size = 3);\nsphere(r = 4);\ncube([1, 2, 3], center = true);\ncylinder(h = 8, d = 6);\nsquare(5, center = true);");
assert.equal(imported.source, "best-effort");
assert.equal(imported.model.parameters.width, 40);
assert.equal(imported.model.objects.length, 7);
assert.equal(imported.model.objects[0].operations[0].params.height, 4);
assert.equal(imported.model.objects[2].params.text, "Hi");
assert.deepEqual(imported.model.objects[4].params.size, [1, 2, 3]);
assert.equal(imported.model.objects[5].params.radius, 3);
assert.equal(imported.model.objects[6].type, "square");
assert.equal(imported.model.objects[6].params.size, 5);
assert.equal(imported.model.objects[6].params.center, true);

const variablesOnly = parseScadText("height = 12;");
assert.equal(variablesOnly.source, "best-effort");
assert.equal(variablesOnly.model.parameters.height, 12);

const empty = parseScadText("");
assert.equal(empty.model.objects.length, 0);
assert.equal(empty.model.warnings.length, 0);

const unsupported = parseScadText("module custom() { children(); } custom();");
assert.equal(unsupported.source, "unsupported");
assert.ok(unsupported.model.warnings.length > 0);
