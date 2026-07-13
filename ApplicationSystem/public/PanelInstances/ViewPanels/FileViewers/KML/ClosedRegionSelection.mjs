// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/KML/ClosedRegionSelection.mjs
// Closed KML path and polygon region detection for terrain export workflows.

import { parseCoordinates } from "./KMLParser.mjs";

const EARTH_RADIUS_METERS = 6371008.8;
const DEFAULT_CLOSE_TOLERANCE_METERS = 3;
const EPSILON = 1e-10;

function localName(node) {
  return node?.localName || node?.nodeName || "";
}

function elementChildren(node) {
  return Array.from(node?.childNodes || []).filter((child) => child.nodeType === 1);
}

function firstDescendant(node, name) {
  if (!node) return null;
  const queue = [...elementChildren(node)];
  while (queue.length) {
    const current = queue.shift();
    if (localName(current) === name) return current;
    queue.push(...elementChildren(current));
  }
  return null;
}

function descendants(node, name) {
  const out = [];
  const queue = [...elementChildren(node)];
  while (queue.length) {
    const current = queue.shift();
    if (localName(current) === name) out.push(current);
    queue.push(...elementChildren(current));
  }
  return out;
}

function finiteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function coordinateTuple(coord) {
  const lon = finiteNumber(coord?.lon ?? coord?.[0]);
  const lat = finiteNumber(coord?.lat ?? coord?.[1]);
  const altRaw = coord?.alt ?? coord?.[2];
  const alt = finiteNumber(altRaw);
  if (lon === null || lat === null) return null;
  return alt === null ? [lon, lat] : [lon, lat, alt];
}

function coordsToTupleRing(coords = []) {
  return coords.map(coordinateTuple).filter(Boolean);
}

function tupleToCoord(tuple) {
  return { lon: tuple[0], lat: tuple[1], alt: Number.isFinite(tuple[2]) ? tuple[2] : null };
}

function haversineMeters(a, b) {
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLon = ((b[0] - a[0]) * Math.PI) / 180;
  const lat1 = (a[1] * Math.PI) / 180;
  const lat2 = (b[1] * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

function sameLngLat(a, b, toleranceMeters = DEFAULT_CLOSE_TOLERANCE_METERS) {
  if (!a || !b) return false;
  return haversineMeters(a, b) <= toleranceMeters;
}

function ensureClosedRing(ring, toleranceMeters = DEFAULT_CLOSE_TOLERANCE_METERS) {
  const clean = (ring || []).filter((pt) => Array.isArray(pt) && Number.isFinite(pt[0]) && Number.isFinite(pt[1]));
  if (clean.length < 2) return clean;
  const first = clean[0];
  const last = clean[clean.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) return clean;
  if (sameLngLat(first, last, toleranceMeters)) return [...clean.slice(0, -1), [...first]];
  return clean;
}

function distinctVertexCount(ring) {
  const seen = new Set();
  ring.slice(0, -1).forEach((pt) => {
    seen.add(`${pt[0].toFixed(8)},${pt[1].toFixed(8)}`);
  });
  return seen.size;
}

export function boundsForGeometry(geometry) {
  const points = (geometry?.coordinates || []).flatMap((ring) => ring || []);
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  points.forEach((pt) => {
    west = Math.min(west, pt[0]);
    east = Math.max(east, pt[0]);
    south = Math.min(south, pt[1]);
    north = Math.max(north, pt[1]);
  });
  if (![west, south, east, north].every(Number.isFinite)) return null;
  return { west, south, east, north };
}

function projectionOrigin(outerRing) {
  const unique = outerRing.slice(0, -1);
  const totals = unique.reduce((acc, pt) => {
    acc.lon += pt[0];
    acc.lat += pt[1];
    return acc;
  }, { lon: 0, lat: 0 });
  const count = Math.max(1, unique.length);
  return { lon: totals.lon / count, lat: totals.lat / count };
}

function projectRingMeters(ring, origin) {
  const lat0 = (origin.lat * Math.PI) / 180;
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
  const outerArea = Math.abs(signedAreaProjected(projectRingMeters(rings[0], origin)));
  const holesArea = rings.slice(1).reduce((sum, ring) => sum + Math.abs(signedAreaProjected(projectRingMeters(ring, origin))), 0);
  return Math.max(0, outerArea - holesArea);
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
    const a1 = ring[i];
    const a2 = ring[i + 1];
    for (let j = i + 1; j < ring.length - 1; j += 1) {
      if (Math.abs(i - j) <= 1) continue;
      if (i === 0 && j === ring.length - 2) continue;
      if (segmentsIntersect(a1, a2, ring[j], ring[j + 1])) return true;
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
  return !rings.slice(1).some((hole) => pointInRing(point, hole));
}

function normalizeWinding(rings) {
  if (!rings.length) return rings;
  const origin = projectionOrigin(rings[0]);
  return rings.map((ring, index) => {
    const area = signedAreaProjected(projectRingMeters(ring, origin));
    const shouldBePositive = index === 0;
    if ((shouldBePositive && area < 0) || (!shouldBePositive && area > 0)) return [...ring].reverse();
    return ring;
  });
}

function validateRings(rings, options = {}) {
  if (!Array.isArray(rings) || !rings.length) return { valid: false, reason: "No closed region geometry was found." };
  const toleranceMeters = Number(options.closeToleranceMeters) || DEFAULT_CLOSE_TOLERANCE_METERS;
  const closed = rings.map((ring) => ensureClosedRing(ring, toleranceMeters));
  const outer = closed[0] || [];
  if (outer.length < 4) return { valid: false, reason: "A region needs at least three vertices and a closing coordinate." };
  const first = outer[0];
  const last = outer[outer.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) return { valid: false, reason: "This path is not closed. Close the path to select its enclosed region." };
  if (distinctVertexCount(outer) < 3) return { valid: false, reason: "A region needs at least three distinct vertices." };

  for (const ring of closed) {
    for (const pt of ring) {
      if (!Number.isFinite(pt[0]) || !Number.isFinite(pt[1])) return { valid: false, reason: "Region coordinates must be finite numbers." };
      if (pt[1] < -90 || pt[1] > 90 || pt[0] < -180 || pt[0] > 180) return { valid: false, reason: "Region coordinates must be legal longitude/latitude values." };
    }
    if (hasSelfIntersection(ring)) return { valid: false, reason: "Self-intersecting regions are not supported in this phase." };
  }

  const bounds = boundsForGeometry({ type: "Polygon", coordinates: closed });
  if (!bounds) return { valid: false, reason: "Region bounds could not be calculated." };
  if (Math.abs(bounds.east - bounds.west) > 180) return { valid: false, reason: "Antimeridian-crossing regions are not supported in this phase." };

  const geometry = { type: "Polygon", coordinates: normalizeWinding(closed) };
  const areaSquareMeters = areaSquareMetersForGeometry(geometry);
  if (!Number.isFinite(areaSquareMeters) || areaSquareMeters <= 1) return { valid: false, reason: "Region area is too small or zero." };

  for (const hole of geometry.coordinates.slice(1)) {
    if (!hole.slice(0, -1).every((pt) => pointInRing(pt, geometry.coordinates[0]))) {
      return { valid: false, reason: "Polygon holes must lie inside the outer boundary." };
    }
  }

  return { valid: true, geometry, bounds: boundsForGeometry(geometry), areaSquareMeters };
}

function polygonRingsFromGeometryNode(geometryNode) {
  if (!geometryNode || localName(geometryNode) !== "Polygon") return [];
  const outerBoundary = firstDescendant(geometryNode, "outerBoundaryIs") || geometryNode;
  const outerCoordinates = firstDescendant(outerBoundary, "coordinates")?.textContent || "";
  const outer = coordsToTupleRing(parseCoordinates(outerCoordinates));
  const holes = descendants(geometryNode, "innerBoundaryIs")
    .map((node) => coordsToTupleRing(parseCoordinates(firstDescendant(node, "coordinates")?.textContent || "")))
    .filter((ring) => ring.length > 0);
  return [outer, ...holes].filter((ring) => ring.length > 0);
}

export function getClosedRegionCandidate(record, options = {}) {
  if (!record?.geometry) return { valid: false, reason: "Select a KML polygon or closed path first." };
  const geometryType = record.geometry.type;
  let rings = [];
  if (geometryType === "Polygon") {
    rings = polygonRingsFromGeometryNode(record.geometry.node);
    if (!rings.length) rings = [coordsToTupleRing(record.geometry.coordinates || [])];
  } else if (geometryType === "LinearRing" || geometryType === "LineString") {
    rings = [coordsToTupleRing(record.geometry.coordinates || [])];
  } else {
    return { valid: false, reason: "Only KML Polygon, LinearRing, or closed LineString features can define terrain regions." };
  }

  const validation = validateRings(rings, options);
  if (!validation.valid) return validation;
  const vertexCount = validation.geometry.coordinates.reduce((sum, ring) => sum + Math.max(0, ring.length - 1), 0);
  return {
    valid: true,
    region: {
      type: "nodevision-kml-closed-region",
      recordId: record.id || null,
      featureName: record.name || "Selected KML Region",
      sourceKmlFeatureType: geometryType,
      geometry: validation.geometry,
      bounds: validation.bounds,
      areaSquareMeters: validation.areaSquareMeters,
      vertexCount,
      altitudePreserved: validation.geometry.coordinates.some((ring) => ring.some((pt) => Number.isFinite(pt[2]))),
    },
  };
}

export function formatArea(areaSquareMeters) {
  const area = Number(areaSquareMeters);
  if (!Number.isFinite(area)) return "unknown area";
  if (area >= 1000000) return `${(area / 1000000).toFixed(area >= 10000000 ? 1 : 2)} sq km`;
  return `${Math.round(area).toLocaleString()} sq m`;
}

export function formatBounds(bounds) {
  if (!bounds) return "unknown bounds";
  return `W ${bounds.west.toFixed(5)}, S ${bounds.south.toFixed(5)}, E ${bounds.east.toFixed(5)}, N ${bounds.north.toFixed(5)}`;
}
