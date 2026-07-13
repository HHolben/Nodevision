// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/KML/TerrainContourGenerator.mjs
// Lightweight deterministic contour generation from normalized elevation rasters.

import { pointInPolygonGeometry } from "./ClosedRegionSelection.mjs";

export function decodeMapzenTerrariumPixel(red, green, blue) {
  const r = Number(red);
  const g = Number(green);
  const b = Number(blue);
  if (![r, g, b].every(Number.isFinite)) throw new Error("Terrarium pixel channels must be finite numbers.");
  if (r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255) throw new Error("Terrarium pixel channels must be 0-255.");
  return (r * 256) + g + (b / 256) - 32768;
}

export function metersToDisplayElevation(valueMeters, units = "meters") {
  const meters = Number(valueMeters);
  if (!Number.isFinite(meters)) return null;
  return String(units || "meters").toLowerCase() === "feet" ? meters * 3.280839895 : meters;
}

export function contourLevels(minElevation, maxElevation, intervalMeters) {
  const min = Number(minElevation);
  const max = Number(maxElevation);
  const interval = Number(intervalMeters);
  if (![min, max, interval].every(Number.isFinite) || interval <= 0 || max < min) return [];
  const start = Math.ceil(min / interval) * interval;
  const out = [];
  for (let level = start; level <= max + 1e-9; level += interval) out.push(Number(level.toFixed(6)));
  return out;
}

function valueAt(raster, x, y) {
  const value = raster.data[(y * raster.width) + x];
  const noData = raster.noDataValue;
  if (!Number.isFinite(value)) return null;
  if (Number.isFinite(noData) && value === noData) return null;
  return value;
}

function interpolate(a, b, va, vb, level) {
  const denom = vb - va;
  const t = Math.abs(denom) < 1e-12 ? 0.5 : (level - va) / denom;
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function cellSegments(corners, values, level) {
  const edges = [];
  const pairs = [[0, 1], [1, 2], [2, 3], [3, 0]];
  pairs.forEach(([a, b]) => {
    const va = values[a];
    const vb = values[b];
    if (va === null || vb === null) return;
    if ((va < level && vb >= level) || (vb < level && va >= level)) {
      edges.push(interpolate(corners[a], corners[b], va, vb, level));
    }
  });
  if (edges.length === 2) return [[edges[0], edges[1]]];
  if (edges.length === 4) return [[edges[0], edges[1]], [edges[2], edges[3]]];
  return [];
}

function pointForGrid(raster, x, y) {
  const bounds = raster.bounds;
  const lon = bounds.west + ((bounds.east - bounds.west) * x) / Math.max(1, raster.width - 1);
  const lat = bounds.north - ((bounds.north - bounds.south) * y) / Math.max(1, raster.height - 1);
  return [lon, lat];
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
  const features = [];
  const region = options.region || null;

  levels.forEach((level) => {
    for (let y = 0; y < raster.height - 1; y += 1) {
      for (let x = 0; x < raster.width - 1; x += 1) {
        const values = [valueAt(raster, x, y), valueAt(raster, x + 1, y), valueAt(raster, x + 1, y + 1), valueAt(raster, x, y + 1)];
        if (values.every((value) => value === null)) continue;
        const corners = [pointForGrid(raster, x, y), pointForGrid(raster, x + 1, y), pointForGrid(raster, x + 1, y + 1), pointForGrid(raster, x, y + 1)];
        cellSegments(corners, values, level).forEach((segment) => {
          const midpoint = [(segment[0][0] + segment[1][0]) / 2, (segment[0][1] + segment[1][1]) / 2];
          if (region && !pointInPolygonGeometry(midpoint, region.geometry || region)) return;
          features.push({
            type: "Feature",
            properties: {
              elevationMeters: level,
              contourRole: Math.abs(level % indexInterval) < 1e-9 ? "index" : "regular",
            },
            geometry: { type: "LineString", coordinates: segment },
          });
        });
      }
    }
  });
  return { type: "FeatureCollection", features };
}

export function createSyntheticElevationRasterForRegion(region, { width = 48, height = 48 } = {}) {
  const bounds = region?.bounds;
  if (!bounds) throw new Error("Region bounds are required for preview terrain.");
  const data = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const lon = bounds.west + ((bounds.east - bounds.west) * x) / Math.max(1, width - 1);
      const lat = bounds.north - ((bounds.north - bounds.south) * y) / Math.max(1, height - 1);
      const wave = Math.sin((lon + 180) * 0.17) * 450 + Math.cos((lat + 90) * 0.23) * 320;
      const ridge = Math.sin((lon * 2.7 + lat * 1.9) * Math.PI / 180) * 180;
      data.push(wave + ridge + 900);
    }
  }
  return { width, height, bounds, data, noDataValue: null };
}
