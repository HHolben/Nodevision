// Nodevision/ApplicationSystem/Terrain/TerrainSourceSelector.mjs
// Automatic source selection and conservative request estimation.

import { createDefaultTerrainSourceRegistry } from "./TerrainSourceRegistry.mjs";
import { normalizeTerrainRegion } from "./TerrainRegionGeometry.mjs";

const QUALITY = Object.freeze({
  preview: { zoom: 10, resolutionMeters: 120, contourLimit: 8000, label: "Preview" },
  "offline-map": { zoom: 12, resolutionMeters: 60, contourLimit: 40000, label: "Offline Map" },
  "metaworld-low": { zoom: 11, resolutionMeters: 90, contourLimit: 25000, label: "MetaWorld Low" },
  "metaworld-medium": { zoom: 12, resolutionMeters: 45, contourLimit: 60000, label: "MetaWorld Medium" },
  "metaworld-high": { zoom: 13, resolutionMeters: 30, contourLimit: 120000, label: "MetaWorld High" },
  custom: { zoom: 12, resolutionMeters: 60, contourLimit: 60000, label: "Custom" },
});

export const TERRAIN_LIMITS = Object.freeze({
  maxAreaSquareMeters: 2_500_000_000,
  maxTileCount: 2400,
  maxEstimatedBytes: 1_500_000_000,
  maxOutputMeshVertices: 2_000_000,
  maxContourCount: 160000,
  maxConcurrentRequests: 6,
});

function regionLooksUnitedStates(region) {
  const b = region.bounds;
  if (!b) return false;
  const boxes = [
    { west: -125, south: 24, east: -66, north: 50 },
    { west: -170, south: 51, east: -129, north: 72 },
    { west: -161, south: 18, east: -154, north: 23 },
    { west: -68, south: 17, east: -64, north: 19 },
  ];
  return boxes.some((box) => !(b.east < box.west || b.west > box.east || b.north < box.south || b.south > box.north));
}

function tileEstimate(bounds, zoom) {
  const z = Math.max(0, Math.min(18, Number(zoom) || 10));
  const scale = 2 ** z;
  const lonToX = (lon) => ((lon + 180) / 360) * scale;
  const latToY = (lat) => {
    const clamped = Math.max(-85.051129, Math.min(85.051129, lat));
    const rad = clamped * Math.PI / 180;
    return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * scale;
  };
  const x1 = Math.floor(lonToX(bounds.west));
  const x2 = Math.floor(lonToX(bounds.east));
  const y1 = Math.floor(latToY(bounds.north));
  const y2 = Math.floor(latToY(bounds.south));
  return Math.max(1, (Math.abs(x2 - x1) + 1) * (Math.abs(y2 - y1) + 1));
}

function bytesLabel(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = n;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

export async function selectTerrainSource(regionInput, options = {}, registry = createDefaultTerrainSourceRegistry()) {
  const region = normalizeTerrainRegion(regionInput);
  const requestedSource = String(options.requestedSource || options.terrainSource || "automatic").toLowerCase();
  const warnings = [];
  const candidates = requestedSource === "automatic"
    ? (regionLooksUnitedStates(region) ? ["usgs-3dep", "copernicus-dem", "mapzen"] : ["copernicus-dem", "mapzen"])
    : [requestedSource, "copernicus-dem", "mapzen"].filter((value, index, arr) => arr.indexOf(value) === index);

  for (const id of candidates) {
    const adapter = registry.get(id);
    if (!adapter) {
      warnings.push(`Unknown terrain source: ${id}.`);
      continue;
    }
    const support = await adapter.supportsRegion(region, options);
    if (support.supported) {
      if (requestedSource !== "automatic" && id !== requestedSource) warnings.push(`Requested source ${requestedSource} is unavailable; using ${adapter.displayName}.`);
      return {
        requestedSource,
        actualSource: adapter.id,
        adapter,
        displayName: adapter.displayName,
        support,
        fallbackUsed: requestedSource !== "automatic" && id !== requestedSource,
        warnings: [...warnings, ...(support.reason ? [support.reason] : [])],
      };
    }
    warnings.push(`${adapter.displayName}: ${support.reason || "unsupported for this region"}`);
    if (requestedSource !== "automatic" && id === requestedSource && options.allowFallback === false) break;
  }

  return {
    requestedSource,
    actualSource: null,
    adapter: null,
    displayName: "No terrain source",
    support: { supported: false, confidence: "none" },
    fallbackUsed: false,
    warnings,
    error: "No configured terrain source supports this selected region.",
  };
}

export async function estimateTerrainRegionRequest(regionInput, settings = {}, registry = createDefaultTerrainSourceRegistry()) {
  const region = normalizeTerrainRegion(regionInput);
  const preset = QUALITY[String(settings.qualityPreset || "preview")] || QUALITY.preview;
  const selection = await selectTerrainSource(region, settings, registry);
  if (!selection.adapter) return { ok: false, error: selection.error, warnings: selection.warnings, requestedSource: selection.requestedSource, actualSource: null };
  const sourceEstimate = await selection.adapter.estimateRequest(region, settings);
  const tileCount = tileEstimate(region.bounds, preset.zoom);
  const baseMapBytes = settings.includeBasemap ? tileCount * 20_000 : 0;
  const aviationCharts = settings.includeAviation ? Math.max(1, Math.ceil(region.areaSquareMeters / 1_000_000_000)) : 0;
  const aviationBytes = settings.includeAviation ? aviationCharts * 180_000_000 : 0;
  const elevationBytes = sourceEstimate.estimatedBytes || Math.ceil(region.areaSquareMeters / Math.max(1, preset.resolutionMeters * preset.resolutionMeters) * 4);
  const contourBytes = Math.min(TERRAIN_LIMITS.maxContourCount, Math.ceil(region.areaSquareMeters / Math.max(1, preset.resolutionMeters * preset.resolutionMeters) * 1.4)) * 80;
  const processedBytes = elevationBytes + contourBytes + baseMapBytes + aviationBytes + 80_000;
  const warnings = [...selection.warnings, ...(sourceEstimate.warnings || [])];
  if (region.areaSquareMeters > TERRAIN_LIMITS.maxAreaSquareMeters) warnings.push("Selected region exceeds the configured maximum export area.");
  if (tileCount > TERRAIN_LIMITS.maxTileCount) warnings.push("Estimated map tile count exceeds the configured offline tile limit.");
  if (processedBytes > TERRAIN_LIMITS.maxEstimatedBytes) warnings.push("Estimated package size exceeds the configured maximum bytes.");
  if (settings.includeBasemap) warnings.push("Conventional street basemap offline download is disabled unless a source adapter explicitly permits offline caching.");
  return {
    ok: true,
    requestedSource: selection.requestedSource,
    actualSource: selection.actualSource,
    actualSourceDisplayName: selection.displayName,
    fallbackUsed: selection.fallbackUsed,
    areaSquareMeters: region.areaSquareMeters,
    bounds: region.bounds,
    qualityPreset: settings.qualityPreset || "preview",
    requestedResolutionMeters: preset.resolutionMeters,
    nativeResolutionMeters: sourceEstimate.nativeResolutionMeters ?? null,
    tileCount,
    aviationChartCount: aviationCharts,
    estimatedElevationBytes: elevationBytes,
    estimatedBaseMapBytes: baseMapBytes,
    estimatedAviationBytes: aviationBytes,
    estimatedProcessedPackageBytes: processedBytes,
    estimatedBytesLabel: bytesLabel(processedBytes),
    maximums: TERRAIN_LIMITS,
    contourLimit: preset.contourLimit,
    attribution: selection.adapter.getAttribution(),
    licenseMetadata: selection.adapter.getLicenseMetadata(),
    warnings,
    warning: warnings[0] || "",
  };
}
