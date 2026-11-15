// Nodevision/scripts/profile-terrain-phase-e.mjs
// Separates authoritative occupancy, Surface Nets extraction and repeated-route streaming costs using real terrain modules and records exact output hashes for compatibility.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from '../ApplicationSystem/public/lib/three/three.module.js';
import {createVoxelGenerator} from '../ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelTerrainGenerator.mjs';
import {surfaceNetSteps} from '../ApplicationSystem/public/MetaWorld/TerrainRepresentation/SurfaceNets.mjs';
import {drainSteps} from '../ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/ProgressiveTerrain.mjs';
import {createProceduralVoxelWorld} from '../ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/ProceduralVoxelWorldRuntime.mjs';
import {voxelMaterialOptions} from '../ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelMaterialTestFixtures.mjs';
const def={id:'profile',position:[0,0,0],size:[1000,64,2000],worldExtent:{mode:'infinite'},representation:'polygonal',voxelSize:.25,generator:{id:'nodevision-terrain-v1',version:1,seed:42},chunks:{voxelsPerAxis:32,loadRadius:1},generation:{vegetation:true,water:true,caves:true},streaming:{enabled:false,vegetationEnabled:false}};
const g=createVoxelGenerator(def),meshes=[];
for(const [x,z] of [[0,0],[4,4],[-4,-4],[50,50]]){
 const levels=g.getChunkLevels(x,z);
 for(const y of [...new Set([0,levels.at(-1)])]){
  const cell=[x,y,z],start=performance.now(),data=g.generateChunk(...cell),generationMs=performance.now()-start,times=[];let result,calls=0;
  for(let i=0;i<4;i++){const t=performance.now();result=drainSteps(surfaceNetSteps(data,cell,(...p)=>{calls++;return g.getRenderVoxel(...p);}));times.push(performance.now()-t);}
  meshes.push({cell,generationMs,meshingMs:times,haloQueries:calls/4,vertices:result.positions.length/3,triangles:result.indices.length/3,hash:createHash('sha256').update(JSON.stringify(result)).digest('hex')});
 }
}
const root=createProceduralVoxelWorld(THREE,def,[],voxelMaterialOptions),r=root.userData.terrainRuntime;await r.ready;const route=[];
for(const x of [32,64,96,64,32,64,96,64,32]){
 const start=performance.now(),old={...r.stats};let steps=0;
 do{r.update(new THREE.Vector3(x,40,32));steps++;}while((r.manager.queue.length||r.manager.pending)&&performance.now()-start<20000);
 route.push({x,ms:performance.now()-start,steps,generated:r.stats.generated-old.generated,generationMs:r.stats.generationMs-old.generationMs,meshingMs:r.stats.meshingMs-old.meshingMs,loaded:r.manager.loaded.size,bytes:r.stats.residentBytes,cache:r.meshCache?.snapshot()??null});
}
r.dispose();await fs.writeFile(process.argv[2],JSON.stringify({meshes,route,gpuMs:null},null,2));
