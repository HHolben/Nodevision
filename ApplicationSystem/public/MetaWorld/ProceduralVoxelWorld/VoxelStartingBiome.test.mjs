// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelStartingBiome.test.mjs
// These tests verify starting-biome validation, deterministic climate and surface changes, legacy compatibility, and canonical form/runtime persistence.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../lib/three/three.module.js';
import { voxelWorldForm, definitionFromVoxelForm } from './VoxelAuthoringDefinition.mjs';
import { validateVoxelWorld } from './VoxelWorldDefinition.mjs';
import { createVoxelGenerator } from './VoxelTerrainGenerator.mjs';
import { createProceduralVoxelWorld } from './ProceduralVoxelWorldRuntime.mjs';
import { voxelMaterialOptions } from './VoxelMaterialTestFixtures.mjs';
import { createStartingBiomeSampler } from './VoxelStartingBiome.mjs';
import { biomeAt } from './VoxelBiomes.mjs';
const form={...voxelWorldForm(),seed:'123456',sizeX:1024,sizeZ:1024,vegetation:false,water:false,caves:false};
const definition=startingBiome=>validateVoxelWorld(definitionFromVoxelForm({...form,startingBiome}));
test('starting choices validate and survive the canonical form round trip',()=>{
  for(const id of ['auto','temperate','snowy-pine-forest','aegean']) {
    const def=definition(id),saved=JSON.parse(JSON.stringify(def));
    assert.equal(voxelWorldForm(saved).startingBiome,id);
    assert.deepEqual(definitionFromVoxelForm(voxelWorldForm(saved),saved),def);
    assert.equal(def.environment?.id,id==='aegean'?'aegean':undefined);
  }
  assert.throws(()=>definition('unknown'),/starting biome/);
  assert.throws(()=>validateVoxelWorld({...definition('temperate'),environment:definition('aegean').environment}),/does not match/);
  assert.throws(()=>validateVoxelWorld({...definition('auto'),startingBiome:'aegean'}),/requires/);
});
test('legacy automatic climate stays unchanged and explicit choices blend back to it',()=>{
  const auto=definition('auto');assert.equal(Object.hasOwn(auto,'startingBiome'),false);
  for(const id of ['temperate','snowy-pine-forest']) {
    const sampler=createStartingBiomeSampler(definition(id),[4096,320,4096]);
    for(const [x,z] of [[2048,2048],[2100,2048],[2000,2100]])assert.equal(sampler(x,z).id,id);
    for(const [x,z] of [[0,0],[4000,4000],[1000,2048]])assert.equal(sampler(x,z).id,biomeAt(x,z,auto.generator.seed).id);
  }
  const legacy=createVoxelGenerator(auto),explicit=createVoxelGenerator({...auto,startingBiome:'auto'});
  assert.deepEqual(legacy.generateChunk(0,2,0),explicit.generateChunk(0,2,0));
});
test('generation uses the chosen climate for surfaces and deterministic saved chunks',()=>{
  const snow=createVoxelGenerator(definition('snowy-pine-forest')),warm=createVoxelGenerator(definition('temperate'));
  let snowySurfaces=0;
  for(let z=1920;z<=2176;z+=16)for(let x=1920;x<=2176;x+=16) {
    assert.equal(snow.getBiome(x,z),'snowy-pine-forest');assert.equal(warm.getBiome(x,z),'temperate');
    const height=snow.getTerrainHeight(x,z);assert.equal(height,warm.getTerrainHeight(x,z));
    if(snow.getVoxelMaterialId(x,height-1,z)==='snow' && warm.getVoxelMaterialId(x,height-1,z)!=='snow')snowySurfaces++;
  }
  assert.ok(snowySurfaces>0,'the choice changes rendered surface materials');
  const saved=createVoxelGenerator(JSON.parse(JSON.stringify(definition('snowy-pine-forest'))));
  assert.deepEqual(snow.generateChunk(64,2,64),saved.generateChunk(64,2,64));
  const aegean=createVoxelGenerator(definition('aegean'));
  assert.ok(aegean.getEnvironment(2048,2048),'Aegean uses the existing coastal field');
});
test('runtime serialization retains the selected start',async()=>{
  const def=definition('snowy-pine-forest');
  const root=createProceduralVoxelWorld(THREE,def,[],voxelMaterialOptions),runtime=root.userData.proceduralVoxelRuntime;
  try {assert.equal(await runtime.ready,true);assert.equal(runtime.serialize().startingBiome,'snowy-pine-forest');}
  finally {runtime.dispose();}
});
