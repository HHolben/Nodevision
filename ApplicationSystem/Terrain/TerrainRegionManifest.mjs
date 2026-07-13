// Nodevision/ApplicationSystem/Terrain/TerrainRegionManifest.mjs
// Versioned manifest creation and validation for exported terrain-region assets.

import { relativePathIsSafe } from "./TerrainRegionGeometry.mjs";

export const TERRAIN_REGION_FORMAT = "nodevision-terrain-region";
export const TERRAIN_REGION_VERSION = 1;

export function createTerrainRegionManifest({ name, region, settings, estimate, sourceSelection, elevationStats, contourFile = "contours/contours.geojson", offline = {}, aviation = {}, provenance = {} } = {}) {
  const now = new Date().toISOString();
  return {
    format: TERRAIN_REGION_FORMAT,
    version: TERRAIN_REGION_VERSION,
    name: String(name || region?.featureName || "Selected Terrain Region"),
    createdAt: now,
    region: {
      geometry: region.geometry,
      bounds: region.bounds,
      areaSquareMeters: region.areaSquareMeters,
      sourceKmlFeatureId: region.featureId || null,
      sourceKmlFeatureName: region.featureName || null,
      vertexCount: region.vertexCount || 0,
    },
    origin: {
      latitude: region.origin?.latitude ?? ((region.bounds.south + region.bounds.north) / 2),
      longitude: region.origin?.longitude ?? ((region.bounds.west + region.bounds.east) / 2),
      elevationMeters: region.origin?.elevationMeters ?? 0,
    },
    coordinateSystem: {
      geographicCrs: "EPSG:4326",
      localAxes: "X-east,Y-up,Z-south",
      horizontalUnits: "meters",
      verticalUnits: "meters",
      localProjection: "local tangent plane centered on origin for area and future mesh generation",
    },
    terrain: {
      requestedSource: settings?.requestedSource || estimate?.requestedSource || "automatic",
      actualSources: sourceSelection?.actualSource ? [sourceSelection.actualSource] : [estimate?.actualSource].filter(Boolean),
      terrainModel: estimate?.licenseMetadata?.terrainModel || "preview-derived-unverified",
      nativeResolutionMeters: estimate?.nativeResolutionMeters ?? null,
      processedResolutionMeters: estimate?.requestedResolutionMeters ?? null,
      minimumElevationMeters: elevationStats?.minimumElevationMeters ?? null,
      maximumElevationMeters: elevationStats?.maximumElevationMeters ?? null,
      verticalScale: 1,
    },
    contours: {
      intervalMeters: settings?.intervalMeters || settings?.customContourIntervalMeters || 10,
      indexIntervalMeters: settings?.indexIntervalMeters || settings?.customIndexContourIntervalMeters || 50,
      file: contourFile,
    },
    offline: {
      complete: offline.complete === true,
      missingResources: Array.isArray(offline.missingResources) ? offline.missingResources : [],
      basemapIncluded: offline.basemapIncluded === true,
      aviationIncluded: offline.aviationIncluded === true,
      offlineMode: true,
    },
    aviation: {
      charts: Array.isArray(aviation.charts) ? aviation.charts : [],
      lastCheckedAt: aviation.lastCheckedAt || null,
      containsExpiredMaterial: aviation.containsExpiredMaterial === true,
      warning: "Nodevision terrain and chart views are planning/reference products, not independently certified navigation products.",
    },
    provenance: {
      sources: Array.isArray(provenance.sources) ? provenance.sources : [],
      licenses: Array.isArray(provenance.licenses) ? provenance.licenses : [],
      attributionFile: "attribution/attribution.html",
      generatedBy: "Nodevision terrain-region export phase 1",
    },
    files: {
      regionGeoJson: "region.geojson",
      regionKml: "region.kml",
      elevationIndex: "elevation/elevation-index.json",
      contourIndex: "contours/contour-index.json",
      basemapIndex: "basemap/tile-index.json",
      aviationIndex: "aviation/aviation-index.json",
      checksums: "checksums.json",
    },
  };
}

function walkPaths(value, paths = []) {
  if (!value || typeof value !== "object") return paths;
  for (const [key, child] of Object.entries(value)) {
    if ((key === "file" || key.endsWith("File") || key.endsWith("Path") || key.endsWith("Index") || key === "checksums") && typeof child === "string") paths.push(child);
    if (child && typeof child === "object") walkPaths(child, paths);
  }
  return paths;
}

export function validateTerrainRegionManifest(manifest) {
  if (manifest?.format !== TERRAIN_REGION_FORMAT) throw new Error("Manifest format is not nodevision-terrain-region.");
  if (Number(manifest.version) !== TERRAIN_REGION_VERSION) throw new Error("Unsupported terrain-region manifest version.");
  if (manifest.region?.geometry?.type !== "Polygon") throw new Error("Terrain-region manifest must contain a Polygon geometry.");
  for (const rel of walkPaths(manifest)) {
    if (rel && !relativePathIsSafe(rel)) throw new Error(`Unsafe manifest relative path: ${rel}`);
  }
  return true;
}
