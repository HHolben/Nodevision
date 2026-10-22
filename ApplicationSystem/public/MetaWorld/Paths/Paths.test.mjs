// Nodevision/ApplicationSystem/public/MetaWorld/Paths/Paths.test.mjs
// These regressions validate physical path definitions, horizontal-width ribbons, voxel cut/fill, stable chunk queries, exclusions, and unmodified source terrain using the real procedural generator.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../lib/three/three.module.js';
import {validatePath} from './PathDefinition.mjs';
import {samplePath,ribbonForPath} from './PathGeometry.mjs';
import {createVoxelGenerator} from '../ProceduralVoxelWorld/VoxelTerrainGenerator.mjs';
import {voxelIndex} from '../ProceduralVoxelWorld/VoxelCoordinates.mjs';
import {VoxelChunkManager} from '../ProceduralVoxelWorld/VoxelChunkManager.mjs';
const path=(patch={})=>validatePath({id:'road',controlPoints:[[2,15,8],[28,15,8]],...patch});
const ribbon=d=>ribbonForPath(d,samplePath(THREE,d));
const world={type:'procedural-voxel-world',id:'hills',position:[0,0,0],size:[32,64,32],voxelSize:.25,generator:{id:'nodevision-terrain-v1',version:1,seed:42},chunks:{voxelsPerAxis:32,loadRadius:2}};
test('definitions have durable defaults and reject invalid/near-coincident points',()=>{
  const d=path();assert.equal(d.width,2);assert.equal(d.crossSlope,0);assert.equal(d.surfaceMaterial,'gravel');
  assert.deepEqual(validatePath(JSON.parse(JSON.stringify(d))),d);
  for(const patch of [{width:0},{width:NaN},{controlPoints:[[0,0,0],[0,9,0]]},{interpolation:'other'},{controlPoints:[[0,0,0],[1,Infinity,2]]}])assert.throws(()=>path(patch));
});
for(const interpolation of ['straight','smooth'])for(const rise of [-8,0,8])test(`${interpolation} ${rise}: cross-flat width, finite triangles and height queries`,()=>{
  const d=path({interpolation,controlPoints:[[2,15,2],[12,15+rise/2,7],[28,15+rise,8]]}),r=ribbon(d);
  for(let i=0;i<r.vertices.length;i+=2){const a=r.vertices[i],b=r.vertices[i+1];assert.equal(a[1],b[1]);assert.ok(Math.abs(Math.hypot(a[0]-b[0],a[2]-b[2])-2)<1e-9);assert.ok(a.every(Number.isFinite));}
  for(const p of r.samples)assert.ok(Math.abs(r.heightAt(p[0],p[2])-p[1])<1e-7);
  assert.ok(Number.isNaN(r.heightAt(-100,100)));
});
test('follow terrain samples original field, authored heights never resample',()=>{
  const d=path(),authored=samplePath(THREE,d,()=>100);assert.ok(authored.every(p=>p[1]===15));
  const follow=samplePath(THREE,{...d,elevationMode:'follow-terrain'},(x,z)=>x+z);assert.ok(follow.every(p=>p[1]===p[0]+p[2]));
  assert.throws(()=>samplePath(THREE,{...d,elevationMode:'follow-terrain'},()=>NaN));
});
test('real voxel hills grade deterministically across chunks, cut and fill, clear features and restore',()=>{
  const g=createVoxelGenerator(world),original=g.base.getTerrainHeight(32,32),d=path({interpolation:'straight'}),r=ribbon(d);
  const fingerprint=Array.from(g.generateChunk(1,1,1));g.setPathConstraints([r]);
  for(const x of [31,32,63,64,95,96]){assert.equal(g.getTerrainHeight(x,32),60);assert.equal(g.getVoxel(x,59,32),2);assert.equal(g.getVoxel(x,60,32),0);}
  assert.equal(g.base.getTerrainHeight(32,32),original);
  const chunk=g.generateChunk(1,1,1);assert.equal(chunk[voxelIndex(0,27,0)],g.getVoxel(32,59,32));
  assert.ok(g.excludesFeature({min:[30,0,30],max:[35,100,35]}));
  g.setPathConstraints([ribbon(path({controlPoints:[[2,2,8],[28,2,8]]}))]);assert.equal(g.getTerrainHeight(32,32),8);
  g.setPathConstraints([ribbon(path({controlPoints:[[2,55,8],[28,55,8]]}))]);assert.equal(g.getTerrainHeight(32,32),220);
  g.setPathConstraints([]);assert.equal(g.getTerrainHeight(32,32),original);assert.deepEqual(Array.from(g.generateChunk(1,1,1)),fingerprint);
});
test('grading is ordered by stable ID, not layer order; visibility removes constraints',()=>{
  const g=createVoxelGenerator(world),a=ribbon(path({id:'a'})),b=ribbon(path({id:'b',controlPoints:[[2,20,8],[28,20,8]]}));
  g.setPathConstraints([a,b]);const height=g.getTerrainHeight(32,32);g.setPathConstraints([b,a]);assert.equal(g.getTerrainHeight(32,32),height);
  g.setPathConstraints([{...a,def:{...a.def,visible:false}}]);assert.equal(g.getTerrainHeight(32,32),g.base.getTerrainHeight(32,32));
});
test('chunk invalidation retains old surfaces until affected replacements are ready',()=>{
  const released=[],m=new VoxelChunkManager({dimensions:[320,32,320],getChunkLevels:()=>[0]},1,()=>({solidVoxels:0,faceCount:0,generationMs:0,meshingMs:0}),e=>released.push(e.cell));
  for(const cell of [[0,0,0],[1,0,0],[8,0,8]])m.loaded.set(cell.join(','),{cell,solidVoxels:0,faceCount:0});
  m.invalidateBounds({minX:0,maxX:40,minZ:0,maxZ:10});assert.equal(m.loaded.size,3);assert.equal(released.length,0);assert.equal(m.invalidated.size,2);
  m.update([0,0,0]);assert.ok(released.some(cell=>cell.join(',')==='0,0,0'));assert.ok(m.loaded.has('0,0,0'));
});
test('many points, nearly coincident points, steep ramps and overlapping edges have bounded outcomes',()=>{
  const many=path({controlPoints:Array.from({length:64},(_,i)=>[i*2,10+Math.sin(i/10),8+Math.sin(i/8)]),width:1});
  assert.ok(ribbon(many).triangles.length>100);
  assert.throws(()=>ribbon(path({interpolation:'straight',controlPoints:[[0,1,0],[10,1,10],[0,1,10],[10,1,0]]})),/cross|overlap|turn/);
  assert.throws(()=>ribbon(path({interpolation:'straight',controlPoints:[[0,0,0],[10,0,0],[10,0,.5],[0,0,.5]]})),/overlap|turn/);
  assert.throws(()=>path({controlPoints:[[0,0,0],[.001,1,.001]]}));
  assert.ok(ribbon(path({controlPoints:[[0,0,0],[2,30,0]]})).vertices.flat().every(Number.isFinite));
});
test('transition is smoothstep blended, disabled grading leaves base intact, and whole voxel cells stay below sloped road',()=>{
  const g=createVoxelGenerator(world),r=ribbon(path({width:2,transitionWidth:2}));g.setPathConstraints([r]);
  const base=g.base.getTerrainHeight(48,39),distance=(39.5*.25-8)-1,t=distance/2;
  assert.equal(g.getTerrainHeight(48,39),Math.floor(base+(60-base)*(1-t*t*(3-2*t))+1e-7));
  g.setPathConstraints([ribbon(path({terrainInteraction:'none'}))]);assert.equal(g.getTerrainHeight(48,32),g.base.getTerrainHeight(48,32));
  const slope=ribbon(path({controlPoints:[[2,10,8],[28,30,8]]}));g.setPathConstraints([slope]);
  for(let x=12;x<100;x++)assert.ok(g.getTerrainHeight(x,32)*.25<=slope.heightAt(x*.25,8)+1e-7);
});
test('feature exclusion clears real generated trees and returns them after deleting the constraint',()=>{
  const g=createVoxelGenerator({...world,size:[128,64,128]});
  const list=g.features.query([0,0,0],[512,256,512]);assert.ok(list.length>0,'fixture has generated vegetation');
  const tree=list[0],[x,,z]=tree.origin.map(v=>v*.25);
  const d=path({controlPoints:[[x-3,15,z],[x+3,15,z]]});g.setPathConstraints([ribbon(d)]);
  assert.ok(!g.features.query([0,0,0],[512,256,512]).some(f=>f.id===tree.id));
  g.setPathConstraints([]);assert.ok(g.features.query([0,0,0],[512,256,512]).some(f=>f.id===tree.id));
});
test('locally flat smoothing retains the overall incline and deterministically grades only its corridor',()=>{
 const d=path({elevationMode:'locally-flat',smoothing:.8,controlPoints:[[2,10,8],[12,18,8],[28,20,8]],elevationOffset:.5});
 const samples=samplePath(THREE,d);assert.equal(samples[0][1],10.5);assert.equal(samples.at(-1)[1],20.5);assert.ok(samples.every(p=>p[1]>=10.5&&p[1]<=20.5));
 const r=ribbonForPath(d,samples),g=createVoxelGenerator(world),outside=g.getTerrainHeight(0,0);g.setPathConstraints([r]);const first=Array.from(g.generateChunk(1,1,1));g.setPathConstraints([r]);assert.deepEqual(Array.from(g.generateChunk(1,1,1)),first);assert.equal(g.getTerrainHeight(0,0),outside);
});
test('mixed geometry and new placement settings roundtrip, while overlays leave terrain unchanged',()=>{
 const d=path({interpolation:'mixed',segmentKinds:['straight','smooth'],controlPoints:[[2,15,2],[12,16,7],[28,18,8]],snap:'endpoints',terrainInteraction:'overlay',smoothing:.5});
 assert.deepEqual(validatePath(JSON.parse(JSON.stringify(d))),d);assert.ok(ribbon(d).vertices.length>4);
 const g=createVoxelGenerator(world),before=Array.from(g.generateChunk(0,1,0));g.setPathConstraints([ribbon(d)]);assert.deepEqual(Array.from(g.generateChunk(0,1,0)),before);
 assert.throws(()=>path({smoothing:2}));assert.throws(()=>path({gridSize:0}));assert.throws(()=>path({segmentKinds:['invalid']}));
});
