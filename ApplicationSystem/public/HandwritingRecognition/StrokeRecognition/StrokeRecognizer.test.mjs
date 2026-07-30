// Nodevision/ApplicationSystem/public/HandwritingRecognition/StrokeRecognition/StrokeRecognizer.test.mjs
// DOM-independent tests for the experimental isolated-character stroke recognizer.

import assert from "node:assert/strict";
import fsPromises from "node:fs/promises";
import {
  createStrokeRecognitionRequestTracker,
  isExperimentalStrokeRecognitionEnabled,
  recognizeGlyph,
} from "./StrokeRecognizer.mjs";
import {
  makePersonalStrokeTemplatePayload,
  normalizeStrokeTemplates,
} from "./StrokeTemplateStore.mjs";
import { rerankStrokeCandidatesWithContext } from "./StrokeContextRanker.mjs";

const rawPack = JSON.parse(await fsPromises.readFile(new URL("./BuiltinStrokeTemplates.json", import.meta.url), "utf8"));
const builtinSet = normalizeStrokeTemplates(rawPack.templates);
const templates = builtinSet.templates;
assert.ok(templates.length >= 70, "built-in template pack should cover letters, digits, and punctuation");
assert.deepEqual(builtinSet.errors, []);
assert.deepEqual(builtinSet.duplicateTemplateIds, []);

function templateByCharacter(character, variantIncludes = "") {
  const found = templates.find((template) => template.character === character && (!variantIncludes || template.id.includes(variantIncludes)))
    || templates.find((template) => template.character === character);
  assert.ok(found, `missing template for ${character}`);
  return found;
}

function densify(points, extra = 1) {
  if (extra <= 1 || points.length < 2) return points.map((point) => [...point]);
  const output = [];
  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1];
    const b = points[index];
    if (index === 1) output.push([...a]);
    for (let step = 1; step <= extra; step += 1) {
      const t = step / extra;
      output.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return output;
}

function glyphFromTemplate(template, {
  scaleX = 240,
  scaleY = 240,
  offsetX = 20,
  offsetY = 40,
  pointDensity = 2,
  jitter = 0,
  reverseStrokes = false,
  reverseStrokeOrder = false,
  startTime = 100,
  timeStep = 17,
  pointerType = "pen",
} = {}) {
  let elapsed = 0;
  let sourceStrokes = template.strokes.map((stroke) => densify(stroke, pointDensity));
  if (reverseStrokes) sourceStrokes = sourceStrokes.map((stroke) => [...stroke].reverse());
  if (reverseStrokeOrder) sourceStrokes = [...sourceStrokes].reverse();
  const strokes = sourceStrokes.map((stroke, strokeIndex) => ({
    pointerType,
    points: stroke.map(([x, y], pointIndex) => {
      elapsed += timeStep;
      const wobble = jitter ? (((strokeIndex + 1) * 31 + (pointIndex + 1) * 17) % 9 - 4) * jitter : 0;
      return {
        x: offsetX + x * scaleX + wobble,
        y: offsetY + y * scaleY - wobble * 0.5,
        t: startTime + elapsed,
        pressure: 0.42 + ((pointIndex % 3) * 0.08),
        tiltX: strokeIndex,
        tiltY: pointIndex % 2,
      };
    }),
  }));
  return { strokes, pointerType, canvas: { width: 512, height: 512 } };
}

function recognize(template, options = {}) {
  return recognizeGlyph(glyphFromTemplate(template, options), {
    templates,
    templatesAlreadyNormalized: true,
    candidateLimit: 5,
    minCandidateScore: options.minCandidateScore ?? 0.05,
    contextRankingEnabled: options.contextRankingEnabled ?? false,
    context: options.context || null,
  });
}

function assertTop(template, expected, options = {}) {
  const result = recognize(template, options);
  assert.equal(result.candidates[0]?.character, expected, `${expected} should rank first: ${JSON.stringify(result.candidates.slice(0, 3))}`);
  return result;
}

{
  const a = templateByCharacter("A");
  assertTop(a, "A", { offsetX: 260, offsetY: -120 });
}

{
  const z = templateByCharacter("Z");
  assertTop(z, "Z", { scaleX: 43, scaleY: 71, offsetX: 300, offsetY: 12 });
}

{
  const s = templateByCharacter("S");
  assertTop(s, "S", { pointDensity: 6 });
}

{
  const five = templateByCharacter("5");
  const slow = recognize(five, { timeStep: 80 });
  const fast = recognize(five, { timeStep: 3 });
  assert.equal(slow.candidates[0]?.character, "5");
  assert.equal(fast.candidates[0]?.character, "5");
}

{
  const b = templateByCharacter("B");
  assertTop(b, "B", { jitter: 1.8 });
}

{
  const slash = templateByCharacter("/");
  assertTop(slash, "/", { reverseStrokes: true });
}

{
  const a = templateByCharacter("A");
  assertTop(a, "A", { reverseStrokeOrder: true });
}

{
  const empty = recognizeGlyph({ strokes: [] }, { templates, templatesAlreadyNormalized: true });
  assert.equal(empty.status, "empty");
  assert.deepEqual(empty.candidates, []);
}

{
  const period = templateByCharacter(".");
  const result = recognizeGlyph({ strokes: [{ points: [{ x: 4, y: 4, t: 1, pressure: 0.5, tiltX: 0, tiltY: 0 }] }] }, {
    templates,
    templatesAlreadyNormalized: true,
    candidateLimit: 5,
    minCandidateScore: 0.01,
    contextRankingEnabled: false,
  });
  assert.ok(result.candidates.some((candidate) => candidate.character === "."), `period should be plausible for one-point tap; fixture ${period.id}`);
}

{
  const underscore = templateByCharacter("_");
  assertTop(underscore, "_", { scaleX: 0.4, scaleY: 0.05, offsetX: 10, offsetY: 10, pointDensity: 3 });
}

{
  const tracker = createStrokeRecognitionRequestTracker();
  const first = tracker.begin();
  const second = tracker.begin();
  assert.equal(tracker.isActive(first), false);
  assert.equal(tracker.isActive(second), true);
  tracker.invalidate();
  assert.equal(tracker.isActive(second), false);
}

{
  const c = templateByCharacter("C");
  const first = recognize(c);
  const second = recognize(c);
  assert.deepEqual(first.candidates, second.candidates, "recognition should be deterministic");
  const scores = first.candidates.map((candidate) => candidate.score);
  assert.deepEqual(scores, [...scores].sort((a, b) => b - a), "candidates should be sorted high to low");
}

{
  const qGlyph = glyphFromTemplate(templateByCharacter("Q"));
  const userPayload = makePersonalStrokeTemplatePayload({ character: "R", glyph: qGlyph, rawGlyph: qGlyph });
  const userSet = normalizeStrokeTemplates([userPayload]);
  assert.equal(userSet.errors.length, 0);
  const result = recognizeGlyph(qGlyph, {
    templates,
    userTemplates: userSet.templates,
    templatesAlreadyNormalized: true,
    candidateLimit: 5,
    minCandidateScore: 0.01,
    contextRankingEnabled: false,
  });
  assert.equal(result.candidates[0]?.character, "R", "approved personal templates should participate in ranking");
}

{
  const malformed = normalizeStrokeTemplates([
    { id: "bad", character: "X", strokes: [] },
    { id: "dup", character: "A", strokes: [[[0, 0], [1, 1]]] },
    { id: "dup", character: "B", strokes: [[[0, 1], [1, 0]]] },
  ]);
  assert.equal(malformed.templates.length, 1);
  assert.equal(malformed.duplicateTemplateIds.length, 1);
  assert.ok(malformed.errors.some((entry) => /no strokes|Duplicate/i.test(entry.error)));
}

{
  const badGlyph = { strokes: [{ points: [{ x: 0, y: 0 }, { x: 100, y: 4 }, { x: 1, y: 99 }] }] };
  const result = recognizeGlyph(badGlyph, {
    templates,
    templatesAlreadyNormalized: true,
    candidateLimit: 5,
    minCandidateScore: 0,
    lowConfidenceThreshold: 0.98,
    contextRankingEnabled: false,
  });
  assert.equal(result.status, "low-confidence");
}

{
  const ranked = rerankStrokeCandidatesWithContext([
    { character: "c", score: 0.501, templateId: "c" },
    { character: "e", score: 0.500, templateId: "e" },
    { character: "z", score: 0.18, templateId: "z" },
  ], { before: "th" });
  assert.equal(ranked.candidates[0].character, "e");
  assert.equal(ranked.adjustments.find((entry) => entry.character === "z")?.plausible, false);
}

{
  const input = [
    { character: "c", score: 0.501, templateId: "c" },
    { character: "e", score: 0.500, templateId: "e" },
  ];
  const ranked = rerankStrokeCandidatesWithContext(input, { before: "th" }, { enabled: false });
  assert.deepEqual(ranked.candidates, input);
  assert.equal(ranked.changed, false);
}

{
  assert.equal(isExperimentalStrokeRecognitionEnabled({ handwritingExperimentalStrokeRecognitionEnabled: false }), false);
  const disabled = recognizeGlyph(glyphFromTemplate(templateByCharacter("O")), {
    templates,
    templatesAlreadyNormalized: true,
    featureFlagEnabled: false,
  });
  assert.equal(disabled.status, "disabled");
}

for (const [first, second] of [
  ["O", "0"],
  ["I", "1"],
  ["l", "1"],
  ["S", "5"],
  ["Z", "2"],
  ["B", "8"],
  ["G", "6"],
  ["C", "("],
  ["-", "_"],
]) {
  const firstResult = recognize(templateByCharacter(first), { minCandidateScore: 0.01 });
  const secondResult = recognize(templateByCharacter(second), { minCandidateScore: 0.01 });
  assert.ok(firstResult.candidates.some((candidate) => candidate.character === first), `${first} should remain a plausible candidate`);
  assert.ok(secondResult.candidates.some((candidate) => candidate.character === second), `${second} should remain a plausible candidate`);
}

console.log("Experimental stroke recognizer tests passed");
