// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelWorldToolState.test.mjs
// These tests verify shared authoring settings, validated placement offsets, and generator identity without allocating another procedural generator.
import test from 'node:test';
import assert from 'node:assert/strict';
import { VOXEL_WORLD_TOOL_ID, getVoxelWorldToolSettings, setVoxelWorldToolSettings, voxelWorldPlacementDefinition } from './VoxelWorldToolState.mjs';
import { definitionFromVoxelForm, voxelWorldForm } from './VoxelAuthoringDefinition.mjs';
test('one configuration per world, independent of activation source',()=>{
  const a={},b={},initial=getVoxelWorldToolSettings(a);
  const settings=setVoxelWorldToolSettings(a,{...initial,name:'Island',seed:'my seed',sizeX:16,sizeZ:24,loadRadius:3});
  settings.name='external mutation';assert.equal(getVoxelWorldToolSettings(a).name,'Island');
  assert.equal(getVoxelWorldToolSettings(b).name,'Voxel World');
  assert.throws(()=>setVoxelWorldToolSettings(a,{loadRadius:99}));
  assert.equal(getVoxelWorldToolSettings(a).loadRadius,3);
});
test('placement reuses the canonical definition and preserves parameters',()=>{
  const bridge={};const settings=setVoxelWorldToolSettings(bridge,{seed:'forest',sizeX:16,sizeZ:24,minHeight:-8,maxHeight:24,vegetation:false,loadRadius:4});
  const def=voxelWorldPlacementDefinition(bridge,{x:10.4,y:5.3,z:20.7},true);
  const canonical=definitionFromVoxelForm(settings);
  assert.equal(def.type,VOXEL_WORLD_TOOL_ID);assert.deepEqual(def.generator,canonical.generator);
  assert.deepEqual(def.position,[2,5,9]);assert.deepEqual(def.size,[16,32,24]);
  assert.equal(def.generation.vegetation,false);assert.equal(def.chunks.loadRadius,4);
  assert.equal(voxelWorldForm(JSON.parse(JSON.stringify(def))).loadRadius,4);
  assert.throws(()=>voxelWorldPlacementDefinition(bridge,null));
});
