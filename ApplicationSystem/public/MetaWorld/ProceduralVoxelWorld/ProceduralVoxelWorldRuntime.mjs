// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/ProceduralVoxelWorldRuntime.mjs
// This module owns one logical terrain object, its streamed chunk resources, and its analytic movement collider.
import {usesMap} from '../TerrainMaps/Source.mjs';
import {bindMap} from '../TerrainMaps/Binding.mjs';

import {raycastCells} from '../SessionVoxels/Raycast.mjs';
import {createSessionPalette} from '../SessionVoxels/SessionPalette.mjs';
import {composeSession} from '../SessionVoxels/TerrainSession.mjs';
import { terrainData } from '../TerrainRepresentation/TerrainData.mjs';
import { surfaceNetSteps } from '../TerrainRepresentation/SurfaceNets.mjs';
import { chunkRepresentation } from '../TerrainRepresentation/ChunkRepresentation.mjs';
import { meshTerrainCollision } from '../TerrainRepresentation/MeshCollision.mjs';
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
  const definition = validateVoxelWorld(source), map=usesMap(definition)?bindMap(definition,materialOptions):null, generator = composeSession(createVoxelGenerator(definition,map));
  let mapWindow=null,mapWork=null,mapFailedWindow=null,mapRevision=0;const mapEvents=[],mapPointRequests=new Map();
  const root = new THREE.Group();
  root.position.fromArray(definition.position);
  root.visible = definition.visible !== false && definition.hidden !== true;
  Object.assign(root.userData, { nvType: definition.type, metaWorldLayerId: definition.id, breakable: false });
  let constructionEdited=false,sessionEdited=false;const sessionPalette=createSessionPalette(THREE);generator.setConstructionMaterialResolver(sessionPalette.material);
  let palette = null, resolvedPalette=null, disposed = false, lastPosition = null, activeAstronomy = null;
  const floorOffset = definition.heightLimits?.min || 0;
  const originPoint = () => new THREE.Vector3(root.position.x,root.position.y+floorOffset,root.position.z);
  const origin = () => originPoint().toArray();
  const collider = { type: "expression-heightfield", target: root, layerId: definition.id,
    materialId: "grass", physicsMaterialId: "grass", voxelTerrain: true,
    sampleGroundY(x, z, maxY = Infinity) {
      if (disposed || !root.visible || map&&!map.readyAt(x-root.position.x,z-root.position.z)) return NaN;
      if(representation.active==='polygonal'&&!constructionEdited&&!sessionEdited){const surface=polygonCollision.sampleGroundY(x,z,maxY);if(Number.isFinite(surface))return surface;}
      // Until a streamed surface arrives, retain local analytic ground support.
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
  function finishChunk(cell,result,generationMs,meshingMs,hidden=false){
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
      mesh.visible=!hidden;root.add(mesh);
    }
    return { mesh, faceCount: result.faceCount, solidVoxels: result.solidVoxels,
      generationMs, meshingMs:meshingMs+performance.now()-commitStart,buildMs:generationMs+meshingMs+performance.now()-commitStart,
      residentBytes:result.positions.length*4+result.normals.length*4+result.uvs.length*4+result.indices.length*4 };
  }
  function* progressiveChunk(cell,mode=representation.active,hidden=false){
    const generated=yield* timedSteps(generator.generateChunkSteps(...cell));
    const meshed=yield* timedSteps((mode==='polygonal'?surfaceNetSteps:meshVoxelChunkSteps)(generated.value,cell,generator.getRenderVoxel));
    return finishChunk(cell,meshed.value,generated.cpuMs,meshed.cpuMs,hidden);
  }
  const progressive=definition.geographic?.version===2||!!map;
  const manager = new VoxelChunkManager(generator,definition.chunks.loadRadius,cell=>{
    if(manager.options)return progressiveChunk(cell);
    const start=performance.now(),data=generator.generateChunk(...cell),generated=performance.now();
    const result=(definition.environment?.id==='aegean'?meshGreedyVoxelChunk:meshVoxelChunk)(data,cell,generator.getRenderVoxel);
    return finishChunk(cell,result,generated-start,performance.now()-generated);
  },releaseChunk,progressive||definition.representation==='polygonal'?{budgetMs:B.frameMs,maxChunks:B.residentChunks,maxBytes:B.residentBytes}:null);
  function releaseChunk(entry){entry.mesh?.geometry.dispose();entry.mesh?.removeFromParent();}
  const representation=chunkRepresentation(definition,manager,progressiveChunk,releaseChunk);
  const polygonCollision=meshTerrainCollision(THREE,root,()=>[...manager.loaded.values()].map(e=>e.mesh).filter(Boolean),i=>palette?.entries[i+1]?.collider?.solid===true);
  const seasons=createCalendarSeasonBinding(definition.environment,season=>{
    if(disposed||!generator.setSeason(season))return false;
    representation.cancel();manager.invalidateBounds({minX:0,minZ:0,maxX:generator.dimensions[0],maxZ:generator.dimensions[2]});return true;
  });
  const runtime = {
    seasonState:seasons.state,updateCalendar(astronomy){if(disposed)return false;activeAstronomy=astronomy;return seasons.update(astronomy);},
    generator, manager, definition, stats: manager.stats,map,
    get mapRevision(){return mapRevision;},mapRevisionFor(bounds){if(!bounds)return mapRevision;return mapEvents.reduce((n,e)=>!e.bounds||e.bounds.minX<=bounds.maxX&&e.bounds.maxX>=bounds.minX&&e.bounds.minZ<=bounds.maxZ&&e.bounds.maxZ>=bounds.minZ?Math.max(n,e.revision):n,0);},
    sampleTerrainSource(x,z){const lx=x-root.position.x,lz=z-root.position.z,sample=generator.terrainSampler?.sample(lx,lz)||{covered:lx>=0&&lz>=0&&lx<definition.size[0]&&lz<definition.size[2],elevation:floorOffset+generator.base.getTerrainHeight(Math.floor(lx/.25),Math.floor(lz/.25))*.25,biome:generator.getBiome(Math.floor(lx/.25),Math.floor(lz/.25)),material:null};return {...sample,elevation:sample.elevation===null?null:sample.elevation+root.position.y};},
    requestMapPoint(x,z){if(!map||disposed)return;const lx=x-root.position.x,lz=z-root.position.z,key=`${Math.floor(lx)},${Math.floor(lz)}`;if(mapPointRequests.has(key))return;const work=runtime.prepareMapRegion({minX:lx-1,maxX:lx+1,minZ:lz-1,maxZ:lz+1}).catch(error=>{if(!disposed)runtime.mapError=error;}).finally(()=>mapPointRequests.delete(key));mapPointRequests.set(key,work);},
    async prepareMapRegion(bounds){if(!map)return;await map.prepare(bounds);generator.invalidateTerrainSource();mapLoaded(bounds);mapWindow=null;},
    async declareMapRegionChanged(bounds){if(!map)throw Error('This terrain has no map');return map.declareChanged(bounds);},
    mapSampleReady(point){return !map||map.readyAt(point[0]-root.position.x,point[2]-root.position.z);},
    data:terrainData(root,{kind:'occupancy',parameters:definition,dimensions:definition.size,seed:definition.generator.seed,originOffset:[0,floorOffset,0],sampleVoxel:generator.getVoxel,sampleHeight:(x,z)=>generator.getSolidHeight(Math.floor(x/.25),Math.floor(z/.25))*.25,biome:generator.getBiome,materials:()=>palette?.materials||[]}),
    get representation(){return representation.active;},
    async setRepresentation(mode,beforeCommit){await runtime.ready;if(disposed)return false;const result=await representation.setRepresentation(mode,beforeCommit);if(result)manager.options=progressive||mode==='polygonal'?{budgetMs:B.frameMs,maxChunks:B.residentChunks,maxBytes:B.residentBytes}:null;return result;},
    setPathConstraints(paths,bounds) {
      representation.cancel();generator.setPathOrigin(root.position.toArray());
      generator.setPathConstraints(paths);
      const margin=generator.pathFeatureReach+1;
      if(bounds)manager.invalidateBounds({minX:(bounds.minX-root.position.x)/.25-margin,maxX:(bounds.maxX-root.position.x)/.25+margin,
        minZ:(bounds.minZ-root.position.z)/.25-margin,maxZ:(bounds.maxZ-root.position.z)/.25+margin});
      if(lastPosition)runtime.update(lastPosition);
    },
    setConstructions(entries,bounds){
      constructionEdited=true;representation.cancel();generator.setConstructionOrigin(root.position.toArray());generator.setConstructions(entries);
      for(const b of bounds){const o=origin();manager.invalidateRegion({min:b.min.map((v,i)=>(v-o[i])/.25-1),max:b.max.map((v,i)=>(v-o[i])/.25+1)});}
      if(lastPosition)runtime.update(lastPosition);
    },
    sessionOrigin:origin,
    bindSession(session,toCell){generator.bindSession({session,toCell,fromWorld:p=>worldToVoxel(p,origin()),material:runtime.sessionMaterial,solid:sessionPalette.solid});},
    sessionMaterial:sessionPalette.material,
    invalidateSession(cells){sessionEdited=true;representation.cancel();const chunks=new Map();for(const p of cells)for(let x=Math.floor((p[0]-1)/32);x<=Math.floor((p[0]+1)/32);x++)for(let y=Math.floor((p[1]-1)/32);y<=Math.floor((p[1]+1)/32);y++)for(let z=Math.floor((p[2]-1)/32);z<=Math.floor((p[2]+1)/32);z++)chunks.set([x,y,z].join(','),[x,y,z]);for(const c of chunks.values())manager.invalidateRegion({min:c.map(n=>n*32),max:c.map(n=>(n+1)*32)});if(lastPosition)runtime.update(lastPosition);},
    getPersistentVoxel(x,y,z){return generator.persistent.getVoxel(x,y,z);},
    getPersistentMaterial(x,y,z){const i=generator.persistent.getVoxel(x,y,z),entry=palette?.entries[i];if(!i||!entry)return null;const color=palette.materials[i-1].color.clone().convertLinearToSRGB();return {materialId:entry.materialId,materialFile:entry.materialFile,rgba:[Math.round(color.r*255),Math.round(color.g*255),Math.round(color.b*255),Math.round((palette.materials[i-1].opacity??1)*255)],solid:entry.collider?.solid===true,matterState:entry.matterState,paletteIndex:i};},
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
      if(map&&palette){const {key,bounds}=mapArea(position);if(mapWindow!==key){if(!mapWork&&mapFailedWindow!==key){mapWork=map.prepare(bounds).then(()=>{if(disposed)return;generator.invalidateTerrainSource();mapLoaded(bounds);mapWindow=key;runtime.mapError=null;}).catch(error=>{if(!disposed&&!error.message.includes('superseded')){runtime.mapError=error;mapFailedWindow=key;}}).finally(()=>{mapWork=null;if(!disposed&&mapWindow===key&&lastPosition)runtime.update(lastPosition);});}return;}}
      if (!disposed && palette && root.visible && !representation.pending) manager.update(worldToVoxel([position.x,position.y,position.z], origin()));
    },
    prepareSpawn(position, playerHeight) {
      if (!root.visible) return;
      if (definition.boundaryMode === 'open' && (position.x < root.position.x || position.z < root.position.z || position.x >= root.position.x+definition.size[0] || position.z >= root.position.z+definition.size[2])) return;
      if(map&&!runtime.mapSampleReady(position.toArray())){runtime.update(position);return;}
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
      disposed = true; map?.dispose();representation.dispose();generator.features.clear(); generator.clearColumns(); manager.dispose(); palette?.dispose();sessionPalette.dispose();
      const index = colliders.indexOf(collider); if (index >= 0) colliders.splice(index,1);
      root.removeFromParent();
    }
  };
  function mapLoaded(b){mapRevision++;mapEvents.push({revision:mapRevision,bounds:{minX:b.minX+root.position.x,maxX:b.maxX+root.position.x,minZ:b.minZ+root.position.z,maxZ:b.maxZ+root.position.z}});if(mapEvents.length>64){const old=mapEvents.splice(0,mapEvents.length-63).at(-1);mapEvents.unshift({revision:old.revision,bounds:null});}}
  function mapArea(position){const x=Math.floor((position.x-root.position.x)/8),z=Math.floor((position.z-root.position.z)/8),radius=manager.radius*8+8+generator.pathFeatureReach*.25+4;return {key:`${x},${z},${manager.radius}`,bounds:{minX:Math.max(0,Math.min(definition.size[0],x*8-radius)),maxX:Math.max(0,Math.min(definition.size[0],x*8+8+radius)),minZ:Math.max(0,Math.min(definition.size[2],z*8-radius)),maxZ:Math.max(0,Math.min(definition.size[2],z*8+8+radius))}};}
  map?.onChanged(bounds=>{if(disposed)return;representation.cancel();generator.invalidateTerrainSource();mapLoaded(bounds);mapWindow=null;mapFailedWindow=null;const margin=generator.pathFeatureReach+2;manager.invalidateBounds({minX:bounds.minX/.25-margin,maxX:bounds.maxX/.25+margin,minZ:bounds.minZ/.25-margin,maxZ:bounds.maxZ/.25+margin});if(lastPosition)runtime.update(lastPosition);});
  collider.sampleMaterial = (x,y,z) => runtime.getVoxelMaterial(...worldToVoxel([x,y,z], origin()));
  runtime.ready = Promise.all([createVoxelMaterialPalette(THREE, {...materialOptions,aegean:definition.environment?.id==='aegean'||definition.terrainSource==='geographic'||!!map}).then(value=>{if(disposed||map?.error){value.dispose();return null;}resolvedPalette=value;return value;}),map?.ready]).then(async ([resolved]) => {
    if (disposed||!resolved) { resolved?.dispose(); return false; }
    palette = resolved;sessionPalette.attach(palette);
    if(map){const area=mapArea(lastPosition||{x:root.position.x+definition.size[0]/2,z:root.position.z+definition.size[2]/2});await map.prepare(area.bounds);if(disposed)return false;generator.invalidateTerrainSource();mapLoaded(area.bounds);mapWindow=area.key;}
    const voxelCollision=createFeatureCollision(root, generator, palette.entries, () => disposed, originPoint);
    collider.intersectsPlayer=(...args)=>representation.active==='polygonal'&&!constructionEdited&&!sessionEdited?polygonCollision.intersectsPlayer(...args):voxelCollision(...args);
    root.userData.waterVolumeRef = createVoxelLiquidVolume(root, runtime, palette.entries, () => disposed, originPoint);
    const surface = palette.entries[1];
    Object.assign(collider, { materialId: surface.materialId, physicsMaterialId: surface.physicsMaterialId,
      materialFile: surface.materialFile, MatterState: surface.matterState, materialDefinition: surface.materialDefinition });
    Object.assign(root.userData, { physicsMaterialId: surface.physicsMaterialId,
      physicsMaterialFile: surface.materialFile, MatterState: surface.matterState, matterState: surface.matterState });
    if (lastPosition) runtime.update(lastPosition);
    return true;
  }).catch(error => {if(!palette)resolvedPalette?.dispose(); if(map)runtime.mapError=error;else runtime.materialError=error;console.error('Terrain asset loading failed:', error); return false; });
  // Existing picking uses nonrecursive raycasts; forward terrain hits to child chunks.
  root.raycast = (raycaster, hits) => {
    if (!root.visible || disposed) return;
    if(sessionEdited){const ray=raycaster.ray,hit=raycastCells(ray.origin.toArray(),ray.direction.toArray(),p=>generator.getRenderVoxel(...p),{gridOrigin:origin(),maxDistance:Math.min(raycaster.far,512)});if(hit&&hit.distance>=raycaster.near)hits.push({distance:hit.distance,point:ray.at(hit.distance,new THREE.Vector3()),object:root,face:{normal:new THREE.Vector3(...hit.normal)}});return;}
    root.updateMatrixWorld(true);
    for (const mesh of root.children) if(mesh.visible)mesh.raycast(raycaster, hits);
  };
  root.userData.proceduralVoxelRuntime = runtime;root.userData.terrainRuntime=runtime;
  return root;
}
