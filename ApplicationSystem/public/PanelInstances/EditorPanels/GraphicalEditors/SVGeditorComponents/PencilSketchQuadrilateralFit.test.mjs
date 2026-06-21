// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/PencilSketchQuadrilateralFit.test.mjs
// Focused quadrilateral / rectangle hypothesis battery for pencil sketch preview fitting.

import assert from "node:assert/strict";
import { fitTriangleHypothesis } from "./PencilSketchTriangleFit.mjs";
import { fitQuadrilateralHypothesis } from "./PencilSketchQuadrilateralFit.mjs";

function stroke(points) {
  return { points: points.map(([x, y]) => ({ x, y })) };
}

function fitQuad(strokes, triangleError = 18) {
  return fitQuadrilateralHypothesis(strokes, {
    minClosureTolerance: 12,
    minSideLength: 18,
    minSideLengthRatio: 0.12,
    closureDiagonalRatio: 0.10,
    parallelToleranceDegrees: 15,
    rightAngleToleranceDegrees: 15,
    minCornerAngleDegrees: 18,
    minClosureScore: 0.38,
    confidenceThreshold: 0.56,
    maxTriangleErrorRatio: 1.18,
    triangleError,
  });
}

const triangle = [
  stroke([[0, 100], [16, 72], [34, 32]]),
  stroke([[36, 30], [62, 58], [92, 100]]),
  stroke([[92, 100], [62, 104], [30, 102], [2, 99]]),
];

const rectangle = [
  stroke([[0, 100], [0, 68], [1, 34], [0, 2]]),
  stroke([[2, 0], [34, 1], [72, 3], [122, 2]]),
  stroke([[124, 4], [123, 36], [124, 72], [122, 104]]),
  stroke([[120, 106], [82, 104], [42, 103], [2, 101]]),
];

{
  const result = fitQuad(triangle, 16);
  assert.equal(result.quadrilateral, false, "true triangle should not become a quadrilateral");
}

{
  const triangleResult = fitTriangleHypothesis(rectangle, {
    minClosureTolerance: 12,
    minSideLength: 20,
    minSideLengthRatio: 0.15,
    closureDiagonalRatio: 0.10,
    rightAngleToleranceDegrees: 15,
    minCornerAngleDegrees: 20,
    maxImprovementRatio: 0.75,
    confidenceThreshold: 0.58,
    twoSegmentError: 24,
  });
  const result = fitQuad(rectangle, triangleResult.threeSegmentError);
  assert.equal(result.quadrilateral, true, "four supported side bands should recognize as a quadrilateral");
  assert.equal(result.points.length, 4, "quadrilateral preview should have exactly four vertices");
  assert.equal(result.detectedSideCount, 4, "all four rectangle sides need support");
  assert.ok(result.rectangleSubtypeConfidence > 0.45, "rectangle-like evidence should be scored");
}

{
  const gappedRectangle = fitQuad([
    stroke([[0, 96], [0, 62], [1, 28]]),
    stroke([[8, 0], [42, 1], [82, 2], [116, 2]]),
    stroke([[124, 10], [124, 44], [123, 78], [122, 98]]),
    stroke([[114, 106], [78, 104], [38, 102], [8, 101]]),
  ], 18);
  assert.equal(gappedRectangle.quadrilateral, true, "corner gaps should still allow a four-sided shape");
  assert.equal(gappedRectangle.detectedSideCount, 4);
}

{
  const threeSidesOnly = fitQuad(rectangle.slice(0, 3), 18);
  assert.equal(threeSidesOnly.quadrilateral, false, "three rectangle sides should not force a quadrilateral");
}
