// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/PencilSketchIrregularShapeFit.test.mjs
// Focused radial silhouette checks for Pencil Sketch Irregular Shape mode.

import assert from "node:assert/strict";
import { fitIrregularShapeRadialPrediction } from "./PencilSketchIrregularShapeFit.mjs";

function blobStroke(center, radiusAtAngle, count = 96, from = 0, to = Math.PI * 2) {
  const points = [];
  const span = to - from;
  for (let i = 0; i < count; i += 1) {
    const t = count === 1 ? 0 : i / (count - 1);
    const theta = from + span * t;
    const radius = radiusAtAngle(theta);
    points.push({
      x: center.x + Math.cos(theta) * radius,
      y: center.y + Math.sin(theta) * radius,
    });
  }
  return { points };
}

function fit(strokes, focalPoint = { x: 0, y: 0 }, options = {}) {
  return fitIrregularShapeRadialPrediction(strokes, focalPoint, {
    radialBinCount: 96,
    angularSmoothingBins: 3,
    minCoverageForPreview: 0.2,
    outlierTrimPercent: 0.15,
    previewSmoothness: 0.65,
    ...options,
  });
}

function radiusNear(result, theta) {
  const target = ((theta % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  return [...result.points].sort((a, b) =>
    Math.abs(a.theta - target) - Math.abs(b.theta - target)
  )[0].radius;
}

{
  const result = fit([
    blobStroke({ x: 0, y: 0 }, (theta) => 50 + Math.sin(theta * 3) * 7),
  ]);
  assert.equal(result.ok, true, "closed blob should produce an irregular outline");
  assert.ok(result.coverage > 0.8, "full outline should have high angular coverage");
  assert.ok(result.points.length >= 48, "outline should cover the circle");
}

{
  const base = blobStroke({ x: 0, y: 0 }, () => 50);
  const outward = blobStroke(
    { x: 0, y: 0 },
    () => 74,
    12,
    -0.16,
    0.16,
  );
  const result = fit([base, outward]);
  assert.ok(radiusNear(result, 0) > 54, "subsequent outward evidence should expand the right side");
}

{
  const base = blobStroke({ x: 0, y: 0 }, () => 60);
  const inward = blobStroke(
    { x: 0, y: 0 },
    () => 34,
    12,
    Math.PI - 0.16,
    Math.PI + 0.16,
  );
  const result = fit([base, inward]);
  assert.ok(radiusNear(result, Math.PI) < 56, "subsequent inward evidence should contract the left side");
}

{
  const arc = blobStroke({ x: 0, y: 0 }, () => 50, 10, 0, Math.PI / 6);
  const result = fit([arc]);
  assert.equal(result.ok, false, "small arcs should remain low confidence");
  assert.equal(result.reason, "coverage-too-low");
}

{
  const strokes = [blobStroke({ x: 10, y: 0 }, () => 45)];
  const centered = fit(strokes, { x: 10, y: 0 });
  const shifted = fit(strokes, { x: 0, y: 0 });
  assert.ok(Math.abs(radiusNear(centered, 0) - radiusNear(shifted, 0)) > 5, "moving focal point should recompute radii");
}

{
  const base = blobStroke({ x: 0, y: 0 }, () => 50);
  const replacement = blobStroke({ x: 0, y: 0 }, () => 80);
  const averaged = fit([base, replacement], { x: 0, y: 0 }, { combineMode: "averaging" });
  const overridden = fit([base, replacement], { x: 0, y: 0 }, { combineMode: "overriding" });
  assert.equal(overridden.combineMode, "overriding");
  assert.equal(overridden.sourceStrokeCount, 2);
  assert.ok(overridden.points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y)), "overriding should emit literal point coordinates");
  assert.ok(radiusNear(averaged, 0) < 70, "averaging should keep earlier strokes in the radius estimate");
  assert.ok(radiusNear(overridden, 0) > 76, "overriding should let the latest stroke overwrite each covered angle");
}

{
  const rightHalf = blobStroke({ x: 0, y: 0 }, () => 50, 32, -Math.PI / 2, Math.PI / 2);
  const plain = fit([rightHalf]);
  const mirrored = fit([rightHalf], { x: 0, y: 0 }, { mirrorY: true });
  assert.equal(mirrored.mirrorY, true);
  assert.ok(mirrored.coverage > plain.coverage + 0.25, "Mirror Y should add direct evidence on the opposite side");
  assert.ok(radiusNear(mirrored, Math.PI) > 45, "Mirror Y should produce the left side from right-side evidence");
}

{
  const result = fit([blobStroke({ x: 0, y: 0 }, () => 52)]);
  const uniqueAngles = new Set(result.points.map((point) => point.theta.toFixed(6)));
  assert.equal(uniqueAngles.size, result.points.length, "outline should contain one point for each predicted angle");
}

{
  const result = fit([], { x: 0, y: 0 }, { combineMode: "overriding" });
  assert.equal(result.ok, false, "overriding should not invent a shape before the artist draws");
  assert.equal(result.reason, "not-enough-radial-samples");
  assert.equal(result.points.length, 0);
}

{
  const rightEdge = blobStroke({ x: 0, y: 0 }, () => 82, 10, -0.12, 0.12);
  const previous = blobStroke({ x: 0, y: 0 }, () => 50);
  const result = fit([previous, rightEdge], { x: 0, y: 0 }, { combineMode: "overriding" });
  assert.equal(result.ok, true);
  assert.ok(result.binsOverwritten > 0, "stroke samples should set override bins");
  assert.equal(result.sourceStrokeCount, 2);
  assert.ok(radiusNear(result, 0) > 76, "covered angles should use newer stroke radii");
  assert.ok(Math.abs(radiusNear(result, Math.PI) - 50) < 5, "untouched angles should keep previous stroke geometry");
}
