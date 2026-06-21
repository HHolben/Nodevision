// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/PencilSketchLineFit.test.mjs
// Focused straight-line hypothesis battery for pencil sketch preview fitting.

import assert from "node:assert/strict";
import { fitStraightLineHypothesis } from "./PencilSketchLineFit.mjs";

function stroke(points) {
  return { points: points.map(([x, y]) => ({ x, y })) };
}

function lengthOf(result) {
  const [a, b] = result.points;
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function fit(strokes, previous = null) {
  return fitStraightLineHypothesis(strokes, {
    minAllowedError: 6,
    errorLengthRatio: 0.08,
    directionToleranceDegrees: 24,
    linearityThreshold: 0.34,
    confidenceThreshold: 0.56,
    minDirectionAgreement: 0.78,
    minProjectedLength: 8.8,
    previousLine: previous,
  });
}

const diagonalStrokes = [
  stroke([[0, 100], [8, 92], [18, 82]]),
  stroke([[22, 78], [31, 69], [42, 58]]),
  stroke([[47, 53], [55, 45], [66, 34]]),
  stroke([[70, 30], [80, 20], [92, 8]]),
];

{
  const result = fit([diagonalStrokes[0]]);
  assert.equal(result.straight, false, "single stroke should not be interpreted");
  assert.equal(result.reason, "single-stroke");
}

{
  const result = fit(diagonalStrokes.slice(0, 2));
  assert.equal(result.straight, true, "two same-axis strokes should infer a line");
  assert.ok(lengthOf(result) > 50, "line should span both strokes");
}

{
  const initial = fit(diagonalStrokes);
  assert.equal(initial.straight, true, "choppy same-direction strokes should infer a line");
  const backtracked = fit([
    ...diagonalStrokes,
    stroke([[38, 62], [28, 72], [15, 85]]),
  ], initial.state);
  assert.equal(backtracked.straight, true, "backtracking should preserve the line");
  assert.equal(backtracked.reinforcementClassification, "reinforcement");
  assert.ok(lengthOf(backtracked) >= lengthOf(initial) * 0.94, "reinforcement should not collapse endpoints");
}

{
  const initial = fit(diagonalStrokes);
  const reinforced = fit([
    ...diagonalStrokes,
    stroke([[24, 77], [34, 67], [43, 58]]),
    stroke([[26, 74], [36, 64], [45, 55]]),
  ], initial.state);
  assert.equal(reinforced.straight, true, "overlapping redraws should remain one line");
  assert.ok(reinforced.confidence >= initial.confidence * 0.85, "reinforcement should keep confidence stable");
}



{
  const initial = fit(diagonalStrokes);
  const belowOffset = fit([
    ...diagonalStrokes,
    stroke([[23, 88], [33, 78], [45, 66]]),
  ], initial.state);
  assert.equal(belowOffset.straight, true, "parallel lower offset stroke should preserve line");
  assert.equal(belowOffset.latestStrokeCompatible, true);
  assert.ok(lengthOf(belowOffset) >= lengthOf(initial) * 0.94, "offset stroke should not collapse to a local segment");
}

{
  const initial = fit(diagonalStrokes);
  const aboveOffset = fit([
    ...diagonalStrokes,
    stroke([[25, 70], [36, 59], [46, 49]]),
  ], initial.state);
  assert.equal(aboveOffset.straight, true, "parallel upper offset stroke should preserve line");
  assert.equal(aboveOffset.latestStrokeCompatible, true);
  assert.ok(lengthOf(aboveOffset) >= lengthOf(initial) * 0.94, "offset stroke should keep the global span");
}

{
  const initial = fit(diagonalStrokes);
  const extended = fit([
    ...diagonalStrokes,
    stroke([[95, 5], [106, -6], [118, -18]]),
  ], initial.state);
  assert.equal(extended.straight, true, "same-axis extension should preserve line");
  assert.ok(lengthOf(extended) > lengthOf(initial), "same-axis extension should extend an endpoint");
}

{
  const initial = fit(diagonalStrokes);
  const crossed = fit([
    ...diagonalStrokes,
    stroke([[38, 24], [42, 52], [46, 84]]),
  ], initial.state);
  assert.equal(crossed.latestDirectionCompatible, false, "crossing stroke should fail direction compatibility");
  assert.equal(crossed.latestStrongViolation, true, "crossing stroke should be treated as a strong conflict");
}

{
  const result = fit([
    ...diagonalStrokes,
    stroke([[30, 20], [42, 25], [55, 26]]),
  ]);
  assert.equal(result.straight, true, "one accidental off-line stroke should be down-weighted");
  assert.ok(result.supportRatio < 1, "the off-line stroke should not be counted as full support");
}
