// Nodevision/scripts/profile-terrain-phase-e-worker.mjs
// Measures a single bounded Node worker against synchronous Surface Nets with transferable chunk and halo buffers. This isolates transport and extraction costs without copying world definitions or elevation caches; it does not claim browser-worker or GPU performance.
import {Worker,isMainThread,parentPort} from 'node:worker_threads';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {surfaceNetSteps} from '../ApplicationSystem/public/MetaWorld/TerrainRepresentation/SurfaceNets.mjs';
import {drainSteps} from '../ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/ProgressiveTerrain.mjs';
const extract=({data,halo})=>drainSteps(surfaceNetSteps(data,[0,0,0],(x,y,z)=>halo[x+1+34*(y+1+34*(z+1))]));
if(!isMainThread){
 parentPort.on('message',input=>{
  const start=performance.now(),r=extract(input),result={...r,positions:new Float32Array(r.positions),normals:new Float32Array(r.normals),uvs:new Float32Array(r.uvs),indices:new Uint32Array(r.indices)};
  parentPort.postMessage({result,workerMs:performance.now()-start},[result.positions.buffer,result.normals.buffer,result.uvs.buffer,result.indices.buffer]);
 });
}else{
 const {createVoxelGenerator}=await import('../ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelTerrainGenerator.mjs');
 const generator=createVoxelGenerator({position:[0,0,0],voxelSize:.25,size:[64,64,64],generator:{id:'nodevision-terrain-v1',version:1,seed:42},generation:{vegetation:true,water:true,caves:true}});
 const prep=performance.now(),data=generator.generateChunk(0,0,0),halo=new Uint16Array(34**3);
 for(let z=-1;z<=32;z++)for(let y=-1;y<=32;y++)for(let x=-1;x<=32;x++)if(x<0||y<0||z<0||x===32||y===32||z===32)halo[x+1+34*(y+1+34*(z+1))]=generator.getRenderVoxel(x,y,z);
 const preparationMs=performance.now()-prep,rows=[],worker=new Worker(new URL(import.meta.url)),startup=performance.now();
 await new Promise((resolve,reject)=>{worker.once('online',resolve);worker.once('error',reject);});const startupMs=performance.now()-startup;
 try{for(let i=0;i<8;i++){
  const start=performance.now(),expected=extract({data,halo}),syncMs=performance.now()-start;
  const sent=performance.now(),input={data:data.slice(),halo:halo.slice()};
  const reply=await new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);worker.postMessage(input,[input.data.buffer,input.halo.buffer]);});
  const roundTripMs=performance.now()-sent;
  for(const name of ['positions','normals','uvs'])assert.deepEqual(reply.result[name],new Float32Array(expected[name]));
  assert.deepEqual(reply.result.indices,new Uint32Array(expected.indices));assert.deepEqual(reply.result.groups,expected.groups);
  rows.push({syncMs,roundTripMs,workerMs:reply.workerMs});
 }}finally{await worker.terminate();}
 await fs.writeFile(process.argv[2]||'/tmp/phase-e-worker.json',JSON.stringify({environment:'Node worker_threads, not browser',workerCount:1,maxOutstanding:1,preparationMs,startupMs,inputBytes:data.byteLength+halo.byteLength,rows},null,2));
}
