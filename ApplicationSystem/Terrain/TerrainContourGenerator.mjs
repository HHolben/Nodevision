// Nodevision/ApplicationSystem/Terrain/TerrainContourGenerator.mjs
// Deterministic server-side contour generation for terrain-region exports.

import { pointInPolygonGeometry } from "./TerrainRegionGeometry.mjs";

export function contourLevels(minElevation, maxElevation, intervalMeters) {
  const min = Number(minElevation);
  const max = Number(maxElevation);
  const interval = Number(intervalMeters);
  if (![min, max, interval].every(Number.isFinite) || interval <= 0 || max < min) return [];
  const start = Math.ceil(min / interval) * interval;
  const levels = [];
  for (let level = start; level <= max + 1e-9; level += interval) levels.push(Number(level.toFixed(6)));
  return levels;
}

function valueAt(raster, x, y) {
  const value = raster.data[(y * raster.width) + x];
  if (!Number.isFinite(value)) return null;
  if (Number.isFinite(raster.noDataValue) && value === raster.noDataValue) return null;
  return value;
}

function interpolate(a, b, va, vb, level) {
  const delta = vb - va;
  const t = Math.abs(delta) < 1e-12 ? 0.5 : (level - va) / delta;
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function gridPoint(raster, x, y) {
  const b = raster.bounds;
  return [
    b.west + ((b.east - b.west) * x) / Math.max(1, raster.width - 1),
    b.north - ((b.north - b.south) * y) / Math.max(1, raster.height - 1),
  ];
}

function cellSegments(corners, values, level) {
  const points = [];
  for (const [a, b] of [[0, 1], [1, 2], [2, 3], [3, 0]]) {
    const va = values[a];
    const vb = values[b];
    if (va === null || vb === null) continue;
    if ((va < level && vb >= level) || (vb < level && va >= level)) points.push(interpolate(corners[a], corners[b], va, vb, level));
  }
  if (points.length === 2) return [[points[0], points[1]]];
  if (points.length === 4) return [[points[0], points[1]], [points[2], points[3]]];
  return [];
}

export function generateContoursFromRaster(raster, options = {}) {
  if (!raster || !Number.isInteger(raster.width) || !Number.isInteger(raster.height) || raster.width < 2 || raster.height < 2) {
    throw new Error("Contour raster must have width and height of at least 2.");
  }
  if (!raster.bounds) throw new Error("Contour raster must include geographic bounds.");
  if (!Array.isArray(raster.data) && !(raster.data instanceof Float32Array) && !(raster.data instanceof Float64Array)) {
    throw new Error("Contour raster data must be an array of elevations in meters.");
  }
  const interval = Number(options.intervalMeters) || 10;
  const indexInterval = Number(options.indexIntervalMeters) || interval * 5;
  const finite = Array.from(raster.data).filter(Number.isFinite).filter((value) => value !== raster.noDataValue);
  if (!finite.length) return { type: "FeatureCollection", features: [] };
  const levels = contourLevels(Math.min(...finite), Math.max(...finite), interval);
  const region = options.region || null;
  const features = [];
  for (const level of levels) {
    for (let y = 0; y < raster.height - 1; y += 1) {
      for (let x = 0; x < raster.width - 1; x += 1) {
        const values = [valueAt(raster, x, y), valueAt(raster, x + 1, y), valueAt(raster, x + 1, y + 1), valueAt(raster, x, y + 1)];
        if (values.every((value) => value === null)) continue;
        const corners = [gridPoint(raster, x, y), gridPoint(raster, x + 1, y), gridPoint(raster, x + 1, y + 1), gridPoint(raster, x, y + 1)];
        for (const segment of cellSegments(corners, values, level)) {
          const midpoint = [(segment[0][0] + segment[1][0]) / 2, (segment[0][1] + segment[1][1]) / 2];
          if (region && !pointInPolygonGeometry(midpoint, region.geometry || region)) continue;
          features.push({
            type: "Feature",
            properties: {
              elevationMeters: level,
              contourRole: Math.abs(level % indexInterval) < 1e-9 ? "index" : "regular",
            },
            geometry: { type: "LineString", coordinates: segment },
          });
        }
      }
    }
  }
  return { type: "FeatureCollection", features };
}

export function createSyntheticElevationRasterForRegion(region, { width = 64, height = 64 } = {}) {
  const bounds = region?.bounds;
  if (!bounds) throw new Error("Region bounds are required for terrain preview raster generation.");
  const data = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const lon = bounds.west + ((bounds.east - bounds.west) * x) / Math.max(1, width - 1);
      const lat = bounds.north - ((bounds.north - bounds.south) * y) / Math.max(1, height - 1);
      const ridge = Math.sin((lon * 2.7 + lat * 1.9) * Math.PI / 180) * 240;
      const folds = Math.cos((lon - lat) * Math.PI / 22) * 360;
      const broad = Math.sin((lat + 19) * Math.PI / 45) * 420;
      data.push(ridge + folds + broad + 900);
    }
  }
  return { width, height, bounds, data, noDataValue: null };
}

export function elevationStats(raster) {
  const values = Array.from(raster?.data || []).filter(Number.isFinite).filter((value) => value !== raster?.noDataValue);
  if (!values.length) return { minimumElevationMeters: null, maximumElevationMeters: null };
  return { minimumElevationMeters: Math.min(...values), maximumElevationMeters: Math.max(...values) };
}
