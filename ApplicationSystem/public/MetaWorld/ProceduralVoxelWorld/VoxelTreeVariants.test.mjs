// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelTreeVariants.test.mjs
// These regressions verify canonical needle litter, living magnolias, species-specific dead and fallen trees, bounded placement and deterministic collision and chunk composition.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../lib/three/three.module.js';
import { createBaseTerrain } from './VoxelBaseTerrain.mjs';
import { createTreePlacement } from './Features/TreePlacement.mjs';
import { fallenTree } from './Features/TreeVariants.mjs';
import { createVoxelGenerator } from './VoxelTerrainGenerator.mjs';
import { createProceduralVoxelWorld } from './ProceduralVoxelWorldRuntime.mjs';
import { resolveWorldObjectMaterial } from '../Materials/WorldObjectMaterialResolver.mjs';
import { treeMaterialIndices, PINE_NEEDLES } from './VoxelMaterialIds.mjs';
import { meshVoxelChunk } from './VoxelChunkMesher.mjs';
import { voxelIndex } from './VoxelCoordinates.mjs';
import { terrainDefinition as def, voxelMaterialOptions } from './VoxelMaterialTestFixtures.mjs';
const fixtures={Pine:[[47,0],[33,1]],Maple:[[7,0],[60,1]],Oak:[[58,1],[24,0]],Magnolia:[[54,1],[57,6]]};
function cells(tree) {
  const result=[];
  for(let z=tree.min[2];z<tree.max[2];z++)for(let x=tree.min[0];x<tree.max[0];x++)for(let y=tree.min[1];y<tree.max[1];y++){
    const id=tree.sample(x,y,z);if(id)result.push([x,y,z,id]);
  }
  return result;
}
test('pine needle litter resolves canonically and follows dry ground without replacing roots or ground',async()=>{
  const material=await resolveWorldObjectMaterial('pine needles',voxelMaterialOptions);
  assert.equal(material.materialId,'PineNeedles');assert.equal(material.collider.solid,false);
  const base=createBaseTerrain(def),tree=createTreePlacement(base,def.generator.seed).candidate(29,1),g=createVoxelGenerator(def);
  const bed=cells(tree).filter(c=>c[3]===PINE_NEEDLES);assert.ok(bed.length>20&&bed.length<160);
  for(const [x,y,z] of bed){
    assert.equal(y,base.getTerrainHeight(x,z));assert.equal(base.getVoxel(x,y,z),0);
    assert.equal(g.getVoxel(x,y,z),PINE_NEEDLES);assert.equal(g.getVoxel(x,y-1,z),base.getVoxel(x,y-1,z));
    assert.ok(Math.hypot(x-tree.origin[0],z-tree.origin[2])<=7);
  }
  assert.equal(g.getVoxel(...tree.origin),treeMaterialIndices('Pine')[0]);
  const chunk=bed[0].slice(0,3).map(v=>Math.floor(v/32));
  const mesh=meshVoxelChunk(g.generateChunk(...chunk),chunk,g.getVoxel);
  assert.ok(mesh.groups.some(group=>group.materialIndex===PINE_NEEDLES-1));
});
test('all four species have bare dead trees, low fallen wood and bark, and living flowering magnolias',()=>{
  const base=createBaseTerrain(def),provider=createTreePlacement(base,def.generator.seed);
  for(const [species,locations] of Object.entries(fixtures))for(const [index,cell] of locations.entries()){
    const tree=provider.candidate(...cell),[wood,bark]=treeMaterialIndices(species);
    assert.equal(tree.species,species);assert.equal(tree.variant,index?'fallen':'dead');
    assert.ok(tree.min.every(v=>v>=0)&&tree.max.every((v,a)=>v<=base.dimensions[a]));
    const values=new Set(cells(tree).map(c=>c[3]));assert.ok(values.has(wood)&&values.has(bark));
    assert.ok([...values].every(id=>[wood,bark,PINE_NEEDLES].includes(id)));
    if(index)assert.ok(tree.max[1]-tree.min[1]<tree.parameters.height);
  }
  const magnolia=provider.candidate(14,0),values=new Set(cells(magnolia).map(c=>c[3]));
  assert.equal(magnolia.species,'Magnolia');assert.equal(magnolia.variant,'living');
  for(const id of [19,20,21,22])assert.ok(values.has(id));
  const standing=provider.candidate(29,1);
  assert.equal(fallenTree(standing,{...base,getTerrainHeight:()=>0}),null);
});
test('fallen trees remain discoverable past their ownership cell and regenerate seamlessly',()=>{
  const g=createVoxelGenerator(def),base=createBaseTerrain(def),p=createTreePlacement(base,def.generator.seed),other=createVoxelGenerator(def);
  for(const locations of Object.values(fixtures)){
    const tree=p.candidate(...locations[1]),wood=treeMaterialIndices(tree.species)[0];
    const samples=cells(tree).filter(c=>c[3]===wood&&g.getVoxel(...c.slice(0,3))===wood);
    const tip=samples.reduce((a,b)=>Math.hypot(a[0]-tree.origin[0],a[2]-tree.origin[2])>Math.hypot(b[0]-tree.origin[0],b[2]-tree.origin[2])?a:b);
    assert.ok(Math.hypot(tip[0]-tree.origin[0],tip[2]-tree.origin[2])>20);
    assert.ok(g.features.query(tip.slice(0,3),tip.slice(0,3).map(v=>v+1)).some(f=>f.id===tree.id));
    const chunk=tip.slice(0,3).map(v=>Math.floor(v/32)),data=g.generateChunk(...chunk);
    assert.deepEqual(data,other.generateChunk(...chunk));
    for(let z=0;z<32;z++)for(let x=0;x<32;x++)for(let y=0;y<32;y++)assert.equal(data[voxelIndex(x,y,z)],g.getVoxel(chunk[0]*32+x,chunk[1]*32+y,chunk[2]*32+z));
  }
});
test('fallen logs block the player while loose needle beds do not add solid obstacles',async()=>{
  const root=createProceduralVoxelWorld(THREE,def,[],voxelMaterialOptions),r=root.userData.proceduralVoxelRuntime;
  await r.ready;const collider=root.userData.colliderRef,base=createBaseTerrain(def),p=createTreePlacement(base,def.generator.seed);
  const log=p.candidate(33,1),voxel=cells(log).find(c=>c[3]===6&&r.generator.getVoxel(...c.slice(0,3))===6);
  const [x,y,z]=voxel,point=new THREE.Vector3((x+.5)*.25,(y+1)*.25,(z+.5)*.25);
  assert.equal(collider.intersectsPlayer(point,.1,y*.25,point.y),true);
  const pine=p.candidate(29,1),bed=cells(pine).find(c=>c[3]===PINE_NEEDLES&&Math.hypot(c[0]-pine.origin[0],c[2]-pine.origin[2])>4);
  const [bx,by,bz]=bed,feet=by*.25,standing=new THREE.Vector3((bx+.5)*.25,feet+1.75,(bz+.5)*.25);
  assert.equal(collider.intersectsPlayer(standing,.01,feet,standing.y),false);
  assert.ok(!JSON.stringify(r.serialize()).includes('PineNeedles'));r.dispose();
});
