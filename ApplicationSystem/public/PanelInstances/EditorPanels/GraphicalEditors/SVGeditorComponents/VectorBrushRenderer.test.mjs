// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/VectorBrushRenderer.test.mjs
// Focused tests for pressure normalization and SVG vector brush specs.

import assert from "node:assert/strict";
import { normalizePointerPressure, normalizePointerSample } from "./PointerInput.mjs";
import { buildVectorBrushSpec } from "./VectorBrushRenderer.mjs";
import { getBrushPreset } from "./VectorBrushPresets.mjs";

const settings = {
  syntheticMousePressure: 0.42,
  brushSize: 12,
  brushOpacity: 0.8,
  defaultBrushPreset: "pencil",
  stabilizationMode: "none",
  stabilizationStrength: 0,
  smoothing: 0,
  minimumPointDistance: 0,
  curveSimplification: 0,
  preserveCorners: true,
};

{
  assert.equal(normalizePointerPressure({ pointerType: "mouse", pressure: 0, buttons: 1 }, settings), 0.42);
  assert.equal(normalizePointerPressure({ pointerType: "pen", pressure: 0, buttons: 1 }, settings), 0.42);
  assert.equal(normalizePointerPressure({ pointerType: "pen", pressure: 0.75, buttons: 1 }, settings), 0.75);
  assert.ok(normalizePointerPressure({ pointerType: "touch", pressure: 0, buttons: 0 }, settings) > 0, "zero-pressure touch fallback remains usable");
}

{
  const first = normalizePointerSample({ pointerType: "pen", pressure: 0.3, timeStamp: 10, pointerId: 7, tiltX: 20, tiltY: -10, twist: 33 }, { x: 0, y: 0 }, null, settings);
  const second = normalizePointerSample({ pointerType: "pen", pressure: 0.8, timeStamp: 30, pointerId: 7 }, { x: 10, y: 0 }, first, settings);
  assert.equal(first.pointerType, "pen");
  assert.equal(first.pointerId, 7);
  assert.equal(first.tiltX, 20);
  assert.equal(first.twist, 33);
  assert.equal(second.distanceFromPrevious, 10);
  assert.equal(second.deltaTime, 20);
  assert.equal(second.velocity, 0.5);
}

{
  const samples = [
    { x: 0, y: 0, pressure: 0.05, velocity: 0, time: 0 },
    { x: 20, y: 2, pressure: 0.5, velocity: 0.4, time: 10 },
    { x: 40, y: 0, pressure: 1, velocity: 0.2, time: 20 },
  ];
  const spec = buildVectorBrushSpec(samples, { stroke: "#123456" }, settings, { preset: getBrushPreset("pencil") });
  assert.equal(spec.tag, "path");
  assert.equal(spec.attrs.fill, "#123456");
  assert.equal(spec.attrs.stroke, "none");
  assert.equal(spec.attrs["data-nv-vector-brush"], "outline");
  assert.ok(Number(spec.attrs["fill-opacity"]) <= 0.8 && Number(spec.attrs["fill-opacity"]) > 0);
  assert.ok(!spec.attrs.d.includes("NaN"));
}

{
  const spec = buildVectorBrushSpec([{ x: 5, y: 5, pressure: 0, velocity: 0, time: 0 }], { stroke: "#000" }, settings, { preset: getBrushPreset("monoline") });
  assert.equal(spec.attrs["data-nv-vector-brush"], "centerline");
  assert.ok(Number(spec.attrs["stroke-width"]) >= 0.1);
}

{
  assert.equal(buildVectorBrushSpec([], { stroke: "#000" }, settings), null, "empty stroke should not create SVG geometry");
}
