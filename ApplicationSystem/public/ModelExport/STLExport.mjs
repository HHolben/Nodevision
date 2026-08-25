// Nodevision/ApplicationSystem/public/ModelExport/STLExport.mjs
// Shared STL download helpers for browser-side 3D editors and viewers.

import * as THREE from "/lib/three/three.module.js";
import { STLLoader } from "/lib/three/STLLoader.js";

function cleanNotebookPath(pathValue = "") {
  return String(pathValue || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/[?#].*$/, "")
    .replace(/^\/+/, "")
    .replace(/^Notebook\/+/i, "");
}

function stlFileName(pathValue = "", fallback = "model.stl") {
  const base = cleanNotebookPath(pathValue).split("/").filter(Boolean).pop() || fallback;
  const withoutExt = base.replace(/\.[^.]*$/, "") || base;
  const safe = withoutExt.replace(/[^A-Za-z0-9_.-]+/g, "_") || "model";
  return safe.toLowerCase().endsWith(".stl") ? safe : `${safe}.stl`;
}

function downloadBlob(blob, fileName) {
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}


const PATTERN_2D_DEFAULTS = Object.freeze({
  mode: "foldable-net",
  units: "mm",
  scale: 1,
  tabDepthMm: 5,
  includeTabs: true,
  includeFoldLines: true,
  includeLabels: true,
  faceLimit: 2500,
});
const PATTERN_2D_MAX_FACE_LIMIT = 20000;
const PATTERN_VERTEX_KEY_SCALE = 100000;
const PATTERN_EPSILON = 1e-7;
const PATTERN_FACE_EDGES = Object.freeze([[0, 1], [1, 2], [2, 0]]);

function patternNumber(value, fallback, min = -Infinity, max = Infinity) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

function patternBoolean(value, fallback = false) {
  if (value === undefined || value === null) return fallback;
  return Boolean(value);
}

function normalizePatternOptions(options = {}) {
  const scale = patternNumber(options.scale, PATTERN_2D_DEFAULTS.scale, 0.001, 1000000);
  const units = String(options.units || PATTERN_2D_DEFAULTS.units).toLowerCase() === "in" ? "in" : "mm";
  return {
    mode: options.mode === "sliced-stack" ? "sliced-stack" : "foldable-net",
    units,
    scale,
    tabDepthMm: patternNumber(options.tabDepthMm, PATTERN_2D_DEFAULTS.tabDepthMm, 0, 500),
    includeTabs: patternBoolean(options.includeTabs, PATTERN_2D_DEFAULTS.includeTabs),
    includeFoldLines: patternBoolean(options.includeFoldLines, PATTERN_2D_DEFAULTS.includeFoldLines),
    includeLabels: patternBoolean(options.includeLabels, PATTERN_2D_DEFAULTS.includeLabels),
    faceLimit: Math.round(patternNumber(options.faceLimit, PATTERN_2D_DEFAULTS.faceLimit, 1, PATTERN_2D_MAX_FACE_LIMIT)),
  };
}

function patternFileName(pathValue = "model.stl") {
  const clean = cleanNotebookPath(pathValue);
  const leaf = clean.split("/").filter(Boolean).pop() || "model";
  const base = leaf.replace(/\.[^.]*$/, "") || "model";
  const safe = base.replace(/[^A-Za-z0-9_.-]+/g, "_") || "model";
  return safe + "-2d-pattern.svg";
}

function svgEscape(value = "") {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
}

function fmt(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "0";
  const rounded = Math.abs(num) < 0.000001 ? 0 : num;
  return String(Number(rounded.toFixed(4)));
}

function p2(x = 0, y = 0) {
  return { x: Number(x) || 0, y: Number(y) || 0 };
}

function dist2(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function signedArea2(points = []) {
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += a.x * b.y - b.x * a.y;
  }
  return area / 2;
}

function cross2(a, b, c) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function triangleArea3(a, b, c) {
  const ab = new THREE.Vector3().subVectors(b, a);
  const ac = new THREE.Vector3().subVectors(c, a);
  return ab.cross(ac).length() / 2;
}

function vertexKey3(v) {
  return [v.x, v.y, v.z].map((part) => String(Math.round(part * PATTERN_VERTEX_KEY_SCALE))).join(",");
}

function edgeKeyForIds(a, b) {
  return a < b ? String(a) + "|" + String(b) : String(b) + "|" + String(a);
}

function treePairKey(a, b, edgeKey) {
  return (a < b ? String(a) + "|" + String(b) : String(b) + "|" + String(a)) + "|" + edgeKey;
}

function readMeshVertex(mesh, attributeIndex, target) {
  target.fromBufferAttribute(mesh.position, attributeIndex);
  if (mesh.object.isSkinnedMesh && typeof mesh.object.applyBoneTransform === "function") {
    mesh.object.applyBoneTransform(attributeIndex, target);
  }
  target.applyMatrix4(mesh.object.matrixWorld);
}

function collectSceneTriangles(root, options = {}) {
  if (!root) throw new Error("No 3D model is available for pattern export.");
  root.updateMatrixWorld?.(true);

  const meshes = [];
  const visit = (object) => {
    if (!object?.isMesh || !objectWorldVisible(object) || !objectExportsToSTL(object)) return;
    const geometry = object.geometry;
    const position = geometry?.getAttribute?.("position");
    if (!position || !Number.isFinite(position.count) || position.count < 3) return;
    meshes.push({ object, geometry, index: geometry.index || null, position });
  };

  if (root?.isBufferGeometry) {
    const object = { isMesh: true, geometry: root, matrixWorld: new THREE.Matrix4(), updateMatrixWorld() {} };
    visit(object);
  } else if (typeof root.traverse === "function") {
    root.traverse(visit);
  } else {
    visit(root);
  }

  const triangles = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const maxFaces = Math.round(patternNumber(options.faceLimit, PATTERN_2D_DEFAULTS.faceLimit, 1, PATTERN_2D_MAX_FACE_LIMIT));

  const addTriangle = (mesh, ia, ib, ic) => {
    readMeshVertex(mesh, ia, a);
    readMeshVertex(mesh, ib, b);
    readMeshVertex(mesh, ic, c);
    if (triangleArea3(a, b, c) <= PATTERN_EPSILON) return;
    triangles.push({ vertices: [a.clone(), b.clone(), c.clone()] });
    if (triangles.length > maxFaces) {
      throw new Error("This mesh has more than " + String(maxFaces) + " faces. Increase the face limit or simplify the model first.");
    }
  };

  meshes.forEach((mesh) => {
    if (mesh.index) {
      for (let i = 0; i + 2 < mesh.index.count; i += 3) {
        addTriangle(mesh, mesh.index.getX(i), mesh.index.getX(i + 1), mesh.index.getX(i + 2));
      }
      return;
    }
    for (let i = 0; i + 2 < mesh.position.count; i += 3) addTriangle(mesh, i, i + 1, i + 2);
  });

  if (!triangles.length) throw new Error("This model does not contain triangle mesh geometry for pattern export.");
  return triangles;
}

function indexedPatternMesh(triangles = []) {
  const vertices = [];
  const vertexByKey = new Map();
  const faces = [];

  const internVertex = (vertex) => {
    const key = vertexKey3(vertex);
    if (vertexByKey.has(key)) return vertexByKey.get(key);
    const id = vertices.length;
    vertices.push(vertex.clone());
    vertexByKey.set(key, id);
    return id;
  };

  triangles.forEach((triangle) => {
    const ids = triangle.vertices.map(internVertex);
    if (new Set(ids).size !== 3) return;
    const area = triangleArea3(vertices[ids[0]], vertices[ids[1]], vertices[ids[2]]);
    if (area <= PATTERN_EPSILON) return;
    faces.push({ index: faces.length, vIds: ids, area, adjacent: [] });
  });

  const edgeMap = new Map();
  faces.forEach((face) => {
    PATTERN_FACE_EDGES.forEach(([i, j]) => {
      const aId = face.vIds[i];
      const bId = face.vIds[j];
      const key = edgeKeyForIds(aId, bId);
      if (!edgeMap.has(key)) edgeMap.set(key, []);
      edgeMap.get(key).push({ faceIndex: face.index, edgeKey: key });
    });
  });

  edgeMap.forEach((entries, edgeKey) => {
    for (let i = 0; i < entries.length; i += 1) {
      for (let j = i + 1; j < entries.length; j += 1) {
        const aEntry = entries[i];
        const bEntry = entries[j];
        faces[aEntry.faceIndex].adjacent.push({ faceIndex: bEntry.faceIndex, edgeKey });
        faces[bEntry.faceIndex].adjacent.push({ faceIndex: aEntry.faceIndex, edgeKey });
      }
    }
  });

  return { vertices, faces, edgeMap };
}

function triangleCandidates2D(pA, pB, radiusA, radiusB) {
  const baseLength = Math.max(PATTERN_EPSILON, dist2(pA, pB));
  const ux = (pB.x - pA.x) / baseLength;
  const uy = (pB.y - pA.y) / baseLength;
  const x = (radiusA * radiusA - radiusB * radiusB + baseLength * baseLength) / (2 * baseLength);
  const h = Math.sqrt(Math.max(0, radiusA * radiusA - x * x));
  const base = p2(pA.x + ux * x, pA.y + uy * x);
  const px = -uy;
  const py = ux;
  return [p2(base.x + px * h, base.y + py * h), p2(base.x - px * h, base.y - py * h)];
}

function rootPlacement(face, vertices, offsetX = 0) {
  const ids = face.vIds;
  const v0 = vertices[ids[0]];
  const v1 = vertices[ids[1]];
  const v2 = vertices[ids[2]];
  const p0 = p2(offsetX, 0);
  const p1 = p2(offsetX + v0.distanceTo(v1), 0);
  const candidates = triangleCandidates2D(p0, p1, v0.distanceTo(v2), v1.distanceTo(v2));
  const points = [p0, p1, candidates[0]];
  const vertexPoints = new Map(ids.map((id, index) => [id, points[index]]));
  return { faceIndex: face.index, points, vertexPoints };
}

function pointInTriangleStrict(point, triangle) {
  const c1 = cross2(triangle[0], triangle[1], point);
  const c2 = cross2(triangle[1], triangle[2], point);
  const c3 = cross2(triangle[2], triangle[0], point);
  const hasPositive = c1 > PATTERN_EPSILON || c2 > PATTERN_EPSILON || c3 > PATTERN_EPSILON;
  const hasNegative = c1 < -PATTERN_EPSILON || c2 < -PATTERN_EPSILON || c3 < -PATTERN_EPSILON;
  return !(hasPositive && hasNegative) && Math.abs(c1) > PATTERN_EPSILON && Math.abs(c2) > PATTERN_EPSILON && Math.abs(c3) > PATTERN_EPSILON;
}

function segmentsIntersectStrict(a, b, c, d) {
  const abC = cross2(a, b, c);
  const abD = cross2(a, b, d);
  const cdA = cross2(c, d, a);
  const cdB = cross2(c, d, b);
  return abC * abD < -PATTERN_EPSILON && cdA * cdB < -PATTERN_EPSILON;
}

function trianglesOverlapStrict(a, b) {
  for (const point of a) if (pointInTriangleStrict(point, b)) return true;
  for (const point of b) if (pointInTriangleStrict(point, a)) return true;
  for (let i = 0; i < 3; i += 1) {
    for (let j = 0; j < 3; j += 1) {
      if (segmentsIntersectStrict(a[i], a[(i + 1) % 3], b[j], b[(j + 1) % 3])) return true;
    }
  }
  return false;
}

function placementOverlapsAny(points, placedList = []) {
  return placedList.some((placement) => trianglesOverlapStrict(points, placement.points));
}

function adjacentPlacement(parentPlacement, parentFace, childFace, vertices, placedList) {
  const sharedIds = parentFace.vIds.filter((id) => childFace.vIds.includes(id));
  if (sharedIds.length !== 2) return null;
  const childThirdId = childFace.vIds.find((id) => !sharedIds.includes(id));
  const parentThirdId = parentFace.vIds.find((id) => !sharedIds.includes(id));
  const pA = parentPlacement.vertexPoints.get(sharedIds[0]);
  const pB = parentPlacement.vertexPoints.get(sharedIds[1]);
  const parentThird = parentPlacement.vertexPoints.get(parentThirdId);
  if (!pA || !pB || !parentThird || childThirdId === undefined) return null;

  const vA = vertices[sharedIds[0]];
  const vB = vertices[sharedIds[1]];
  const vC = vertices[childThirdId];
  const candidates = triangleCandidates2D(pA, pB, vA.distanceTo(vC), vB.distanceTo(vC));
  const parentSide = Math.sign(cross2(pA, pB, parentThird)) || 1;
  const preferred = Math.sign(cross2(pA, pB, candidates[0])) === -parentSide ? candidates[0] : candidates[1];
  const alternate = preferred === candidates[0] ? candidates[1] : candidates[0];

  const build = (thirdPoint) => {
    const vertexPoints = new Map();
    vertexPoints.set(sharedIds[0], pA);
    vertexPoints.set(sharedIds[1], pB);
    vertexPoints.set(childThirdId, thirdPoint);
    return {
      faceIndex: childFace.index,
      points: childFace.vIds.map((id) => vertexPoints.get(id)),
      vertexPoints,
    };
  };

  const preferredPlacement = build(preferred);
  const alternatePlacement = build(alternate);
  if (!placementOverlapsAny(preferredPlacement.points, placedList)) return { placement: preferredPlacement, overlapped: false };
  if (!placementOverlapsAny(alternatePlacement.points, placedList)) return { placement: alternatePlacement, overlapped: false };
  return { placement: preferredPlacement, overlapped: true };
}

function bboxForPointSets(pointSets = []) {
  const bbox = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  pointSets.forEach((points) => points.forEach((point) => {
    bbox.minX = Math.min(bbox.minX, point.x);
    bbox.minY = Math.min(bbox.minY, point.y);
    bbox.maxX = Math.max(bbox.maxX, point.x);
    bbox.maxY = Math.max(bbox.maxY, point.y);
  }));
  if (!Number.isFinite(bbox.minX)) return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  return bbox;
}

function buildFoldableLayout(triangles = []) {
  const mesh = indexedPatternMesh(triangles);
  if (!mesh.faces.length) throw new Error("This mesh does not contain usable faces after cleanup.");
  const placements = new Map();
  const placementOrder = [];
  const unplaced = new Set(mesh.faces.map((face) => face.index));
  const foldLines = [];
  const foldedFaceEdges = new Set();
  let overlapCount = 0;
  let componentCount = 0;
  let componentOffsetX = 0;

  while (unplaced.size) {
    componentCount += 1;
    let rootFace = null;
    unplaced.forEach((faceIndex) => {
      const face = mesh.faces[faceIndex];
      if (!rootFace || face.area > rootFace.area) rootFace = face;
    });
    const root = rootPlacement(rootFace, mesh.vertices, componentOffsetX);
    placements.set(rootFace.index, root);
    placementOrder.push(root);
    unplaced.delete(rootFace.index);

    const queue = [rootFace.index];
    while (queue.length) {
      const parentIndex = queue.shift();
      const parentFace = mesh.faces[parentIndex];
      const parentPlacement = placements.get(parentIndex);
      const neighbors = [...parentFace.adjacent].sort((a, b) => mesh.faces[b.faceIndex].area - mesh.faces[a.faceIndex].area);
      neighbors.forEach((neighbor) => {
        if (!unplaced.has(neighbor.faceIndex)) return;
        const childFace = mesh.faces[neighbor.faceIndex];
        const result = adjacentPlacement(parentPlacement, parentFace, childFace, mesh.vertices, placementOrder);
        if (!result?.placement) return;
        placements.set(childFace.index, result.placement);
        placementOrder.push(result.placement);
        unplaced.delete(childFace.index);
        queue.push(childFace.index);
        if (result.overlapped) overlapCount += 1;
        const pairKey = treePairKey(parentFace.index, childFace.index, neighbor.edgeKey);
        if (!foldLines.some((line) => line.pairKey === pairKey)) {
          const sharedIds = parentFace.vIds.filter((id) => childFace.vIds.includes(id));
          foldLines.push({ pairKey, edgeKey: neighbor.edgeKey, p0: parentPlacement.vertexPoints.get(sharedIds[0]), p1: parentPlacement.vertexPoints.get(sharedIds[1]) });
        }
        foldedFaceEdges.add(String(parentFace.index) + "|" + neighbor.edgeKey);
        foldedFaceEdges.add(String(childFace.index) + "|" + neighbor.edgeKey);
      });
    }

    const bbox = bboxForPointSets(placementOrder.map((placement) => placement.points));
    componentOffsetX = bbox.maxX + Math.max(10, bbox.maxX - bbox.minX + 10);
  }

  const cutLines = [];
  placementOrder.forEach((placement) => {
    const face = mesh.faces[placement.faceIndex];
    PATTERN_FACE_EDGES.forEach(([i, j]) => {
      const edgeKey = edgeKeyForIds(face.vIds[i], face.vIds[j]);
      if (foldedFaceEdges.has(String(face.index) + "|" + edgeKey)) return;
      cutLines.push({ faceIndex: face.index, p0: placement.points[i], p1: placement.points[j], facePoints: placement.points });
    });
  });

  return { mesh, placements: placementOrder, foldLines, cutLines, overlapCount, componentCount };
}

function tabPolygonForCutLine(line, tabDepth) {
  const length = dist2(line.p0, line.p1);
  if (length <= PATTERN_EPSILON || tabDepth <= 0) return null;
  const dx = (line.p1.x - line.p0.x) / length;
  const dy = (line.p1.y - line.p0.y) / length;
  const orientation = signedArea2(line.facePoints) >= 0 ? 1 : -1;
  const normal = orientation > 0 ? p2(dy, -dx) : p2(-dy, dx);
  const inset = Math.min(length * 0.18, Math.max(0, tabDepth * 0.55));
  return [
    p2(line.p0.x, line.p0.y),
    p2(line.p1.x, line.p1.y),
    p2(line.p1.x - dx * inset + normal.x * tabDepth, line.p1.y - dy * inset + normal.y * tabDepth),
    p2(line.p0.x + dx * inset + normal.x * tabDepth, line.p0.y + dy * inset + normal.y * tabDepth),
  ];
}

function generateFoldablePatternSvg(triangles, pathValue = "model.stl", options = {}) {
  const normalized = normalizePatternOptions(options);
  if (normalized.mode !== "foldable-net") throw new Error("Only foldable net pattern export is available right now.");
  const layout = buildFoldableLayout(triangles);
  const unitScaleMm = normalized.units === "in" ? 25.4 : 1;
  const rawTabDepth = normalized.includeTabs ? normalized.tabDepthMm / Math.max(PATTERN_EPSILON, unitScaleMm * normalized.scale) : 0;
  const tabs = normalized.includeTabs
    ? layout.cutLines.map((line) => tabPolygonForCutLine(line, rawTabDepth)).filter(Boolean)
    : [];
  const bbox = bboxForPointSets([
    ...layout.placements.map((placement) => placement.points),
    ...tabs,
  ]);
  const marginMm = 10;
  const rawWidth = Math.max(1, bbox.maxX - bbox.minX);
  const rawHeight = Math.max(1, bbox.maxY - bbox.minY);
  const widthMm = rawWidth * unitScaleMm * normalized.scale + marginMm * 2;
  const heightMm = rawHeight * unitScaleMm * normalized.scale + marginMm * 2;
  const tx = (point) => p2(
    (point.x - bbox.minX) * unitScaleMm * normalized.scale + marginMm,
    (bbox.maxY - point.y) * unitScaleMm * normalized.scale + marginMm,
  );
  const pointsAttr = (points) => points.map((point) => {
    const mapped = tx(point);
    return fmt(mapped.x) + "," + fmt(mapped.y);
  }).join(" ");
  const lineAttrs = (line) => {
    const a = tx(line.p0);
    const b = tx(line.p1);
    return "x1=\"" + fmt(a.x) + "\" y1=\"" + fmt(a.y) + "\" x2=\"" + fmt(b.x) + "\" y2=\"" + fmt(b.y) + "\"";
  };
  const centroid = (points) => {
    const total = points.reduce((acc, point) => p2(acc.x + point.x, acc.y + point.y), p2(0, 0));
    return p2(total.x / points.length, total.y / points.length);
  };

  const title = patternFileName(pathValue);
  const warnings = [];
  if (layout.componentCount > 1) warnings.push(String(layout.componentCount) + " disconnected components");
  if (layout.overlapCount > 0) warnings.push(String(layout.overlapCount) + " overlapping placements");
  const desc = "Foldable mesh net generated from " + cleanNotebookPath(pathValue) + ". Faces: " + String(layout.placements.length) + "." + (warnings.length ? " Warnings: " + warnings.join(", ") + "." : "");

  const tabSvg = tabs.map((tab) => "    <polygon points=\"" + pointsAttr(tab) + "\" class=\"glue-tab\" />").join("\n");
  const faceSvg = layout.placements.map((placement) => "    <polygon points=\"" + pointsAttr(placement.points) + "\" class=\"face\" />").join("\n");
  const cutSvg = layout.cutLines.map((line) => "    <line " + lineAttrs(line) + " class=\"cut\" />").join("\n");
  const foldSvg = normalized.includeFoldLines
    ? layout.foldLines.map((line) => "    <line " + lineAttrs(line) + " class=\"fold\" />").join("\n")
    : "";
  const labelSvg = normalized.includeLabels
    ? layout.placements.map((placement, index) => {
        const mapped = tx(centroid(placement.points));
        return "    <text x=\"" + fmt(mapped.x) + "\" y=\"" + fmt(mapped.y) + "\" class=\"label\">" + String(index + 1) + "</text>";
      }).join("\n")
    : "";

  return [
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
    "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"" + fmt(widthMm) + "mm\" height=\"" + fmt(heightMm) + "mm\" viewBox=\"0 0 " + fmt(widthMm) + " " + fmt(heightMm) + "\">",
    "  <title>" + svgEscape(title) + "</title>",
    "  <desc>" + svgEscape(desc) + "</desc>",
    "  <style>",
    "    .face{fill:#ffffff;stroke:none}",
    "    .glue-tab{fill:#f3f4f6;stroke:#6b7280;stroke-width:0.2}",
    "    .cut{stroke:#111827;stroke-width:0.35;stroke-linecap:round}",
    "    .fold{stroke:#2563eb;stroke-width:0.28;stroke-dasharray:2 1.4;stroke-linecap:round}",
    "    .label{font:2.8px system-ui,sans-serif;text-anchor:middle;dominant-baseline:central;fill:#4b5563}",
    "  </style>",
    "  <rect x=\"0\" y=\"0\" width=\"" + fmt(widthMm) + "\" height=\"" + fmt(heightMm) + "\" fill=\"#ffffff\" />",
    "  <g id=\"glue-tabs\">",
    tabSvg,
    "  </g>",
    "  <g id=\"faces\">",
    faceSvg,
    "  </g>",
    "  <g id=\"fold-lines\">",
    foldSvg,
    "  </g>",
    "  <g id=\"cut-lines\">",
    cutSvg,
    "  </g>",
    "  <g id=\"face-labels\">",
    labelSvg,
    "  </g>",
    "</svg>",
  ].join("\n");
}

export function exportSceneTo2DPattern(root, pathValue = "model.stl", options = {}) {
  const normalized = normalizePatternOptions(options);
  const triangles = collectSceneTriangles(root, normalized);
  const svg = generateFoldablePatternSvg(triangles, pathValue, normalized);
  const fileName = patternFileName(pathValue);
  downloadBlob(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }), fileName);
  return { source: "scene", fileName, faceCount: triangles.length, mode: normalized.mode };
}

export function exportSTLBufferTo2DPattern(arrayBuffer, pathValue = "model.stl", options = {}) {
  if (!arrayBuffer || !arrayBuffer.byteLength) throw new Error("No STL data is available for pattern export.");
  const loader = new STLLoader();
  const geometry = loader.parse(arrayBuffer);
  const material = new THREE.MeshBasicMaterial();
  const mesh = new THREE.Mesh(geometry, material);
  try {
    return { ...exportSceneTo2DPattern(mesh, pathValue, options), source: "stl" };
  } finally {
    geometry.dispose?.();
    material.dispose?.();
  }
}

async function renderScadCodeToSTLPatternBuffer(scadCode) {
  const response = await fetch("/api/scad/render", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scadCode: String(scadCode || ""), format: "stl" }),
  });

  if (!response.ok) {
    const json = await response.json().catch(() => null);
    const text = json ? "" : await response.text().catch(() => "");
    const details = [json?.error || text || String(response.status) + " " + String(response.statusText), json?.hint]
      .filter(Boolean)
      .join("\n");
    throw new Error(details || "SCAD pattern export failed.");
  }

  return response.arrayBuffer();
}

function fallbackPatternScene(root, pathValue, primaryError, options = {}) {
  try {
    const result = exportSceneTo2DPattern(root, pathValue, options.fallbackOptions || options);
    options.onFallback?.(primaryError);
    return { ...result, source: "preview", error: primaryError };
  } catch (fallbackErr) {
    const primaryMessage = primaryError?.message || String(primaryError || "SCAD pattern export failed.");
    const fallbackMessage = fallbackErr?.message || String(fallbackErr || "Preview pattern export failed.");
    throw new Error(primaryMessage + "\nPreview pattern export also failed: " + fallbackMessage);
  }
}

export async function exportScadCodeTo2DPattern(scadCode, pathValue = "model.scad", options = {}) {
  try {
    const buffer = await renderScadCodeToSTLPatternBuffer(scadCode);
    const result = exportSTLBufferTo2DPattern(buffer, pathValue, options);
    options.onExactExport?.();
    return { ...result, source: "openscad" };
  } catch (err) {
    const fallbackRoot = fallbackRootFromOptions(options);
    if (fallbackRoot) return fallbackPatternScene(fallbackRoot, pathValue, err, options);
    throw err;
  }
}

function appendPatternField(form, labelText, control) {
  const label = document.createElement("label");
  label.style.cssText = "display:grid;grid-template-columns:minmax(110px,1fr) minmax(140px,1.2fr);align-items:center;gap:10px;font:12px/1.3 system-ui,sans-serif;color:#172026;";
  const span = document.createElement("span");
  span.textContent = labelText;
  label.append(span, control);
  form.appendChild(label);
}

function styledPatternInput(input) {
  input.style.cssText = "width:100%;min-height:30px;border:1px solid #aebbc4;border-radius:4px;background:#fff;color:#172026;padding:4px 7px;box-sizing:border-box;font:12px system-ui,sans-serif;";
  return input;
}

export function openPattern2DExportDialog(context = {}) {
  return new Promise((resolve) => {
    document.getElementById("nv-pattern-export-overlay")?.remove?.();
    const overlay = document.createElement("div");
    overlay.id = "nv-pattern-export-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.tabIndex = -1;
    overlay.style.cssText = "position:fixed;inset:0;z-index:1300;background:rgba(15,23,42,0.38);display:grid;place-items:center;padding:18px;box-sizing:border-box;";

    const card = document.createElement("form");
    card.style.cssText = "width:min(440px,100%);background:#ffffff;border:1px solid #9aa7b0;border-radius:8px;box-shadow:0 18px 44px rgba(0,0,0,0.28);padding:16px;display:flex;flex-direction:column;gap:12px;color:#172026;";

    const title = document.createElement("h2");
    title.textContent = "Export 2D Pattern";
    title.style.cssText = "margin:0;font:650 15px/1.25 system-ui,sans-serif;";
    card.appendChild(title);

    const mode = styledPatternInput(document.createElement("select"));
    mode.name = "mode";
    mode.innerHTML = "<option value=\"foldable-net\">Foldable Net</option><option value=\"sliced-stack\" disabled>Stacked Slices</option>";
    appendPatternField(card, "Pattern", mode);

    const units = styledPatternInput(document.createElement("select"));
    units.name = "units";
    units.innerHTML = "<option value=\"mm\">Millimeters</option><option value=\"in\">Inches</option>";
    appendPatternField(card, "Model Units", units);

    const scale = styledPatternInput(document.createElement("input"));
    scale.name = "scale";
    scale.type = "number";
    scale.min = "0.001";
    scale.step = "0.01";
    scale.value = String(PATTERN_2D_DEFAULTS.scale);
    appendPatternField(card, "Scale", scale);

    const tabDepth = styledPatternInput(document.createElement("input"));
    tabDepth.name = "tabDepthMm";
    tabDepth.type = "number";
    tabDepth.min = "0";
    tabDepth.step = "0.5";
    tabDepth.value = String(PATTERN_2D_DEFAULTS.tabDepthMm);
    appendPatternField(card, "Tab Depth", tabDepth);

    const faceLimit = styledPatternInput(document.createElement("input"));
    faceLimit.name = "faceLimit";
    faceLimit.type = "number";
    faceLimit.min = "1";
    faceLimit.max = String(PATTERN_2D_MAX_FACE_LIMIT);
    faceLimit.step = "1";
    faceLimit.value = String(PATTERN_2D_DEFAULTS.faceLimit);
    appendPatternField(card, "Max Faces", faceLimit);

    const checks = document.createElement("div");
    checks.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:8px 12px;";
    const makeCheck = (name, labelText, checked) => {
      const label = document.createElement("label");
      label.style.cssText = "display:flex;align-items:center;gap:7px;font:12px/1.3 system-ui,sans-serif;color:#172026;";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.name = name;
      input.checked = checked;
      label.append(input, document.createTextNode(labelText));
      checks.appendChild(label);
      return input;
    };
    makeCheck("includeTabs", "Glue Tabs", true);
    makeCheck("includeFoldLines", "Fold Lines", true);
    makeCheck("includeLabels", "Face Labels", true);
    card.appendChild(checks);

    const actions = document.createElement("div");
    actions.style.cssText = "display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin-top:2px;";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "Cancel";
    const submit = document.createElement("button");
    submit.type = "submit";
    submit.textContent = "Generate";
    [cancel, submit].forEach((button) => {
      button.style.cssText = "min-height:30px;border:1px solid #aebbc4;border-radius:4px;background:#f7fafb;color:#172026;padding:5px 10px;font:12px system-ui,sans-serif;cursor:pointer;";
    });
    submit.style.background = "#1f6feb";
    submit.style.borderColor = "#1d4ed8";
    submit.style.color = "#ffffff";
    actions.append(cancel, submit);
    card.appendChild(actions);
    overlay.appendChild(card);

    const close = (result) => {
      overlay.remove();
      resolve(result);
    };
    cancel.addEventListener("click", () => close(null));
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) close(null);
    });
    overlay.addEventListener("keydown", (event) => {
      if (event.key === "Escape") close(null);
    });
    card.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(card);
      close(normalizePatternOptions({
        mode: data.get("mode"),
        units: data.get("units"),
        scale: data.get("scale"),
        tabDepthMm: data.get("tabDepthMm"),
        faceLimit: data.get("faceLimit"),
        includeTabs: Boolean(data.get("includeTabs")),
        includeFoldLines: Boolean(data.get("includeFoldLines")),
        includeLabels: Boolean(data.get("includeLabels")),
        filePath: context.filePath || "",
      }));
    });

    document.body.appendChild(overlay);
    mode.focus();
  });
}

export async function exportActiveModelAs2DPattern() {
  const context = window.NodevisionModelExportContext;
  if (!context || typeof context.export2DPattern !== "function") {
    alert("No STL or SCAD model is active for 2D pattern export.");
    return null;
  }

  const options = await openPattern2DExportDialog(context);
  if (!options) return null;

  try {
    return await context.export2DPattern(options);
  } catch (err) {
    console.error("[Nodevision] 2D pattern export failed:", err);
    alert("2D pattern export failed:\n" + (err?.message || err));
    return null;
  }
}

function objectWorldVisible(object) {
  let current = object;
  while (current) {
    if (current.visible === false) return false;
    current = current.parent;
  }
  return true;
}

function objectExportsToSTL(object) {
  let current = object;
  while (current) {
    const userData = current.userData || {};
    if (userData.stlExport === false || userData.ignoreSTLExport === true || userData.skipSTLExport === true) return false;
    current = current.parent;
  }
  return true;
}

export function serializeSceneToAsciiSTL(root, options = {}) {
  if (!root?.traverse) throw new Error("No 3D scene is available to export.");
  root.updateMatrixWorld?.(true);

  const meshes = [];
  let triangleCount = 0;
  root.traverse((object) => {
    if (!object?.isMesh || !objectWorldVisible(object) || !objectExportsToSTL(object)) return;
    const geometry = object.geometry;
    const position = geometry?.getAttribute?.("position");
    if (!position || !Number.isFinite(position.count) || position.count < 3) return;
    const index = geometry.index || null;
    const count = index ? index.count : position.count;
    const triangles = Math.floor(count / 3);
    if (triangles <= 0) return;
    triangleCount += triangles;
    meshes.push({ object, geometry, index, position });
  });

  if (triangleCount <= 0) {
    throw new Error("This model does not contain triangle mesh geometry that can be exported as STL.");
  }

  const solidName = (options.solidName || "nodevision_export").replace(/[^A-Za-z0-9_.-]+/g, "_") || "nodevision_export";
  const lines = [`solid ${solidName}`];
  const vA = new THREE.Vector3();
  const vB = new THREE.Vector3();
  const vC = new THREE.Vector3();
  const cb = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const normal = new THREE.Vector3();

  function loadVertex(mesh, attributeIndex, target) {
    target.fromBufferAttribute(mesh.position, attributeIndex);
    if (mesh.object.isSkinnedMesh && typeof mesh.object.applyBoneTransform === "function") {
      mesh.object.applyBoneTransform(attributeIndex, target);
    }
    target.applyMatrix4(mesh.object.matrixWorld);
  }

  function writeFace(mesh, a, b, c) {
    loadVertex(mesh, a, vA);
    loadVertex(mesh, b, vB);
    loadVertex(mesh, c, vC);
    cb.subVectors(vC, vB);
    ab.subVectors(vA, vB);
    normal.copy(cb.cross(ab)).normalize();

    lines.push(`  facet normal ${normal.x} ${normal.y} ${normal.z}`);
    lines.push("    outer loop");
    lines.push(`      vertex ${vA.x} ${vA.y} ${vA.z}`);
    lines.push(`      vertex ${vB.x} ${vB.y} ${vB.z}`);
    lines.push(`      vertex ${vC.x} ${vC.y} ${vC.z}`);
    lines.push("    endloop");
    lines.push("  endfacet");
  }

  meshes.forEach((mesh) => {
    if (mesh.index) {
      for (let i = 0; i + 2 < mesh.index.count; i += 3) {
        writeFace(mesh, mesh.index.getX(i), mesh.index.getX(i + 1), mesh.index.getX(i + 2));
      }
      return;
    }
    for (let i = 0; i + 2 < mesh.position.count; i += 3) {
      writeFace(mesh, i, i + 1, i + 2);
    }
  });

  lines.push(`endsolid ${solidName}`);
  return `${lines.join("\n")}\n`;
}

export function exportSceneToSTL(root, pathValue = "model.stl", options = {}) {
  const fileName = stlFileName(pathValue);
  const solidName = fileName.replace(/\.stl$/i, "");
  const stl = serializeSceneToAsciiSTL(root, { solidName, ...options });
  downloadBlob(new Blob([stl], { type: "application/sla;charset=utf-8" }), fileName);
  return { source: "scene", fileName };
}

function errorLooksLikeMissingOpenSCAD(error) {
  const message = String(error?.message || error || "").toLowerCase();
  return message.includes("openscad cli not found")
    || message.includes("spawn openscad enoent")
    || message.includes("spawn flatpak-spawn enoent")
    || message.includes("nodevision_openscad_bin")
    || message.includes("configured openscad command")
    || message.includes("install openscad on the server")
    || message.includes("no such file or directory");
}

function fallbackRootFromOptions(options = {}) {
  if (typeof options.fallbackRoot === "function") return options.fallbackRoot();
  return options.fallbackRoot || null;
}

function exportFallbackScene(root, pathValue, primaryError, options = {}) {
  try {
    const result = exportSceneToSTL(root, pathValue, options.fallbackOptions || {});
    options.onFallback?.(primaryError);
    return { ...result, source: "preview", error: primaryError };
  } catch (fallbackErr) {
    const primaryMessage = primaryError?.message || String(primaryError || "SCAD STL export failed.");
    const fallbackMessage = fallbackErr?.message || String(fallbackErr || "Preview STL export failed.");
    throw new Error(primaryMessage + "\nPreview STL export also failed: " + fallbackMessage);
  }
}

export async function exportScadCodeToSTL(scadCode, pathValue = "model.scad", options = {}) {
  try {
    const response = await fetch("/api/scad/render", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scadCode: String(scadCode || ""), format: "stl" }),
    });

    if (!response.ok) {
      const json = await response.json().catch(() => null);
      const text = json ? "" : await response.text().catch(() => "");
      const details = [json?.error || text || String(response.status) + " " + String(response.statusText), json?.hint]
        .filter(Boolean)
        .join("\n");
      throw new Error(details || "SCAD STL export failed.");
    }

    const fileName = stlFileName(pathValue);
    const blob = await response.blob();
    downloadBlob(blob, fileName);
    options.onExactExport?.();
    return { source: "openscad", fileName };
  } catch (err) {
    if (options.fallbackOnAnyError || errorLooksLikeMissingOpenSCAD(err)) {
      const fallbackRoot = fallbackRootFromOptions(options);
      if (fallbackRoot) return exportFallbackScene(fallbackRoot, pathValue, err, options);
    }
    throw err;
  }
}
