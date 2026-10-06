// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelPine.test.mjs
// These regressions pin canonical pine materials, placement, geometry, cross-chunk determinism, feature collision and compact persistence.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../lib/three/three.module.js';
import { terrainDefinition as def, voxelMaterialOptions } from './VoxelMaterialTestFixtures.mjs';
import { createVoxelGenerator } from './VoxelTerrainGenerator.mjs';
import { createProceduralVoxelWorld } from './ProceduralVoxelWorldRuntime.mjs';
import { createBaseTerrain } from './VoxelBaseTerrain.mjs';
import { createPinePlacement } from './Features/PinePlacement.mjs';
import { pineParameters, samplePineVoxel } from './Features/PineShape.mjs';
import { resolveWorldObjectMaterial } from '../Materials/WorldObjectMaterialResolver.mjs';
import { meshVoxelChunk } from './VoxelChunkMesher.mjs';
import { voxelIndex } from './VoxelCoordinates.mjs';
import { createCollisionChecker } from '../../PanelInstances/ViewPanels/GameViewDependencies/collisionCheck.mjs';

test('pine materials resolve through the shared catalog with explicit solidity and opacity',async()=>{
  for(const id of ['PineWood','PineBark','PineFoliage']){
    const entry=await resolveWorldObjectMaterial(id,voxelMaterialOptions);
    assert.equal(entry.materialId,id);assert.equal(entry.physicsMaterialId,id);assert.equal(entry.matterState,'solid');
    assert.equal(entry.collider.solid,id!=='PineFoliage');assert.equal(entry.rendering.opacity,1);
    assert.ok(entry.materialFile.endsWith('/Solids/'+id+'.json'));
  }
});
test('placement and parameters are seeded, local, suitable, bounded and nonuniform',()=>{
  const base=createBaseTerrain(def),p=createPinePlacement(base,def.generator.seed),g=createVoxelGenerator(def);
  const f=p.candidate(1,3);assert.equal(f.id,'pine:1,3');assert.deepEqual(f.origin,[47,76,74]);
  assert.deepEqual(p.candidate(1,3).parameters,f.parameters);assert.deepEqual(pineParameters(f.seed),f.parameters);
  assert.equal(f.parameters.height,32);
  const features=g.features.query([0,0,0],[256,200,256]);assert.equal(features.length,8);
  assert.equal(new Set(features.map(v=>v.id)).size,features.length);
  assert.ok(new Set(features.map(v=>v.parameters.height)).size>3);
  for(const tree of features){
    const [x,y,z]=tree.origin;assert.equal(base.getVoxelMaterialId(x,y-1,z),'grass');assert.ok(y>71);
    assert.ok(tree.min.every(v=>v>=0));assert.ok(tree.max.every((v,a)=>v<=base.dimensions[a]));
    const heights=[[3,0],[-3,0],[0,3],[0,-3]].map(([dx,dz])=>base.getTerrainHeight(x+dx,z+dz));
    assert.ok(Math.max(y,...heights)-Math.min(y,...heights)<=3);
  }
  const fake={dimensions:[4000,512,4000],getTerrainHeight:()=>60,getVoxel:()=>1};
  assert.equal(createPinePlacement(fake,def.generator.seed).candidate(0,1),null);
  fake.getTerrainHeight=()=>80;fake.getVoxel=()=>3;assert.equal(createPinePlacement(fake,def.generator.seed).candidate(0,1),null);
  fake.getVoxel=()=>1;fake.getTerrainHeight=(x)=>x===16?80:90;assert.equal(createPinePlacement(fake,def.generator.seed).candidate(0,1),null);
  for(let i=0;i<100;i++)g.features.query([i*32,0,200],[i*32+32,160,232]);assert.ok(g.features.cacheSize<=512);
});
test('pine core, bark and canopy compose without replacing terrain and remain inside bounds',()=>{
  const g=createVoxelGenerator(def),f=g.features.query([47,76,74],[48,77,75]).find(v=>v.id==='pine:1,3');
  for(const [cell,id] of [[[47,76,74],'PineWood'],[[46,76,73],'PineBark'],[[51,85,82],'PineFoliage'],[[47,75,74],'grass']])assert.equal(g.getVoxelMaterialId(...cell),id);
  const seen=new Set();
  for(let y=-1;y<=f.parameters.height;y++)for(let z=-13;z<=13;z++)for(let x=-13;x<=13;x++){
    const id=samplePineVoxel(x,y,z,f.seed,f.parameters);seen.add(id);
    assert.equal(id,samplePineVoxel(x,y,z,f.seed,pineParameters(f.seed)));
    if(id)assert.ok(y>=0&&y<f.parameters.height&&Math.abs(x)<=12&&Math.abs(z)<=12);
  }
  assert.ok(seen.has(6)&&seen.has(7)&&seen.has(8));
  assert.equal(samplePineVoxel(0,15,0,f.seed,f.parameters),6);
  assert.equal(samplePineVoxel(1,5,0,f.seed,f.parameters),7); // Tapered exterior remains bark, never exposed core.
});
test('cross-chunk pines agree with final queries in either load order and after regeneration',()=>{
  const a=createVoxelGenerator(def),b=createVoxelGenerator(JSON.parse(JSON.stringify(def)));
  const cells=[[0,2,4],[1,2,4],[0,3,4],[1,3,4]],snapshots=new Map();
  for(const cell of cells)snapshots.set(cell.join(','),a.generateChunk(...cell));
  for(const cell of cells.toReversed()){
    const bytes=b.generateChunk(...cell);assert.deepEqual(bytes,snapshots.get(cell.join(',')));
    for(let z=0;z<32;z++)for(let y=0;y<32;y++)for(let x=0;x<32;x++)assert.equal(bytes[voxelIndex(x,y,z)],a.getVoxel(x+cell[0]*32,y+cell[1]*32,z+cell[2]*32));
  }
  assert.equal(a.getVoxelMaterialId(31,75,133),'PineBark');assert.equal(a.getVoxelMaterialId(32,75,133),'PineWood');
});
test('canonical feature solidity blocks trunks without tree colliders or serialized tree objects',async()=>{
  const colliders=[],root=createProceduralVoxelWorld(THREE,def,colliders,voxelMaterialOptions),r=root.userData.proceduralVoxelRuntime;await r.ready;
  const state={playerHeight:1.75,isGrounded:true,activeExpressionTerrainColliderId:def.id};
  const collide=createCollisionChecker({colliders,movementState:state,playerRadius:.35});
  assert.equal(colliders.length,1);assert.equal(collide(new THREE.Vector3(11.875,20.8,18.625)),true);
  assert.equal(collide(new THREE.Vector3(13.25,20.8,18.625)),false);
  const foliage=r.getVoxelMaterial(51,85,82);assert.equal(foliage.collider.solid,false);
  root.visible=false;assert.equal(collide(new THREE.Vector3(11.875,20.8,18.625)),false);root.visible=true;
  const saved=r.serialize();assert.ok(!JSON.stringify(saved).includes('Pine'));assert.deepEqual(saved.generator,def.generator);
  assert.equal(createVoxelGenerator(saved).getVoxelMaterialId(47,76,74),'PineWood');
  r.dispose();assert.equal(colliders.length,0);assert.equal(r.generator.features.cacheSize,0);
});

test('opaque pine interfaces cull normally and existing compound collision is preserved',()=>{
  const data=new Uint8Array(32**3);data[voxelIndex(0,0,0)]=6;data[voxelIndex(1,0,0)]=7;
  assert.equal(meshVoxelChunk(data,[0,0,0],()=>0).faceCount,10);
  data[voxelIndex(1,0,0)]=8;assert.equal(meshVoxelChunk(data,[0,0,0],()=>0).faceCount,10);
  const box={min:{x:0,y:0,z:0},max:{x:1,y:2,z:1}},movementState={playerHeight:1.75};
  for(const collider of [{type:'box',box},{type:'compound',boxes:[{box}]},{type:'compound',worldTriangles:[[{x:0,y:0,z:0},{x:0,y:3,z:0},{x:0,y:0,z:3}]]}]){
    const check=createCollisionChecker({colliders:[collider],movementState,playerRadius:.35});
    assert.equal(check({x:.1,y:1.8,z:.1}),true);assert.equal(check({x:5,y:1.8,z:5}),false);
  }
});
