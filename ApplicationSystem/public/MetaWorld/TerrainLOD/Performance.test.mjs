// Nodevision/ApplicationSystem/public/MetaWorld/TerrainLOD/Performance.test.mjs
// This regression verifies that settled ownership avoids repeated scans while preserving coarse coverage during installation, invalidation, eviction, and changes to empty columns.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../lib/three/three.module.js';
import {createTerrainLOD} from './Runtime.mjs';
import {VoxelChunkManager} from '../ProceduralVoxelWorld/VoxelChunkManager.mjs';
const def={size:[16,32,8],generation:{caves:false,water:false},streaming:{visibilityDistance:64}};
const generator={dimensions:[64,128,32],terrainSampler:{kind:'procedural',sample:()=>({covered:true,elevation:4})},getRenderVoxel:()=>1,getWaterTop:()=>0};
test('settled masks do no column queries and react to install, invalidation, eviction and empty-column changes',()=>{
 const root=new THREE.Group(),material=new THREE.MeshBasicMaterial();
 const manager=new VoxelChunkManager(generator,1,()=>{},()=>{});let checks=0;
 const ready=manager.columnReady.bind(manager);manager.columnReady=(...args)=>{checks++;return ready(...args);};
 const lod=createTerrainLOD(THREE,root,def,generator,manager,()=>[material],null),position={x:1,z:1};
 for(let i=0;i<100&&(!lod.snapshot().tiles||lod.snapshot().queue);i++)lod.update(position);
 assert.equal(lod.snapshot().queue,0);
 const mesh=root.children[0].children[0],initial=mesh.geometry.index.count,before=checks,index=mesh.geometry.index;
 for(let i=0;i<100;i++)lod.update(position);
 assert.equal(checks,before);assert.equal(mesh.geometry.index,index);
 manager.columnLevels.set('0,0',[0]);manager.loaded.set('0,0,0',{cell:[0,0,0]});lod.update(position);
 assert.ok(mesh.geometry.index.count<initial,'installed detail masks coarse section');
 manager.invalidated.add('0,0,0');lod.update(position);assert.equal(mesh.geometry.index.count,initial,'invalid detail restores coarse protection');
 manager.invalidated.delete('0,0,0');lod.update(position);assert.ok(mesh.geometry.index.count<initial);
 manager.loaded.delete('0,0,0');lod.update(position);assert.equal(mesh.geometry.index.count,initial);
 manager.columnLevels.set('0,0',[]);lod.update(position);assert.ok(mesh.geometry.index.count<initial,'known empty columns also own coverage');
 manager.columnLevels.clear();lod.update(position);assert.equal(mesh.geometry.index.count,initial);
 lod.dispose();manager.dispose();material.dispose();assert.equal(root.children.length,0);
});
