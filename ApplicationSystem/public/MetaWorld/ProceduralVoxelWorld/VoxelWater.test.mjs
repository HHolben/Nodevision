// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelWater.test.mjs
// These tests verify finite deterministic water cells, boundary meshing, canonical liquid volumes, solid lakebeds, lifecycle, and compact regeneration.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../lib/three/three.module.js';
import { terrainDefinition as def, voxelMaterialOptions, canonicalCatalog } from './VoxelMaterialTestFixtures.mjs';
import { createVoxelGenerator } from './VoxelTerrainGenerator.mjs';
import { createProceduralVoxelWorld } from './ProceduralVoxelWorldRuntime.mjs';
import { meshVoxelChunk } from './VoxelChunkMesher.mjs';
import { voxelIndex } from './VoxelCoordinates.mjs';
import { WATER_VOXEL } from './VoxelMaterialIds.mjs';
import { installEnvironmentRuntimeAbility } from '../../PanelInstances/ViewPanels/GameViewDependencies/Abilities/InteractAbilities/EnvironmentRuntimeAbility.mjs';

test('V1 pins a wet column, a dry column, the waterline and finite bounds', () => {
  const g=createVoxelGenerator(def);
  assert.equal(g.getTerrainHeight(448,448),58);
  for(const [cell,id] of [[[448,57,448],'stone'],[[448,58,448],'water'],[[448,71,448],'water'],[[448,72,448],'air'],[[0,75,0],'grass'],[[0,76,0],'air']]){
    assert.equal(g.getVoxelMaterialId(...cell),id);
    assert.equal(createVoxelGenerator(JSON.parse(JSON.stringify(def))).getVoxelMaterialId(...cell),id);
  }
  for(const cell of [[-1,71,448],[4000,71,448],[448,71,4000],[448,512,448]])assert.equal(g.getVoxel(...cell),0);
  const small=createVoxelGenerator({...def,size:[112.25,17,112.25]});
  const bytes=small.generateChunk(14,2,14);
  for(let z=0;z<32;z++)for(let y=0;y<32;y++)for(let x=0;x<32;x++)assert.equal(bytes[voxelIndex(x,y,z)],small.getVoxel(x+448,y+64,z+448));
});
test('water faces cull internally and across chunks while keeping the solid lakebed', () => {
  const data=new Uint8Array(32**3);data[voxelIndex(0,0,0)]=WATER_VOXEL;data[voxelIndex(1,0,0)]=WATER_VOXEL;
  assert.equal(meshVoxelChunk(data,[0,0,0],()=>0).faceCount,10);
  data[voxelIndex(1,0,0)]=3;
  const mixed=meshVoxelChunk(data,[0,0,0],()=>0);
  assert.equal(mixed.faceCount,11);assert.equal(mixed.solidVoxels,1);
  assert.equal(mixed.groups.find(g=>g.materialIndex===WATER_VOXEL-1).count,30);
  data.fill(0);data[voxelIndex(31,0,0)]=WATER_VOXEL;
  assert.equal(meshVoxelChunk(data,[0,0,0],(x,y,z)=>x===32&&y===0&&z===0?WATER_VOXEL:0).faceCount,5);
});
test('canonical liquid volume shares swimming detection without replacing ground collision', async () => {
  const colliders=[],root=createProceduralVoxelWorld(THREE,def,colliders,voxelMaterialOptions),r=root.userData.proceduralVoxelRuntime;
  assert.equal(await r.ready,true);
  const wet=new THREE.Vector3(112.125,16,112.125),volume=root.userData.waterVolumeRef;
  const canonical=canonicalCatalog.find(e=>e.materialId==='water');
  assert.strictEqual(volume.materialDefinition,canonical.materialDefinition);
  assert.equal(volume.MatterState,'liquid');assert.equal(volume.materialId,'water');assert.equal(volume.buoyancyScale,1);
  assert.equal(r.materials[WATER_VOXEL-1].opacity,.48);assert.equal(r.materials[WATER_VOXEL-1].depthWrite,false);
  assert.equal(colliders.length,1);assert.equal(colliders[0].sampleGroundY(wet.x,wet.z),14.5);
  const env=installEnvironmentRuntimeAbility({api:{},objects:[root],waterVolumes:[]});
  assert.strictEqual(env.getWaterVolumeAtPosition(wet),volume);
  assert.equal(env.getWaterVolumeAtPosition(new THREE.Vector3(wet.x,18,wet.z)),null);
  assert.equal(env.getWaterVolumeAtPosition(new THREE.Vector3(wet.x,14,wet.z)),null);
  root.visible=false;assert.equal(env.getWaterVolumeAtPosition(wet),null);root.visible=true;
  root.position.x=10;assert.equal(volume.containsPoint(new THREE.Vector3(122.125,16,112.125)),true);root.position.x=0;
  const saved=r.serialize();assert.equal(JSON.stringify(saved).includes('water'),false);
  assert.equal(createVoxelGenerator(saved).getVoxelMaterialId(448,71,448),'water');
  const ordinary={box:new THREE.Box3(new THREE.Vector3(0,0,0),new THREE.Vector3(1,1,1))};
  const old=installEnvironmentRuntimeAbility({api:{},objects:[root],waterVolumes:[ordinary]});
  assert.strictEqual(old.getWaterVolumeAtPosition(new THREE.Vector3(.5,.5,.5)),ordinary);
  r.dispose();assert.equal(volume.containsPoint(wet),false);assert.equal(colliders.length,0);
});
