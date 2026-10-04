// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/ProceduralVoxelWorldRuntime.mjs
// This module owns one logical terrain object, its streamed chunk resources, and its analytic movement collider.

import { validateVoxelWorld } from "./VoxelWorldDefinition.mjs";
import { VOXEL_SIZE, chunkToVoxel, voxelToWorld, worldToVoxel } from "./VoxelCoordinates.mjs";
import { createVoxelGenerator, VOXEL_MATERIALS } from "./VoxelTerrainGenerator.mjs";
import { meshVoxelChunk } from "./VoxelChunkMesher.mjs";
import { VoxelChunkManager } from "./VoxelChunkManager.mjs";
export function createProceduralVoxelWorld(THREE, source, colliders) {
  const definition = validateVoxelWorld(source), generator = createVoxelGenerator(definition);
  const root = new THREE.Group();
  root.position.fromArray(definition.position);
  root.visible = definition.visible !== false && definition.hidden !== true;
  Object.assign(root.userData, { nvType: definition.type, metaWorldLayerId: definition.id, breakable: false });
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
  const colors = VOXEL_MATERIALS.map(item => item ? new THREE.Color(item.color) : null);
  let disposed = false;
  const origin = () => root.position.toArray();
  const collider = { type: "expression-heightfield", target: root, layerId: definition.id,
    materialId: "grass", physicsMaterialId: "grass",
    sampleGroundY(x, z) {
      if (disposed || !root.visible) return NaN;
      const [vx,,vz] = worldToVoxel([x, root.position.y, z], origin());
      const h = generator.getTerrainHeight(vx,vz);
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
      const geometry = new THREE.BufferGeometry(), rgb = [];
      for (const id of result.materials) { const c = colors[id]; rgb.push(c.r,c.g,c.b); }
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(result.positions,3));
      geometry.setAttribute("normal", new THREE.Float32BufferAttribute(result.normals,3));
      geometry.setAttribute("color", new THREE.Float32BufferAttribute(rgb,3));
      geometry.setIndex(result.indices); geometry.computeBoundingSphere();
      mesh = new THREE.Mesh(geometry, material);
      mesh.position.fromArray(voxelToWorld(chunkToVoxel(cell), [0,0,0]));
      Object.assign(mesh.userData, { proceduralTerrainId: definition.id, proceduralChunk: cell.slice(),
        runtimeGenerated: true, breakable: false, physicsMaterialId: "grass" });
      root.add(mesh);
    }
    return { mesh, faceCount: result.faceCount, solidVoxels: result.solidVoxels,
      generationMs: generated-start, meshingMs: performance.now()-generated };
  }, entry => { entry.mesh?.geometry.dispose(); entry.mesh?.removeFromParent(); });
  const runtime = {
    generator, manager, definition, stats: manager.stats,
    update(position) {
      if (!disposed && root.visible) manager.update(worldToVoxel([position.x,position.y,position.z], origin()));
    },
    prepareSpawn(position, playerHeight) {
      if (!root.visible) return;
      position.x = Math.max(root.position.x + 0.5, Math.min(root.position.x + definition.size[0] - 0.5, position.x));
      position.z = Math.max(root.position.z + 0.5, Math.min(root.position.z + definition.size[2] - 0.5, position.z));
      const y = collider.sampleGroundY(position.x, position.z);
      if (Number.isFinite(y)) position.y = Math.max(position.y, y + playerHeight);
      runtime.update(position);
    },
    serialize() {
      return { ...structuredClone(definition), position: origin(), visible: root.visible, hidden: !root.visible };
    },
    dispose() {
      if (disposed) return;
      disposed = true; manager.dispose(); material.dispose();
      const index = colliders.indexOf(collider); if (index >= 0) colliders.splice(index,1);
      root.removeFromParent();
    }
  };
  // Existing picking uses nonrecursive raycasts; forward terrain hits to child chunks.
  root.raycast = (raycaster, hits) => {
    if (!root.visible || disposed) return;
    root.updateMatrixWorld(true);
    for (const mesh of root.children) mesh.raycast(raycaster, hits);
  };
  root.userData.proceduralVoxelRuntime = runtime;
  return root;
}
