// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/ProceduralVoxelWorldRuntime.mjs
// This module owns one logical terrain object, its streamed chunk resources, and its analytic movement collider.

import { GEO_BUDGETS as B } from '../Geographic/Budgets.mjs';
import { timedSteps } from './ProgressiveTerrain.mjs';
import { createCalendarSeasonBinding } from '../Aegean/CalendarSeasons.mjs';
import { findVoxelSpawn } from "./VoxelSpawn.mjs";
import { createFeatureCollision } from "./VoxelFeatureCollision.mjs";
import { validateVoxelWorld } from "./VoxelWorldDefinition.mjs";
import { VOXEL_SIZE, chunkToVoxel, voxelToWorld, worldToVoxel } from "./VoxelCoordinates.mjs";
import { createVoxelGenerator } from "./VoxelTerrainGenerator.mjs";
import { meshGreedyVoxelChunk } from './VoxelGreedyMesher.mjs';
import { meshVoxelChunk,meshVoxelChunkSteps } from "./VoxelChunkMesher.mjs";
import { createVoxelMaterialPalette } from "./VoxelMaterialPalette.mjs";
import { createVoxelLiquidVolume } from "./VoxelLiquidVolume.mjs";
import { VoxelChunkManager } from "./VoxelChunkManager.mjs";
export function createProceduralVoxelWorld(THREE, source, colliders, materialOptions = {}) {
  const definition = validateVoxelWorld(source), generator = createVoxelGenerator(definition);
  const root = new THREE.Group();
  root.position.fromArray(definition.position);
  root.visible = definition.visible !== false && definition.hidden !== true;
  Object.assign(root.userData, { nvType: definition.type, metaWorldLayerId: definition.id, breakable: false });
  let palette = null, disposed = false, lastPosition = null, activeAstronomy = null;
  const floorOffset = definition.heightLimits?.min || 0;
  const originPoint = () => new THREE.Vector3(root.position.x,root.position.y+floorOffset,root.position.z);
  const origin = () => originPoint().toArray();
  const collider = { type: "expression-heightfield", target: root, layerId: definition.id,
    materialId: "grass", physicsMaterialId: "grass", voxelTerrain: true,
    sampleGroundY(x, z, maxY = Infinity) {
      if (disposed || !root.visible) return NaN;
      const voxelOrigin = origin();
      const [vx,,vz] = worldToVoxel([x, root.position.y, z], voxelOrigin);
      const h = generator.getSolidHeight(vx,vz,(maxY-voxelOrigin[1])/VOXEL_SIZE);
      const entry = palette?.entries[generator.getVoxel(vx,h-1,vz)];
      if(entry)Object.assign(collider,{materialId:entry.materialId,physicsMaterialId:entry.physicsMaterialId,materialFile:entry.materialFile,MatterState:entry.matterState,materialDefinition:entry.materialDefinition});
      return h ? voxelOrigin[1] + h * VOXEL_SIZE : NaN;
    },
    containsPlayer(point, radius) {
      return point.x >= root.position.x+radius && point.z >= root.position.z+radius
        && point.x <= root.position.x+definition.size[0]-radius
        && point.z <= root.position.z+definition.size[2]-radius;
    }
  };
  if (definition.boundaryMode === 'open') delete collider.containsPlayer;
  colliders.push(collider); root.userData.colliderRef = collider;
  function finishChunk(cell,result,generationMs,meshingMs){
    const commitStart=performance.now();
    let mesh = null;
    if (result.faceCount) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(result.positions,3));
      geometry.setAttribute("uv", new THREE.Float32BufferAttribute(result.uvs,2));
      geometry.setAttribute("normal", new THREE.Float32BufferAttribute(result.normals,3));
      for (const group of result.groups) geometry.addGroup(group.start, group.count, group.materialIndex);
      geometry.setIndex(result.indices); geometry.computeBoundingSphere();
      mesh = new THREE.Mesh(geometry, palette.materials);
      mesh.position.fromArray(voxelToWorld(chunkToVoxel(cell), [0,floorOffset,0]));
      Object.assign(mesh.userData, { proceduralTerrainId: definition.id, proceduralChunk: cell.slice(),
        runtimeGenerated: true, breakable: false });
      root.add(mesh);
    }
    return { mesh, faceCount: result.faceCount, solidVoxels: result.solidVoxels,
      generationMs, meshingMs:meshingMs+performance.now()-commitStart,buildMs:generationMs+meshingMs+performance.now()-commitStart,
      residentBytes:result.positions.length*4+result.normals.length*4+result.uvs.length*4+result.indices.length*4 };
  }
  function* progressiveChunk(cell){
    const generated=yield* timedSteps(generator.generateChunkSteps(...cell));
    const meshed=yield* timedSteps(meshVoxelChunkSteps(generated.value,cell,generator.getVoxel));
    return finishChunk(cell,meshed.value,generated.cpuMs,meshed.cpuMs);
  }
  const progressive=definition.geographic?.version===2;
  const manager = new VoxelChunkManager(generator,definition.chunks.loadRadius,cell=>{
    if(progressive)return progressiveChunk(cell);
    const start=performance.now(),data=generator.generateChunk(...cell),generated=performance.now();
    const result=(definition.environment?.id==='aegean'?meshGreedyVoxelChunk:meshVoxelChunk)(data,cell,generator.getVoxel);
    return finishChunk(cell,result,generated-start,performance.now()-generated);
  },entry=>{entry.mesh?.geometry.dispose();entry.mesh?.removeFromParent();},progressive?{budgetMs:B.frameMs,maxChunks:B.residentChunks,maxBytes:B.residentBytes}:null);
  const seasons=createCalendarSeasonBinding(definition.environment,season=>{
    if(disposed||!generator.setSeason(season))return false;
    manager.invalidateBounds({minX:0,minZ:0,maxX:generator.dimensions[0],maxZ:generator.dimensions[2]});return true;
  });
  const runtime = {
    seasonState:seasons.state,updateCalendar(astronomy){if(disposed)return false;activeAstronomy=astronomy;return seasons.update(astronomy);},
    generator, manager, definition, stats: manager.stats,
    setPathConstraints(paths,bounds) {
      generator.setPathOrigin(root.position.toArray());
      generator.setPathConstraints(paths);
      const margin=generator.pathFeatureReach+1;
      if(bounds)manager.invalidateBounds({minX:(bounds.minX-root.position.x)/.25-margin,maxX:(bounds.maxX-root.position.x)/.25+margin,
        minZ:(bounds.minZ-root.position.z)/.25-margin,maxZ:(bounds.maxZ-root.position.z)/.25+margin});
      if(lastPosition)runtime.update(lastPosition);
    },
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
    update(position,astronomy=activeAstronomy) {
      if(disposed)return;
      activeAstronomy=astronomy;seasons.update(astronomy);
      lastPosition = { x: position.x, y: position.y, z: position.z };
      if (!disposed && palette && root.visible) manager.update(worldToVoxel([position.x,position.y,position.z], origin()));
    },
    prepareSpawn(position, playerHeight) {
      if (!root.visible) return;
      if (definition.boundaryMode === 'open' && (position.x < root.position.x || position.z < root.position.z || position.x >= root.position.x+definition.size[0] || position.z >= root.position.z+definition.size[2])) return;
      const requested=worldToVoxel([position.x,position.y,position.z],origin());
      const [x,y,z]=findVoxelSpawn(generator,requested[0],requested[2],playerHeight);
      position.x=root.position.x+(x+.5)*VOXEL_SIZE;position.z=root.position.z+(z+.5)*VOXEL_SIZE;
      position.y=Math.max(position.y,origin()[1]+y*VOXEL_SIZE+playerHeight);
      runtime.update(position);
    },
    serialize() {
      return { ...structuredClone(definition), position: root.position.toArray(), visible: root.visible, hidden: !root.visible };
    },
    dispose() {
      if (disposed) return;
      disposed = true; generator.features.clear(); generator.clearColumns(); manager.dispose(); palette?.dispose();
      const index = colliders.indexOf(collider); if (index >= 0) colliders.splice(index,1);
      root.removeFromParent();
    }
  };
  collider.sampleMaterial = (x,y,z) => runtime.getVoxelMaterial(...worldToVoxel([x,y,z], origin()));
  runtime.ready = createVoxelMaterialPalette(THREE, {...materialOptions,aegean:definition.environment?.id==='aegean'||definition.terrainSource==='geographic'}).then(resolved => {
    if (disposed) { resolved.dispose(); return false; }
    palette = resolved;
    collider.intersectsPlayer = createFeatureCollision(root, generator, palette.entries, () => disposed, originPoint);
    root.userData.waterVolumeRef = createVoxelLiquidVolume(root, runtime, palette.entries, () => disposed, originPoint);
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
