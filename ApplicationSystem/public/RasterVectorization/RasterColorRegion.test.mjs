// Nodevision/ApplicationSystem/public/RasterVectorization/RasterColorRegion.test.mjs
// Regression tests for Color Region PNG-to-SVG vectorization coverage, palette reduction, dark detail preservation, and contour simplification.

import assert from "node:assert/strict";
import { vectorizeRaster } from "./RasterVectorizationService.mjs";

function image(width = 36, height = 28, bg = [8, 8, 8, 255]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let p = 0, i = 0; p < width * height; p += 1, i += 4) {
    data[i] = bg[0]; data[i + 1] = bg[1]; data[i + 2] = bg[2]; data[i + 3] = bg[3];
  }
  const set = (x, y, c) => { const i = (y * width + x) * 4; data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = c[3] ?? 255; };
  const rect = (x0, y0, x1, y1, c) => { for (let y = y0; y < y1; y += 1) for (let x = x0; x < x1; x += 1) set(x, y, c); };
  return { width, height, data, set, rect };
}

function rawColorCount(imageData) {
  const colors = new Set();
  for (let i = 0; i < imageData.data.length; i += 4) if (imageData.data[i + 3] > 8) colors.add(imageData.data[i] + "," + imageData.data[i + 1] + "," + imageData.data[i + 2]);
  return colors.size;
}

function fills(result) {
  return new Set(result.paths.map((path) => path.fill));
}

function artisticFixture() {
  const img = image();
  img.rect(5, 5, 24, 23, [196, 94, 45]);
  img.rect(24, 9, 32, 20, [230, 188, 112]);
  img.rect(11, 10, 18, 16, [8, 8, 8]);
  img.rect(8, 8, 10, 21, [20, 14, 11]);
  for (let x = 7; x < 22; x += 1) img.set(x, 18, [24, 16, 12]);
  return img;
}

{
  const result = vectorizeRaster(artisticFixture(), { mode: "color", colorMaxColors: 8, minFeatureSize: 2, backgroundPolicy: "preserve" });
  assert.equal(result.statistics.mode, "color", "Color Region mode is distinct from binary trace modes");
  assert.ok(result.statistics.coverageRatio > 0.96, "opaque color-region trace preserves near-complete coverage");
  assert.ok(result.paths.length >= 4, "large fills and dark internal linework remain separate vector regions");
  assert.ok([...fills(result)].some((fill) => fill !== "#000" && fill !== "#080808"), "large light/color regions receive real fills");
  assert.doesNotMatch(result.svg, /<image\b/i, "color-region output remains vector-only");
}

{
  const noisy = image(24, 16, [255, 255, 255, 255]);
  for (let y = 2; y < 14; y += 1) for (let x = 2; x < 22; x += 1) noisy.set(x, y, [190 + ((x + y) % 9), 92 + (x % 7), 42 + (y % 7)]);
  const result = vectorizeRaster(noisy, { mode: "color", colorMaxColors: 5, regionMinArea: 16, minFeatureSize: 2 });
  assert.ok(rawColorCount(noisy) > 100, "fixture contains many raw noisy RGB values");
  assert.ok(result.statistics.colors <= 5, "palette quantization limits bucket count for noisy source colors");
  assert.ok(fills(result).size <= 5, "final SVG fills stay bounded by the palette");
  assert.ok(result.statistics.mergedRegions > 0, "tiny noisy regions are absorbed into neighboring regions");
}

{
  const speck = image(30, 18, [255, 255, 255, 255]);
  speck.rect(3, 3, 27, 15, [190, 90, 40]);
  for (let x = 5; x < 25; x += 3) speck.set(x, 6, [196, 94, 45]);
  for (let x = 6; x < 25; x += 4) speck.set(x, 10, [20, 10, 8]);
  const result = vectorizeRaster(speck, { mode: "color", colorMaxColors: 5, regionMinArea: 10, minFeatureSize: 1 });
  assert.ok(result.statistics.initialRegions > result.statistics.finalRegions, "region absorption reduces connected region count");
  assert.ok(result.statistics.colors <= 5, "absorbed fixture remains palette bounded");
  assert.ok(result.statistics.coverageRatio > 0.98, "region absorption preserves opaque coverage");
}

{
  const holed = image(30, 24, [12, 12, 12, 255]);
  holed.rect(5, 4, 25, 20, [204, 102, 46]);
  holed.rect(12, 9, 18, 15, [12, 12, 12]);
  const result = vectorizeRaster(holed, { mode: "color", colorMaxColors: 8, minFeatureSize: 2 });
  assert.ok(result.paths.some((path) => path.fillRule === "evenodd"), "color-region contours preserve holes with evenodd paths");
  assert.ok(result.statistics.rectanglePathPercent < 80, "output is not dominated by rectangle paths");
}

{
  const circle = image(48, 48, [255, 255, 255, 255]);
  const cx = 24, cy = 24;
  for (let y = 0; y < 48; y += 1) for (let x = 0; x < 48; x += 1) if ((x - cx) ** 2 + (y - cy) ** 2 <= 17 ** 2) circle.set(x, y, [190, 90, 40]);
  const detailed = vectorizeRaster(circle, { mode: "color", colorMaxColors: 8, simplification: 0, detail: 100, minFeatureSize: 2 });
  const simplified = vectorizeRaster(circle, { mode: "color", colorMaxColors: 8, simplification: 85, detail: 10, minFeatureSize: 2 });
  assert.ok(simplified.statistics.nodes < detailed.statistics.nodes, "Color Region simplification reduces contour node count");
  assert.ok(simplified.statistics.pathCommands < detailed.statistics.pathCommands, "simplified color contour has fewer path commands");
  assert.ok(detailed.statistics.bezierCommands > 0, "smooth circle contour emits Bezier commands before aggressive simplification");
}

console.log("ok - color-region vectorization covers opaque artwork, limits palette noise, and preserves contour holes");
