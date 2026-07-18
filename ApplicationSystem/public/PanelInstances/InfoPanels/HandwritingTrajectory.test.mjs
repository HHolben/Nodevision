// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/HandwritingTrajectory.test.mjs
// Focused tests for handwriting trajectory normalization and resampling.

import assert from "node:assert/strict";
import {
  HANDWRITING_TRAJECTORY_SCHEMA,
  normalizeRawHandwritingStrokes,
  resampleStrokePoints,
} from "./HandwritingTrajectory.mjs";

function line(x1, y1, x2, y2, count = 5) {
  return [Array.from({ length: count }, (_, index) => {
    const t = count === 1 ? 0 : index / (count - 1);
    return { x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t, t: index * 9 };
  })];
}

function nearlyEqual(a, b, epsilon = 1e-6) {
  assert.ok(Math.abs(a - b) <= epsilon, `${a} should be close to ${b}`);
}

{
  const a = normalizeRawHandwritingStrokes(line(10, 20, 110, 120));
  const b = normalizeRawHandwritingStrokes(line(210, 320, 410, 520));
  assert.equal(a.schema, HANDWRITING_TRAJECTORY_SCHEMA);
  nearlyEqual(a.strokes[0].points[0].x, b.strokes[0].points[0].x);
  nearlyEqual(a.strokes[0].points[4].y, b.strokes[0].points[4].y);
}

{
  const a = normalizeRawHandwritingStrokes(line(0, 0, 10, 0));
  const b = normalizeRawHandwritingStrokes(line(0, 0, 1000, 0));
  nearlyEqual(a.strokes[0].points[2].x, b.strokes[0].points[2].x);
  assert.ok(a.metadata.aspectRatio > 1);
}

{
  const dot = normalizeRawHandwritingStrokes([[{ x: 42, y: 99 }]]);
  assert.equal(dot.metadata.strokeCount, 1);
  assert.equal(dot.metadata.pointCount, 1);
  assert.equal(dot.strokes[0].points[0].x, 0.5);
  assert.equal(dot.strokes[0].points[0].pressure, 0.5);
  assert.ok(Number.isFinite(dot.metadata.aspectRatio));
}

{
  const repeated = normalizeRawHandwritingStrokes([[{ x: 1, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 1 }]]);
  assert.equal(repeated.metadata.pathLength, 0);
  assert.ok(repeated.raster28.points.length >= 1);
}

{
  const narrow = normalizeRawHandwritingStrokes(line(50, 0, 51, 400));
  const wide = normalizeRawHandwritingStrokes(line(0, 50, 400, 51));
  assert.ok(narrow.metadata.aspectRatio < 0.01);
  assert.ok(wide.metadata.aspectRatio > 100);
}

{
  const timed = normalizeRawHandwritingStrokes([[{ x: 0, y: 0, t: 100, pressure: 0.2 }, { x: 10, y: 10, t: 160, pressure: 0.9 }]]);
  assert.equal(timed.metadata.durationMs, 60);
  assert.equal(timed.strokes[0].points[0].t, 0);
  assert.equal(timed.strokes[0].points[1].pressure, 0.9);
}

{
  const points = resampleStrokePoints([{ x: 0, y: 0 }, { x: 10, y: 0 }], 5);
  assert.equal(points.length, 5);
  assert.equal(points[0].x, 0);
  assert.equal(points[4].x, 1);
  nearlyEqual(points[2].x, 0.5);
}

{
  const zero = resampleStrokePoints([{ x: 0.2, y: 0.3 }, { x: 0.2, y: 0.3 }], 4);
  assert.equal(zero.length, 4);
  assert.deepEqual(zero[0], zero[3]);
}

{
  const curve = resampleStrokePoints([
    { x: 0, y: 0 },
    { x: 0.5, y: 1 },
    { x: 1, y: 0 },
  ], 9);
  assert.equal(curve.length, 9);
  assert.equal(curve[0].x, 0);
  assert.equal(curve[8].x, 1);
}

console.log("Handwriting trajectory tests passed");
