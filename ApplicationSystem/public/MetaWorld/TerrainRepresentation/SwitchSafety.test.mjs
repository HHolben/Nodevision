// Nodevision/ApplicationSystem/public/MetaWorld/TerrainRepresentation/SwitchSafety.test.mjs
// These tests exercise failure rollback and authored voxel composition during representation replacement. They verify that prepared resources are released without deleting active terrain and that temporary edits remain authoritative in both mesh pipelines.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../lib/three/three.module.js';
import { chunkRepresentation } from './ChunkRepresentation.mjs';
import { createProceduralVoxelWorld } from '../ProceduralVoxelWorld/ProceduralVoxelWorldRuntime.mjs';
import { voxelMaterialOptions } from '../ProceduralVoxelWorld/VoxelMaterialTestFixtures.mjs';
import { createSessionLayer } from '../SessionVoxels/SessionLayer.mjs';

test('failed geometry budget and commit guard retain the old representation and release candidates',async()=>{
  const old={cell:[0,0,0],mesh:{visible:true}},released=[];
  const manager={loaded:new Map([['0,0,0',old]]),invalidated:new Set(),stats:{},queue:[],storeEntry(){throw Error('Must not commit');}};
  const oversized=chunkRepresentation({},manager,function*(){return {residentBytes:129*1024**2};},e=>released.push(e));
  await assert.rejects(()=>oversized.setRepresentation('polygonal'),/128 MiB/);
  assert.equal(oversized.active,'voxel');assert.equal(oversized.pending,false);assert.equal(manager.loaded.get('0,0,0'),old);assert.equal(released.length,1);
  const rejected=chunkRepresentation({},manager,function*(){return {residentBytes:1024};},e=>released.push(e));
  await assert.rejects(()=>rejected.setRepresentation('polygonal',()=>{throw Error('Selection changed');}),/Selection changed/);
  assert.equal(released.length,2);assert.equal(rejected.active,'voxel');assert.equal(old.mesh.visible,true);
});

test('authored additions and removals survive polygonal geometry and return to voxels',async()=>{
  const definition={id:'terrain',type:'procedural-voxel-world',size:[16,32,16],position:[0,0,0],voxelSize:.25,
    generator:{id:'nodevision-terrain-v1',version:1,seed:42},chunks:{voxelsPerAxis:32,loadRadius:1},generation:{vegetation:false,water:false,caves:false}};
  const colliders=[],root=createProceduralVoxelWorld(THREE,definition,colliders,voxelMaterialOptions),r=root.userData.terrainRuntime;await r.ready;
  const session=createSessionLayer({changed:cells=>r.invalidateSession(cells)});r.bindSession(session,p=>p);
  const material={materialId:'stone',rgba:[180,190,200,255],solid:true,customColor:true};
  session.batch([{at:[16,80,16],value:material},{at:[16,1,16],value:null}]);
  const deadline=performance.now()+10000;
  while(!r.manager.loaded.get('0,2,0')?.mesh&&performance.now()<deadline){r.update(new THREE.Vector3(4,25,4));await new Promise(resolve=>setTimeout(resolve,0));}
  assert.ok(r.manager.loaded.get('0,2,0')?.mesh,'authored block chunk finishes progressive installation');
  const value=r.generator.getVoxel(16,80,16);assert.ok(value>0);
  for(const mode of ['polygonal','voxel','polygonal']){
    await r.setRepresentation(mode);assert.equal(r.generator.getVoxel(16,80,16),value);assert.equal(r.generator.getVoxel(16,1,16),0);assert.equal(session.count,2);
    const hits=[];root.raycast(new THREE.Raycaster(new THREE.Vector3(4.125,25,4.125),new THREE.Vector3(0,-1,0)),hits);hits.sort((a,b)=>a.distance-b.distance);
    assert.ok(hits.length&&hits[0].point.y>20,'authored block remains visible and pickable');
    assert.ok(Math.abs(colliders[0].sampleGroundY(4.125,4.125)-hits[0].point.y)<1e-6,'collision follows the rendered authored block');
  }
  r.dispose();session.dispose();
});
