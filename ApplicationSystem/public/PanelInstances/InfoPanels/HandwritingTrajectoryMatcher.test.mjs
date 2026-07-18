// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/HandwritingTrajectoryMatcher.test.mjs
// Focused tests for DTW trajectory matching.

import assert from "node:assert/strict";
import { normalizeRawHandwritingStrokes } from "./HandwritingTrajectory.mjs";
import {
  compareHandwritingTrajectories,
  dynamicTimeWarpingDistance,
} from "./HandwritingTrajectoryMatcher.mjs";

function stroke(points) {
  return [points.map((point, index) => ({ ...point, t: index * 11 }))];
}

function line(count, reverse = false) {
  const points = Array.from({ length: count }, (_, index) => {
    const t = count === 1 ? 0 : index / (count - 1);
    return { x: t * 100, y: t * 100 };
  });
  return stroke(reverse ? points.reverse() : points);
}

function zigzag() {
  return stroke([
    { x: 0, y: 0 },
    { x: 20, y: 80 },
    { x: 50, y: 10 },
    { x: 80, y: 90 },
    { x: 100, y: 0 },
  ]);
}

{
  const a = normalizeRawHandwritingStrokes(line(5));
  const b = normalizeRawHandwritingStrokes(line(20));
  const result = compareHandwritingTrajectories(a, b);
  assert.ok(result.similarity > 0.92, `same path different speeds should match: ${result.similarity}`);
}

{
  const a = normalizeRawHandwritingStrokes(line(8));
  const b = normalizeRawHandwritingStrokes(line(8, true));
  const result = compareHandwritingTrajectories(a, b);
  assert.ok(result.similarity < 0.8, "reversed path should be meaningfully worse than same direction");
}

{
  const a = normalizeRawHandwritingStrokes(line(9));
  const shiftedScaled = [[
    { x: 1000, y: -2000 },
    { x: 1500, y: -1500 },
    { x: 2000, y: -1000 },
  ]];
  const b = normalizeRawHandwritingStrokes(shiftedScaled);
  assert.ok(compareHandwritingTrajectories(a, b).similarity > 0.9);
}

{
  const a = normalizeRawHandwritingStrokes(line(12));
  const b = normalizeRawHandwritingStrokes(zigzag());
  assert.ok(compareHandwritingTrajectories(a, b).similarity < 0.8);
}

{
  const oneStroke = normalizeRawHandwritingStrokes(line(5));
  const twoStroke = normalizeRawHandwritingStrokes([
    [{ x: 0, y: 0 }, { x: 100, y: 0 }],
    [{ x: 100, y: 0 }, { x: 100, y: 100 }],
  ]);
  const result = compareHandwritingTrajectories(oneStroke, twoStroke);
  assert.ok(result.evidence.strokeCountScore < 1);
  assert.ok(result.similarity > 0, "stroke mismatch should be penalized but not fatal");
}

{
  const a = normalizeRawHandwritingStrokes(line(10));
  const b = normalizeRawHandwritingStrokes(line(10));
  assert.deepEqual(compareHandwritingTrajectories(a, b), compareHandwritingTrajectories(a, b));
}

{
  const points = Array.from({ length: 200 }, (_, index) => ({ x: index / 199, y: index / 199 }));
  const result = dynamicTimeWarpingDistance(points, points, { maxDtwCells: 1000 });
  assert.equal(result.skipped, true);
  assert.equal(result.reason, "complexity-guard");
}

console.log("Handwriting trajectory matcher tests passed");
