// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/ShapeRecognition.test.mjs
// Focused tests for SVG draw-and-hold shape recognition.

import assert from "node:assert/strict";
import { recognizeShape, shapeToSvgSpec } from "./ShapeRecognition.mjs";

function pt(x, y) {
  return { x, y };
}

function line(a, b, count = 24, noise = 0) {
  return Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1);
    return pt(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t + Math.sin(i * 2.1) * noise);
  });
}

function ellipse(cx, cy, rx, ry, count = 96, noise = 0) {
  const points = [];
  for (let i = 0; i <= count; i += 1) {
    const t = (Math.PI * 2 * i) / count;
    points.push(pt(cx + Math.cos(t) * (rx + Math.sin(i) * noise), cy + Math.sin(t) * (ry + Math.cos(i * 1.7) * noise)));
  }
  return points;
}

function edgePoints(vertices, perEdge = 16, closed = true) {
  const out = [];
  const n = closed ? vertices.length : vertices.length - 1;
  for (let i = 0; i < n; i += 1) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    for (let j = 0; j < perEdge; j += 1) {
      const t = j / perEdge;
      out.push(pt(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t));
    }
  }
  if (closed) out.push({ ...vertices[0] });
  return out;
}

function regularPolygon(cx, cy, r, sides) {
  return Array.from({ length: sides }, (_, i) => {
    const t = -Math.PI / 2 + (Math.PI * 2 * i) / sides;
    return pt(cx + Math.cos(t) * r, cy + Math.sin(t) * r);
  });
}

{
  const result = recognizeShape(line(pt(10, 20), pt(160, 22), 40, 0.25), { sensitivity: 0.2 });
  assert.equal(result.recognized, true);
  assert.equal(result.type, "line");
  assert.equal(shapeToSvgSpec(result, { stroke: "#111", strokeWidth: 2 }).tag, "line");
}

{
  const result = recognizeShape([...line(pt(160, 22), pt(10, 20), 40, 0.25)], { sensitivity: 0.2 });
  assert.equal(result.recognized, true, "reversed drawing direction should still recognize");
  assert.equal(result.type, "line");
}

{
  const result = recognizeShape(ellipse(80, 70, 40, 39, 96, 0.35), { sensitivity: 0.2 });
  assert.equal(result.recognized, true);
  assert.equal(result.type, "circle");
  assert.equal(shapeToSvgSpec(result, { fill: "none" }).tag, "circle");
}

{
  const result = recognizeShape(ellipse(80, 70, 62, 28, 96, 0.25), { sensitivity: 0.2 });
  assert.equal(result.recognized, true);
  assert.equal(result.type, "ellipse");
  assert.equal(shapeToSvgSpec(result, { fill: "none" }).tag, "ellipse");
}

{
  const result = recognizeShape(edgePoints([pt(10, 10), pt(140, 10), pt(140, 90), pt(10, 90)], 18), { sensitivity: 0.2 });
  assert.equal(result.recognized, true);
  assert.equal(result.type, "rectangle");
  assert.equal(shapeToSvgSpec(result, { fill: "none" }).tag, "rect");
}

{
  const result = recognizeShape(edgePoints([pt(60, 10), pt(120, 120), pt(0, 120)], 18), { sensitivity: 0.2 });
  assert.equal(result.recognized, true);
  assert.equal(result.type, "triangle");
  assert.equal(shapeToSvgSpec(result, { fill: "none" }).tag, "polygon");
}

{
  const result = recognizeShape(edgePoints(regularPolygon(80, 80, 58, 5), 14), { sensitivity: 0.2 });
  assert.equal(result.recognized, true);
  assert.equal(result.type, "polygon");
}

{
  const result = recognizeShape(edgePoints([pt(0, 0), pt(40, 80), pt(90, 20), pt(150, 100)], 12, false), { sensitivity: 0.2 });
  assert.equal(result.recognized, true);
  assert.equal(result.type, "polyline");
}

{
  const arc = [];
  for (let i = 0; i <= 48; i += 1) {
    const t = Math.PI * 0.15 + (Math.PI * 1.1 * i) / 48;
    arc.push(pt(100 + Math.cos(t) * 70, 90 + Math.sin(t) * 70));
  }
  const result = recognizeShape(arc, { sensitivity: 0.2 });
  assert.equal(result.recognized, true);
  assert.equal(result.type, "arc");
  assert.equal(shapeToSvgSpec(result, {}).tag, "path");
}

{
  const curve = Array.from({ length: 60 }, (_, i) => pt(i * 3, 60 + Math.sin(i / 7) * 28));
  const result = recognizeShape(curve, { sensitivity: 0.2 });
  assert.equal(result.recognized, true);
  assert.equal(result.type, "smooth-open-curve");
}

{
  const noisy = Array.from({ length: 80 }, (_, i) => pt((i * 37) % 113, (i * i * 17) % 89));
  const result = recognizeShape(noisy, { sensitivity: 0.9 });
  assert.equal(result.recognized, false, "low-confidence irregular stroke should not convert");
}

{
  const tiny = [pt(0, 0), pt(0.05, 0.04), pt(0.1, 0.05)];
  const result = recognizeShape(tiny, { minSize: 1.5 });
  assert.equal(result.recognized, false);
  assert.equal(result.reason, "too-small");
}

{
  const result = recognizeShape(line(pt(10000, -2000), pt(20000, 4000), 64, 1), { sensitivity: 0.2 });
  assert.equal(result.recognized, true, "large translated strokes should recognize");
  assert.equal(result.type, "line");
}

{
  const rotatedRect = edgePoints([pt(0, 0), pt(70, 40), pt(35, 102), pt(-35, 62)], 16);
  const result = recognizeShape(rotatedRect, { sensitivity: 0.2 });
  assert.equal(result.recognized, true, "rotated rectangle should be recognized as polygon-backed rectangle");
  assert.equal(result.type, "rectangle");
  assert.equal(shapeToSvgSpec(result, { fill: "none" }).tag, "polygon");
}
