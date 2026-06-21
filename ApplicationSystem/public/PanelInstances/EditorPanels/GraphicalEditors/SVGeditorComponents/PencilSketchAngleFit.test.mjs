// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/PencilSketchAngleFit.test.mjs
// Focused two-segment angle hypothesis battery for pencil sketch preview fitting.

import assert from "node:assert/strict";
import { fitTwoSegmentAngleHypothesis } from "./PencilSketchAngleFit.mjs";

function stroke(points) {
  return { points: points.map(([x, y]) => ({ x, y })) };
}

function fit(strokes) {
  return fitTwoSegmentAngleHypothesis(strokes, {
    minAllowedError: 8,
    errorLengthRatio: 0.08,
    minAngleDegrees: 25,
    maxImprovementRatio: 0.65,
    minSegmentLength: 10,
    confidenceThreshold: 0.6,
  });
}

const straightStrokes = [
  stroke([[0, 100], [12, 88], [24, 76]]),
  stroke([[28, 72], [42, 58], [56, 44]]),
  stroke([[60, 40], [74, 26], [88, 12]]),
];

const angleStrokes = [
  stroke([[0, 100], [15, 80], [30, 58]]),
  stroke([[32, 56], [45, 35], [58, 18]]),
  stroke([[60, 18], [75, 38], [90, 60]]),
  stroke([[92, 62], [106, 80], [120, 98]]),
];

{
  const result = fit([angleStrokes[0]]);
  assert.equal(result.angle, false, "single stroke should not be auto-interpreted as an angle");
  assert.equal(result.reason, "single-stroke");
}

{
  const result = fit(straightStrokes);
  assert.equal(result.angle, false, "straight-ish stroke clusters should not become an angle");
}

{
  const result = fit(angleStrokes);
  assert.equal(result.angle, true, "supported direction change should become a two-segment angle");
  assert.equal(result.points.length, 3, "angle preview should have start, corner, end");
  assert.ok(result.improvementRatio < 0.65, "two-line fit should beat one-line fit");
  assert.ok(result.angleBetweenSegments > 25, "corner angle should be meaningful");
  assert.ok(result.segmentLengthA > 10, "first segment needs meaningful length");
  assert.ok(result.segmentLengthB > 10, "second segment needs meaningful length");
}

{
  const reinforced = fit([
    ...angleStrokes,
    stroke([[34, 54], [45, 36], [56, 20]]),
  ]);
  assert.equal(reinforced.angle, true, "extra rough strokes near one segment should preserve the angle");
  assert.equal(reinforced.points.length, 3);
}

{
  const smallHook = fit([
    ...straightStrokes,
    stroke([[88, 12], [92, 18], [95, 20]]),
  ]);
  assert.equal(smallHook.angle, false, "a small accidental hook should not create a full angle");
}
