// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/ProceduralVoxelWorld.test.mjs
// These tests verify declarative validation, coordinate boundaries, deterministic generation, face culling, residency, and resource ownership.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../lib/three/three.module.js';
import { validateMetaWorldDefinition } from '../MetaWorldLoader.mjs';
import { validateVoxelWorld } from './VoxelWorldDefinition.mjs';
import * as C from './VoxelCoordinates.mjs';
import { createVoxelGenerator } from './VoxelTerrainGenerator.mjs';
import { meshVoxelChunk } from './VoxelChunkMesher.mjs';
import { createProceduralVoxelWorld } from './ProceduralVoxelWorldRuntime.mjs';
import { voxelMaterialOptions } from './VoxelMaterialTestFixtures.mjs';
const def = { id:'terrain', type:'procedural-voxel-world', position:[-500,0,-500], size:[1000,128,1000], voxelSize:0.25,
  generator:{id:'nodevision-terrain-v1',version:1,seed:123456}, chunks:{voxelsPerAxis:32,loadRadius:1} };
const world = objects => ({name:'Test',type:'world',objects});
test('MetaWorld keeps one compact validated terrain definition',()=>{
  const result=validateMetaWorldDefinition(world([def]));
  assert.equal(result.objects.length,1); assert.deepEqual(result.objects[0].generator,def.generator);
  assert.deepEqual(C.voxelDimensions(def.size),[4000,512,4000]);
});
test('invalid settings and unsupported transforms fail safely',()=>{
  for(const voxelSize of [0,-1,NaN,Infinity,1,'0.25']) assert.throws(()=>validateVoxelWorld({...def,voxelSize}));
  for(const chunks of [{voxelsPerAxis:16,loadRadius:1},{voxelsPerAxis:32,loadRadius:9},{voxelsPerAxis:32,loadRadius:1.5},{}]) assert.throws(()=>validateVoxelWorld({...def,chunks}));
  for(const generator of [{...def.generator,seed:0.5},{...def.generator,seed:2**32},{...def.generator,version:2},{...def.generator,id:'javascript'}]) assert.throws(()=>validateVoxelWorld({...def,generator}));
  for(const patch of [{size:[Infinity,1,1]},{size:[-1,1,1]},{rotation:[0,1,0]},{scale:[2,1,1]}]) assert.throws(()=>validateVoxelWorld({...def,...patch}));
});
test('canonical coordinates handle negatives, boundaries and finite edges',()=>{
  assert.deepEqual(C.worldToVoxel([-0.01,0,8],[0,0,0]),[-1,0,32]);
  assert.deepEqual(C.voxelToChunk([-1,0,32]),[-1,0,1]);
  assert.deepEqual(C.voxelToLocal([-1,0,32]),[31,0,0]);
  assert.deepEqual(C.chunkLocalToVoxel([-1,0,1],[31,0,0]),[-1,0,32]);
  for(const cell of [[0,0,0],[3999,511,3999],[32,0,31]]) assert.deepEqual(C.worldToVoxel(C.voxelToWorld(cell,def.position),def.position),cell);
  assert.equal(C.containsVoxel(C.worldToVoxel([500,0,0],def.position),C.voxelDimensions(def.size)),false);
});
test('seeded voxel queries and chunks reproduce exactly',()=>{
  const a=createVoxelGenerator(def),b=createVoxelGenerator(def),c=createVoxelGenerator({...def,generator:{...def.generator,seed:7}});
  assert.deepEqual(a.generateChunk(60,2,60),b.generateChunk(60,2,60));
  assert.notDeepEqual(Array.from({length:20},(_,i)=>a.getTerrainHeight(i*100,i*70)),Array.from({length:20},(_,i)=>c.getTerrainHeight(i*100,i*70)));
  const h=a.getTerrainHeight(0,0); assert.equal(a.getVoxel(0,h,0),0);assert.equal(a.getVoxel(0,h-1,0),1);
  assert.equal(a.getVoxel(0,h-2,0),2);assert.equal(a.getVoxel(0,0,0),3);assert.equal(a.getVoxel(-1,0,0),0);
});
test('meshing suppresses adjacent and cross-chunk internal faces',()=>{
  const data=new Uint8Array(32**3);data[C.voxelIndex(0,0,0)]=1;data[C.voxelIndex(1,0,0)]=1;
  assert.equal(meshVoxelChunk(data,[0,0,0],()=>0).faceCount,10);
  assert.equal(meshVoxelChunk(data,[0,0,0],(x,y,z)=>x===-1&&y===0&&z===0?1:0).faceCount,9);
});
test('residency unloads, reproduces geometry and releases resources',async()=>{
  const colliders=[], root=createProceduralVoxelWorld(THREE,def,colliders,voxelMaterialOptions), runtime=root.userData.proceduralVoxelRuntime;
  assert.equal(await runtime.ready,true);
  const position=new THREE.Vector3(0,30,0);
  for(let i=0;i<36;i++) runtime.update(position);
  assert.equal(runtime.stats.loaded,36);assert.equal(colliders.length,1); assert.ok(root.children.length<=36);
  const geometry=root.children[0].geometry, original=Array.from(geometry.attributes.position.array), cell=root.children[0].userData.proceduralChunk;
  let released=false;geometry.addEventListener('dispose',()=>released=true);
  position.x=200;runtime.update(position);assert.equal(released,true);
  position.x=0;for(let i=0;i<36;i++)runtime.update(position);
  const restored=root.children.find(mesh=>C.chunkKey(mesh.userData.proceduralChunk)===C.chunkKey(cell));
  assert.deepEqual(Array.from(restored.geometry.attributes.position.array),original);
  assert.deepEqual(runtime.serialize().generator,def.generator);
  runtime.dispose();runtime.dispose();assert.equal(colliders.length,0);assert.equal(root.children.length,0);assert.equal(runtime.stats.loaded,0);
});
test('ordinary worlds and authored voxel patterns retain their behavior',()=>{
  const box={type:'box',position:[1,2,3],size:[1,1,1]};assert.deepEqual(validateMetaWorldDefinition(world([box])).objects,[box]);
  const pattern={type:'voxel-pattern',id:'authored',position:[0,0,0],pattern:{counts:[2,1,2]},voxel:{type:'box',size:[0.25,0.25,0.25]}};
  const expanded=validateMetaWorldDefinition(world([pattern])).objects;
  assert.equal(expanded.length,4);assert.ok(expanded.every(o=>o.isVoxel));assert.deepEqual(expanded[3].position,[0.25,0,0.25]);
});
