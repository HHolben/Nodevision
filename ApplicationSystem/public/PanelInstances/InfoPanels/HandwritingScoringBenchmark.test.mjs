// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/HandwritingScoringBenchmark.test.mjs
// Synthetic and optional font-generated benchmark for handwriting OCR scoring weights.

import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
import {
  DEFAULT_HANDWRITING_SCORING_CONFIG,
  combineHandwritingCandidateEvidence,
  stableSortHandwritingCandidates,
} from "./HandwritingCandidateScoring.mjs";
import { rerankCandidatesWithContext } from "./HandwritingRecognitionContext.mjs";
import {
  recordDirectionalConfusion,
  rerankCandidatesWithConfusions,
  validateConfusions,
} from "./HandwritingConfusions.mjs";

const GRID = 28;
const FONT_BENCHMARK_CHARS = "ABCEHILNOSUVZabceilnosuvz0125";

function finiteNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function clamp(value, min, max) {
  const numeric = finiteNumber(value, min);
  return Math.max(min, Math.min(max, numeric));
}

function metadataRatioScore(inputValue, templateValue) {
  const a = Number(inputValue);
  const b = Number(templateValue);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) return 1;
  return clamp(1 - Math.abs(Math.log(a / b)) / Math.log(4), 0, 1);
}

function meanNearestDistance(fromPoints, toPoints) {
  if (!fromPoints.length || !toPoints.length) return Infinity;
  let total = 0;
  for (const point of fromPoints) {
    let best = Infinity;
    for (const target of toPoints) {
      const dx = point.x - target.x;
      const dy = point.y - target.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < best) best = dist;
    }
    total += best;
  }
  return total / fromPoints.length;
}

function scoreSamplesDetailed(inputSample, templateSample) {
  const gridScale = GRID - 1;
  const inputToTemplate = meanNearestDistance(inputSample.points, templateSample.points) / gridScale;
  const templateToInput = meanNearestDistance(templateSample.points, inputSample.points) / gridScale;
  const inkDensityScore = Math.min(inputSample.points.length, templateSample.points.length)
    / Math.max(inputSample.points.length, templateSample.points.length);
  const weightedDistance = inputToTemplate * 0.62 + templateToInput * 0.38;
  const shapeScore = Math.max(0, 1 - weightedDistance / 0.22);
  return {
    rasterScore: clamp(shapeScore * (0.74 + inkDensityScore * 0.26), 0, 1),
    inkDensityScore: clamp(inkDensityScore, 0, 1),
  };
}

function scoreBenchmarkCandidates(candidates, { context = null, confusions = null, scoringConfig = {} } = {}) {
  let scored = candidates.map((candidate) => {
    const combined = combineHandwritingCandidateEvidence({
      mode: candidate.mode,
      ...(candidate.evidence || {}),
    }, scoringConfig);
    return {
      ...candidate,
      char: candidate.char || candidate.text,
      score: combined.score,
      relativeConfidence: combined.relativeConfidence,
      evidence: {
        ...(candidate.evidence || {}),
        ...combined.evidence,
      },
    };
  });
  scored = stableSortHandwritingCandidates(scored);
  if (context) scored = rerankCandidatesWithContext(scored, context);
  if (confusions) scored = rerankCandidatesWithConfusions(scored, confusions);
  return stableSortHandwritingCandidates(scored);
}

function runBenchmarkCases(cases, scoringConfig = {}) {
  const results = cases.map((testCase) => {
    const ranked = scoreBenchmarkCandidates(testCase.candidates, {
      context: testCase.context || null,
      confusions: testCase.confusions || null,
      scoringConfig,
    });
    const best = ranked[0] || null;
    const runnerUp = ranked.find((candidate) => candidate.text !== best?.text) || null;
    return {
      name: testCase.name,
      source: testCase.source || "synthetic",
      expected: testCase.expected,
      actual: best?.text || "",
      score: best?.score || 0,
      margin: (best?.score || 0) - (runnerUp?.score || 0),
      passed: best?.text === testCase.expected,
      ranked,
    };
  });
  const failures = results.filter((result) => !result.passed);
  const margins = results.map((result) => result.margin);
  return {
    results,
    failures,
    accuracy: results.length ? (results.length - failures.length) / results.length : 1,
    minMargin: margins.length ? Math.min(...margins) : 0,
    averageMargin: margins.length ? margins.reduce((total, value) => total + value, 0) / margins.length : 0,
  };
}

function confusionStatsFor(recognized, intended, count) {
  let stats = validateConfusions(null);
  for (let index = 0; index < count; index += 1) {
    stats = recordDirectionalConfusion(stats, recognized, intended, {
      now: `2026-01-01T00:00:${String(index).padStart(2, "0")}Z`,
    }).confusions;
  }
  return stats;
}

function syntheticCases() {
  return [
    {
      name: "raster-only generated template remains usable",
      expected: "H",
      candidates: [
        { text: "H", mode: "sans-fill", evidence: { rasterScore: 0.84, trajectoryScore: null, inkDensityScore: 0.82, strokeCountScore: 0.96, aspectRatioScore: 0.92 } },
        { text: "N", mode: "sans-fill", evidence: { rasterScore: 0.76, trajectoryScore: null, inkDensityScore: 0.8, strokeCountScore: 0.92, aspectRatioScore: 0.88 } },
        { text: "A", mode: "sans-fill", evidence: { rasterScore: 0.67, trajectoryScore: null, inkDensityScore: 0.75, strokeCountScore: 0.86, aspectRatioScore: 0.78 } },
      ],
    },
    {
      name: "trajectory-aware personal sample wins ambiguous raster match",
      expected: "0",
      candidates: [
        { text: "O", mode: "sans-fill", evidence: { rasterScore: 0.79, trajectoryScore: 0.62, inkDensityScore: 0.87, strokeCountScore: 0.96, aspectRatioScore: 0.98 } },
        { text: "0", mode: "user-correction", evidence: { rasterScore: 0.72, trajectoryScore: 0.95, inkDensityScore: 0.82, strokeCountScore: 1, aspectRatioScore: 0.95, personalSampleBonus: 0.08 } },
      ],
    },
    {
      name: "personal sample bonus cannot rescue poor shape evidence",
      expected: "S",
      candidates: [
        { text: "S", mode: "sans-fill", evidence: { rasterScore: 0.77, trajectoryScore: null, inkDensityScore: 0.82, strokeCountScore: 0.94, aspectRatioScore: 0.9 } },
        { text: "5", mode: "user-correction", evidence: { rasterScore: 0.08, trajectoryScore: 0.18, inkDensityScore: 0.46, strokeCountScore: 0.8, aspectRatioScore: 0.72, personalSampleBonus: 0.08 } },
      ],
    },
    {
      name: "henryscript generated fixture gets bounded template boost",
      source: "henryscript-generated",
      expected: "A",
      candidates: [
        { text: "A", mode: "henryscript-fill", evidence: { rasterScore: 0.8, trajectoryScore: null, inkDensityScore: 0.82, strokeCountScore: 0.95, aspectRatioScore: 0.95 } },
        { text: "a", mode: "sans-fill", evidence: { rasterScore: 0.795, trajectoryScore: null, inkDensityScore: 0.82, strokeCountScore: 0.95, aspectRatioScore: 0.95 } },
      ],
    },
    {
      name: "web-safe script fixture wins close sans candidate",
      source: "web-safe-generated",
      expected: "g",
      candidates: [
        { text: "g", mode: "script-fill", evidence: { rasterScore: 0.812, trajectoryScore: null, inkDensityScore: 0.78, strokeCountScore: 0.92, aspectRatioScore: 0.88 } },
        { text: "q", mode: "sans-fill", evidence: { rasterScore: 0.807, trajectoryScore: null, inkDensityScore: 0.78, strokeCountScore: 0.9, aspectRatioScore: 0.88 } },
      ],
    },
    {
      name: "numeric context prefers digit",
      expected: "0",
      context: { before: "2026" },
      candidates: [
        { text: "O", mode: "sans-fill", evidence: { rasterScore: 0.72, trajectoryScore: null, inkDensityScore: 0.78, strokeCountScore: 0.95, aspectRatioScore: 0.96 } },
        { text: "0", mode: "sans-fill", evidence: { rasterScore: 0.70, trajectoryScore: null, inkDensityScore: 0.76, strokeCountScore: 0.95, aspectRatioScore: 0.96 } },
      ],
    },
    {
      name: "inside word context prefers lowercase",
      expected: "e",
      context: { before: "sentenc" },
      candidates: [
        { text: "E", mode: "sans-fill", evidence: { rasterScore: 0.73, trajectoryScore: null, inkDensityScore: 0.8, strokeCountScore: 0.9, aspectRatioScore: 0.88 } },
        { text: "e", mode: "sans-fill", evidence: { rasterScore: 0.71, trajectoryScore: null, inkDensityScore: 0.8, strokeCountScore: 0.9, aspectRatioScore: 0.88 } },
      ],
    },
    {
      name: "directional confusion learning reranks close pair",
      expected: "0",
      confusions: confusionStatsFor("O", "0", 5),
      candidates: [
        { text: "O", mode: "sans-fill", evidence: { rasterScore: 0.71, trajectoryScore: null, inkDensityScore: 0.8, strokeCountScore: 0.95, aspectRatioScore: 0.96 } },
        { text: "0", mode: "sans-fill", evidence: { rasterScore: 0.70, trajectoryScore: null, inkDensityScore: 0.8, strokeCountScore: 0.95, aspectRatioScore: 0.96 } },
      ],
    },
    {
      name: "stroke and aspect evidence penalize wrong narrow glyph",
      expected: "H",
      candidates: [
        { text: "H", mode: "sans-fill", evidence: { rasterScore: 0.72, trajectoryScore: 0.84, inkDensityScore: 0.76, strokeCountScore: 1, aspectRatioScore: 0.92 } },
        { text: "I", mode: "sans-fill", evidence: { rasterScore: 0.73, trajectoryScore: 0.72, inkDensityScore: 0.6, strokeCountScore: 0.68, aspectRatioScore: 0.36 } },
      ],
    },
  ];
}

function addPoint(contour, x, y) {
  const previous = contour[contour.length - 1];
  if (!previous || Math.abs(previous.x - x) > 1e-9 || Math.abs(previous.y - y) > 1e-9) {
    contour.push({ x, y });
  }
}

function flattenGlyphPath(commands) {
  const contours = [];
  let contour = [];
  let current = { x: 0, y: 0 };
  let start = null;

  const closeContour = () => {
    if (contour.length >= 2) contours.push(contour);
    contour = [];
    start = null;
  };

  for (const command of commands || []) {
    const args = command.args || [];
    if (command.command === "moveTo") {
      closeContour();
      current = { x: args[0], y: args[1] };
      start = current;
      addPoint(contour, current.x, current.y);
    } else if (command.command === "lineTo") {
      current = { x: args[0], y: args[1] };
      addPoint(contour, current.x, current.y);
    } else if (command.command === "quadraticCurveTo") {
      const p0 = current;
      const c = { x: args[0], y: args[1] };
      const p1 = { x: args[2], y: args[3] };
      for (let step = 1; step <= 12; step += 1) {
        const t = step / 12;
        const mt = 1 - t;
        addPoint(contour, mt * mt * p0.x + 2 * mt * t * c.x + t * t * p1.x, mt * mt * p0.y + 2 * mt * t * c.y + t * t * p1.y);
      }
      current = p1;
    } else if (command.command === "bezierCurveTo") {
      const p0 = current;
      const c1 = { x: args[0], y: args[1] };
      const c2 = { x: args[2], y: args[3] };
      const p1 = { x: args[4], y: args[5] };
      for (let step = 1; step <= 16; step += 1) {
        const t = step / 16;
        const mt = 1 - t;
        addPoint(contour,
          mt ** 3 * p0.x + 3 * mt * mt * t * c1.x + 3 * mt * t * t * c2.x + t ** 3 * p1.x,
          mt ** 3 * p0.y + 3 * mt * mt * t * c1.y + 3 * mt * t * t * c2.y + t ** 3 * p1.y);
      }
      current = p1;
    } else if (command.command === "closePath") {
      if (start) addPoint(contour, start.x, start.y);
      closeContour();
    }
  }
  closeContour();
  return contours;
}

function pointInContour(point, contour) {
  let inside = false;
  for (let i = 0, j = contour.length - 1; i < contour.length; j = i, i += 1) {
    const a = contour[i];
    const b = contour[j];
    const intersects = ((a.y > point.y) !== (b.y > point.y))
      && point.x < ((b.x - a.x) * (point.y - a.y)) / Math.max(1e-9, b.y - a.y) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInGlyph(point, contours) {
  let inside = false;
  for (const contour of contours) {
    if (pointInContour(point, contour)) inside = !inside;
  }
  return inside;
}

function rasterizeGlyph(font, char) {
  const glyph = font.glyphForCodePoint(char.codePointAt(0));
  if (!glyph?.path?.commands?.length) return null;
  const bounds = glyph.bbox;
  const width = Math.max(1, bounds.maxX - bounds.minX);
  const height = Math.max(1, bounds.maxY - bounds.minY);
  const contours = flattenGlyphPath(glyph.path.commands);
  const points = [];

  for (let y = 0; y < GRID; y += 1) {
    for (let x = 0; x < GRID; x += 1) {
      const px = bounds.minX + ((x + 0.5) / GRID) * width;
      const py = bounds.maxY - ((y + 0.5) / GRID) * height;
      if (pointInGlyph({ x: px, y: py }, contours)) points.push({ x, y });
    }
  }
  return points.length ? {
    grid: GRID,
    points,
    bounds: { minX: bounds.minX, minY: bounds.minY, maxX: bounds.maxX, maxY: bounds.maxY, width, height },
    aspectRatio: width / Math.max(height, 1),
  } : null;
}

function jitterSample(sample) {
  const seen = new Set();
  const points = sample.points.map((point, index) => {
    const dx = index % 5 === 0 ? 1 : (index % 7 === 0 ? -1 : 0);
    const dy = index % 6 === 0 ? 1 : (index % 11 === 0 ? -1 : 0);
    return {
      x: clamp(point.x + dx, 0, GRID - 1),
      y: clamp(point.y + dy, 0, GRID - 1),
    };
  }).filter((point) => {
    const key = `${point.x},${point.y}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { grid: GRID, points, bounds: sample.bounds || null, aspectRatio: sample.aspectRatio || 1 };
}

function loadOptionalFontkit() {
  const requireTarget = process.env.NODEVISION_FONTKIT_REQUIRE || "";
  if (!requireTarget) return null;
  try {
    return createRequire(requireTarget)("fontkit");
  } catch (err) {
    console.warn(`Skipping font benchmark fixtures: ${err?.message || err}`);
    return null;
  }
}

function loadFontCases() {
  const fontkit = loadOptionalFontkit();
  if (!fontkit) return [];
  const fontDefs = [
    { label: "henryscript", mode: "henryscript-fill", file: process.env.NODEVISION_HENRYSCRIPT_FONT || "" },
    { label: "web-safe", mode: "sans-fill", file: process.env.NODEVISION_WEBSAFE_FONT || "" },
  ].filter((fontDef) => fontDef.file);
  if (!fontDefs.length) return [];

  const fonts = fontDefs.map((fontDef) => ({
    ...fontDef,
    displayFile: path.basename(fontDef.file),
    font: fontkit.openSync(fontDef.file),
  }));
  const templates = [];
  for (const fontDef of fonts) {
    for (const char of FONT_BENCHMARK_CHARS) {
      const sample = rasterizeGlyph(fontDef.font, char);
      if (sample?.points?.length) templates.push({ char, text: char, mode: fontDef.mode, sample, fontLabel: fontDef.label });
    }
  }

  const cases = [];
  for (const fontDef of fonts) {
    for (const char of FONT_BENCHMARK_CHARS) {
      const rawSample = rasterizeGlyph(fontDef.font, char);
      if (!rawSample?.points?.length) continue;
      const inputSample = jitterSample(rawSample);
      const byChar = new Map();
      for (const template of templates) {
        const raster = scoreSamplesDetailed(inputSample, template.sample);
        const candidate = {
          text: template.char,
          mode: template.mode,
          evidence: {
            rasterScore: raster.rasterScore,
            trajectoryScore: null,
            inkDensityScore: raster.inkDensityScore,
            strokeCountScore: 1,
            aspectRatioScore: metadataRatioScore(inputSample.aspectRatio, template.sample.aspectRatio),
          },
        };
        const previous = byChar.get(template.char);
        const scored = scoreBenchmarkCandidates([candidate])[0];
        if (!previous || scored.score > previous.score) byChar.set(template.char, candidate);
      }
      cases.push({
        name: `${fontDef.label} generated ${char} from ${fontDef.displayFile}`,
        source: `${fontDef.label}-font-generated`,
        expected: char,
        candidates: Array.from(byChar.values()),
      });
    }
  }
  return cases;
}

function evaluateConfig(name, scoringConfig, cases) {
  const result = runBenchmarkCases(cases, scoringConfig);
  console.log(`${name}: accuracy ${(result.accuracy * 100).toFixed(1)}%, min margin ${result.minMargin.toFixed(3)}, average margin ${result.averageMargin.toFixed(3)}, cases ${result.results.length}`);
  if (result.failures.length) {
    for (const failure of result.failures.slice(0, 8)) {
      console.log("  FAIL " + failure.name + ": expected " + failure.expected + ", got " + failure.actual);
      if (process.env.NODEVISION_BENCHMARK_VERBOSE === "1") {
        const top = failure.ranked.slice(0, 5).map((candidate) => {
          const evidence = candidate.evidence || {};
          return String(candidate.text) + ":" + Number(candidate.score || 0).toFixed(3)
            + " r=" + Number(evidence.rasterScore || 0).toFixed(3)
            + " d=" + Number(evidence.inkDensityScore || 0).toFixed(3)
            + " m=" + String(candidate.mode || "");
        }).join(" | ");
        console.log("    top " + top);
        const expected = failure.ranked.find((candidate) => candidate.text === failure.expected);
        if (expected) {
          const evidence = expected.evidence || {};
          console.log("    expected " + expected.text + ":" + Number(expected.score || 0).toFixed(3) + " r=" + Number(evidence.rasterScore || 0).toFixed(3) + " d=" + Number(evidence.inkDensityScore || 0).toFixed(3) + " m=" + String(expected.mode || ""));
        }
      }
    }
  }
  return result;
}

function tuneRasterOnlyWeights(cases, limit = 5) {
  const configs = [];
  for (let raster = 0.72; raster <= 0.94 + 1e-9; raster += 0.02) {
    for (let inkDensity = 0.02; inkDensity <= 0.16 + 1e-9; inkDensity += 0.02) {
      for (let strokeCount = 0.02; strokeCount <= 0.08 + 1e-9; strokeCount += 0.02) {
        const aspectRatio = 1 - raster - inkDensity - strokeCount;
        if (aspectRatio < 0.02 - 1e-9 || aspectRatio > 0.2 + 1e-9) continue;
        const weights = {
          raster: Number(raster.toFixed(2)),
          inkDensity: Number(inkDensity.toFixed(2)),
          strokeCount: Number(strokeCount.toFixed(2)),
          aspectRatio: Number(aspectRatio.toFixed(2)),
        };
        const result = runBenchmarkCases(cases, { rasterOnlyWeights: weights });
        configs.push({ weights, result });
      }
    }
  }
  return configs.sort((a, b) => (
    b.result.accuracy - a.result.accuracy
      || b.result.averageMargin - a.result.averageMargin
      || b.result.minMargin - a.result.minMargin
      || b.weights.raster - a.weights.raster
  )).slice(0, limit);
}

const synthetic = syntheticCases();
const fontCases = loadFontCases();
const allCases = [...synthetic, ...fontCases];
if (process.env.NODEVISION_BENCHMARK_TUNE === "1") {
  console.log("raster-only weight search:");
  for (const entry of tuneRasterOnlyWeights(allCases, 8)) {
    console.log("  " + JSON.stringify(entry.weights)
      + " accuracy " + (entry.result.accuracy * 100).toFixed(1) + "%"
      + " min " + entry.result.minMargin.toFixed(3)
      + " avg " + entry.result.averageMargin.toFixed(3));
  }
}


const baselineConfig = {
  rasterOnlyWeights: { raster: 0.84, inkDensity: 0.08, strokeCount: 0.04, aspectRatio: 0.04 },
  trajectoryWeights: { raster: 0.58, trajectory: 0.24, inkDensity: 0.06, strokeCount: 0.06, aspectRatio: 0.06 },
};

const baseline = evaluateConfig("baseline-raster-heavy", baselineConfig, allCases);
const tuned = evaluateConfig("current-tuned", DEFAULT_HANDWRITING_SCORING_CONFIG, allCases);

const syntheticResult = runBenchmarkCases(synthetic, DEFAULT_HANDWRITING_SCORING_CONFIG);
assert.equal(syntheticResult.failures.length, 0, "synthetic benchmark cases should remain strict passes");

if (fontCases.length) {
  const fontResult = runBenchmarkCases(fontCases, DEFAULT_HANDWRITING_SCORING_CONFIG);
  assert.ok(tuned.accuracy >= baseline.accuracy, "current tuned weights should improve or match baseline accuracy with font fixtures");
  assert.ok(tuned.averageMargin >= baseline.averageMargin, "current tuned weights should improve or match baseline average margin with font fixtures");
  assert.ok(fontResult.accuracy >= 0.6, "font-generated fixtures should remain above the tuned top-1 accuracy floor");
  assert.ok(fontResult.minMargin >= 0, "font-generated fixture ranking margins should stay non-negative");
  console.log("Font fixtures enabled: " + fontCases.length + " cases");
} else {
  assert.equal(tuned.failures.length, 0, "current tuned weights should pass every benchmark case");
  assert.ok(tuned.minMargin > 0.005, "current tuned weights should leave a non-trivial minimum margin");
  console.log("Font fixtures skipped: set NODEVISION_FONTKIT_REQUIRE, NODEVISION_HENRYSCRIPT_FONT, and NODEVISION_WEBSAFE_FONT to enable them.");
}

console.log("Handwriting scoring benchmark passed");
