// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/PencilSketchTriangleFit.test.mjs
// Focused triangle hypothesis battery for pencil sketch preview fitting.

import assert from "node:assert/strict";
import { fitTriangleHypothesis } from "./PencilSketchTriangleFit.mjs";

function stroke(points) {
  return { points: points.map(([x, y]) => ({ x, y })) };
}

function fit(strokes, twoSegmentError = 18) {
  return fitTriangleHypothesis(strokes, {
    minClosureTolerance: 12,
    minSideLength: 20,
    minSideLengthRatio: 0.15,
    closureDiagonalRatio: 0.10,
    rightAngleToleranceDegrees: 15,
    minCornerAngleDegrees: 20,
    maxImprovementRatio: 0.75,
    confidenceThreshold: 0.58,
    twoSegmentError,
  });
}

const angleOnly = [
  stroke([[0, 100], [16, 72], [34, 32]]),
  stroke([[36, 30], [62, 58], [92, 100]]),
];

const triangle = [
  ...angleOnly,
  stroke([[92, 100], [62, 104], [30, 102], [2, 99]]),
];

{
  const result = fit([angleOnly[0]]);
  assert.equal(result.triangle, false, "single stroke should not be a triangle");
}

{
  const result = fit(angleOnly);
  assert.equal(result.triangle, false, "two rough sides should remain an open angle");
}

{
  const partialBottom = fit([
    ...angleOnly,
    stroke([[92, 100], [76, 102], [64, 103]]),
  ]);
  assert.equal(partialBottom.triangle, false, "short third-side marks should not upgrade yet");
}

{
  const result = fit(triangle);
  assert.equal(result.triangle, true, "three supported sides should recognize as a triangle");
  assert.equal(result.points.length, 3, "triangle preview should have exactly three vertices");
  assert.equal(result.activeSegmentCount, 3);
  assert.ok(result.closureScore >= 0.42, "triangle closure should be plausible");
  assert.ok(Math.min(result.sideLengthA, result.sideLengthB, result.sideLengthC) >= 20);
}

{
  const gappedBottom = fit([
    ...angleOnly,
    stroke([[86, 100], [58, 103], [28, 101], [8, 99]]),
  ]);
  assert.equal(gappedBottom.triangle, true, "small gaps near triangle corners should be tolerated");
}

{
  const offsetBottom = fit([
    ...angleOnly,
    stroke([[94, 110], [62, 113], [30, 111], [0, 108]]),
  ]);
  assert.equal(offsetBottom.triangle, true, "slightly offset bottom side should still close a triangle");
}

const rightTriangle = [
  stroke([[0, 100], [0, 68], [0, 32], [1, 2]]),
  stroke([[2, 100], [38, 104], [78, 106], [122, 108]]),
  stroke([[122, 108], [88, 76], [48, 38], [1, 2]]),
];

{
  const result = fit(rightTriangle, 24);
  assert.equal(result.triangle, true, "asymmetric right triangle should recognize as a triangle");
  assert.equal(result.rightTriangleCompatible, true, "right-triangle-compatible angle should be detected");
  assert.ok(result.rightAngleScore > 0, "right-angle score should be positive");
  assert.equal(result.detectedSideCount, 3, "all three right-triangle sides need support");
}

{
  const gappedRightTriangle = fit([
    stroke([[0, 96], [0, 62], [1, 28]]),
    stroke([[8, 102], [46, 105], [86, 107], [116, 108]]),
    stroke([[112, 104], [78, 72], [40, 34], [6, 8]]),
  ], 24);
  assert.equal(gappedRightTriangle.triangle, true, "right triangle with corner gaps should still close");
  assert.equal(gappedRightTriangle.rightTriangleCompatible, true);
}

{
  const choppyVerticalRightTriangle = fit([
    stroke([[0, 100], [0, 78]]),
    stroke([[1, 70], [1, 42]]),
    stroke([[0, 34], [1, 4]]),
    stroke([[2, 100], [38, 104], [78, 106], [122, 108]]),
    stroke([[122, 108], [88, 76], [48, 38], [1, 2]]),
  ], 24);
  assert.equal(choppyVerticalRightTriangle.triangle, true, "separate vertical leg strokes should assign to one side");
  assert.equal(choppyVerticalRightTriangle.detectedSideCount, 3);
}

{
  const twoSidesOnly = fit([
    stroke([[0, 100], [0, 68], [0, 32], [1, 2]]),
    stroke([[2, 100], [38, 104], [78, 106], [122, 108]]),
  ], 24);
  assert.equal(twoSidesOnly.triangle, false, "two sides of a right triangle should not upgrade to triangle");
}
