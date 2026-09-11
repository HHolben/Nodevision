// Nodevision/ApplicationSystem/public/ImageStitching/ImageStitchingCore.test.mjs

import assert from "node:assert/strict";
import {
  computeMosaicBounds,
  estimateAffineRansac,
  estimatePairRegistration,
  extractFeatures,
  getGridNeighborPairs,
  mapItemsToGrid,
  offsetTransformsToBounds,
  solveTransformsFromEdges,
} from "./ImageStitchingCore.mjs";

function approx(actual, expected, tolerance, message) {
  assert(Math.abs(actual - expected) <= tolerance, `${message}: expected ${expected}, got ${actual}`);
}

const items = Array.from({ length: 6 }, (_, index) => ({ index }));
const grid = mapItemsToGrid(items, 2, 3);
assert.deepEqual(
  getGridNeighborPairs(grid).map((pair) => [pair.from, pair.to, pair.direction]),
  [[0, 1, "right"], [0, 3, "down"], [1, 2, "right"], [1, 4, "down"], [2, 5, "down"], [3, 4, "right"], [4, 5, "right"]],
  "grid adjacency should only include right/down neighboring cells",
);

const matches = [];
for (let y = 0; y < 6; y += 1) {
  for (let x = 0; x < 6; x += 1) {
    matches.push({ a: { x: x * 11 + 40, y: y * 9 + 25 }, b: { x: x * 11 + 10, y: y * 9 + 17 } });
  }
}
matches.push({ a: { x: 300, y: 4 }, b: { x: 1, y: 240 } });
const ransac = estimateAffineRansac(matches, { minimumMatches: 8, threshold: 1.2, seed: 7 });
assert.equal(ransac.ok, true, "RANSAC should recover the dominant affine relation");
approx(ransac.matrix[4], 30, 0.4, "affine x translation");
approx(ransac.matrix[5], 8, 0.4, "affine y translation");

const rejected = estimateAffineRansac(matches.slice(-4), { minimumMatches: 8, threshold: 1.2 });
assert.equal(rejected.ok, false, "RANSAC should reject too few matches");

function makeTexturedSource(width, height) {
  const gray = new Float32Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      gray[y * width + x] = ((x * 37 + y * 61 + x * y * 13) % 251) / 250;
    }
  }
  return { width, height, gray };
}

function cropGray(source, x0, y0, width, height) {
  const gray = new Float32Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      gray[y * width + x] = source.gray[(y0 + y) * source.width + x0 + x];
    }
  }
  return { width, height, gray };
}

const textured = makeTexturedSource(180, 130);
const cropA = cropGray(textured, 0, 0, 132, 100);
const cropB = cropGray(textured, 42, 16, 132, 100);
const autoRegistration = estimatePairRegistration(
  {
    work: cropA,
    workScale: { x: 1, y: 1 },
    features: extractFeatures(cropA, { maxKeypoints: 420, minDistance: 7, patchRadius: 5 }),
  },
  {
    work: cropB,
    workScale: { x: 1, y: 1 },
    features: extractFeatures(cropB, { maxKeypoints: 420, minDistance: 7, patchRadius: 5 }),
  },
  { matching: { ratio: 0.82, maxMatches: 260 }, ransac: { minimumMatches: 8, threshold: 3, seed: 21 } },
);
assert.equal(autoRegistration.ok, true, "automatic landmark registration should recover overlapping textured crops");
approx(autoRegistration.matrix[4], 42, 2.5, "automatic x translation");
approx(autoRegistration.matrix[5], 16, 2.5, "automatic y translation");

const images = [
  { index: 0, width: 100, height: 80 },
  { index: 1, width: 100, height: 80 },
  { index: 2, width: 60, height: 50 },
];
const transforms = solveTransformsFromEdges(images, [
  { from: 0, to: 1, ok: true, confidence: 0.9, matrix: [1, 0, 0, 1, -72, 3] },
  { from: 1, to: 2, ok: true, confidence: 0.8, matrix: [1, 0, 0, 1, -45, -36] },
], { referenceIndex: 0 });
assert.equal(transforms.every((entry) => entry.resolved), true, "all connected images should be resolved");
approx(transforms[1].matrix[4], -72, 0.01, "propagated transform for image 1");
approx(transforms[2].matrix[5], -33, 0.01, "propagated transform for image 2");
const shifted = offsetTransformsToBounds(transforms, computeMosaicBounds(images, transforms));
const bounds = computeMosaicBounds(images, shifted);
assert(bounds.width >= 160, "bounds should include transformed source extents");
assert(bounds.height >= 116, "bounds should include different source heights");

const fullMatches = [];
for (let y = 0; y < 5; y += 1) {
  for (let x = 0; x < 5; x += 1) {
    fullMatches.push({ a: { x: x * 20 + 50, y: y * 18 + 60 }, b: { x: x * 20 + 10, y: y * 18 + 30 } });
  }
}
const scaledRegistration = estimatePairRegistration(
  {
    work: { width: 120, height: 90, gray: new Float32Array(120 * 90) },
    workScale: { x: 0.5, y: 0.5 },
    features: [],
  },
  {
    work: { width: 120, height: 90, gray: new Float32Array(120 * 90) },
    workScale: { x: 0.5, y: 0.5 },
    features: [],
  },
  {
    manualMatches: fullMatches.map((match) => ({ a: { x: match.a.x * 0.5, y: match.a.y * 0.5 }, b: { x: match.b.x * 0.5, y: match.b.y * 0.5 } })),
    ransac: { minimumMatches: 3, threshold: 2, confidenceThreshold: 0.2, seed: 11 },
  },
);
assert.equal(scaledRegistration.ok, true, "scaled-copy registration should recover a full-resolution matrix");
approx(scaledRegistration.matrix[4], 40, 0.5, "full-resolution x translation from scaled matches");
approx(scaledRegistration.matrix[5], 30, 0.5, "full-resolution y translation from scaled matches");

console.log("ImageStitchingCore tests passed");
