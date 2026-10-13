// Nodevision/ApplicationSystem/public/VectorDrawing/VectorDrawing.test.mjs
// These regressions verify document-space geometry, directed arcs, polygon editing, and cancellation independently of rendering or image format.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGeometry, geometryMeasurements, svgGeometry } from './VectorGeometry.mjs';
import { createVectorInteraction } from './VectorInteraction.mjs';
const p = (x, y) => ({ x, y });
test('circle center, radius, area and native SVG element', () => {
  const g = createGeometry('circle', [p(10, 20), p(13, 24)]);
  assert.deepEqual(g, { kind: 'circle', cx: 10, cy: 20, r: 5 });
  assert.equal(geometryMeasurements(g).area, 25 * Math.PI);
  assert.equal(svgGeometry(g).tag, 'circle');
});
test('ellipse and rectangles normalize all four drag directions', () => {
  for (const x of [-10, 10]) for (const y of [-20, 20]) {
    const r = createGeometry('rectangle', [p(0, 0), p(x, y)]);
    assert.deepEqual(r, { kind: 'rectangle', x: Math.min(0, x), y: Math.min(0, y), width: 10, height: 20 });
    const e = createGeometry('ellipse', [p(0, 0), p(x, y)]);
    assert.deepEqual(e, { kind: 'ellipse', cx: x / 2, cy: y / 2, rx: 5, ry: 10 });
    assert.equal(geometryMeasurements(e).area, 50 * Math.PI);
  }
});
test('directed arcs project endpoint to radius and compute large-arc and sweep flags', () => {
  const points = [p(0, 0), p(10, 0), p(0, -20)];
  const clockwise = createGeometry('arc', points), reverse = createGeometry('arc', points, { sweep: 0 });
  assert.equal(clockwise.largeArc, 1); assert.equal(clockwise.sweep, 1);
  assert.equal(reverse.largeArc, 0); assert.equal(reverse.sweep, 0);
  assert.ok(Math.abs(geometryMeasurements(clockwise).length - 15 * Math.PI) < 1e-10);
  assert.match(svgGeometry(clockwise).attributes.d, / A 10 10 0 1 1 /);
  const wrap = createGeometry('arc', [p(0, 0), p(0, -10), p(10, 0)]);
  assert.equal(wrap.angle, Math.PI / 2);
});
test('polygon vertices close in SVG and measure area and perimeter', () => {
  const g = createGeometry('polygon', [p(0, 0), p(4, 0), p(4, 3), p(0, 0)]);
  assert.equal(g.points.length, 3); assert.equal(svgGeometry(g).tag, 'polygon');
  assert.deepEqual(geometryMeasurements(g), { perimeter: 12, area: 6 });
});
test('reject nonfinite, zero-sized and collinear geometry', () => {
  for (const kind of ['line', 'circle', 'ellipse', 'arc', 'rectangle', 'polygon']) assert.equal(createGeometry(kind, [p(1, 1), p(1, 1), p(1, 1)]), null);
  assert.equal(createGeometry('circle', [p(0, 0), p(Infinity, 2)]), null);
  assert.equal(createGeometry('polygon', [p(0, 0), p(1, 1), p(2, 2)]), null);
});
function fixture(kind) {
  const commits = [], previews = [];
  const controller = createVectorInteraction({ commit: g => commits.push(g), preview: g => previews.push(g) });
  controller.setTool(kind); return { controller, commits, previews };
}
test('drag preview and release commit once, ignoring other pointers', () => {
  const { controller: c, commits, previews } = fixture('circle');
  c.down(p(10, 20), { pointerId: 7 }); c.move(p(13, 24), { pointerId: 7 });
  assert.equal(previews.at(-1).r, 5);
  c.up(p(20, 20), { pointerId: 8 }); assert.equal(commits.length, 0);
  c.up(p(13, 24), { pointerId: 7 }); c.up(p(13, 24), { pointerId: 7 });
  assert.equal(commits.length, 1); assert.equal(c.active, false);
});
test('Escape and tool switches discard previews without commits', () => {
  const { controller: c, commits, previews } = fixture('rectangle');
  c.down(p(0, 0)); c.move(p(10, 20)); assert.equal(c.key('Escape'), true);
  assert.equal(previews.at(-1), null); c.up(p(10, 20));
  c.down(p(0, 0)); c.setTool('ellipse'); c.up(p(10, 20));
  assert.equal(commits.length, 0); assert.equal(c.pointerId, null);
});
test('polygon Enter, Backspace and double-click do not duplicate vertices', () => {
  const { controller: c, commits } = fixture('polygon');
  c.down(p(0, 0)); c.down(p(4, 0)); c.key('Enter'); assert.equal(commits.length, 0);
  c.down(p(9, 9)); c.key('Backspace'); c.down(p(4, 3)); c.key('Enter');
  assert.equal(commits[0].points.length, 3);
  c.down(p(0, 0)); c.down(p(4, 0)); c.down(p(4, 3)); c.down(p(4, 3), { detail: 2 });
  assert.equal(commits.length, 2); assert.equal(commits[1].points.length, 3);
});
test('arc requires center, nonzero radius, then end angle', () => {
  const { controller: c, commits } = fixture('arc');
  c.down(p(0, 0)); c.down(p(0, 0)); assert.equal(c.points.length, 1);
  c.down(p(10, 0)); c.move(p(0, -20)); assert.equal(commits.length, 0);
  c.down(p(0, -20), { shiftKey: true }); assert.equal(commits[0].sweep, 0);
});
test('DOMPoint-style prototype coordinates survive preview and commits', () => {
  class Point { get x() { return 4; } get y() { return 3; } }
  const { controller: c, commits, previews } = fixture('line');
  c.down(p(0,0)); c.move(new Point()); assert.equal(previews.at(-1).points.at(-1).x,4);
  c.down(new Point()); c.key('Enter'); assert.deepEqual(commits[0].points.at(-1),p(4,3));
});
test('freehand preserves the sampled path and measures its open length', () => {
  const { controller: c, commits, previews } = fixture('freehand');
  c.down(p(20,20), {pointerId:7}); c.move(p(23,24), {pointerId:7});
  c.move(p(99,99), {pointerId:8}); c.move(p(23,24), {pointerId:7});
  c.move(p(26,24), {pointerId:7});
  assert.deepEqual(previews.at(-1).points, [p(20,20),p(23,24),p(26,24)]);
  c.up(p(26,28), {pointerId:7});
  assert.equal(commits.length,1); assert.equal(geometryMeasurements(commits[0]).length,12);
  assert.equal(svgGeometry(commits[0]).tag,'polyline');
  assert.equal(svgGeometry(commits[0]).attributes.points,'20,20 23,24 26,24 26,28');
});
test('freehand rejects stationary clicks and discards canceled strokes', () => {
  const { controller: c, commits } = fixture('freehand');
  c.down(p(1,1)); c.up(p(1,1)); assert.equal(commits.length,0);
  c.down(p(1,1)); c.move(p(5,8)); c.key('Escape'); c.up(p(7,9));
  c.down(p(1,1)); c.move(p(5,8)); c.setTool('line'); c.up(p(7,9));
  assert.equal(commits.length,0);
  const loop = createGeometry('freehand',[p(0,0),p(3,4),p(0,0)]);
  assert.equal(geometryMeasurements(loop).length,10);
  assert.equal(createGeometry('freehand',[p(0,0),p(NaN,4)]),null);
});

test('Line stays active after two and five clicks; hover is never committed', () => {
  const { controller: c, commits, previews } = fixture('line');
  for (let i = 0; i < 5; i++) {
    c.down(p(i * 10, 0)); c.up(p(i * 10, 0));
    assert.equal(c.active, true); assert.equal(commits.length, 0);
    c.move(p(i * 10 + 5, 5));
    assert.equal(previews.at(-1).points.length, i + 2);
  }
  c.key('Enter'); assert.equal(commits.length, 1);
  assert.equal(commits[0].points.length, 5);
  assert.equal(geometryMeasurements(commits[0]).length, 40);
  assert.equal(svgGeometry(commits[0]).attributes.d, 'M 0 0 L 10 0 L 20 0 L 30 0 L 40 0');
  assert.equal(c.active, false); assert.equal(previews.at(-1), null);
  c.down(p(0,0)); c.down(p(10,0)); c.key('Escape');
  c.down(p(0,0)); c.down(p(10,0)); c.setTool('circle');
  assert.equal(commits.length, 1); assert.equal(previews.at(-1), null);
});
