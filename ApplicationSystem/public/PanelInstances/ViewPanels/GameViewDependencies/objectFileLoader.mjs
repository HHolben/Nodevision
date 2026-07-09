// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/objectFileLoader.mjs
// This file defines browser-side object File Loader logic for the Nodevision UI. It renders interface components and handles user interactions.

import { STLLoader } from "/lib/three/STLLoader.js";
import { Box3, Vector3 } from "/lib/three/three.module.js";

const NOTEBOOK_PREFIX = "/Notebook/";
const NOTEBOOK_TOKEN = "Notebook/";
const STL_COLLIDER_MAX_AXIS_CELLS = 10;
const STL_COLLIDER_MAX_BOXES = 96;
const STL_COLLIDER_MIN_AXIS_CELLS = 3;
const STL_COLLIDER_LARGE_TRIANGLE_LIMIT = 120000;
const STL_COLLIDER_SAMPLE_TRIANGLE_LIMIT = 80000;
const stlLoader = new STLLoader();
const geometryCache = new Map();
const scratchVector = new Vector3();
const scratchBox = new Box3();
const scratchSize = new Vector3();
const scratchMin = new Vector3();
const scratchMax = new Vector3();
const scratchWorldPoint = new Vector3();

function normalizeNotebookPath(rawPath) {
  const candidate = String(rawPath || "").trim().replace(/\\/g, "/").replace(/^\/+/, "");
  const markerIndex = candidate.indexOf(NOTEBOOK_TOKEN);
  if (markerIndex !== -1) {
    return candidate.slice(markerIndex + NOTEBOOK_TOKEN.length);
  }
  return candidate.startsWith("./")
    ? candidate.slice(2)
    : candidate;
}

function buildNotebookUrl(normalizedPath) {
  if (!normalizedPath) return "";
  const segments = normalizedPath.split("/").filter(Boolean).map((segment) => encodeURIComponent(segment));
  if (segments.length === 0) return NOTEBOOK_PREFIX.slice(0, -1);
  return `${NOTEBOOK_PREFIX}${segments.join("/")}`;
}

async function loadStlGeometry(normalizedPath) {
  if (!normalizedPath) throw new Error("Missing path for STL model.");
  const url = buildNotebookUrl(normalizedPath);
  if (!url) throw new Error("Unable to resolve STL URL.");
  if (geometryCache.has(url)) return geometryCache.get(url);

  const promise = (async () => {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to fetch STL (${res.status})`);
    const data = await res.arrayBuffer();
    if (!data || data.byteLength === 0) throw new Error("Empty STL payload.");
    let geometry;
    try {
      geometry = stlLoader.parse(data);
    } catch (err) {
      if (err instanceof RangeError) {
        try {
          const text = new TextDecoder("utf-8").decode(data);
          geometry = stlLoader.parse(text);
        } catch (fallbackErr) {
          console.warn("STL parse failed after RangeError; returning no geometry to avoid repeat errors.", fallbackErr);
          return null;
        }
      } else {
        throw err;
      }
    }
    if (!geometry) return null;
    if (geometry.computeBoundingBox) geometry.computeBoundingBox();
    if (geometry.computeVertexNormals) geometry.computeVertexNormals();
    return geometry;
  })().catch((err) => {
    geometryCache.delete(url);
    throw err;
  });

  geometryCache.set(url, promise);
  return promise;
}


function clampCellIndex(value, max) {
  return Math.max(0, Math.min(max - 1, value));
}

function chooseColliderGridDimensions(bounds, maxAxisCells) {
  bounds.getSize(scratchSize);
  const maxSize = Math.max(scratchSize.x, scratchSize.y, scratchSize.z, 0.0001);
  const makeDim = (value) => Math.max(1, Math.min(maxAxisCells, Math.round((value / maxSize) * maxAxisCells)));
  return {
    x: makeDim(scratchSize.x),
    y: makeDim(scratchSize.y),
    z: makeDim(scratchSize.z)
  };
}

function cellKey(x, y, z, dims) {
  return x + dims.x * (y + dims.y * z);
}

function readGeometryVertex(geometry, attr, vertexIndex, out) {
  const index = geometry.index?.array ? geometry.index.array[vertexIndex] : vertexIndex;
  return out.set(attr.getX(index), attr.getY(index), attr.getZ(index));
}

function markTriangleCells(occupied, dims, bounds, triMin, triMax) {
  bounds.getSize(scratchSize);
  const toX = (value) => clampCellIndex(Math.floor(((value - bounds.min.x) / (scratchSize.x || 1)) * dims.x), dims.x);
  const toY = (value) => clampCellIndex(Math.floor(((value - bounds.min.y) / (scratchSize.y || 1)) * dims.y), dims.y);
  const toZ = (value) => clampCellIndex(Math.floor(((value - bounds.min.z) / (scratchSize.z || 1)) * dims.z), dims.z);
  const minX = toX(triMin.x);
  const minY = toY(triMin.y);
  const minZ = toZ(triMin.z);
  const maxX = toX(triMax.x);
  const maxY = toY(triMax.y);
  const maxZ = toZ(triMax.z);
  for (let z = minZ; z <= maxZ; z += 1) {
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        occupied[cellKey(x, y, z, dims)] = 1;
      }
    }
  }
}

function buildOccupiedColliderBoxes(bounds, dims, occupied) {
  const total = dims.x * dims.y * dims.z;
  const visited = new Uint8Array(total);
  const boxes = [];
  bounds.getSize(scratchSize);

  const isOpen = (x, y, z) => {
    const key = cellKey(x, y, z, dims);
    return occupied[key] === 1 && visited[key] !== 1;
  };

  const rangeIsOpen = (x0, x1, y0, y1, z0, z1) => {
    for (let z = z0; z <= z1; z += 1) {
      for (let y = y0; y <= y1; y += 1) {
        for (let x = x0; x <= x1; x += 1) {
          if (!isOpen(x, y, z)) return false;
        }
      }
    }
    return true;
  };

  for (let z = 0; z < dims.z; z += 1) {
    for (let y = 0; y < dims.y; y += 1) {
      for (let x = 0; x < dims.x; x += 1) {
        if (!isOpen(x, y, z)) continue;
        let xEnd = x;
        while (xEnd + 1 < dims.x && rangeIsOpen(x, xEnd + 1, y, y, z, z)) xEnd += 1;
        let yEnd = y;
        while (yEnd + 1 < dims.y && rangeIsOpen(x, xEnd, y, yEnd + 1, z, z)) yEnd += 1;
        let zEnd = z;
        while (zEnd + 1 < dims.z && rangeIsOpen(x, xEnd, y, yEnd, z, zEnd + 1)) zEnd += 1;

        for (let zz = z; zz <= zEnd; zz += 1) {
          for (let yy = y; yy <= yEnd; yy += 1) {
            for (let xx = x; xx <= xEnd; xx += 1) {
              visited[cellKey(xx, yy, zz, dims)] = 1;
            }
          }
        }

        const min = new Vector3(
          bounds.min.x + (x / dims.x) * scratchSize.x,
          bounds.min.y + (y / dims.y) * scratchSize.y,
          bounds.min.z + (z / dims.z) * scratchSize.z
        );
        const max = new Vector3(
          bounds.min.x + ((xEnd + 1) / dims.x) * scratchSize.x,
          bounds.min.y + ((yEnd + 1) / dims.y) * scratchSize.y,
          bounds.min.z + ((zEnd + 1) / dims.z) * scratchSize.z
        );
        boxes.push(new Box3(min, max));
      }
    }
  }

  return boxes;
}

function buildColliderBoxesForGeometry(geometry) {
  const attr = geometry?.getAttribute?.("position");
  if (!attr || attr.count < 3) return [];
  if (!geometry.boundingBox && geometry.computeBoundingBox) geometry.computeBoundingBox();
  const bounds = geometry.boundingBox?.clone?.();
  if (!bounds || bounds.isEmpty()) return [];

  const triangleCount = geometry.index?.array
    ? Math.floor(geometry.index.array.length / 3)
    : Math.floor(attr.count / 3);
  const largeMesh = triangleCount > STL_COLLIDER_LARGE_TRIANGLE_LIMIT;
  const startAxisCells = largeMesh ? 6 : STL_COLLIDER_MAX_AXIS_CELLS;
  const sampleStride = largeMesh
    ? Math.max(1, Math.ceil(triangleCount / STL_COLLIDER_SAMPLE_TRIANGLE_LIMIT))
    : 1;

  for (let maxAxisCells = startAxisCells; maxAxisCells >= STL_COLLIDER_MIN_AXIS_CELLS; maxAxisCells -= 1) {
    const dims = chooseColliderGridDimensions(bounds, maxAxisCells);
    const occupied = new Uint8Array(dims.x * dims.y * dims.z);

    for (let tri = 0; tri < triangleCount; tri += sampleStride) {
      const base = tri * 3;
      readGeometryVertex(geometry, attr, base, scratchVector);
      scratchMin.copy(scratchVector);
      scratchMax.copy(scratchVector);
      readGeometryVertex(geometry, attr, base + 1, scratchVector);
      scratchMin.min(scratchVector);
      scratchMax.max(scratchVector);
      readGeometryVertex(geometry, attr, base + 2, scratchVector);
      scratchMin.min(scratchVector);
      scratchMax.max(scratchVector);
      markTriangleCells(occupied, dims, bounds, scratchMin, scratchMax);
    }

    const boxes = buildOccupiedColliderBoxes(bounds, dims, occupied);
    if (boxes.length <= STL_COLLIDER_MAX_BOXES || maxAxisCells === STL_COLLIDER_MIN_AXIS_CELLS) {
      return boxes.length > 0 ? boxes : [bounds];
    }
  }

  return [bounds];
}

function updateWorldBoxFromLocalBox(mesh, localBox, worldBox) {
  worldBox.makeEmpty();
  const min = localBox.min;
  const max = localBox.max;
  const corners = [
    [min.x, min.y, min.z],
    [min.x, min.y, max.z],
    [min.x, max.y, min.z],
    [min.x, max.y, max.z],
    [max.x, min.y, min.z],
    [max.x, min.y, max.z],
    [max.x, max.y, min.z],
    [max.x, max.y, max.z]
  ];
  for (const [x, y, z] of corners) {
    scratchWorldPoint.set(x, y, z);
    mesh.localToWorld(scratchWorldPoint);
    worldBox.expandByPoint(scratchWorldPoint);
  }
}

function updateCompoundColliderRef(ref) {
  const target = ref?.target;
  if (!target) return ref;
  target.updateMatrixWorld?.(true);
  if (!Array.isArray(ref.boxes)) ref.boxes = [];
  if (!ref.box) ref.box = new Box3();
  ref.box.makeEmpty();
  for (const part of ref.boxes) {
    if (!part?.localBox) continue;
    if (!part.box) part.box = new Box3();
    updateWorldBoxFromLocalBox(target, part.localBox, part.box);
    ref.box.union(part.box);
  }
  return ref;
}

function configureCompoundColliderRef(mesh, colliderRef, localBoxes) {
  if (!mesh || !colliderRef || !Array.isArray(localBoxes) || localBoxes.length === 0) return null;
  delete colliderRef.center;
  delete colliderRef.radius;
  colliderRef.type = "compound";
  colliderRef.source = "stl";
  colliderRef.target = mesh;
  colliderRef.boxes = localBoxes.map((localBox) => ({
    localBox: localBox.clone(),
    box: new Box3()
  }));
  colliderRef.update = () => updateCompoundColliderRef(colliderRef);
  return updateCompoundColliderRef(colliderRef);
}

export async function applyObjectFileGeometry(mesh) {
  if (!mesh?.userData?.objectFilePath) return null;
  const objectPath = mesh.userData.objectFilePath;
  console.debug("[ObjectFileLoader] applying geometry for", objectPath);
  const extension = String(objectPath).split(".").pop()?.toLowerCase() || "";
  if (extension !== "stl") return null;
  const normalized = normalizeNotebookPath(objectPath);
  if (!normalized) return null;
  let geometry;
  try {
    geometry = await loadStlGeometry(normalized);
  } catch (err) {
    console.warn("STL geometry load failed:", err);
    return null;
  }
  if (!geometry) {
    // Already logged in loader; avoid spamming repeated RangeErrors.
    return null;
  }

  const clone = geometry.clone();
  if (clone.computeBoundingBox) clone.computeBoundingBox();
  const bounds = clone.boundingBox ? clone.boundingBox.clone() : scratchBox.setFromCenterAndSize(new Vector3(), new Vector3(1, 1, 1));
  if (bounds) {
    bounds.getCenter(scratchVector);
    clone.translate(-scratchVector.x, -scratchVector.y, -scratchVector.z);
    if (clone.computeBoundingBox) clone.computeBoundingBox();
  }

  const resultBounds = clone.boundingBox || bounds;
  const halfHeight = resultBounds ? (resultBounds.max.y - resultBounds.min.y) * 0.5 : 0;
  const placeholderHalf = Number(mesh.userData.placeholderHalfHeight ?? 0.5);
  let localColliderBoxes = resultBounds ? [resultBounds.clone()] : [];
  try {
    const generatedBoxes = buildColliderBoxesForGeometry(clone);
    if (generatedBoxes.length > 0) localColliderBoxes = generatedBoxes;
  } catch (err) {
    console.warn("STL collider generation failed; using bounding collider fallback.", err);
  }
  mesh.geometry.dispose?.();
  mesh.geometry = clone;
  mesh.position.y += halfHeight - placeholderHalf;
  mesh.userData.placeholderHalfHeight = halfHeight;
  mesh.userData.objectFileNormalizedPath = normalized;
  mesh.userData.objectFileUrl = buildNotebookUrl(normalized);
  mesh.userData.objectFileColliderShape = "compound";
  mesh.userData.objectFileUseBoundsPicking = true;
  mesh.userData.objectFileColliderBoxCount = localColliderBoxes.length;
  mesh.userData.objectFileColliderFactory = (colliderRef) => configureCompoundColliderRef(mesh, colliderRef, localColliderBoxes);
  if (mesh.userData.colliderRef) {
    mesh.userData.objectFileColliderFactory(mesh.userData.colliderRef);
  }
  return clone;
}

export function resolveNotebookUrl(rawPath) {
  const normalized = normalizeNotebookPath(rawPath);
  if (!normalized) return "";
  return buildNotebookUrl(normalized);
}
