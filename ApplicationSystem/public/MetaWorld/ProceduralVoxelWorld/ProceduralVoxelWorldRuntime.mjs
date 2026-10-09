// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/ProceduralVoxelWorldRuntime.mjs
// This module owns one logical terrain object, its streamed chunk resources, and its analytic movement collider.

import { findVoxelSpawn } from "./VoxelSpawn.mjs";
import { createFeatureCollision } from "./VoxelFeatureCollision.mjs";
import { validateVoxelWorld } from "./VoxelWorldDefinition.mjs";
import { VOXEL_SIZE, chunkToVoxel, voxelToWorld, worldToVoxel } from "./VoxelCoordinates.mjs";
import { createVoxelGenerator } from "./VoxelTerrainGenerator.mjs";
import { meshVoxelChunk } from "./VoxelChunkMesher.mjs";
import { createVoxelMaterialPalette } from "./VoxelMaterialPalette.mjs";
import { createVoxelLiquidVolume } from "./VoxelLiquidVolume.mjs";
import { VoxelChunkManager } from "./VoxelChunkManager.mjs";
export function createProceduralVoxelWorld(THREE, source, colliders, materialOptions = {}) {
  const definition = validateVoxelWorld(source), generator = createVoxelGenerator(definition);
  const root = new THREE.Group();
  root.position.fromArray(definition.position);
  root.visible = definition.visible !== false && definition.hidden !== true;
  Object.assign(root.userData, { nvType: definition.type, metaWorldLayerId: definition.id, breakable: false });
  let palette = null, disposed = false, lastPosition = null;
  const origin = () => root.position.toArray();
  const collider = { type: "expression-heightfield", target: root, layerId: definition.id,
    materialId: "grass", physicsMaterialId: "grass", voxelTerrain: true,
    sampleGroundY(x, z, maxY = Infinity) {
      if (disposed || !root.visible) return NaN;
      const [vx,,vz] = worldToVoxel([x, root.position.y, z], origin());
      const h = generator.getSolidHeight(vx,vz,(maxY-root.position.y)/VOXEL_SIZE);
      const entry = palette?.entries[generator.getVoxel(vx,h-1,vz)];
      if(entry)Object.assign(collider,{materialId:entry.materialId,physicsMaterialId:entry.physicsMaterialId,materialFile:entry.materialFile,MatterState:entry.matterState,materialDefinition:entry.materialDefinition});
      return h ? root.position.y + h * VOXEL_SIZE : NaN;
    },
    containsPlayer(point, radius) {
      return point.x >= root.position.x+radius && point.z >= root.position.z+radius
        && point.x <= root.position.x+definition.size[0]-radius
        && point.z <= root.position.z+definition.size[2]-radius;
    }
  };
  colliders.push(collider); root.userData.colliderRef = collider;
  const manager = new VoxelChunkManager(generator, definition.chunks.loadRadius, cell => {
    const start = performance.now(), data = generator.generateChunk(...cell), generated = performance.now();
    const result = meshVoxelChunk(data, cell, generator.getVoxel);
    let mesh = null;
    if (result.faceCount) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(result.positions,3));
      geometry.setAttribute("normal", new THREE.Float32BufferAttribute(result.normals,3));
      for (const group of result.groups) geometry.addGroup(group.start, group.count, group.materialIndex);
      geometry.setIndex(result.indices); geometry.computeBoundingSphere();
      mesh = new THREE.Mesh(geometry, palette.materials);
      mesh.position.fromArray(voxelToWorld(chunkToVoxel(cell), [0,0,0]));
      Object.assign(mesh.userData, { proceduralTerrainId: definition.id, proceduralChunk: cell.slice(),
        runtimeGenerated: true, breakable: false });
      root.add(mesh);
    }
    return { mesh, faceCount: result.faceCount, solidVoxels: result.solidVoxels,
      generationMs: generated-start, meshingMs: performance.now()-generated };
  }, entry => { entry.mesh?.geometry.dispose(); entry.mesh?.removeFromParent(); });
  const runtime = {
    generator, manager, definition, stats: manager.stats,
    get renderDistance() { return manager.radius * 32 * VOXEL_SIZE; },
    setRenderDistance(metres) {
      if (disposed || !Number.isFinite(metres)) return;
      const radius = Math.max(1, Math.min(8, Math.round(metres / (32 * VOXEL_SIZE))));
      if (radius === manager.radius) return;
      manager.radius = radius;
      manager.center = "";
      manager.queue.length = 0;
      if (lastPosition) runtime.update(lastPosition);
    },
    getVoxelMaterialId: generator.getVoxelMaterialId,
    getBiome: generator.getBiome,
    getVoxelMaterial(x, y, z) { return palette?.entries[generator.getVoxel(x,y,z)] || null; },
    get materials() { return palette?.materials || []; },
    update(position) {
      lastPosition = { x: position.x, y: position.y, z: position.z };
      if (!disposed && palette && root.visible) manager.update(worldToVoxel([position.x,position.y,position.z], origin()));
    },
    prepareSpawn(position, playerHeight) {
      if (!root.visible) return;
      const requested=worldToVoxel([position.x,position.y,position.z],origin());
      const [x,y,z]=findVoxelSpawn(generator,requested[0],requested[2],playerHeight);
      position.x=root.position.x+(x+.5)*VOXEL_SIZE;position.z=root.position.z+(z+.5)*VOXEL_SIZE;
      position.y=Math.max(position.y,root.position.y+y*VOXEL_SIZE+playerHeight);
      runtime.update(position);
    },
    serialize() {
      return { ...structuredClone(definition), position: origin(), visible: root.visible, hidden: !root.visible };
    },
    dispose() {
      if (disposed) return;
      disposed = true; generator.features.clear(); generator.clearColumns(); manager.dispose(); palette?.dispose();
      const index = colliders.indexOf(collider); if (index >= 0) colliders.splice(index,1);
      root.removeFromParent();
    }
  };
  collider.sampleMaterial = (x,y,z) => runtime.getVoxelMaterial(...worldToVoxel([x,y,z], origin()));
  runtime.ready = createVoxelMaterialPalette(THREE, materialOptions).then(resolved => {
    if (disposed) { resolved.dispose(); return false; }
    palette = resolved;
    collider.intersectsPlayer = createFeatureCollision(root, generator, palette.entries, () => disposed);
    root.userData.waterVolumeRef = createVoxelLiquidVolume(root, runtime, palette.entries, () => disposed);
    const surface = palette.entries[1];
    Object.assign(collider, { materialId: surface.materialId, physicsMaterialId: surface.physicsMaterialId,
      materialFile: surface.materialFile, MatterState: surface.matterState, materialDefinition: surface.materialDefinition });
    Object.assign(root.userData, { physicsMaterialId: surface.physicsMaterialId,
      physicsMaterialFile: surface.materialFile, MatterState: surface.matterState, matterState: surface.matterState });
    if (lastPosition) runtime.update(lastPosition);
    return true;
  }).catch(error => { runtime.materialError = error; console.error('Procedural terrain material loading failed:', error); return false; });
  // Existing picking uses nonrecursive raycasts; forward terrain hits to child chunks.
  root.raycast = (raycaster, hits) => {
    if (!root.visible || disposed) return;
    root.updateMatrixWorld(true);
    for (const mesh of root.children) mesh.raycast(raycaster, hits);
  };
  root.userData.proceduralVoxelRuntime = runtime;
  return root;
}
