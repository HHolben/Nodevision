// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/objectFileLoader.mjs
// This file defines browser-side object File Loader logic for the Nodevision UI. It renders interface components and handles user interactions.

import { STLLoader } from "/lib/three/STLLoader.js";
import { Box3, BufferGeometry, Float32BufferAttribute, Vector3 } from "/lib/three/three.module.js";

const NOTEBOOK_PREFIX = "/Notebook/";
const NOTEBOOK_TOKEN = "Notebook/";
const OBJECT_FILE_COLLIDER_MAX_AXIS_CELLS = 10;
const OBJECT_FILE_COLLIDER_MAX_BOXES = 96;
const OBJECT_FILE_COLLIDER_MIN_AXIS_CELLS = 3;
const OBJECT_FILE_COLLIDER_LARGE_TRIANGLE_LIMIT = 120000;
const OBJECT_FILE_COLLIDER_SAMPLE_TRIANGLE_LIMIT = 80000;
const OBJECT_FILE_COLLIDER_SURFACE_AREA_RATIO = 0.003;
const OBJECT_FILE_COLLIDER_SURFACE_THICKNESS_RATIO = 0.012;
const SUPPORTED_OBJECT_FILE_EXTENSIONS = new Set(["stl", "obj"]);
const stlLoader = new STLLoader();
const geometryCache = new Map();
const scratchVector = new Vector3();
const scratchVectorB = new Vector3();
const scratchVectorC = new Vector3();
const scratchEdgeA = new Vector3();
const scratchEdgeB = new Vector3();
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

function objectFileExtension(path = "") {
  return String(path || "").split(/[?#]/)[0].split(".").pop()?.toLowerCase() || "";
}

async function fetchObjectFilePayload(normalizedPath, expectedExtension) {
  if (!normalizedPath) throw new Error("Missing path for object-file model.");
  const url = buildNotebookUrl(normalizedPath);
  if (!url) throw new Error("Unable to resolve object-file URL.");
  const cacheKey = expectedExtension + ":" + url;
  if (geometryCache.has(cacheKey)) return geometryCache.get(cacheKey);

  const promise = (async () => {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to fetch ${expectedExtension.toUpperCase()} (${res.status})`);
    const data = await res.arrayBuffer();
    if (!data || data.byteLength === 0) throw new Error(`Empty ${expectedExtension.toUpperCase()} payload.`);
    return data;
  })().catch((err) => {
    geometryCache.delete(cacheKey);
    throw err;
  });

  geometryCache.set(cacheKey, promise);
  return promise;
}

async function loadStlGeometry(normalizedPath) {
  const data = await fetchObjectFilePayload(normalizedPath, "stl");
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
}

function parseObjVertexIndex(rawToken, vertexCount) {
  const raw = String(rawToken || "").split("/")[0];
  const n = Number.parseInt(raw, 10);
  if (!Number.isInteger(n) || n === 0) return null;
  const index = n < 0 ? vertexCount + n : n - 1;
  return index >= 0 && index < vertexCount ? index : null;
}

function parseObjGeometry(source = "") {
  const vertices = [];
  const triangles = [];
  const normalized = String(source || "").replace(/\\\r?\n/g, " ");
  normalized.split(/\r?\n/).forEach((line) => {
    const clean = line.split("#")[0].trim();
    if (!clean) return;
    const [kind, ...values] = clean.split(/\s+/);
    if (kind === "v") {
      const point = values.slice(0, 3).map((value) => Number(value));
      if (point.length === 3 && point.every(Number.isFinite)) vertices.push(point);
      return;
    }
    if (kind !== "f") return;
    const face = values.map((value) => parseObjVertexIndex(value, vertices.length)).filter(Number.isInteger);
    if (face.length < 3) return;
    for (let i = 1; i < face.length - 1; i += 1) {
      triangles.push(face[0], face[i], face[i + 1]);
    }
  });

  if (!triangles.length) return null;
  const positions = [];
  triangles.forEach((index) => {
    const vertex = vertices[index];
    if (!vertex) return;
    positions.push(vertex[0], vertex[1], vertex[2]);
  });
  if (positions.length < 9) return null;

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals?.();
  geometry.computeBoundingBox?.();
  return geometry;
}

async function loadObjGeometry(normalizedPath) {
  const data = await fetchObjectFilePayload(normalizedPath, "obj");
  const text = new TextDecoder("utf-8").decode(data);
  const geometry = parseObjGeometry(text);
  if (!geometry) throw new Error("OBJ file does not contain triangle faces that can be loaded.");
  return geometry;
}

async function loadObjectFileGeometry(normalizedPath, extension) {
  if (extension === "stl") return loadStlGeometry(normalizedPath);
  if (extension === "obj") return loadObjGeometry(normalizedPath);
  return null;
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

function readGeometryTriangle(geometry, attr, triangleIndex, outA, outB, outC) {
  const base = triangleIndex * 3;
  readGeometryVertex(geometry, attr, base, outA);
  readGeometryVertex(geometry, attr, base + 1, outB);
  readGeometryVertex(geometry, attr, base + 2, outC);
}

function triangleArea(a, b, c) {
  scratchEdgeA.subVectors(b, a);
  scratchEdgeB.subVectors(c, a);
  return scratchEdgeA.cross(scratchEdgeB).length() * 0.5;
}

function colliderSurfaceAreaThreshold(bounds) {
  bounds.getSize(scratchSize);
  const area = 2 * ((scratchSize.x * scratchSize.y) + (scratchSize.x * scratchSize.z) + (scratchSize.y * scratchSize.z));
  return Math.max(1e-8, Math.abs(area) * OBJECT_FILE_COLLIDER_SURFACE_AREA_RATIO);
}

function colliderSurfaceThickness(bounds) {
  bounds.getSize(scratchSize);
  const maxSize = Math.max(scratchSize.x, scratchSize.y, scratchSize.z, 0.0001);
  return Math.max(1e-5, maxSize * OBJECT_FILE_COLLIDER_SURFACE_THICKNESS_RATIO);
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

function buildLargeSurfaceColliderBoxesForGeometry(geometry, bounds, triangleCount) {
  const attr = geometry?.getAttribute?.("position");
  if (!attr || attr.count < 3 || triangleCount <= 0) return { boxes: [], strategy: "surface", minSurfaceArea: 0 };
  if (triangleCount > OBJECT_FILE_COLLIDER_LARGE_TRIANGLE_LIMIT) return { boxes: [], strategy: "surface-skipped-large-mesh", minSurfaceArea: 0 };

  const minSurfaceArea = colliderSurfaceAreaThreshold(bounds);
  const thickness = colliderSurfaceThickness(bounds);
  const boxes = [];
  const triangles = [];
  for (let tri = 0; tri < triangleCount; tri += 1) {
    readGeometryTriangle(geometry, attr, tri, scratchVector, scratchVectorB, scratchVectorC);
    if (triangleArea(scratchVector, scratchVectorB, scratchVectorC) < minSurfaceArea) continue;
    const triangle = [scratchVector.clone(), scratchVectorB.clone(), scratchVectorC.clone()];
    const box = new Box3().setFromPoints(triangle);
    box.expandByScalar(thickness * 0.5);
    boxes.push(box);
    triangles.push(triangle);
    if (boxes.length > OBJECT_FILE_COLLIDER_MAX_BOXES) {
      return { boxes: [], triangles: [], strategy: "surface-too-detailed", minSurfaceArea };
    }
  }
  return { boxes, triangles, strategy: "surface", minSurfaceArea };
}

function buildVoxelColliderBoxesForGeometry(geometry, bounds, triangleCount) {
  const attr = geometry?.getAttribute?.("position");
  if (!attr || attr.count < 3) return [];
  const largeMesh = triangleCount > OBJECT_FILE_COLLIDER_LARGE_TRIANGLE_LIMIT;
  const startAxisCells = largeMesh ? 6 : OBJECT_FILE_COLLIDER_MAX_AXIS_CELLS;
  const sampleStride = largeMesh
    ? Math.max(1, Math.ceil(triangleCount / OBJECT_FILE_COLLIDER_SAMPLE_TRIANGLE_LIMIT))
    : 1;

  for (let maxAxisCells = startAxisCells; maxAxisCells >= OBJECT_FILE_COLLIDER_MIN_AXIS_CELLS; maxAxisCells -= 1) {
    const dims = chooseColliderGridDimensions(bounds, maxAxisCells);
    const occupied = new Uint8Array(dims.x * dims.y * dims.z);

    for (let tri = 0; tri < triangleCount; tri += sampleStride) {
      readGeometryTriangle(geometry, attr, tri, scratchVector, scratchVectorB, scratchVectorC);
      scratchMin.copy(scratchVector).min(scratchVectorB).min(scratchVectorC);
      scratchMax.copy(scratchVector).max(scratchVectorB).max(scratchVectorC);
      markTriangleCells(occupied, dims, bounds, scratchMin, scratchMax);
    }

    const boxes = buildOccupiedColliderBoxes(bounds, dims, occupied);
    if (boxes.length <= OBJECT_FILE_COLLIDER_MAX_BOXES || maxAxisCells === OBJECT_FILE_COLLIDER_MIN_AXIS_CELLS) {
      return boxes.length > 0 ? boxes : [bounds.clone()];
    }
  }

  return [bounds.clone()];
}

function buildColliderBoxesForGeometry(geometry) {
  const attr = geometry?.getAttribute?.("position");
  if (!attr || attr.count < 3) return { boxes: [], strategy: "none", minSurfaceArea: 0 };
  if (!geometry.boundingBox && geometry.computeBoundingBox) geometry.computeBoundingBox();
  const bounds = geometry.boundingBox?.clone?.();
  if (!bounds || bounds.isEmpty()) return { boxes: [], strategy: "none", minSurfaceArea: 0 };

  const triangleCount = geometry.index?.array
    ? Math.floor(geometry.index.array.length / 3)
    : Math.floor(attr.count / 3);
  const surface = buildLargeSurfaceColliderBoxesForGeometry(geometry, bounds, triangleCount);
  if (surface.boxes.length > 0) return surface;

  return {
    boxes: buildVoxelColliderBoxesForGeometry(geometry, bounds, triangleCount),
    triangles: [],
    strategy: surface.strategy === "surface-too-detailed" ? "voxel-after-surface-limit" : "voxel",
    minSurfaceArea: surface.minSurfaceArea || colliderSurfaceAreaThreshold(bounds)
  };
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
  if (Array.isArray(ref.localTriangles) && ref.localTriangles.length) {
    if (!Array.isArray(ref.worldTriangles)) ref.worldTriangles = [];
    ref.worldTriangles.length = 0;
    ref.localTriangles.forEach((triangle) => {
      ref.worldTriangles.push(triangle.map((point) => {
        scratchWorldPoint.copy(point);
        target.localToWorld(scratchWorldPoint);
        return scratchWorldPoint.clone();
      }));
    });
  }
  return ref;
}

function configureCompoundColliderRef(mesh, colliderRef, localBoxes, sourceFormat = "object-file", colliderStats = {}) {
  if (!mesh || !colliderRef || !Array.isArray(localBoxes) || localBoxes.length === 0) return null;
  delete colliderRef.center;
  delete colliderRef.radius;
  delete colliderRef.half;
  colliderRef.type = "compound";
  colliderRef.source = "object-file";
  colliderRef.sourceFormat = sourceFormat;
  colliderRef.colliderStrategy = colliderStats.strategy || "compound";
  colliderRef.minSurfaceArea = Number.isFinite(colliderStats.minSurfaceArea) ? colliderStats.minSurfaceArea : 0;
  colliderRef.target = mesh;
  colliderRef.boxes = localBoxes.map((localBox) => ({
    localBox: localBox.clone(),
    box: new Box3()
  }));
  colliderRef.localTriangles = Array.isArray(colliderStats.triangles)
    ? colliderStats.triangles.map((triangle) => triangle.map((point) => point.clone()))
    : [];
  colliderRef.worldTriangles = [];
  colliderRef.lowPolyMesh = {
    type: colliderRef.localTriangles.length ? "triangle-surface" : "compound-boxes",
    triangleCount: colliderRef.localTriangles.length,
    boxCount: localBoxes.length
  };
  colliderRef.update = () => updateCompoundColliderRef(colliderRef);
  return updateCompoundColliderRef(colliderRef);
}

export async function applyObjectFileGeometry(mesh) {
  if (!mesh?.userData?.objectFilePath) return null;
  const objectPath = mesh.userData.objectFilePath;
  console.debug("[ObjectFileLoader] applying geometry for", objectPath);
  const extension = objectFileExtension(objectPath);
  if (!SUPPORTED_OBJECT_FILE_EXTENSIONS.has(extension)) return null;
  const normalized = normalizeNotebookPath(objectPath);
  if (!normalized) return null;
  let geometry;
  try {
    geometry = await loadObjectFileGeometry(normalized, extension);
  } catch (err) {
    console.warn(`${extension.toUpperCase()} geometry load failed:`, err);
    return null;
  }
  if (!geometry) {
    // Already logged in loader; avoid spamming repeated parse errors.
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
  let colliderBuild = { boxes: resultBounds ? [resultBounds.clone()] : [], triangles: [], strategy: "bounds", minSurfaceArea: 0 };
  try {
    const generated = buildColliderBoxesForGeometry(clone);
    if (generated.boxes.length > 0) colliderBuild = generated;
  } catch (err) {
    console.warn(`${extension.toUpperCase()} collider generation failed; using bounding collider fallback.`, err);
  }
  mesh.geometry.dispose?.();
  mesh.geometry = clone;
  mesh.position.y += halfHeight - placeholderHalf;
  mesh.userData.placeholderHalfHeight = halfHeight;
  mesh.userData.objectFileNormalizedPath = normalized;
  mesh.userData.objectFileUrl = buildNotebookUrl(normalized);
  mesh.userData.objectFileExtension = extension;
  mesh.userData.objectFileColliderShape = "compound-surface";
  mesh.userData.objectFileUseBoundsPicking = true;
  mesh.userData.objectFileColliderBoxCount = colliderBuild.boxes.length;
  mesh.userData.objectFileColliderTriangleCount = Array.isArray(colliderBuild.triangles) ? colliderBuild.triangles.length : 0;
  mesh.userData.objectFileColliderStrategy = colliderBuild.strategy;
  mesh.userData.objectFileColliderMinSurfaceArea = colliderBuild.minSurfaceArea;
  mesh.userData.objectFileColliderFactory = (colliderRef) => configureCompoundColliderRef(mesh, colliderRef, colliderBuild.boxes, extension, colliderBuild);
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
