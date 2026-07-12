// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/StrokeStabilizer.test.mjs
// Focused tests for SVG freehand stabilization.

import assert from "node:assert/strict";
import { detectCornerIndices, stabilizeStroke } from "./StrokeStabilizer.mjs";

function pt(x, y, pressure = 0.5) {
  return { x, y, pressure, time: x + y };
}

const noisyLine = Array.from({ length: 180 }, (_, i) => pt(i, Math.sin(i / 3) * 0.8));
{
  const result = stabilizeStroke(noisyLine, {
    mode: "medium",
    strength: 0.5,
    minimumPointDistance: 0.25,
    curveSimplification: 1.2,
  }).samples;
  assert.deepEqual({ x: result[0].x, y: result[0].y }, { x: noisyLine[0].x, y: noisyLine[0].y });
  assert.deepEqual(
    { x: result[result.length - 1].x, y: result[result.length - 1].y },
    { x: noisyLine[noisyLine.length - 1].x, y: noisyLine[noisyLine.length - 1].y },
  );
  assert.ok(result.length < noisyLine.length, "stabilization should reduce unnecessary nodes");
  assert.ok(result.every((sample) => Number.isFinite(sample.x) && Number.isFinite(sample.y)), "coordinates stay finite");
}

{
  const cornerStroke = [
    ...Array.from({ length: 40 }, (_, i) => pt(i, 0)),
    ...Array.from({ length: 40 }, (_, i) => pt(39, i + 1)),
  ];
  const corners = detectCornerIndices(cornerStroke, { cornerAngleDegrees: 42 });
  assert.ok(corners.size >= 3, "corner detector should include endpoints and the intentional bend");
  const result = stabilizeStroke(cornerStroke, { mode: "technical", preserveCorners: true, curveSimplification: 2 }).samples;
  assert.ok(result.some((sample) => Math.abs(sample.x - 39) < 0.001 && Math.abs(sample.y) < 1.5), "intentional corner should survive simplification");
}

{
  const source = noisyLine.map((sample) => ({ ...sample }));
  const before = JSON.stringify(source);
  stabilizeStroke(source, { mode: "strong" });
  assert.equal(JSON.stringify(source), before, "stabilizer must not mutate source samples");
}

{
  const a = stabilizeStroke(noisyLine, { mode: "medium", curveSimplification: 1 }).samples;
  const b = stabilizeStroke(noisyLine, { mode: "medium", curveSimplification: 1, zoom: 200 }).samples;
  assert.deepEqual(a, b, "stabilization should not depend on zoom-like external options");
}

{
  const none = stabilizeStroke(noisyLine, { mode: "none" }).samples;
  assert.equal(none.length, noisyLine.length);
  assert.notEqual(none[0], noisyLine[0], "none mode still returns cloned samples");
}
