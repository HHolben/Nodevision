// Nodevision/ApplicationSystem/Terrain/TerrainRegionGeometry.mjs
// Server-side geographic region validation for KML terrain workflows.

const EARTH_RADIUS_METERS = 6371008.8;
const EPSILON = 1e-10;

function finiteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function closeRing(ring) {
  const clean = (Array.isArray(ring) ? ring : []).map((pt) => {
    const lon = finiteNumber(pt?.[0]);
    const lat = finiteNumber(pt?.[1]);
    const alt = finiteNumber(pt?.[2]);
    if (lon === null || lat === null) return null;
    return alt === null ? [lon, lat] : [lon, lat, alt];
  }).filter(Boolean);
  if (clean.length < 2) return clean;
  const first = clean[0];
  const last = clean[clean.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) return clean;
  return [...clean, [...first]];
}

export function boundsForGeometry(geometry) {
  const points = (geometry?.coordinates || []).flatMap((ring) => Array.isArray(ring) ? ring : []);
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const pt of points) {
    west = Math.min(west, pt[0]);
    east = Math.max(east, pt[0]);
    south = Math.min(south, pt[1]);
    north = Math.max(north, pt[1]);
  }
  if (![west, south, east, north].every(Number.isFinite)) return null;
  return { west, south, east, north };
}

function projectionOrigin(outerRing) {
  const vertices = outerRing.slice(0, -1);
  const sum = vertices.reduce((acc, pt) => {
    acc.lon += pt[0];
    acc.lat += pt[1];
    return acc;
  }, { lon: 0, lat: 0 });
  const count = Math.max(1, vertices.length);
  return { lon: sum.lon / count, lat: sum.lat / count };
}

function projectRingMeters(ring, origin) {
  const lat0 = origin.lat * Math.PI / 180;
  return ring.map((pt) => ({
    x: ((pt[0] - origin.lon) * Math.PI / 180) * EARTH_RADIUS_METERS * Math.cos(lat0),
    y: ((pt[1] - origin.lat) * Math.PI / 180) * EARTH_RADIUS_METERS,
  }));
}

function signedAreaProjected(points) {
  let area = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    area += (a.x * b.y) - (b.x * a.y);
  }
  return area / 2;
}

export function areaSquareMetersForGeometry(geometry) {
  const rings = geometry?.coordinates || [];
  if (!rings.length) return 0;
  const origin = projectionOrigin(rings[0]);
  const outer = Math.abs(signedAreaProjected(projectRingMeters(rings[0], origin)));
  const holes = rings.slice(1).reduce((sum, ring) => sum + Math.abs(signedAreaProjected(projectRingMeters(ring, origin))), 0);
  return Math.max(0, outer - holes);
}

function orientation(a, b, c) {
  const value = (b[1] - a[1]) * (c[0] - b[0]) - (b[0] - a[0]) * (c[1] - b[1]);
  if (Math.abs(value) < EPSILON) return 0;
  return value > 0 ? 1 : 2;
}

function onSegment(a, b, c) {
  return b[0] <= Math.max(a[0], c[0]) + EPSILON &&
    b[0] + EPSILON >= Math.min(a[0], c[0]) &&
    b[1] <= Math.max(a[1], c[1]) + EPSILON &&
    b[1] + EPSILON >= Math.min(a[1], c[1]);
}

function segmentsIntersect(p1, q1, p2, q2) {
  const o1 = orientation(p1, q1, p2);
  const o2 = orientation(p1, q1, q2);
  const o3 = orientation(p2, q2, p1);
  const o4 = orientation(p2, q2, q1);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(p1, p2, q1)) return true;
  if (o2 === 0 && onSegment(p1, q2, q1)) return true;
  if (o3 === 0 && onSegment(p2, p1, q2)) return true;
  if (o4 === 0 && onSegment(p2, q1, q2)) return true;
  return false;
}

function hasSelfIntersection(ring) {
  for (let i = 0; i < ring.length - 1; i += 1) {
    for (let j = i + 1; j < ring.length - 1; j += 1) {
      if (Math.abs(i - j) <= 1) continue;
      if (i === 0 && j === ring.length - 2) continue;
      if (segmentsIntersect(ring[i], ring[i + 1], ring[j], ring[j + 1])) return true;
    }
  }
  return false;
}

export function pointInRing(point, ring = []) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersects = ((yi > point[1]) !== (yj > point[1])) &&
      (point[0] < ((xj - xi) * (point[1] - yi)) / ((yj - yi) || EPSILON) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}

export function pointInPolygonGeometry(point, geometry) {
  const rings = geometry?.coordinates || [];
  if (!rings.length || !pointInRing(point, rings[0])) return false;
  return !rings.slice(1).some((ring) => pointInRing(point, ring));
}

function normalizeWinding(rings) {
  if (!rings.length) return rings;
  const origin = projectionOrigin(rings[0]);
  return rings.map((ring, index) => {
    const area = signedAreaProjected(projectRingMeters(ring, origin));
    const positive = index === 0;
    if ((positive && area < 0) || (!positive && area > 0)) return [...ring].reverse();
    return ring;
  });
}

function distinctVertexCount(ring) {
  const seen = new Set();
  for (const pt of ring.slice(0, -1)) seen.add(`${pt[0].toFixed(8)},${pt[1].toFixed(8)}`);
  return seen.size;
}

export function normalizeTerrainRegion(input = {}) {
  const source = input?.region || input;
  const geometry = source?.geometry || source;
  if (geometry?.type !== "Polygon" || !Array.isArray(geometry.coordinates)) {
    throw new Error("Terrain region geometry must be a GeoJSON-like Polygon.");
  }

  const rings = geometry.coordinates.map(closeRing).filter((ring) => ring.length > 0);
  if (!rings.length) throw new Error("Terrain region must include an outer ring.");
  const outer = rings[0];
  if (outer.length < 4) throw new Error("A terrain region needs at least three vertices and a closing coordinate.");
  if (distinctVertexCount(outer) < 3) throw new Error("A terrain region needs at least three distinct vertices.");

  for (const ring of rings) {
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) throw new Error("Terrain region rings must be closed.");
    for (const pt of ring) {
      if (![pt[0], pt[1]].every(Number.isFinite)) throw new Error("Terrain region coordinates must be finite numbers.");
      if (pt[0] < -180 || pt[0] > 180 || pt[1] < -90 || pt[1] > 90) throw new Error("Terrain region coordinates must be legal longitude/latitude values.");
    }
    if (hasSelfIntersection(ring)) throw new Error("Self-intersecting terrain regions are not supported in this phase.");
  }

  const normalizedGeometry = { type: "Polygon", coordinates: normalizeWinding(rings) };
  const bounds = boundsForGeometry(normalizedGeometry);
  if (!bounds) throw new Error("Terrain region bounds could not be calculated.");
  if (Math.abs(bounds.east - bounds.west) > 180) throw new Error("Antimeridian-crossing terrain regions are not supported in this phase.");
  const areaSquareMeters = areaSquareMetersForGeometry(normalizedGeometry);
  if (!Number.isFinite(areaSquareMeters) || areaSquareMeters <= 1) throw new Error("Terrain region area is too small or zero.");
  for (const hole of normalizedGeometry.coordinates.slice(1)) {
    if (!hole.slice(0, -1).every((pt) => pointInRing(pt, normalizedGeometry.coordinates[0]))) {
      throw new Error("Terrain region holes must lie inside the outer ring.");
    }
  }

  const origin = {
    longitude: (bounds.west + bounds.east) / 2,
    latitude: (bounds.south + bounds.north) / 2,
    elevationMeters: 0,
  };
  return {
    geometry: normalizedGeometry,
    bounds,
    areaSquareMeters,
    origin,
    vertexCount: normalizedGeometry.coordinates.reduce((sum, ring) => sum + Math.max(0, ring.length - 1), 0),
    featureId: source?.featureId || source?.sourceKmlFeatureId || input?.featureId || null,
    featureName: String(source?.featureName || input?.featureName || input?.name || "Selected Terrain Region"),
  };
}

export function sanitizeFilename(value, fallback = "terrain-region") {
  const safe = String(value || fallback)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._ -]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 96);
  return safe || fallback;
}

export function relativePathIsSafe(value) {
  const text = String(value || "").replace(/\\/g, "/");
  if (!text || text.startsWith("/") || /^[a-z][a-z0-9+.-]*:/i.test(text)) return false;
  return !text.split("/").some((part) => part === ".." || part.includes("\0"));
}
