// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelWorldAuthoring.test.mjs
// These tests validate authoring inputs, deterministic seeded generation, local elevation offsets, bounded streaming, and disposal using the existing runtime and canonical material fixtures.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../lib/three/three.module.js';
import { definitionFromVoxelForm, terrainSeed } from './VoxelAuthoringDefinition.mjs';
import { validateVoxelWorld } from './VoxelWorldDefinition.mjs';
import { createVoxelGenerator } from './VoxelTerrainGenerator.mjs';
import { createProceduralVoxelWorld } from './ProceduralVoxelWorldRuntime.mjs';
import { voxelMaterialOptions } from './VoxelMaterialTestFixtures.mjs';
import { VoxelChunkManager } from './VoxelChunkManager.mjs';
const input={name:'Test terrain',seed:'forest',sizeX:256,sizeZ:256,minHeight:-16,maxHeight:64,voxelSize:.25,chunkSize:32,vegetation:true,water:true,caves:true};
test('authoring defaults preserve compact V1 identity and deterministic text/numeric seeds',()=>{
  const def=validateVoxelWorld(definitionFromVoxelForm(input));
  assert.equal(terrainSeed('forest'),terrainSeed('forest'));assert.notEqual(terrainSeed('forest'),terrainSeed('desert'));
  assert.equal(terrainSeed('123'),123);assert.equal(terrainSeed('4294967295'),-1);
  assert.deepEqual(def.size,[256,80,256]);assert.deepEqual(def.heightLimits,{min:-16,max:64});
  assert.equal(def.generator.version,1);assert.equal(def.boundaryMode,'open');
  assert.ok(JSON.stringify(def).length<1000);
  const a=createVoxelGenerator(def),b=createVoxelGenerator(JSON.parse(JSON.stringify(def)));
  assert.deepEqual(a.generateChunk(2,2,2),b.generateChunk(2,2,2));
});
test('invalid dimensions, heights, resolution, seeds and versions fail before allocation',()=>{
  for(const patch of [{sizeX:0},{sizeZ:-1},{sizeX:4097},{sizeX:.3},{maxHeight:-16},{minHeight:65},{minHeight:-300},{maxHeight:NaN},{sizeX:''},{voxelSize:1},{chunkSize:16},{seed:''},{seed:'9007199254740992'}])
    assert.throws(()=>definitionFromVoxelForm({...input,...patch}));
  const def=definitionFromVoxelForm(input);
  assert.throws(()=>validateVoxelWorld({...def,generator:{...def.generator,version:99}}));
  assert.throws(()=>validateVoxelWorld({...def,heightLimits:{min:0,max:64}}));
});
test('existing terrain features can be disabled without introducing a new generator',()=>{
  const def=definitionFromVoxelForm({...input,vegetation:false,water:false,caves:false});
  const g=createVoxelGenerator(def);
  assert.equal(g.features.query([0,0,0],[1024,320,1024]).length,0);
  assert.equal(g.getWaterTop(20,20),0);assert.equal(g.getCavern(20,20),null);
  for(let y=0;y<320;y++)assert.notEqual(g.getVoxel(20,y,20),5);
});
test('maximum valid dimensions allocate only fixed-size chunks and defer column scans',()=>{
  const def=definitionFromVoxelForm({...input,sizeX:4096,sizeZ:4096,minHeight:-128,maxHeight:128});
  const generator=createVoxelGenerator(def);assert.deepEqual(generator.dimensions,[16384,1024,16384]);
  let queries=0,builds=0;
  const manager=new VoxelChunkManager({...generator,getChunkLevels(){queries++;return [0,1];}},8,()=>{builds++;return {faceCount:0,solidVoxels:0,generationMs:0,meshingMs:0};},()=>{});
  manager.update([1000,0,1000]);assert.equal(queries,1);assert.equal(builds,1);
  assert.ok(manager.queue.length<600);assert.equal(generator.generateChunk(0,0,0).length,32**3);
  manager.dispose();assert.equal(manager.queue.length,0);
});
test('local height origin agrees with collision, serialization, and disposal',async()=>{
  const def=definitionFromVoxelForm({...input,sizeX:16,sizeZ:16,vegetation:false});def.position=[20,10,30];
  const colliders=[],root=createProceduralVoxelWorld(THREE,def,colliders,voxelMaterialOptions),runtime=root.userData.proceduralVoxelRuntime;
  assert.equal(await runtime.ready,true);assert.equal(colliders[0].containsPlayer,undefined);
  const height=runtime.generator.getSolidHeight(16,16);
  assert.equal(colliders[0].sampleGroundY(24,34),10-16+height*.25);
  runtime.update(new THREE.Vector3(24,20,34));assert.equal(runtime.stats.generated,1);
  assert.ok(root.children.length>0);assert.equal(root.children[0].position.y,-16+root.children[0].userData.proceduralChunk[1]*8);
  root.position.y=12;assert.deepEqual(runtime.serialize().position,[20,12,30]);
  let disposed=false;root.children[0].geometry.addEventListener('dispose',()=>disposed=true);
  runtime.dispose();assert.equal(disposed,true);assert.equal(colliders.length,0);assert.equal(root.children.length,0);
});
