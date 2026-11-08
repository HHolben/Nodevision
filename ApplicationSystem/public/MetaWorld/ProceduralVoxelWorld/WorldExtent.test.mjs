// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/WorldExtent.test.mjs
// These regressions protect source identity at the extent validation boundary and ensure that legacy finite serialization remains unchanged. Incompatible map-based infinity fails before allocation or history mutation.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../lib/three/three.module.js';
import {validateVoxelWorld} from './VoxelWorldDefinition.mjs';
import {createProceduralVoxelWorld} from './ProceduralVoxelWorldRuntime.mjs';
import {installVoxelWorldAuthoring} from './VoxelWorldAuthoringBridge.mjs';
import {voxelMaterialOptions} from './VoxelMaterialTestFixtures.mjs';
import {worldExtentDescription} from './WorldExtent.mjs';
const def={id:'finite',size:[16,32,16],voxelSize:.25,generator:{id:'nodevision-terrain-v1',version:1,seed:42},chunks:{voxelsPerAxis:32,loadRadius:1},generation:{vegetation:false,water:false,caves:false}};
test('legacy finite documents gain no extent defaults and explicit finite settings round trip',async()=>{
 for(const extent of [undefined,{mode:'finite'}]){
  const input={...def,...(extent?{worldExtent:extent}:{})},root=createProceduralVoxelWorld(THREE,input,[],voxelMaterialOptions),r=root.userData.terrainRuntime;await r.ready;
  assert.deepEqual(r.serialize().worldExtent,extent);assert.equal(Object.hasOwn(r.serialize(),'worldExtent'),!!extent);
  r.definition.worldExtent={mode:'infinite'};assert.throws(()=>r.serialize(),/regeneration/);r.dispose();
 }
});
test('geographic, authored-map and hybrid infinite requests fail before runtime or editing mutation',()=>{
 const bridge={recordHistory(){throw Error('History must not change');}};installVoxelWorldAuthoring(bridge,{layerEntries:[]});
 for(const source of ['geographic','map','hybrid']){
  const invalid={...def,terrainSource:source,worldExtent:{mode:'infinite'}},copy=JSON.stringify(invalid),colliders=[];
  assert.throws(()=>validateVoxelWorld(invalid),/only for purely procedural/);
  assert.throws(()=>createProceduralVoxelWorld(THREE,invalid,colliders,voxelMaterialOptions),/only for purely procedural/);
  assert.throws(()=>bridge.addVoxelWorld(invalid),/only for purely procedural/);
  assert.equal(JSON.stringify(invalid),copy);assert.equal(colliders.length,0);
  assert.match(worldExtentDescription(invalid),/Source-defined and finite/);
 }
 assert.throws(()=>validateVoxelWorld({...def,geographic:{},worldExtent:{mode:'infinite'}}),/only for purely procedural/);
 assert.equal(validateVoxelWorld({...def,worldExtent:{mode:'infinite'}}).worldExtent.mode,'infinite');
 for(const worldExtent of [null,[],{},'infinite',{mode:'other'}])assert.throws(()=>validateVoxelWorld({...def,worldExtent}),/World extent/);
});
