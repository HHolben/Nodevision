// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelBiomes.test.mjs
// These regressions verify canonical substrates, broad snowy biomes, denser shared pines, liquid mud, boundary stability and compact regeneration.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../lib/three/three.module.js';
import { terrainDefinition as def, voxelMaterialOptions } from './VoxelMaterialTestFixtures.mjs';
import { createVoxelGenerator } from './VoxelTerrainGenerator.mjs';
import { createProceduralVoxelWorld } from './ProceduralVoxelWorldRuntime.mjs';
import { resolveWorldObjectMaterial } from '../Materials/WorldObjectMaterialResolver.mjs';
import { createTreePlacement } from './Features/TreePlacement.mjs';
import { surfaceMaterial } from './VoxelSurfaceComposition.mjs';
import { meshVoxelChunk } from './VoxelChunkMesher.mjs';
import { voxelIndex } from './VoxelCoordinates.mjs';
import { installEnvironmentRuntimeAbility } from '../../PanelInstances/ViewPanels/GameViewDependencies/Abilities/InteractAbilities/EnvironmentRuntimeAbility.mjs';

test('substrate palette uses existing sand, liquid mud and snow plus canonical limestone gravel',async()=>{
  for(const id of ['sand','mud','LimestoneGravel','snow']){
    const e=await resolveWorldObjectMaterial(id,voxelMaterialOptions);
    assert.equal(e.materialId,id);assert.equal(e.physicsMaterialId,id);
    assert.equal(e.matterState,id==='mud'?'liquid':'solid');assert.equal(e.collider.solid,id!=='mud');
    assert.ok(e.materialFile.endsWith('/'+id+'.json'));
  }
});
test('seed 123456 pins varied shores, deep substrates, dry grass and actual snow',()=>{
  const g=createVoxelGenerator(def),reloaded=createVoxelGenerator(JSON.parse(JSON.stringify(def)));
  for(const [cell,id] of [[[0,75,0],'grass'],[[32,71,0],'LimestoneGravel'],[[96,67,0],'sand'],[[240,62,0],'stone'],[[1280,73,0],'mud'],[[2032,57,0],'limestone'],[[2224,75,0],'snow']]){
    assert.equal(g.getVoxelMaterialId(...cell),id);assert.equal(reloaded.getVoxelMaterialId(...cell),id);
  }
  assert.equal(g.getVoxelMaterialId(96,68,0),'water');assert.equal(g.getVoxelMaterialId(2224,74,0),'soil');
  assert.equal(g.getVoxelMaterialId(2224,10,0),'stone');
  assert.equal(surfaceMaterial({x:0,z:0,height:71,waterTop:72,limestone:true,biome:{id:'snowy-pine-forest'},seed:123456}),11);
  for(let z=0;z<512;z+=16)for(let x=0;x<3000;x+=16){
    const h=g.getTerrainHeight(x,z),id=g.getVoxelMaterialId(x,h-1,z);
    if(id==='snow'){assert.equal(g.getBiome(x,z),'snowy-pine-forest');assert.ok(h>74);}
    if(h<=72)assert.notEqual(id,'snow');
  }
});
test('biomes form coherent regions and neighboring chunks agree across surfaces',()=>{
  const g=createVoxelGenerator(def),other=createVoxelGenerator(def);
  assert.equal(g.getBiome(0,0),'temperate');assert.equal(g.getBiome(2224,0),'snowy-pine-forest');
  for(let z=0;z<64;z+=4)for(let x=2224;x<2288;x+=4)assert.equal(g.getBiome(x,z),'snowy-pine-forest');
  for(const cell of [[69,2,0],[70,2,0],[39,2,0],[40,2,0]]){
    const data=g.generateChunk(...cell);assert.deepEqual(data,other.generateChunk(...cell));
    for(let y=0;y<32;y++)for(let z=0;z<32;z++)for(const x of [0,31])assert.equal(data[voxelIndex(x,y,z)],g.getVoxel(cell[0]*32+x,cell[1]*32+y,cell[2]*32+z));
  }
});
test('shared pine engine is denser in snowy habitat and requires appropriate dry surfaces',()=>{
  const base={dimensions:[4000,512,4000],getTerrainHeight:()=>80,getVoxel:()=>1,getSlope:()=>0,getBiome:()=> 'temperate'};
  const warm=createTreePlacement(base,123456),cold=createTreePlacement({...base,getVoxel:()=>12,getBiome:()=> 'snowy-pine-forest'},123456);
  let a=0,b=0;
  for(let z=1;z<25;z++)for(let x=1;x<25;x++){if(warm.candidate(x,z))a++;if(cold.candidate(x,z))b++;}
  assert.ok(a>0);assert.ok(b>a*2);assert.ok(b<24*24);
  const g=createVoxelGenerator(def),trees=g.features.query([2200,0,16],[2456,160,272]);
  assert.ok(trees.some(f=>g.getBiome(f.origin[0],f.origin[2])==='snowy-pine-forest'));
  for(const f of trees){const [x,y,z]=f.origin;assert.ok(y>71);assert.ok(['grass','snow'].includes(g.getVoxelMaterialId(x,y-1,z)));if(f.variant!=='fallen')assert.equal(g.getVoxelMaterialId(x,y,z),'PineWood');}
});
test('mud retains liquid buoyancy and transparency while collision finds the solid bed',async()=>{
  const colliders=[],root=createProceduralVoxelWorld(THREE,def,colliders,voxelMaterialOptions),r=root.userData.proceduralVoxelRuntime;await r.ready;
  const point=new THREE.Vector3(320.125,18.375,.125),api=installEnvironmentRuntimeAbility({api:{},objects:[root],waterVolumes:[]});
  assert.equal(api.getWaterVolumeAtPosition(point).materialId,'mud');assert.equal(api.getWaterVolumeAtPosition(point).buoyancyScale,1.7);
  assert.equal(colliders[0].sampleGroundY(point.x,point.z),18.25);assert.equal(colliders[0].materialId,'soil');
  const mud=r.materials.find(m=>m.userData.materialId==='mud');assert.equal(mud.opacity,.66);assert.equal(mud.depthWrite,false);
  const data=new Uint8Array(32**3);data[voxelIndex(0,0,0)]=10;data[voxelIndex(0,1,0)]=5;
  const mesh=meshVoxelChunk(data,[0,0,0],()=>0);assert.equal(mesh.faceCount,11);assert.equal(mesh.solidVoxels,0);
  assert.equal(mesh.groups.find(g=>g.materialIndex===9).count,36); // One mud/water interface, owned by mud.
  const saved=r.serialize();assert.ok(!JSON.stringify(saved).includes('biome'));assert.ok(!JSON.stringify(saved).includes('materials'));
  assert.equal(createVoxelGenerator(saved).getBiome(2224,0),'snowy-pine-forest');r.dispose();
});
