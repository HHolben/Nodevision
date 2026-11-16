// Nodevision/scripts/profile-terrain-e3-cpu.mjs
// Interleave warmed extraction trials on identical real procedural and geographic occupancy. Measure raw Surface Nets versus normal correction independently of frame scheduling, GPU rendering and cold JIT effects.
import fs from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import assert from 'node:assert/strict';
import {createVoxelGenerator} from '../ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelTerrainGenerator.mjs';
import {surfaceNetSteps} from '../ApplicationSystem/public/MetaWorld/TerrainRepresentation/SurfaceNets.mjs';
import {naturalGroundNormals} from '../ApplicationSystem/public/MetaWorld/TerrainRepresentation/GroundNormals.mjs';
import {drainSteps} from '../ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/ProgressiveTerrain.mjs';
const html=await fs.readFile(new URL('../Notebook/test.html',import.meta.url),'utf8'),geo=JSON.parse(html.match(/<script[^>]*id="nodevision-metaworld"[^>]*>([\s\S]*?)<\/script>/i)[1]).objects.find(o=>o.terrainSource==='geographic'),results=[];
for(const name of ['procedural','infinite','geographic']){
 const definition=name==='geographic'?{...geo,generation:{...geo.generation,vegetation:false}}:{id:'cpu',position:[0,0,0],size:[1000,64,2000],voxelSize:.25,generator:{seed:42},generation:{vegetation:true,water:false,caves:false},...(name==='infinite'?{worldExtent:{mode:'infinite'}}:{})};
 const g=createVoxelGenerator(definition);let x=name==='infinite'?-4:1,z=name==='infinite'?-2:1;
 if(name==='geographic')for(let i=1;i<10;i++){const p=Math.min(definition.size[0],definition.size[2])*i/10;if(g.terrainSampler.sample(p,p).covered){x=z=Math.floor(p/8);break;}}
 const chunks=[];let generationMs=0;
 for(let i=0;i<8;i++){const cx=x+i%4,cz=z+Math.floor(i/4),cy=Math.floor(g.getTerrainHeight(cx*32+16,cz*32+16)/32),cell=[cx,cy,cz],start=performance.now(),data=g.generateChunk(...cell);generationMs+=performance.now()-start;chunks.push({cell,data});}
 for(let trial=-1;trial<6;trial++)for(const variant of trial%2?['modified','baseline']:['baseline','modified']){
  const start=performance.now();let vertices=0,triangles=0;
  for(const {cell,data} of chunks){const r=drainSteps(surfaceNetSteps(data,cell,g.getRenderVoxel,variant==='modified'?naturalGroundNormals(g,cell):null));vertices+=r.positions.length/3;triangles+=r.indices.length/3;}
  const elapsedMs=performance.now()-start;if(trial>=0)results.push({name,trial,variant,elapsedMs,vertices,triangles});
 }
 const rows=results.filter(r=>r.name===name);for(let trial=0;trial<6;trial++){const pair=rows.filter(r=>r.trial===trial);assert.equal(pair[0].vertices,pair[1].vertices);assert.equal(pair[0].triangles,pair[1].triangles);}
 console.log(name,'generation',generationMs,'ms');
}
await fs.writeFile(new URL('../docs/TerrainE3CPU.json',import.meta.url),JSON.stringify({method:'Eight identical precomputed chunk buffers per source; one warmup trial per variant discarded; six interleaved warmed extraction trials, no concurrent browser benchmark. Includes halo queries and corrected normal preparation; generation is outside extraction.',results},null,2));
