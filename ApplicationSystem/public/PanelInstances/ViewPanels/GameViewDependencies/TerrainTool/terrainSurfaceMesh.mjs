// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/TerrainTool/terrainSurfaceMesh.mjs
// Shared helpers for continuous polygonal terrain surfaces used by the Meta World terrain tool.

import { createTerrainMaterial } from "./terrainMaterial.mjs";

function round3(value) {
  return Math.round(Number(value) * 1000) / 1000;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function normalizeGridCount(value, fallback) {
  return Math.max(1, Math.floor(Number(value) || fallback));
}

function vertexCount(columns, rows) {
  return (columns + 1) * (rows + 1);
}

function normalizeHeights(heights, columns, rows) {
  const count = vertexCount(columns, rows);
  const out = new Array(count).fill(0);
  if (!Array.isArray(heights)) return out;
  for (let i = 0; i < Math.min(count, heights.length); i += 1) {
    const height = Number(heights[i]);
    out[i] = Number.isFinite(height) ? height : 0;
  }
  return out;
}

function normalizeColors(colors, columns, rows, fallbackColor) {
  const count = vertexCount(columns, rows);
  if (!Array.isArray(colors) || colors.length < count) {
    return new Array(count).fill(fallbackColor || "#777777");
  }
  return colors.slice(0, count).map((color) => typeof color === "string" && color ? color : fallbackColor || "#777777");
}

function readTerrainMatterState(kind, metadata = {}) {
  const state = String(metadata.MatterState || metadata.matterState || "").trim().toLowerCase();
  if (state) return state;
  return metadata.isLiquid === true || kind === "water" ? "liquid" : "";
}

function isLiquidTerrainMetadata(kind, metadata = {}) {
  return readTerrainMatterState(kind, metadata) === "liquid";
}

function colorToRgb(THREE, color) {
  const c = new THREE.Color(color || "#777777");
  return [c.r, c.g, c.b];
}

function makeTerrainSurfaceGeometry(THREE, { columns, rows, tileSize, heights, colors }) {
  const width = columns * tileSize;
  const depth = rows * tileSize;
  const positions = [];
  const uvs = [];
  const vertexColors = [];
  const indices = [];

  for (let z = 0; z <= rows; z += 1) {
    for (let x = 0; x <= columns; x += 1) {
      const idx = z * (columns + 1) + x;
      positions.push(
        x * tileSize - width / 2,
        heights[idx] || 0,
        z * tileSize - depth / 2
      );
      uvs.push(x / columns, z / rows);
      vertexColors.push(...colorToRgb(THREE, colors[idx]));
    }
  }

  for (let z = 0; z < rows; z += 1) {
    for (let x = 0; x < columns; x += 1) {
      const a = z * (columns + 1) + x;
      const b = a + 1;
      const c = a + (columns + 1);
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(vertexColors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

export function createTerrainSurfaceMesh(THREE, {
  columns = 8,
  rows = 8,
  tileSize = 1,
  heights = null,
  colors = null,
  color = "#3f8f46",
  texture = "solid",
  kind = "grass",
  isSolid = true,
  metadata = {},
  position = null
} = {}) {
  const safeColumns = normalizeGridCount(columns, 8);
  const safeRows = normalizeGridCount(rows, 8);
  const safeTileSize = Math.max(0.1, Number(tileSize) || 1);
  const normalizedHeights = normalizeHeights(heights, safeColumns, safeRows);
  const normalizedColors = normalizeColors(colors, safeColumns, safeRows, color);
  const isLiquid = isLiquidTerrainMetadata(kind, metadata);
  const matterState = readTerrainMatterState(kind, metadata);
  const material = createTerrainMaterial(THREE, { color, texture, kind, isLiquid });
  material.vertexColors = true;
  material.side = THREE.DoubleSide;
  material.needsUpdate = true;

  const mesh = new THREE.Mesh(
    makeTerrainSurfaceGeometry(THREE, {
      columns: safeColumns,
      rows: safeRows,
      tileSize: safeTileSize,
      heights: normalizedHeights,
      colors: normalizedColors
    }),
    material
  );
  if (position) {
    mesh.position.set(Number(position.x) || 0, Number(position.y) || 0, Number(position.z) || 0);
  }
  mesh.userData.generatedByTerrainTool = true;
  mesh.userData.paintedByTerrainTool = metadata.mode === "painted" || metadata.mode === "sculpted";
  mesh.userData.nvType = "terrain-surface";
  mesh.userData.isWater = kind === "water";
  mesh.userData.isLiquid = isLiquid;
  mesh.userData.MatterState = matterState || "";
  mesh.userData.matterState = mesh.userData.MatterState || "";
  mesh.userData.materialName = metadata.materialName || "";
  mesh.userData.physicsMaterialId = metadata.physicsMaterialId || "";
  mesh.userData.physicsMaterialFile = metadata.physicsMaterialFile || "";
  mesh.userData.isSolid = isSolid === true && isLiquid !== true;
  mesh.userData.breakable = isLiquid !== true;
  mesh.userData.terrain = {
    ...metadata,
    materialName: metadata.materialName || "",
    physicsMaterialId: metadata.physicsMaterialId || "",
    physicsMaterialFile: metadata.physicsMaterialFile || "",
    MatterState: matterState || metadata.MatterState || undefined,
    matterState,
    isLiquid,
    geometryMode: "polygonal",
    kind,
    texture,
    color,
    tileSize: round3(safeTileSize),
    columns: safeColumns,
    rows: safeRows,
    width: round3(safeColumns * safeTileSize),
    depth: round3(safeRows * safeTileSize),
    heights: normalizedHeights.map(round3),
    vertexColors: normalizedColors
  };
  return mesh;
}

function materialColorHex(mesh) {
  const mat = Array.isArray(mesh?.material) ? mesh.material[0] : mesh?.material;
  if (mat?.color?.isColor) return "#" + mat.color.getHexString();
  return mesh?.userData?.terrain?.color || "#3f8f46";
}

export function createTerrainSurfaceDefinition(mesh, options = {}) {
  const terrain = mesh?.userData?.terrain && typeof mesh.userData.terrain === "object" ? mesh.userData.terrain : {};
  const id = options.id || mesh?.userData?.metaWorldLayerId || terrain.id || "";
  const def = {
    type: "terrain-surface",
    position: [round3(mesh?.position?.x || 0), round3(mesh?.position?.y || 0), round3(mesh?.position?.z || 0)],
    color: terrain.color || materialColorHex(mesh),
    isSolid: mesh?.userData?.isSolid === true,
    size: [
      round3(Number(terrain.width) || 1),
      round3(Number(terrain.depth) || 1)
    ],
    columns: Math.max(1, Math.floor(Number(terrain.columns) || 1)),
    rows: Math.max(1, Math.floor(Number(terrain.rows) || 1)),
    tileSize: round3(Number(terrain.tileSize) || 1),
    texture: terrain.texture || "solid",
    kind: terrain.kind || "grass",
    name: options.name || terrain.name || "Polygonal Terrain",
    terrain: JSON.parse(JSON.stringify(terrain))
  };
  if (id) def.id = id;
  if (terrain.MatterState) def.MatterState = terrain.MatterState;
  if (terrain.isLiquid === true) def.isLiquid = true;
  if (terrain.materialName) def.materialName = terrain.materialName;
  if (terrain.physicsMaterialId) def.physicsMaterialId = terrain.physicsMaterialId;
  if (terrain.physicsMaterialFile) def.physicsMaterialFile = terrain.physicsMaterialFile;
  if (Array.isArray(terrain.heights)) def.heights = terrain.heights.map(round3);
  if (Array.isArray(terrain.vertexColors)) def.vertexColors = terrain.vertexColors.slice();
  if (mesh?.visible === false) def.hidden = true;
  return def;
}

export function createTerrainSurfaceColliderRef(THREE, mesh) {
  if (!THREE || !mesh?.isMesh || mesh.userData?.isSolid !== true) return null;
  return {
    type: "box",
    target: mesh,
    materialId: mesh.userData?.physicsMaterialId || mesh.userData?.terrain?.physicsMaterialId || "",
    box: new THREE.Box3().setFromObject(mesh)
  };
}

export function refreshTerrainSurfaceMesh(THREE, mesh) {
  const terrain = mesh?.userData?.terrain;
  if (!THREE || !mesh?.isMesh || !terrain) return;
  const columns = normalizeGridCount(terrain.columns, 8);
  const rows = normalizeGridCount(terrain.rows, 8);
  const heights = normalizeHeights(terrain.heights, columns, rows);
  const colors = normalizeColors(terrain.vertexColors, columns, rows, terrain.color);
  const positionAttr = mesh.geometry?.getAttribute?.("position");
  const colorAttr = mesh.geometry?.getAttribute?.("color");
  if (!positionAttr || positionAttr.count !== heights.length) return;
  for (let i = 0; i < heights.length; i += 1) {
    positionAttr.setY(i, heights[i]);
    if (colorAttr) {
      const [r, g, b] = colorToRgb(THREE, colors[i]);
      colorAttr.setXYZ(i, r, g, b);
    }
  }
  positionAttr.needsUpdate = true;
  if (colorAttr) colorAttr.needsUpdate = true;
  mesh.geometry.computeVertexNormals();
  mesh.geometry.computeBoundingBox();
  mesh.geometry.computeBoundingSphere();
}

export function pointInsideTerrainSurface(mesh, point) {
  const terrain = mesh?.userData?.terrain;
  if (!terrain || String(terrain.geometryMode) !== "polygonal") return false;
  const width = Number(terrain.width) || ((Number(terrain.columns) || 0) * (Number(terrain.tileSize) || 1));
  const depth = Number(terrain.depth) || ((Number(terrain.rows) || 0) * (Number(terrain.tileSize) || 1));
  const x = Number(point?.x) || 0;
  const z = Number(point?.z) || 0;
  return x >= mesh.position.x - width / 2
    && x <= mesh.position.x + width / 2
    && z >= mesh.position.z - depth / 2
    && z <= mesh.position.z + depth / 2;
}

export function sculptTerrainSurface(THREE, mesh, point, {
  radius = 1,
  elevation = 0.6,
  color = "#3f8f46"
} = {}) {
  const terrain = mesh?.userData?.terrain;
  if (!THREE || !mesh?.isMesh || !terrain) return false;
  const columns = normalizeGridCount(terrain.columns, 8);
  const rows = normalizeGridCount(terrain.rows, 8);
  const tileSize = Math.max(0.1, Number(terrain.tileSize) || 1);
  const heights = normalizeHeights(terrain.heights, columns, rows);
  const colors = normalizeColors(terrain.vertexColors, columns, rows, terrain.color || color);
  const width = columns * tileSize;
  const depth = rows * tileSize;
  const localX = (Number(point?.x) || 0) - mesh.position.x;
  const localZ = (Number(point?.z) || 0) - mesh.position.z;
  const brushRadius = Math.max(tileSize * 0.75, Number(radius) || tileSize);
  const amount = Math.max(0.01, Number(elevation) || 0.6);
  let changed = false;

  for (let z = 0; z <= rows; z += 1) {
    for (let x = 0; x <= columns; x += 1) {
      const idx = z * (columns + 1) + x;
      const vx = x * tileSize - width / 2;
      const vz = z * tileSize - depth / 2;
      const distance = Math.hypot(vx - localX, vz - localZ);
      if (distance > brushRadius) continue;
      const falloff = 1 - clamp01(distance / brushRadius);
      const eased = falloff * falloff * (3 - 2 * falloff);
      heights[idx] = round3(Math.max(0, heights[idx] + amount * eased));
      colors[idx] = color;
      changed = true;
    }
  }

  if (!changed) return false;
  terrain.heights = heights.map(round3);
  terrain.vertexColors = colors;
  terrain.elevation = round3(Math.max(...heights));
  refreshTerrainSurfaceMesh(THREE, mesh);
  if (mesh.userData?.colliderRef?.box) {
    mesh.userData.colliderRef.box = new THREE.Box3().setFromObject(mesh);
  }
  return true;
}
