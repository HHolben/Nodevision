// Nodevision/ApplicationSystem/Terrain/TerrainOfflinePackage.mjs
// Writes self-contained Nodevision terrain-region packages into the Notebook.

import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { normalizeTerrainRegion, sanitizeFilename } from "./TerrainRegionGeometry.mjs";
import { createSyntheticElevationRasterForRegion, elevationStats, generateContoursFromRaster } from "./TerrainContourGenerator.mjs";
import { createTerrainRegionManifest, validateTerrainRegionManifest } from "./TerrainRegionManifest.mjs";
import { estimateTerrainRegionRequest, selectTerrainSource, TERRAIN_LIMITS } from "./TerrainSourceSelector.mjs";
import { FAAVFRChartSource } from "./Sources/FAAVFRChartSource.mjs";

function posixJoin(...parts) {
  return parts.filter(Boolean).join("/").replace(/\/+/g, "/");
}

function assertInside(base, target) {
  const resolvedBase = path.resolve(base);
  const resolvedTarget = path.resolve(target);
  const relative = path.relative(resolvedBase, resolvedTarget);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Terrain package path escaped its allowed directory.");
  return resolvedTarget;
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(value, null, 2));
}

async function writeText(filePath, text) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, String(text));
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function collectChecksums(rootDir, relativeDir = "") {
  const entries = await fs.readdir(path.join(rootDir, relativeDir), { withFileTypes: true });
  const files = {};
  for (const entry of entries) {
    const rel = posixJoin(relativeDir, entry.name);
    if (rel === "checksums.json") continue;
    const full = path.join(rootDir, rel);
    if (entry.isDirectory()) Object.assign(files, await collectChecksums(rootDir, rel));
    else if (entry.isFile()) files[rel] = sha256(await fs.readFile(full));
  }
  return files;
}

function minimalKml(region) {
  const coords = region.geometry.coordinates[0].map((pt) => pt.join(",")).join(" ");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${escapeXml(region.featureName)}</name><Placemark><name>${escapeXml(region.featureName)}</name><Polygon><outerBoundaryIs><LinearRing><coordinates>${coords}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark></Document></kml>\n`;
}

function escapeXml(value) {
  return String(value || "").replace(/[<>&'"]/g, (ch) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[ch]));
}

function overviewSvg(region) {
  const points = region.geometry.coordinates[0];
  const b = region.bounds;
  const width = 640;
  const height = 420;
  const poly = points.map((pt) => {
    const x = ((pt[0] - b.west) / Math.max(1e-9, b.east - b.west)) * (width - 40) + 20;
    const y = ((b.north - pt[1]) / Math.max(1e-9, b.north - b.south)) * (height - 40) + 20;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#eef3ec"/><polygon points="${poly}" fill="#fef3c7" stroke="#b45309" stroke-width="4"/><text x="20" y="${height - 20}" font-family="system-ui, sans-serif" font-size="18" fill="#334155">Nodevision terrain region preview</text></svg>`;
}

export async function writeTerrainOfflinePackage(ctx, payload = {}, { jobId = "terrain-job", onPhase = () => {}, signal } = {}) {
  const notebookDir = ctx?.notebookDir;
  if (!notebookDir) throw new Error("Notebook directory is not configured.");
  const region = normalizeTerrainRegion(payload.region || payload);
  const settings = payload.settings || {};
  const name = sanitizeFilename(payload.name || region.featureName || "TerrainRegion", "TerrainRegion");
  const estimate = payload.estimate?.ok ? payload.estimate : await estimateTerrainRegionRequest(region, settings);
  if (estimate.areaSquareMeters > TERRAIN_LIMITS.maxAreaSquareMeters) throw new Error("Selected region exceeds the configured maximum export area.");
  if (estimate.tileCount > TERRAIN_LIMITS.maxTileCount) throw new Error("Estimated map tile count exceeds the configured offline tile limit.");
  if (estimate.estimatedProcessedPackageBytes > TERRAIN_LIMITS.maxEstimatedBytes) throw new Error("Estimated package size exceeds the configured maximum bytes.");
  const sourceSelection = await selectTerrainSource(region, settings);
  if (signal?.aborted) throw new Error("Terrain export was cancelled.");

  const suffix = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+$/, "Z");
  const finalRelDir = posixJoin("TerrainRegions", `${name}-${suffix}`);
  const parentDir = assertInside(notebookDir, path.join(notebookDir, "TerrainRegions"));
  const finalDir = assertInside(notebookDir, path.join(notebookDir, finalRelDir));
  const tempDir = assertInside(parentDir, `.tmp-${name}-${process.pid}-${Date.now()}`);
  await fs.rm(tempDir, { recursive: true, force: true });
  await fs.mkdir(tempDir, { recursive: true });

  try {
    onPhase("Generating preview elevation raster", 0.22);
    const rasterSize = settings.qualityPreset === "metaworld-high" ? 96 : settings.qualityPreset === "preview" ? 48 : 64;
    const raster = createSyntheticElevationRasterForRegion(region, { width: rasterSize, height: rasterSize });
    const stats = elevationStats(raster);

    onPhase("Generating contours", 0.42);
    const intervalMeters = Number(settings.intervalMeters || settings.customContourIntervalMeters) || 10;
    const indexIntervalMeters = Number(settings.indexIntervalMeters || settings.customIndexContourIntervalMeters) || Math.max(50, intervalMeters * 5);
    const contours = generateContoursFromRaster(raster, { intervalMeters, indexIntervalMeters, region });

    const faa = new FAAVFRChartSource();
    const charts = settings.includeAviation ? faa.selectIntersectingCharts(region) : [];
    const missingResources = ["provider-elevation-data"];
    if (settings.includeBasemap) missingResources.push("offline-basemap-tiles-disabled-by-source-policy");
    if (settings.includeAviation && charts.length) missingResources.push("verified-faa-chart-files");

    onPhase("Writing package files", 0.62);
    await writeJson(path.join(tempDir, "region.geojson"), { type: "Feature", properties: { name: region.featureName, sourceKmlFeatureId: region.featureId }, geometry: region.geometry });
    await writeText(path.join(tempDir, "region.kml"), payload.kmlText || minimalKml(region));
    await writeJson(path.join(tempDir, "elevation", "elevation-index.json"), {
      format: "nodevision-terrain-elevation-index",
      version: 1,
      source: estimate.actualSource || sourceSelection.actualSource || null,
      raster: { file: "preview-raster.json", width: raster.width, height: raster.height, bounds: raster.bounds, units: "meters", previewDerived: true },
      note: "This phase writes deterministic preview elevation for offline rendering. Provider DEM download is recorded as a missing resource until the live source fetcher is enabled.",
    });
    await writeJson(path.join(tempDir, "elevation", "preview-raster.json"), raster);
    await writeJson(path.join(tempDir, "contours", "contours.geojson"), contours);
    await writeJson(path.join(tempDir, "contours", "contour-index.json"), { format: "nodevision-terrain-contour-index", version: 1, file: "contours.geojson", intervalMeters, indexIntervalMeters, featureCount: contours.features.length });
    await writeJson(path.join(tempDir, "basemap", "tile-index.json"), { format: "nodevision-offline-basemap-index", version: 1, offlineTilesIncluded: false, reason: settings.includeBasemap ? "No configured basemap source permits bulk offline tile download in this phase." : "Basemap was not requested." });
    await writeJson(path.join(tempDir, "aviation", "aviation-index.json"), { format: "nodevision-aviation-index", version: 1, charts, warning: "Offline FAA chart files are only included after verified downloads. Cached charts are not certified navigation products." });
    await writeText(path.join(tempDir, "previews", "overview.svg"), overviewSvg(region));

    const licenses = [estimate.licenseMetadata].filter(Boolean).flatMap((item) => item.licenses || []);
    const sources = [{ id: estimate.actualSource, name: estimate.actualSourceDisplayName, attribution: estimate.attribution, fallbackUsed: estimate.fallbackUsed }].filter((item) => item.id);
    await writeJson(path.join(tempDir, "attribution", "sources.json"), { sources, licenses, warnings: estimate.warnings || [] });
    await writeText(path.join(tempDir, "attribution", "attribution.html"), `<p>${escapeXml(estimate.attribution || "Source attribution unavailable")}</p><p>Nodevision terrain and chart views are planning/reference products and are not certified navigation products.</p>`);

    onPhase("Writing terrain manifest", 0.78);
    const manifest = createTerrainRegionManifest({
      name: payload.name || region.featureName,
      region,
      settings: { ...settings, intervalMeters, indexIntervalMeters },
      estimate,
      sourceSelection,
      elevationStats: stats,
      offline: { complete: missingResources.length === 0, missingResources, basemapIncluded: false, aviationIncluded: false },
      aviation: { charts, lastCheckedAt: null, containsExpiredMaterial: false },
      provenance: { sources, licenses },
    });
    validateTerrainRegionManifest(manifest);
    await writeJson(path.join(tempDir, `${name}.terrain.json`), manifest);

    onPhase("Verifying downloaded files", 0.88);
    await writeJson(path.join(tempDir, "checksums.json"), { algorithm: "sha256", files: await collectChecksums(tempDir), createdAt: new Date().toISOString() });
    await fs.mkdir(parentDir, { recursive: true });
    await fs.rename(tempDir, finalDir);
    onPhase("Complete", 1);
    return {
      ok: true,
      packagePath: finalRelDir,
      manifestPath: posixJoin(finalRelDir, `${name}.terrain.json`),
      contourPath: posixJoin(finalRelDir, "contours", "contours.geojson"),
      missingResources,
      estimate,
      stats,
      chartCount: charts.length,
    };
  } catch (err) {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    throw err;
  }
}
