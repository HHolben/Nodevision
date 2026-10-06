// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelCanonicalMaterials.test.mjs
// These regressions verify canonical voxel identity, deterministic development strata, pooled rendering, shared physics metadata, authored voxel configuration, and equation persistence.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../lib/three/three.module.js';
import { canonicalCatalog, voxelMaterialOptions, terrainDefinition as def } from './VoxelMaterialTestFixtures.mjs';
import { resolveWorldObjectMaterial } from '../Materials/WorldObjectMaterialResolver.mjs';
import { materialFileForWorldObjectMaterial, applyDefaultWorldObjectPhysicsMaterial } from '../Materials/WorldObjectMaterialDefaults.mjs';
import { createVoxelGenerator } from './VoxelTerrainGenerator.mjs';
import { createVoxelMaterialPalette } from './VoxelMaterialPalette.mjs';
import { createProceduralVoxelWorld } from './ProceduralVoxelWorldRuntime.mjs';
import { meshVoxelChunk } from './VoxelChunkMesher.mjs';
import { voxelIndex } from './VoxelCoordinates.mjs';
import { installVoxelMaterialConfigAbility } from '../../PanelInstances/ViewPanels/GameViewDependencies/Abilities/CraftAbilities/VoxelMaterialConfigAbility.mjs';
import { installBounceMaterialAbility } from '../../PanelInstances/ViewPanels/GameViewDependencies/Abilities/MovementAbilities/BounceMaterialAbility.mjs';
import { materialEntryMatchesHint, isLiquidMaterialEntry } from '../../PanelInstances/ViewPanels/GameViewDependencies/equationObjectDefaults.mjs';
import { makeEquationLayerDefinition } from '../../PanelInstances/ViewPanels/GameViewDependencies/equationObjectLayers.mjs';

test('canonical grass, soil, stone, limestone and water resolve shared JSON definitions', async () => {
  for (const id of ['grass','soil','stone','limestone','water']) {
    const entry = await resolveWorldObjectMaterial(id, voxelMaterialOptions);
    assert.equal(entry.materialId,id); assert.equal(entry.physicsMaterialId,id);
    assert.equal(entry.materialFile,materialFileForWorldObjectMaterial(id));
    assert.strictEqual(entry.collider,canonicalCatalog.find(e=>e.materialId===id).materialDefinition.collider);
    assert.equal(entry.matterState,id==='water'?'liquid':'solid');
    assert.equal(entry.rendering.color,entry.materialDefinition.rendering.color);
  }
  const water=await resolveWorldObjectMaterial('water',voxelMaterialOptions);
  assert.equal(water.rendering.opacity,.48);assert.equal(water.collider.solid,false);assert.equal(water.collider.densityKgPerCubicMeter,997);
});
test('fixed V1 seed and coordinates pin grass, soil, stone and coherent limestone', () => {
  const generator=createVoxelGenerator(def), reloaded=createVoxelGenerator(JSON.parse(JSON.stringify(def)));
  for (const [cell,id] of [[[0,75,0],'grass'],[[0,74,0],'soil'],[[0,0,0],'stone'],[[0,32,0],'limestone'],[[0,76,0],'air']]) {
    assert.equal(generator.getVoxelMaterialId(...cell),id);assert.equal(reloaded.getVoxelMaterialId(...cell),id);
  }
  let limestone=0,total=0;
  for(let z=0;z<1000;z+=16)for(let x=0;x<1000;x+=16){total++;if(generator.getVoxelMaterialId(x,32,z)==='limestone')limestone++;}
  assert.equal(limestone,1198);assert.ok(limestone<total/2);
  for(let z=0;z<8;z++)for(let x=0;x<8;x++)assert.equal(generator.getVoxelMaterialId(x,32,z),'limestone');
  assert.deepEqual(generator.generateChunk(0,1,0),reloaded.generateChunk(0,1,0));
  const chunk=generator.generateChunk(0,1,0);
  for(let z=0;z<32;z++)for(let y=0;y<32;y++)for(let x=0;x<32;x++)assert.equal(chunk[voxelIndex(x,y,z)],generator.getVoxel(x,y+32,z));
});
test('mixed chunks group faces by canonical material with twelve shared runtime materials', async () => {
  const data=new Uint8Array(32**3);for(const [x,id] of [[0,1],[2,2],[4,3],[6,4]])data[voxelIndex(x,0,0)]=id;
  const result=meshVoxelChunk(data,[0,0,0],()=>0), palette=await createVoxelMaterialPalette(THREE,voxelMaterialOptions);
  assert.equal(result.faceCount,24);assert.equal(result.groups.length,4);assert.equal(palette.materials.length,12);
  for(const group of result.groups){
    const material=palette.materials[group.materialIndex], id=group.materialIndex+1;
    assert.equal(group.count,36);assert.equal(material.userData.materialId,palette.entries[id].materialId);
    assert.equal('#'+material.color.getHexString(),palette.entries[id].rendering.color);
    for(const index of result.indices.slice(group.start,group.start+group.count))assert.equal(result.materials[index],id);
  }
  let disposals=0;palette.materials.forEach(m=>m.addEventListener('dispose',()=>disposals++));palette.dispose();assert.equal(disposals,12);
});
test('runtime material inspection, ground bounce and compact save use canonical identity', async () => {
  const colliders=[],root=createProceduralVoxelWorld(THREE,def,colliders,voxelMaterialOptions),runtime=root.userData.proceduralVoxelRuntime;
  assert.equal(await runtime.ready,true);for(let i=0;i<36;i++)runtime.update({x:1,y:20,z:1});
  assert.equal(runtime.getVoxelMaterialId(0,32,0),'limestone');assert.equal(runtime.getVoxelMaterial(0,32,0).collider.densityKgPerCubicMeter,2550);
  assert.equal(colliders[0].sampleMaterial(.01,8.01,.01).materialId,'limestone');
  assert.equal(colliders[0].materialDefinition.id,'grass');assert.equal(colliders[0].MatterState,'solid');
  const ctx={api:{},movementState:{},bounceMaterialsByKey:new Map()};const bounce=installBounceMaterialAbility(ctx);
  bounce.refreshBounceMaterialCatalog(canonicalCatalog);assert.equal(bounce.bounceConfigForCollider(colliders[0]).restitution,.06);
  assert.ok(root.children.length);for(const mesh of root.children){assert.strictEqual(mesh.material,runtime.materials);assert.ok(mesh.geometry.groups.length<=12);assert.equal(mesh.userData.physicsMaterialId,undefined);}
  const saved=runtime.serialize();assert.deepEqual(saved.generator,def.generator);
  assert.equal(saved.type,'procedural-voxel-world');assert.ok(JSON.stringify(saved).length<600);
  for(const key of ['chunksData','materials','children','voxels','palette'])assert.equal(saved[key],undefined);
  runtime.dispose();
});
test('authored voxel configuration and ordinary/equation material identities remain compatible', async () => {
  const ctx={api:{},movementState:{},DEFAULT_VOXEL_PLACER_CONFIG:{size:.25,color:'#ffffff',opacity:1,materialId:'PhysicsSolid'}};
  const api=installVoxelMaterialConfigAbility(ctx);
  for(const id of ['limestone','stone','water','PineWood','PineBark','PineFoliage','sand','mud','LimestoneGravel','snow']){
    const entry=canonicalCatalog.find(e=>e.materialId===id),config=api.ensureVoxelPlacerConfig();
    api.applyVoxelMaterialEntry(config,entry,{updateColor:true});assert.equal(config.materialId,id);assert.equal(config.color,entry.color);
    const saved=JSON.parse(JSON.stringify(config));assert.deepEqual(saved,config);assert.equal(saved.materialFile,entry.materialFile);
    const ordinary=applyDefaultWorldObjectPhysicsMaterial({physicsMaterialId:id});assert.equal(ordinary.physicsMaterialFile,entry.materialFile);
    assert.equal(materialEntryMatchesHint(entry,ordinary),true);assert.equal(isLiquidMaterialEntry(entry),['water','mud'].includes(id));
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshStandardMaterial({color:entry.color}));
    Object.assign(mesh.userData,{physicsMaterialId:id,physicsMaterialFile:entry.materialFile,MatterState:entry.matterState,equationCollider:{a:0,b:1,c:0,d:0}});
    const layer=makeEquationLayerDefinition(mesh);assert.equal(layer.physicsMaterialId,id);assert.equal(layer.MatterState,entry.matterState);
    assert.equal(layer.isSolid,!['water','mud'].includes(id));mesh.geometry.dispose();mesh.material.dispose();
  }
});
test('catalog overrides affect procedural visuals and physical metadata, without per-voxel lookup', async () => {
  const catalog=canonicalCatalog.map(e=>e.materialId==='stone'?{...e,materialDefinition:{...e.materialDefinition,rendering:{color:'#112233',roughness:.25},collider:{restitution:.7}}}:e);
  let fetches=0;const palette=await createVoxelMaterialPalette(THREE,{catalog,fetch(){fetches++;throw Error('unexpected fetch');}});
  assert.equal(palette.materials[2].color.getHexString(),'112233');assert.equal(palette.materials[2].roughness,.25);assert.equal(palette.entries[3].collider.restitution,.7);
  createVoxelGenerator(def).generateChunk(0,1,0);assert.equal(fetches,0);palette.dispose();
});
test('disposing during catalog loading cannot leak chunk materials', async () => {
  let release;const pending=new Promise(resolve=>release=resolve);
  const catalog=canonicalCatalog.map(e=>({...e,materialDefinition:undefined}));
  const root=createProceduralVoxelWorld(THREE,def,[],{catalog,fetch:async url=>{await pending;return {ok:true,json:async()=>canonicalCatalog.find(e=>e.materialFile===url).materialDefinition};}});
  const runtime=root.userData.proceduralVoxelRuntime;runtime.dispose();release();assert.equal(await runtime.ready,false);assert.equal(root.children.length,0);
});
