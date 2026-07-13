// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/KML/TerrainSettings.mjs
// Client-side terrain display setting defaults and sanitization.

export const TERRAIN_SOURCE_OPTIONS = ["automatic", "usgs-3dep", "copernicus-dem", "mapzen"];
export const CONTOUR_INTERVAL_OPTIONS = ["automatic", "5", "10", "20", "50", "custom"];

export const DEFAULT_TERRAIN_SETTINGS = Object.freeze({
  requestedSource: "automatic",
  actualSource: "automatic",
  contourInterval: "automatic",
  customContourIntervalMeters: 10,
  indexContourInterval: "automatic",
  customIndexContourIntervalMeters: 50,
  elevationUnits: "meters",
  hillshade: true,
  elevationColors: true,
  slopeShading: false,
  showAttribution: true,
  qualityPreset: "preview",
  includeBasemap: false,
  includeAviation: false,
});

function bool(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}

function oneOf(value, values, fallback) {
  const normalized = String(value || "").trim().toLowerCase();
  return values.includes(normalized) ? normalized : fallback;
}

function positiveNumber(value, fallback, max = 1000000) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(max, n);
}

export function normalizeTerrainSettings(input = {}) {
  const base = DEFAULT_TERRAIN_SETTINGS;
  const source = input && typeof input === "object" ? input : {};
  return {
    requestedSource: oneOf(source.requestedSource ?? source.terrainSource, TERRAIN_SOURCE_OPTIONS, base.requestedSource),
    actualSource: oneOf(source.actualSource, TERRAIN_SOURCE_OPTIONS, base.actualSource),
    contourInterval: oneOf(String(source.contourInterval ?? "automatic"), CONTOUR_INTERVAL_OPTIONS, base.contourInterval),
    customContourIntervalMeters: positiveNumber(source.customContourIntervalMeters, base.customContourIntervalMeters, 10000),
    indexContourInterval: oneOf(String(source.indexContourInterval ?? "automatic"), ["automatic", "custom"], base.indexContourInterval),
    customIndexContourIntervalMeters: positiveNumber(source.customIndexContourIntervalMeters, base.customIndexContourIntervalMeters, 100000),
    elevationUnits: oneOf(source.elevationUnits, ["meters", "feet"], base.elevationUnits),
    hillshade: bool(source.hillshade, base.hillshade),
    elevationColors: bool(source.elevationColors, base.elevationColors),
    slopeShading: bool(source.slopeShading, base.slopeShading),
    showAttribution: bool(source.showAttribution, base.showAttribution),
    qualityPreset: oneOf(source.qualityPreset, ["preview", "offline-map", "metaworld-low", "metaworld-medium", "metaworld-high", "custom"], base.qualityPreset),
    includeBasemap: bool(source.includeBasemap, base.includeBasemap),
    includeAviation: bool(source.includeAviation, base.includeAviation),
  };
}

export function effectiveContourIntervalMeters(settings = {}, zoom = 10) {
  const normalized = normalizeTerrainSettings(settings);
  if (normalized.contourInterval !== "automatic" && normalized.contourInterval !== "custom") return Number(normalized.contourInterval);
  if (normalized.contourInterval === "custom") return normalized.customContourIntervalMeters;
  const z = Number(zoom);
  if (!Number.isFinite(z) || z < 7) return 50;
  if (z < 10) return 20;
  if (z < 13) return 10;
  return 5;
}

export function effectiveIndexContourIntervalMeters(settings = {}, zoom = 10) {
  const normalized = normalizeTerrainSettings(settings);
  if (normalized.indexContourInterval === "custom") return normalized.customIndexContourIntervalMeters;
  return Math.max(effectiveContourIntervalMeters(normalized, zoom) * 5, 25);
}
