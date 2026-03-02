// Nodevision/public/PanelInstances/ViewPanels/GameViewDependencies/objectFileLoader.mjs
// Helper utilities for loading audience-stored object files (STL, etc.) while keeping cache and placement helpers centralized.

import { STLLoader } from "/lib/three/STLLoader.js";
import { Box3, Vector3 } from "/lib/three/three.module.js";

const NOTEBOOK_PREFIX = "/Notebook/";
const NOTEBOOK_TOKEN = "Notebook/";
const stlLoader = new STLLoader();
const geometryCache = new Map();
const scratchVector = new Vector3();
const scratchBox = new Box3();

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
          throw fallbackErr;
        }
      } else {
        throw err;
      }
    }
    if (!geometry) throw new Error("STL loader returned no geometry.");
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
  mesh.geometry.dispose?.();
  mesh.geometry = clone;
  mesh.position.y += halfHeight - placeholderHalf;
  mesh.userData.placeholderHalfHeight = halfHeight;
  mesh.userData.objectFileNormalizedPath = normalized;
  mesh.userData.objectFileUrl = buildNotebookUrl(normalized);
  return clone;
}

export function resolveNotebookUrl(rawPath) {
  const normalized = normalizeNotebookPath(rawPath);
  if (!normalized) return "";
  return buildNotebookUrl(normalized);
}
