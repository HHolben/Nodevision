// Nodevision/ApplicationSystem/public/PanelInstances/Common/ImageMap/ImageMapGeometry.test.mjs
// This test file verifies intrinsic image-map coordinate conversion and geometry editing helpers.

import assert from "node:assert/strict";
import {
  circleCoordsFromPoints,
  moveAreaBy,
  pointFromDisplay,
  rectCoordsFromPoints,
  replacePolygonVertex,
  reshapeAreaWithPoint,
} from "./ImageMapGeometry.mjs";

const imageSize = { width: 1000, height: 500 };
const displayRect = { left: 100, top: 50, width: 200, height: 100 };

assert.deepEqual(pointFromDisplay(150, 75, displayRect, imageSize), { x: 250, y: 125 });
assert.deepEqual(pointFromDisplay(400, 400, displayRect, imageSize), { x: 1000, y: 500 });
assert.deepEqual(rectCoordsFromPoints({ x: 80, y: 40 }, { x: 10, y: 140 }), [10, 40, 80, 140]);
assert.deepEqual(circleCoordsFromPoints({ x: 10, y: 10 }, { x: 13, y: 14 }), [10, 10, 5]);

const movedRect = moveAreaBy({ id: "r", shape: "rect", coords: [10, 20, 30, 40] }, 5, -10, imageSize);
assert.deepEqual(movedRect.coords, [15, 10, 35, 30]);

const movedCircle = moveAreaBy({ id: "c", shape: "circle", coords: [10, 20, 7] }, 5, -10, imageSize);
assert.deepEqual(movedCircle.coords, [15, 10, 7]);

const reshaped = reshapeAreaWithPoint({ id: "r", shape: "rect", coords: [10, 10, 50, 50] }, "se", { x: 70, y: 80 });
assert.deepEqual(reshaped.coords, [10, 10, 70, 80]);

const polygon = replacePolygonVertex({ id: "p", shape: "poly", coords: [0, 0, 10, 0, 10, 10] }, 1, { x: 20, y: 25 });
assert.deepEqual(polygon.coords, [0, 0, 20, 25, 10, 10]);

console.log("ok - image map intrinsic coordinate geometry");
