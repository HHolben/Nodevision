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
  const gappedSecondSide = fit([
    stroke([[0, 100], [16, 72], [34, 30]]),
    stroke([[36, 28], [48, 46], [60, 62]]),
    stroke([[82, 88], [98, 108], [116, 128]]),
  ]);
  assert.equal(gappedSecondSide.angle, true, "gapped second side should still be one angle segment");
  assert.ok(gappedSecondSide.segmentLengthB > 90, "second segment should extend to far compatible evidence");
  assert.ok(gappedSecondSide.assignedCountB > 5, "second segment should use assigned samples beyond the apex");
}

{
  const accidentalMark = fit([
    ...angleStrokes,
    stroke([[35, 75], [39, 79], [42, 82]]),
  ]);
  assert.equal(accidentalMark.angle, true, "angle should survive one short accidental mark");
  assert.ok(accidentalMark.segmentLengthB > 40, "accidental mark should not shorten the second side");
}

{
  const choppySecondSide = fit([
    stroke([[0, 100], [18, 68], [38, 28]]),
    stroke([[40, 30], [52, 48], [64, 64]]),
    stroke([[72, 78], [84, 94]]),
    stroke([[92, 108], [110, 130]]),
  ]);
  assert.equal(choppySecondSide.angle, true, "separated choppy second-side strokes should form one segment");
  assert.ok(choppySecondSide.segmentLengthB > 105, "second segment should reach the farthest choppy stroke");
  assert.equal(
    choppySecondSide.strokeAssignments.find((entry) => entry.strokeId === 3)?.assignedSegment,
    "B",
    "far lower-right stroke should be assigned to Segment B",
  );
}

{
  const offsetSecondSide = fit([
    stroke([[0, 100], [18, 68], [38, 28]]),
    stroke([[40, 30], [52, 48], [64, 64]]),
    stroke([[78, 92], [96, 118], [112, 140]]),
  ]);
  assert.equal(offsetSecondSide.angle, true, "slightly offset second-side evidence should still support Segment B");
  assert.ok(offsetSecondSide.segmentLengthB > 110, "offset second-side evidence should extend Segment B");
  assert.equal(
    offsetSecondSide.strokeAssignments.find((entry) => entry.strokeId === 2)?.assignedSegment,
    "B",
    "offset lower-right stroke should be assigned to Segment B",
  );
}

{
  const crossingMark = fit([
    ...angleStrokes,
    stroke([[45, 92], [95, 92]]),
  ]);
  assert.equal(crossingMark.angle, true, "angle should survive an unrelated crossing mark");
  assert.notEqual(
    crossingMark.strokeAssignments.find((entry) => entry.strokeId === 4)?.assignedSegment,
    "B",
    "different-angle crossing mark should not be assigned to Segment B",
  );
}

{
  const smallHook = fit([
    ...straightStrokes,
    stroke([[88, 12], [92, 18], [95, 20]]),
  ]);
  assert.equal(smallHook.angle, false, "a small accidental hook should not create a full angle");
}
