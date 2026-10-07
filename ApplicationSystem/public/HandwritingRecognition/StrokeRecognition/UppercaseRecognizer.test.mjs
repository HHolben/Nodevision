// Nodevision/ApplicationSystem/public/HandwritingRecognition/StrokeRecognition/UppercaseRecognizer.test.mjs
// These regressions cover uppercase geometry invariance, independent saved examples, malformed input, and replay of exported manual failures without using expected labels as recognition input.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { createUppercaseRecognizer } from "./UppercaseRecognizer.mjs";
import { normalizeStrokeGlyph } from "./StrokeNormalizer.mjs";

const readJSON = async (path) => JSON.parse(await readFile(path, "utf8"));
const { templates } = await readJSON(new URL("./BuiltinStrokeTemplates.json", import.meta.url));
const recognize = createUppercaseRecognizer(templates);
const { fixtures } = await readJSON(new URL("./fixtures/uppercase-examples.json", import.meta.url));
const uppercase = templates.filter((item) => /^[A-Z]$/.test(item.character));

function transform(strokes, { x = 0, y = 0, sx = 1, sy = sx, angle = 0, skew = 0, density = 3 } = {}) {
  return strokes.map((stroke) => {
    const points = stroke.points || stroke;
    const dense = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[Math.max(0, i - 1)], b = points[i];
      const ax = a.x ?? a[0], ay = a.y ?? a[1], bx = b.x ?? b[0], by = b.y ?? b[1];
      for (let j = 1; j <= (i ? density : 1); j++) {
        const t = i ? j / density : 1;
        const px = (ax + (bx - ax) * t) * sx, py = (ay + (by - ay) * t) * sy;
        dense.push({ x: x + px * Math.cos(angle) - py * Math.sin(angle) + py * skew,
          y: y + px * Math.sin(angle) + py * Math.cos(angle), t: dense.length ** 2 });
      }
    }
    return { points: dense };
  });
}

test("normalization keeps stroke boundaries, bounds and translation/scale invariance", () => {
  const strokes = fixtures[0].strokes;
  const a = normalizeStrokeGlyph({ strokes }, { minRawPointDistance: 0 });
  const b = normalizeStrokeGlyph({ strokes: transform(strokes, { sx: 3, x: -820, y: 790 }) }, { minRawPointDistance: 0 });
  assert.equal(a.strokes.length, 2);
  for (let i = 0; i < a.strokes.length; i++) {
    assert.equal(a.strokes[i].points.length, b.strokes[i].points.length);
    a.strokes[i].points.forEach((p, j) => {
      assert.ok(p.x >= 0.08 && p.x <= 0.92 && p.y >= 0.08 && p.y <= 0.92);
      assert.ok(Math.hypot(p.x - b.strokes[i].points[j].x, p.y - b.strokes[i].points[j].y) < 1e-10);
    });
  }
});

test("all A–Z templates survive position, scale, speed, aspect, rotation and skew changes", () => {
  for (const template of uppercase) {
    for (const change of [{}, { x: -100, y: 870, sx: 280 }, { sx: 190, sy: 240 }, { sx: 220, angle: 0.08, skew: 0.04 }]) {
      const result = recognize(transform(template.strokes, change));
      assert.equal(result.letter, template.character, `${template.character}: ${JSON.stringify(change)}`);
      assert.ok(result.candidates.every((c) => /^[A-Z]$/.test(c.letter)));
      assert.ok(result.confidence >= 0 && result.confidence <= 1);
    }
  }
});

test("independent fixture drawings and reversed stroke order/direction", () => {
  for (const fixture of fixtures) {
    assert.equal(recognize(fixture.strokes).letter, fixture.expectedLetter);
    const reversed = fixture.strokes.slice().reverse().map((stroke) => stroke.slice().reverse());
    assert.equal(recognize(reversed).letter, fixture.expectedLetter, `reversed ${fixture.expectedLetter}`);
  }
});

test("empty, malformed and zero-length drawings do not invent letters", () => {
  for (const input of [null, undefined, {}, [], [null], [[null, {}]], [[{ x: NaN, y: 3 }]], [[[8, 8], [8, 8]]]]) {
    const result = recognize(input);
    assert.equal(result.letter, null);
    assert.deepEqual(result.candidates, []);
  }
  assert.throws(() => createUppercaseRecognizer([]), /26 letters/);
});

// Optional replay: NV_UPPERCASE_FIXTURE=/path/to/download.json node --test <this file>
if (process.env.NV_UPPERCASE_FIXTURE) {
  test("exported manual fixture", async () => {
    const fixture = await readJSON(process.env.NV_UPPERCASE_FIXTURE);
    assert.equal(fixture.schema, "nodevision-uppercase-fixture/1");
    assert.match(fixture.expectedLetter, /^[A-Z]$/);
    assert.equal(recognize(fixture.strokes).letter, fixture.expectedLetter);
  });
}
