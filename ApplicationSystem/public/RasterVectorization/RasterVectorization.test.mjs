// Nodevision/ApplicationSystem/public/RasterVectorization/RasterVectorization.test.mjs
// This test verifies the deterministic raster vectorization service and PNG viewer integration using synthetic ImageData fixtures instead of real Notebook files or user documents.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { vectorizeRaster, scheduleVectorizationPreview } from "./RasterVectorizationService.mjs";
import { averageSourceColorForRegion } from "./RasterColorAnalysis.mjs";
import { derivedSvgPath, normalizeNotebookPath, openSvgInGraphicalEditor, reserveDerivedSvgPath } from "./RasterVectorizationWorkflow.mjs";

function fixture(width = 24, height = 18) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) { data[i] = 255; data[i + 1] = 255; data[i + 2] = 255; data[i + 3] = 255; }
  const black = (x, y, gray = 0) => { const i = (y * width + x) * 4; data[i] = gray; data[i + 1] = gray; data[i + 2] = gray; data[i + 3] = 255; };
  for (let y = 4; y < 10; y += 1) for (let x = 3; x < 10; x += 1) black(x, y);
  for (let i = 0; i < 8; i += 1) black(13 + i, 4 + i);
  black(20, 2); black(21, 2);
  return { width, height, data };
}


function colorFixture(colors, width = colors.length, height = 1) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) { data[i] = 255; data[i + 1] = 255; data[i + 2] = 255; data[i + 3] = 255; }
  colors.forEach((color, p) => {
    const i = p * 4;
    data[i] = color[0]; data[i + 1] = color[1]; data[i + 2] = color[2]; data[i + 3] = color[3] ?? 255;
  });
  return { width, height, data };
}

function firstFill(svg) {
  return svg.match(/<path[^>]+fill="([^"]+)"/)?.[1] || "";
}

function circleFixture(width = 48, height = 48, radius = 15) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) { data[i] = 255; data[i + 1] = 255; data[i + 2] = 255; data[i + 3] = 255; }
  const cx = width / 2, cy = height / 2;
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    if ((x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2) {
      const i = (y * width + x) * 4;
      data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 255;
    }
  }
  return { width, height, data };
}

function grayBands() {
  const image = fixture(10, 5);
  for (let y = 0; y < 5; y += 1) for (let x = 0; x < 10; x += 1) {
    const gray = [255, 190, 128, 60, 0][y];
    const i = (y * 10 + x) * 4;
    image.data[i] = gray; image.data[i + 1] = gray; image.data[i + 2] = gray; image.data[i + 3] = 255;
  }
  return image;
}

{
  const result = vectorizeRaster(fixture(), { threshold: 150, minFeatureSize: 3, cleanup: 0, title: "fixture.png" });
  assert.match(result.svg, /<svg[^>]+viewBox="0 0 24 18"/, "viewBox preserves source dimensions");
  assert.match(result.svg, /<path d="M/, "output contains genuine SVG paths");
  assert.doesNotMatch(result.svg, /<image\b/i, "output does not embed the PNG");
  assert.ok(result.paths.length > 0, "black features produce paths");
}

{
  const low = vectorizeRaster(grayBands(), { mode: "line", threshold: 70, cleanup: 0 });
  const high = vectorizeRaster(grayBands(), { mode: "line", threshold: 210, cleanup: 0 });
  assert.notEqual(low.svg, high.svg, "threshold changes SVG geometry");
  const inverted = vectorizeRaster(grayBands(), { mode: "line", threshold: 70, invert: true, cleanup: 0 });
  assert.notEqual(low.svg, inverted.svg, "invert changes SVG geometry");
}

{
  const noisy = vectorizeRaster(fixture(), { threshold: 150, cleanup: 0, minFeatureSize: 1 });
  const cleaned = vectorizeRaster(fixture(), { threshold: 150, cleanup: 0, minFeatureSize: 5 });
  assert.ok(cleaned.statistics.components < noisy.statistics.components, "minimum feature size removes isolated dots");
  assert.ok(cleaned.paths.length > 0, "cleanup preserves representative major feature");
}

{
  const detailed = vectorizeRaster(circleFixture(), { simplification: 0, detail: 100, cleanup: 0 });
  const simplified = vectorizeRaster(circleFixture(), { simplification: 100, detail: 0, cleanup: 0 });
  assert.ok(simplified.statistics.nodes < detailed.statistics.nodes, "simplification reduces contour node count");
  assert.ok(simplified.paths.length > 0, "simplification keeps major geometry");
}

{
  const woodcut = vectorizeRaster(grayBands(), { mode: "woodcut" });
  assert.equal(woodcut.statistics.mode, "woodcut", "woodcut mode reports deterministic mode");
  assert.match(woodcut.svg, /<path /, "woodcut mode creates vector paths");
}


{
  const red = colorFixture([[255, 0, 0], [255, 0, 0], [255, 255, 255]], 3, 1);
  const mono = vectorizeRaster(red, { threshold: 150, cleanup: 0, minFeatureSize: 1, colorizeFromSource: false });
  const colorized = vectorizeRaster(red, { threshold: 200, contrast: 0, cleanup: 0, minFeatureSize: 1, colorizeFromSource: true });
  assert.equal(firstFill(mono.svg), "#000", "monochrome output stays black when source colorization is disabled");
  assert.equal(firstFill(colorized.svg), "#ff0000", "solid source region receives source-derived fill");
  assert.equal(colorized.statistics.colorized, true, "statistics report colorized output");
  assert.doesNotMatch(colorized.svg, /<image\b/i, "colorized SVG does not embed the PNG");
}

{
  const mixed = colorFixture([[255, 0, 0], [0, 255, 0]], 2, 1);
  const result = vectorizeRaster(mixed, { threshold: 200, contrast: 0, cleanup: 0, minFeatureSize: 1, colorizeFromSource: true });
  assert.equal(firstFill(result.svg), "#bcbc00", "mixed region uses linear-light RGB average");
}

{
  const image = colorFixture([[255, 0, 0], [0, 0, 255], [255, 0, 0]], 3, 1);
  const mask = new Uint8Array([1, 0, 1]);
  const color = averageSourceColorForRegion(image, mask, { x: 0, y: 0, w: 3, h: 1 });
  assert.equal(color.fill, "#ff0000", "pixels outside represented mask do not contaminate a region color");
}

{
  const alpha = colorFixture([[255, 0, 0, 255], [0, 0, 0, 0]], 2, 1);
  const color = averageSourceColorForRegion(alpha, new Uint8Array([1, 1]), { x: 0, y: 0, w: 2, h: 1 });
  assert.equal(color.fill, "#ff0000", "transparent pixels are not averaged as opaque black");
  assert.equal(color.fillOpacity, 0.5, "alpha-weighted color analysis preserves representative opacity");
}

{
  const colorImage = colorFixture(Array(12).fill([255, 0, 0]).concat(Array(12).fill([255, 255, 255])), 24, 1);
  const detailed = vectorizeRaster(colorImage, { threshold: 150, cleanup: 0, minFeatureSize: 1, simplification: 0, colorizeFromSource: true });
  const simplified = vectorizeRaster(colorImage, { threshold: 150, cleanup: 0, minFeatureSize: 1, simplification: 55, colorizeFromSource: true });
  assert.match(detailed.svg, /fill="#ff0000"/, "detailed path keeps source red");
  assert.match(simplified.svg, /fill="#ff0000"/, "simplified path keeps logical source color");
}

{
  const woodcutImage = colorFixture(Array(16).fill([255, 0, 0]).concat(Array(16).fill([255, 255, 255])), 8, 4);
  const woodcut = vectorizeRaster(woodcutImage, { mode: "woodcut", colorizeFromSource: true, minFeatureSize: 1 });
  assert.equal(woodcut.statistics.mode, "woodcut", "woodcut mode remains active with colorization");
  assert.match(woodcut.svg, /fill="#[0-9a-f]{6}"/, "woodcut colorization emits ordinary vector fill colors");
  assert.doesNotMatch(woodcut.svg, /<image\b/i, "woodcut colorized output remains vector-only");
}

{
  const source = await readFile(new URL("../PanelInstances/ViewPanels/FileViewers/ViewPNG.mjs", import.meta.url), "utf8");
  assert.match(source, /Vectorize/, "PNG viewer exposes vectorize action");
  assert.match(source, /openPngVectorizationOverlay/, "PNG viewer invokes shared vectorization launcher");
  assert.doesNotMatch(source, /PNGeditor/, "PNG editor is not required for vectorization");
  assert.doesNotMatch(source, /saveViaApi|\/api\/save/, "PNG viewer does not save over the source PNG");
  const launcher = await readFile(new URL("./RasterVectorizationLauncher.mjs", import.meta.url), "utf8");
  assert.match(launcher, /openNodevisionOverlayPanel\("RasterVectorizationOverlay"/, "shared launcher opens the vectorization overlay");
}

{
  const toolbar = JSON.parse(await readFile(new URL("../ToolbarJSONfiles/fileToolbar.json", import.meta.url), "utf8"));
  const item = toolbar.find((entry) => entry.callbackKey === "ConvertToSVG");
  assert.equal(item?.parentHeading, "Export", "Convert to SVG lives under File > Export");
  assert.equal(item?.heading, "Convert to SVG");
  const callback = await readFile(new URL("../ToolbarCallbacks/file/ConvertToSVG.mjs", import.meta.url), "utf8");
  assert.match(callback, /openPngVectorizationOverlay/, "File export callback uses shared vectorization launcher");
}

{
  assert.equal(normalizeNotebookPath("/Notebook/Art/scan.png?x=1"), "Art/scan.png");
  assert.equal(derivedSvgPath("Art/scan.png"), "Art/scan.svg");
  const calls = [];
  globalThis.fetch = async (_url, init) => {
    const path = JSON.parse(init.body).path;
    calls.push(path);
    return { ok: path.endsWith("-2.svg"), status: path.endsWith("-2.svg") ? 200 : 409, text: async () => "exists" };
  };
  assert.equal(await reserveDerivedSvgPath("Art/scan.svg"), "Art/scan-2.svg", "create API collision suffix is used");
  assert.deepEqual(calls, ["Art/scan.svg", "Art/scan-2.svg"]);
  const events = [];
  globalThis.window = { dispatchEvent: (event) => events.push(event.detail) };
  globalThis.CustomEvent = class CustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } };
  openSvgInGraphicalEditor("Notebook/Art/scan.svg");
  assert.equal(globalThis.window.selectedFilePath, "Art/scan.svg");
  assert.equal(events[0].id, "GraphicalEditor", "generated SVG opens through existing graphical editor route");
}

{
  let completed = 0;
  const firstCancel = scheduleVectorizationPreview(fixture(), { threshold: 10 }, () => { completed += 1; }, 5);
  scheduleVectorizationPreview(fixture(), { threshold: 200 }, () => { completed += 1; }, 5);
  firstCancel();
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(completed, 1, "rapid preview updates coalesce obsolete jobs");
}

console.log("ok - raster vectorization service creates portable SVG paths and PNG viewer integration stays viewer-only");
