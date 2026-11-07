// Nodevision/ApplicationSystem/public/MetaWorld/TerrainLOD/Streaming.test.mjs
// These tests exercise real generated terrain, coarse geometry, transition masking, bounded prediction, and collision fallback. They distinguish visual availability from detailed voxel completion.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../lib/three/three.module.js';
import {heightfieldSteps} from './Heightfield.mjs';
import {createTileMesh} from './TileMesh.mjs';
import {terrainStreaming} from './Settings.mjs';
import {drainSteps} from '../ProceduralVoxelWorld/ProgressiveTerrain.mjs';
import {createProceduralVoxelWorld} from '../ProceduralVoxelWorld/ProceduralVoxelWorldRuntime.mjs';
import {voxelMaterialOptions} from '../ProceduralVoxelWorld/VoxelMaterialTestFixtures.mjs';
const definition={type:'procedural-voxel-world',id:'terrain',position:[10,3,20],size:[256,32,256],voxelSize:.25,generator:{id:'nodevision-terrain-v1',version:1,seed:42},chunks:{voxelsPerAxis:32,loadRadius:1},generation:{vegetation:false,water:false,caves:false}};
const sampler={sample:(x,z)=>({covered:!(x>20&&x<24&&z>20&&z<24),elevation:2+x*.1+z*.2}),resolution:[1,1]};
const generator={terrainSampler:sampler,getWaterTop:()=>0,getRenderVoxel:()=>1};
test('coarse geometry has distinct complexity, world anchored edges, and conservative NoData',()=>{
 const a=drainSteps(heightfieldSteps(generator,definition,0,0,1)),b=drainSteps(heightfieldSteps(generator,definition,0,0,2));
 const count=t=>t.sections.reduce((n,s)=>n+s.faces.length,0);assert.ok(count(a)>count(b)*4);
 const c=drainSteps(heightfieldSteps(generator,definition,1,0,2));
 const edge=t=>t.sections.flatMap(s=>s.faces).flatMap(f=>f.vertices).filter(v=>v.p[0]===64&&v.p[1]>1+v.p[0]*.1+v.p[2]*.2);
 const positions=new Set(edge(b).map(v=>v.p.join(',')));assert.ok(edge(c).every(v=>positions.has(v.p.join(','))));
 for(const s of b.sections)for(const f of s.faces){const xs=f.vertices.map(v=>v.p[0]),zs=f.vertices.map(v=>v.p[2]);assert.ok(!(Math.min(...xs)<24&&Math.max(...xs)>20&&Math.min(...zs)<24&&Math.max(...zs)>20));}
 const tile=createTileMesh(THREE,b,[new THREE.MeshBasicMaterial()]),before=tile.mesh.geometry.index.count;
 tile.mask((x,z)=>x===0&&z===0);assert.ok(tile.mesh.geometry.index.count<before);tile.mask(()=>false);assert.equal(tile.mesh.geometry.index.count,before);tile.dispose();
});
test('runtime displays distant geometry independently, predicts ahead, retains source and disposes resources',async()=>{
 const colliders=[],root=createProceduralVoxelWorld(THREE,definition,colliders,voxelMaterialOptions),r=root.userData.terrainRuntime;await r.ready;
 const point=new THREE.Vector3(26,30,36),start=performance.now();
 while(r.lod.snapshot().tiles<3&&performance.now()-start<5000)r.update(point);
 assert.ok(r.lod.snapshot().tiles>=3);assert.ok(r.lod.snapshot().bytes[2]>0);assert.ok(r.lod.snapshot().bytes[2]<32*1048576);
 const coarse=root.getObjectByName('Terrain distance detail');root.updateMatrixWorld(true);
 assert.ok(coarse.children.some(m=>m.geometry.attributes.position.array.some((v,i)=>i%3===0&&v>64)),'geometry extends beyond old near radius');
 const before=r.generator;for(let n=0;n<5;n++){point.x+=8;r.update(point);}
 assert.ok(r.manager.stats.predictedCenter[0]>Math.floor((point.x-10)/8));assert.ok(r.manager.stats.prefetchColumns>0);
 const ground=colliders[0].sampleGroundY(point.x,point.z);assert.ok(Number.isFinite(ground),'collision is available without detailed meshes');
 assert.equal(r.serialize().streaming,undefined,'opening legacy terrain does not persist defaults');
 await r.setRepresentation('polygonal');assert.equal(r.generator,before);assert.equal(r.representation,'polygonal');assert.ok(coarse.children.length>0);
 let disposals=0;for(const mesh of coarse.children)mesh.geometry.addEventListener('dispose',()=>disposals++);const total=coarse.children.length;r.dispose();assert.equal(disposals,total);assert.equal(root.children.length,0);assert.equal(colliders.length,0);
});
test('invalid settings cannot allocate an unbounded cache or visibility radius',()=>{
 assert.throws(()=>terrainStreaming({visibilityDistance:Infinity}));assert.throws(()=>terrainStreaming({coarseBudgetMiB:1024}));assert.throws(()=>terrainStreaming({enabled:'yes'}));
});

// The real chunk scheduler receives deterministic resumable work to isolate prediction from GPU speed.
test('prediction prepares more complete columns before entry during a repeatable acceleration trace',async()=>{
 const {VoxelChunkManager}=await import('../ProceduralVoxelWorld/VoxelChunkManager.mjs');
 const counts=[];
 for(const predictive of [false,true]){
  const g={dimensions:[4096,256,256],*getChunkLevelsSteps(){return [0,1,2];}},build=function*(){return {residentBytes:1,solidVoxels:1,faceCount:1,generationMs:0,meshingMs:0};};
  const m=new VoxelChunkManager(g,1,build,()=>{},{budgetMs:4,maxChunks:256,maxBytes:1024});m.streaming=true;m.predictive=predictive;let ready=0;
  for(let frame=0;frame<300;frame++){const x=3+Math.floor(Math.max(0,frame-100)/4)+(frame>=30?1:0);if(frame>100&&(frame-100)%4===0&&m.columnReady(x,3))ready++;m.update([x*32,0,96]);}
  counts.push(ready);assert.ok(m.loaded.size<=256);assert.ok(m.queue.length<400);m.dispose();
 }
 assert.ok(counts[1]>counts[0],`prepared before entry: reactive ${counts[0]}, predictive ${counts[1]}`);
});

test('geographic coarse coverage rejects interior polygon holes and invalid cached samples',async()=>{
 const {coarseCoverage}=await import('./Coverage.mjs'),data=new Float64Array(65*65).fill(12),outer=[[0,0],[64,0],[64,64],[0,64],[0,0]],hole=[[3,3],[4,3],[4,4],[3,4],[3,3]];
 const def={size:[64,32,64],terrainSource:'geographic',geographic:{version:2,origin:[0,64],horizontalScale:1,elevation:{width:65,height:65,crs:32634,origin:[0,64],resolution:[1,-1],offset:0,data},effectiveRaster:[[outer,hole]]}};
 const covered=coarseCoverage(def);assert.equal(covered(0,0,8,8),false);assert.equal(covered(16,16,24,24),true);data[20*65+20]=NaN;assert.equal(covered(16,16,24,24),false);
});

test('construction cuts refine distant terrain and polygonal collision remains available before streaming',async()=>{
 const colliders=[],root=createProceduralVoxelWorld(THREE,{...definition,representation:'polygonal'},colliders,voxelMaterialOptions),r=root.userData.terrainRuntime;await r.ready;
 const ground=colliders[0].sampleGroundY(26,36);assert.equal(r.manager.loaded.size,0);
 assert.equal(colliders[0].intersectsPlayer({x:26,z:36},.1,ground-.5,ground+.5),true,'unstreamed solid occupancy blocks the body');
 const bounds={min:[74,8,84],max:[82,35,92]};r.setConstructions([{bounds,cuts:[bounds],sample:()=>null}],[bounds]);
 const tile=drainSteps(heightfieldSteps(r.generator,r.definition,1,1,2,r.lod.modified)),section=tile.sections.find(s=>s.x===8&&s.z===8);
 assert.ok(section.faces.length>0);assert.ok(section.faces.flatMap(f=>f.vertices).filter(v=>v.p[0]<72&&v.p[2]<72).every(v=>v.p[1]<=5),'coarse cut does not restore the uncut hill');
 assert.equal(colliders[0].intersectsPlayer({x:78,z:88},.1,9,10),false,'construction void stays passable without a mesh');
 r.update(new THREE.Vector3(26,30,36));assert.ok(r.manager.refinementColumns.some(([x,z])=>x===8&&z===8));r.dispose();
});

test('backtracking and teleports keep coarse residency bounded and dispose outgoing geometry',async()=>{
 const {createTerrainLOD}=await import('./Runtime.mjs'),root=new THREE.Group(),material=new THREE.MeshBasicMaterial();
 const manager={loaded:new Map(),stats:{residentBytes:0},radius:1,columnReady:()=>false};
 const g={...generator,dimensions:[16384,128,16384],terrainSampler:{kind:'procedural',sample:()=>({covered:true,elevation:4})}};
 const lod=createTerrainLOD(THREE,root,{...definition,size:[4096,32,4096],streaming:{visibilityDistance:2048,coarseBudgetMiB:4}},g,manager,()=>[material],null);
 for(const point of [{x:64,z:64},{x:3500,z:3500},{x:64,z:64}]){
  for(let i=0;i<80;i++)lod.update(point);
  const snapshot=lod.snapshot();assert.ok(snapshot.tiles<=128);assert.ok(snapshot.bytes[1]+snapshot.bytes[2]<=4*1048576);assert.ok(snapshot.queue<=129);
 }
 const meshes=[...root.children[0].children];let disposed=0;for(const m of meshes)m.geometry.addEventListener('dispose',()=>disposed++);
 lod.dispose();assert.equal(disposed,meshes.length);assert.equal(root.children.length,0);material.dispose();
});

test('coarse-first tiles remain installed while refined coverage is prepared',async()=>{
 const {createTerrainLOD}=await import('./Runtime.mjs'),root=new THREE.Group(),material=new THREE.MeshBasicMaterial(),manager={loaded:new Map(),stats:{residentBytes:0},radius:1,columnReady:()=>false};
 const lod=createTerrainLOD(THREE,root,{...definition,size:[64,32,64]},generator,manager,()=>[material],null),point={x:16,z:16};
 for(let i=0;i<100&&lod.snapshot().generated<1;i++)lod.update(point);
 assert.equal(lod.snapshot().generated,1);const old=root.children[0].children[0],count=old.geometry.index.count;let disposed=false;old.geometry.addEventListener('dispose',()=>disposed=true);
 for(let i=0;i<100&&lod.snapshot().generated<2;i++){assert.equal(disposed,false);assert.ok(old.parent);lod.update(point);}
 assert.equal(lod.snapshot().generated,2);assert.equal(disposed,true);assert.ok(root.children[0].children[0].geometry.index.count>count);lod.dispose();material.dispose();
});
