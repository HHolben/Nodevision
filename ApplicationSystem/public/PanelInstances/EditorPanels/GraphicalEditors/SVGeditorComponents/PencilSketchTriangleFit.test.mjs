// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/PencilSketchTriangleFit.test.mjs
// Focused triangle hypothesis battery for pencil sketch preview fitting.

import assert from "node:assert/strict";
import { fitTriangleHypothesis } from "./PencilSketchTriangleFit.mjs";

function stroke(points) {
  return { points: points.map(([x, y]) => ({ x, y })) };
}

function fit(strokes, twoSegmentError = 18) {
  return fitTriangleHypothesis(strokes, {
    minClosureTolerance: 10,
    minSideLength: 20,
    minSideLengthRatio: 0.15,
    closureDiagonalRatio: 0.08,
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
