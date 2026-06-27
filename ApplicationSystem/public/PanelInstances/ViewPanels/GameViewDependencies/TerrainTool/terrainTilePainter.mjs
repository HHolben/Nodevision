// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/TerrainTool/terrainTilePainter.mjs
// This file creates and replaces hidden Meta World terrain tiles for the terrain painting tool.

import { createTerrainMaterial } from "./terrainMaterial.mjs";
import {
  createTerrainSurfaceColliderRef,
  createTerrainSurfaceMesh,
  pointInsideTerrainSurface,
  sculptTerrainSurface
} from "./terrainSurfaceMesh.mjs";

function round3(value) {
  return Math.round(value * 1000) / 1000;
}

function snapKey(value, tileSize) {
  return Math.round(value / tileSize);
}

function buildTileKey(gridX, gridZ, tileSize) {
  return `${gridX}:${gridZ}:${round3(tileSize)}`;
}

export function createTerrainTilePainter({ THREE, scene, objects, colliders }) {
  const paintedTiles = new Map();
  const paintedSurfaces = new Set();

  function detachMesh(mesh) {
    if (!mesh) return;
    if (mesh.parent) mesh.parent.remove(mesh);
    const objIdx = objects.indexOf(mesh);
    if (objIdx !== -1) objects.splice(objIdx, 1);
    const colliderRef = mesh.userData?.colliderRef;
    if (colliderRef) {
      const colIdx = colliders.indexOf(colliderRef);
      if (colIdx !== -1) colliders.splice(colIdx, 1);
    }
    const key = mesh.userData?.terrain?.tileKey;
    if (key && paintedTiles.get(key) === mesh) paintedTiles.delete(key);
    if (paintedSurfaces.has(mesh)) paintedSurfaces.delete(mesh);
  }

  function findExistingTile(key) {
    const cached = paintedTiles.get(key);
    if (cached?.parent) return cached;
    if (cached) paintedTiles.delete(key);
    const existing = objects.find((obj) => obj?.isMesh && obj.userData?.terrain?.tileKey === key);
    if (existing) paintedTiles.set(key, existing);
    return existing || null;
  }

  function findExistingSurface(point) {
    for (const mesh of paintedSurfaces) {
      if (mesh?.parent && pointInsideTerrainSurface(mesh, point)) return mesh;
    }
    for (const mesh of objects) {
      if (
        mesh?.isMesh
        && mesh.parent
        && String(mesh.userData?.nvType || "").toLowerCase() === "terrain-surface"
        && pointInsideTerrainSurface(mesh, point)
      ) {
        paintedSurfaces.add(mesh);
        return mesh;
      }
    }
    return null;
  }

  function createSurfaceForPoint({
    point,
    tileSize,
    elevation,
    baseY,
    color,
    isSolid,
    texture,
    metadata
  }) {
    const radius = Math.max(0, Number(metadata.radius) || 0);
    const cells = Math.max(6, Math.ceil(((radius > 0 ? radius * 2 : tileSize * 6) + tileSize * 2) / tileSize));
    const columns = cells + (cells % 2);
    const rows = columns;
    const centerX = Math.round((Number(point.x) || 0) / tileSize) * tileSize;
    const centerZ = Math.round((Number(point.z) || 0) / tileSize) * tileSize;
    const mesh = createTerrainSurfaceMesh(THREE, {
      columns,
      rows,
      tileSize,
      color,
      texture,
      kind: metadata.kind || "grass",
      isSolid,
      metadata: {
        ...metadata,
        mode: "sculpted",
        baseY: round3(Number(baseY) || 0),
        elevation: round3(Number(elevation) || 0)
      },
      position: { x: centerX, y: Number(baseY) || 0, z: centerZ }
    });
    scene.add(mesh);
    objects.push(mesh);
    paintedSurfaces.add(mesh);

    const colliderRef = createTerrainSurfaceColliderRef(THREE, mesh);
    if (colliderRef) {
      colliders.push(colliderRef);
      mesh.userData.colliderRef = colliderRef;
    }
    return mesh;
  }

  function paintPolygonalTerrainSurface({
    point,
    tileSize = 1,
    elevation = 0.6,
    baseY = 0,
    color = "#3f8f46",
    isSolid = true,
    texture = "solid",
    metadata = {}
  }) {
    if (!point) return null;
    const safeTileSize = Math.max(0.1, Number(tileSize) || 1);
    const height = Math.max(0.05, Number(elevation) || 0.6);
    let mesh = findExistingSurface(point);
    if (!mesh) {
      mesh = createSurfaceForPoint({
        point,
        tileSize: safeTileSize,
        elevation: height,
        baseY,
        color,
        isSolid,
        texture,
        metadata
      });
    }

    const changed = sculptTerrainSurface(THREE, mesh, point, {
      radius: Math.max(safeTileSize, Number(metadata.radius) || safeTileSize),
      elevation: height,
      color
    });
    if (!changed) return null;
    mesh.userData.terrain = {
      ...mesh.userData.terrain,
      ...metadata,
      mode: "sculpted",
      kind: metadata.kind || mesh.userData.terrain?.kind || "grass",
      color,
      texture,
      baseY: round3(Number(baseY) || 0),
      paintedAt: metadata.paintedAt || mesh.userData.terrain?.paintedAt || null
    };
    return { mesh, colliderRef: mesh.userData?.colliderRef || null, key: mesh.uuid };
  }

  function paintTerrainTile({
    point,
    tileSize = 1,
    elevation = 0.6,
    baseY = 0,
    color = "#3f8f46",
    isSolid = true,
    geometryMode = "voxel",
    texture = "solid",
    replaceExisting = true,
    metadata = {}
  }) {
    if (!point) return null;
    if (geometryMode === "polygonal") {
      return paintPolygonalTerrainSurface({
        point,
        tileSize,
        elevation,
        baseY,
        color,
        isSolid,
        texture,
        metadata
      });
    }
    const safeTileSize = Math.max(0.1, Number(tileSize) || 1);
    const height = Math.max(0.05, Number(elevation) || 0.6);
    const gridX = snapKey(Number(point.x) || 0, safeTileSize);
    const gridZ = snapKey(Number(point.z) || 0, safeTileSize);
    const key = buildTileKey(gridX, gridZ, safeTileSize);
    const existing = findExistingTile(key);
    if (existing && replaceExisting) detachMesh(existing);
    if (existing && !replaceExisting) return { mesh: existing, colliderRef: existing.userData?.colliderRef || null, key };

    const x = gridX * safeTileSize;
    const z = gridZ * safeTileSize;
    const isPolygonal = geometryMode === "polygonal";
    const visualHeight = isPolygonal ? Math.min(0.08, height) : height;
    const y = (Number(baseY) || 0) + (isPolygonal ? height - visualHeight / 2 : height / 2);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(safeTileSize, visualHeight, safeTileSize),
      createTerrainMaterial(THREE, { color, texture, kind: metadata.kind })
    );
    mesh.position.set(x, y, z);
    mesh.userData.isWater = metadata.kind === "water";
    mesh.userData.isSolid = isSolid === true && mesh.userData.isWater !== true;
    mesh.userData.breakable = mesh.userData.isWater !== true;
    mesh.userData.generatedByTerrainTool = true;
    mesh.userData.paintedByTerrainTool = true;
    mesh.userData.nvType = isPolygonal ? "terrain-surface" : "box";
    mesh.userData.terrain = {
      ...metadata,
      tileKey: key,
      tileSize: round3(safeTileSize),
      elevation: round3(height),
      baseY: round3(Number(baseY) || 0),
      geometryMode: isPolygonal ? "polygonal" : "voxel",
      texture
    };
    scene.add(mesh);
    objects.push(mesh);

    let colliderRef = null;
    if (mesh.userData.isSolid) {
      const half = new THREE.Vector3(safeTileSize / 2, visualHeight / 2, safeTileSize / 2);
      colliderRef = {
        type: "box",
        box: new THREE.Box3(
          new THREE.Vector3(x - half.x, y - half.y, z - half.z),
          new THREE.Vector3(x + half.x, y + half.y, z + half.z)
        )
      };
      colliders.push(colliderRef);
      mesh.userData.colliderRef = colliderRef;
    }

    paintedTiles.set(key, mesh);
    return { mesh, colliderRef, key };
  }

  return {
    paintTerrainTile,
    paintPolygonalTerrainSurface,
    removeTerrainTile(entry) {
      detachMesh(entry?.mesh || entry);
    }
  };
}
