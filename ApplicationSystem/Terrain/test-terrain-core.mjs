import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";

import { selectTerrainSource, estimateTerrainRegionRequest } from "./TerrainSourceSelector.mjs";
import { decodeMapzenTerrariumPixel, encodeMapzenTerrariumElevation } from "./MapzenTerrarium.mjs";
import { normalizeTerrainRegion, areaSquareMetersForGeometry } from "./TerrainRegionGeometry.mjs";
import { generateContoursFromRaster, contourLevels } from "./TerrainContourGenerator.mjs";
import { createTerrainRegionManifest, validateTerrainRegionManifest } from "./TerrainRegionManifest.mjs";
import { writeTerrainOfflinePackage } from "./TerrainOfflinePackage.mjs";
import { FAAVFRChartSource } from "./Sources/FAAVFRChartSource.mjs";
import { getClosedRegionCandidate } from "../public/PanelInstances/ViewPanels/FileViewers/KML/ClosedRegionSelection.mjs";

function polygon(west, south, east, north) {
  return { type: "Polygon", coordinates: [[[west, south], [east, south], [east, north], [west, north], [west, south]]] };
}

function record(type, coords, id = "r1") {
  return { id, name: "Test Region", geometry: { type, coordinates: coords.map(([lon, lat, alt = null]) => ({ lon, lat, alt })) } };
}

function sha256(buffer) { return createHash("sha256").update(buffer).digest("hex"); }

async function testSourceSelection() {
  const usRegion = normalizeTerrainRegion({ geometry: polygon(-82.42, 36.28, -82.28, 36.38), featureName: "US" });
  const usSelection = await selectTerrainSource(usRegion, { requestedSource: "automatic" });
  assert.equal(usSelection.actualSource, "usgs-3dep", "automatic should prefer USGS inside supported US coverage");

  const euRegion = normalizeTerrainRegion({ geometry: polygon(7.1, 45.8, 7.2, 45.9), featureName: "EU" });
  const euSelection = await selectTerrainSource(euRegion, { requestedSource: "automatic" });
  assert.equal(euSelection.actualSource, "copernicus-dem", "automatic should prefer Copernicus outside USGS coverage");

  const mapzenSelection = await selectTerrainSource(euRegion, { requestedSource: "mapzen" });
  assert.equal(mapzenSelection.actualSource, "mapzen", "Mapzen should be selectable explicitly");

  const fallbackSelection = await selectTerrainSource(euRegion, { requestedSource: "usgs-3dep" });
  assert.equal(fallbackSelection.actualSource, "copernicus-dem", "explicit unavailable USGS should fall back visibly");
  assert.equal(fallbackSelection.fallbackUsed, true);
  assert(fallbackSelection.warnings.some((warning) => /using Copernicus DEM/i.test(warning)));

  const estimate = await estimateTerrainRegionRequest(usRegion, { requestedSource: "automatic", qualityPreset: "preview" });
  assert.equal(estimate.ok, true);
  assert.equal(estimate.actualSource, "usgs-3dep");
  assert(estimate.estimatedProcessedPackageBytes > 0);
}

function testMapzenTerrarium() {
  assert.equal(decodeMapzenTerrariumPixel(128, 0, 0), 0);
  assert.equal(decodeMapzenTerrariumPixel(127, 255, 0), -1);
  assert.equal(decodeMapzenTerrariumPixel(128, 0, 128), 0.5);
  const encoded = encodeMapzenTerrariumElevation(1234.25);
  assert.equal(decodeMapzenTerrariumPixel(encoded.red, encoded.green, encoded.blue), 1234.25);
  assert.throws(() => decodeMapzenTerrariumPixel(256, 0, 0), /0-255/);
}

function testClosedRegions() {
  const closed = [[-82.42, 36.28], [-82.28, 36.28], [-82.28, 36.38], [-82.42, 36.38], [-82.42, 36.28]];
  assert.equal(getClosedRegionCandidate(record("Polygon", closed)).valid, true, "KML Polygon should be selectable");
  assert.equal(getClosedRegionCandidate(record("LinearRing", closed)).valid, true, "closed LinearRing should be selectable");
  assert.equal(getClosedRegionCandidate(record("LineString", closed)).valid, true, "closed LineString should be selectable");
  assert.equal(getClosedRegionCandidate(record("LineString", closed.slice(0, -1))).valid, false, "open LineString should not be exportable");

  const nearClosed = [[-82.42, 36.28], [-82.28, 36.28], [-82.28, 36.38], [-82.42, 36.38], [-82.420001, 36.280001]];
  assert.equal(getClosedRegionCandidate(record("LineString", nearClosed)).valid, true, "near closure should obey tolerance");

  const zeroArea = [[0, 0], [1, 1], [2, 2], [0, 0]];
  assert.equal(getClosedRegionCandidate(record("LineString", zeroArea)).valid, false, "zero-area polygon should be rejected");

  const bowTie = [[0, 0], [1, 1], [0, 1], [1, 0], [0, 0]];
  assert.equal(getClosedRegionCandidate(record("LineString", bowTie)).valid, false, "self-intersection should be rejected");

  const withHole = normalizeTerrainRegion({ geometry: { type: "Polygon", coordinates: [closed, [[-82.39, 36.31], [-82.35, 36.31], [-82.35, 36.35], [-82.39, 36.35], [-82.39, 36.31]]] } });
  assert.equal(withHole.geometry.coordinates.length, 2, "inner rings should be preserved");
  assert(areaSquareMetersForGeometry(withHole.geometry) > 0, "area should be calculated in projected meters");
}

function testContours() {
  assert.deepEqual(contourLevels(-5, 25, 10), [0, 10, 20]);
  const region = normalizeTerrainRegion({ geometry: polygon(0, 0, 1, 1) });
  const raster = { width: 3, height: 3, bounds: { west: 0, south: 0, east: 1, north: 1 }, data: [0, 10, 20, 10, 20, 30, 20, 30, 40], noDataValue: null };
  const contours = generateContoursFromRaster(raster, { intervalMeters: 10, indexIntervalMeters: 20, region });
  assert(contours.features.length > 0, "expected contour features from fixture raster");
  assert(contours.features.some((feature) => feature.properties.contourRole === "index"));
  assert(contours.features.every((feature) => typeof feature.properties.elevationMeters === "number"));
  const noDataRaster = { ...raster, data: [0, Number.NaN, 20, 10, 20, 30, 20, 30, 40] };
  assert.doesNotThrow(() => generateContoursFromRaster(noDataRaster, { intervalMeters: 10, region }));
}

async function testOfflinePackage() {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "nv-terrain-test-"));
  const region = normalizeTerrainRegion({ geometry: polygon(-82.42, 36.28, -82.40, 36.30), featureName: "Tiny Terrain" });
  const result = await writeTerrainOfflinePackage({ notebookDir: tmp }, { region, settings: { requestedSource: "automatic", qualityPreset: "preview" }, name: "Tiny Terrain" });
  assert.equal(result.ok, true);
  const manifestPath = path.join(tmp, result.manifestPath);
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  assert.equal(manifest.format, "nodevision-terrain-region");
  assert.equal(validateTerrainRegionManifest(manifest), true);
  assert.equal(path.isAbsolute(manifest.files.regionGeoJson), false);
  const checksumsPath = path.join(tmp, result.packagePath, "checksums.json");
  const checksums = JSON.parse(await fs.readFile(checksumsPath, "utf8"));
  const rel = "region.geojson";
  const originalHash = checksums.files[rel];
  assert.equal(originalHash, sha256(await fs.readFile(path.join(tmp, result.packagePath, rel))));
  await fs.writeFile(path.join(tmp, result.packagePath, rel), "corrupted");
  assert.notEqual(originalHash, sha256(await fs.readFile(path.join(tmp, result.packagePath, rel))), "checksum should detect corruption");
  const unsafe = createTerrainRegionManifest({ name: "Bad", region, settings: {}, estimate: {}, elevationStats: {} });
  unsafe.files.regionGeoJson = "../escape.geojson";
  assert.throws(() => validateTerrainRegionManifest(unsafe), /Unsafe manifest relative path/);
}

function testAviationCharts() {
  const source = new FAAVFRChartSource();
  const region = normalizeTerrainRegion({ geometry: polygon(-82.42, 36.28, -82.28, 36.38) });
  const charts = source.selectIntersectingCharts(region);
  assert(charts.some((chart) => chart.chartName === "Charlotte"), "intersecting chart metadata should be selected for this region");
  assert(charts.every((chart) => chart.source === "FAA" && chart.intersectsRegion === true));
}

await testSourceSelection();
testMapzenTerrarium();
testClosedRegions();
testContours();
await testOfflinePackage();
testAviationCharts();
console.log("terrain core tests passed");
