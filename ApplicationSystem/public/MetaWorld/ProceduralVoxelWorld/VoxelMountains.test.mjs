// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelMountains.test.mjs
// These regressions pin bounded regional mountains, snow and rock surfaces, species ecology, broadleaf structure, local streaming and safe spawn selection.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createVoxelGenerator } from './VoxelTerrainGenerator.mjs';
import { terrainDefinition as def,voxelMaterialOptions } from './VoxelMaterialTestFixtures.mjs';
import { resolveWorldObjectMaterial } from '../Materials/WorldObjectMaterialResolver.mjs';
import { mountainStrength } from './VoxelMountains.mjs';
import { mapleParameters,sampleMapleVoxel,MAPLE } from './Features/MapleShape.mjs';
import { oakParameters,sampleOakVoxel,OAK } from './Features/OakShape.mjs';
import { treeSpeciesAt,TREE_ECOLOGY } from './Features/TreeEcology.mjs';
import { findVoxelSpawn } from './VoxelSpawn.mjs';

test('V1 mountains have broad significant relief, bounded peaks, snow caps and rock faces',()=>{
  const g=createVoxelGenerator(def),short=createVoxelGenerator({...def,size:[1000,32,1000]});
  assert.equal(g.getTerrainHeight(1632,2816),401);assert.equal(g.getVoxelMaterialId(1632,400,2816),'snow');
  assert.ok(g.getTerrainHeight(1632,2816)>g.getTerrainHeight(0,0)+240);
  assert.notEqual(g.getVoxelMaterialId(1632,399,2816),'snow');assert.ok(['stone','limestone'].includes(g.getVoxelMaterialId(3776,211,3968)));
  assert.equal(mountainStrength(1632,2816,123456),mountainStrength(1632,2816,123456));
  for(let z=2400;z<3200;z+=32)for(let x=1200;x<2000;x+=32){assert.ok(g.getTerrainHeight(x,z)<448);assert.ok(short.getTerrainHeight(x,z)<=108);}
  assert.ok(g.getTerrainHeight(1600,2816)>300);assert.ok(Math.abs(g.getTerrainHeight(1631,2816)-g.getTerrainHeight(1632,2816))<5);
  assert.equal(g.getVoxelMaterialId(448,71,448),'water');
  const levels=g.getChunkLevels(51,88);assert.ok(levels.includes(12));assert.ok(levels.length<Math.ceil(g.maxSolidHeight/32));
  const spawn=findVoxelSpawn(g,1632,2816,1.75);assert.ok(g.getSlope(spawn[0],spawn[2])<=.5);assert.ok(spawn[1]>71);
});
test('maple and oak share canonical solid wood and bark with non-solid foliage',async()=>{
  for(const species of ['Maple','Oak'])for(const part of ['Wood','Bark','Foliage']){
    const e=await resolveWorldObjectMaterial(species+part,voxelMaterialOptions);assert.equal(e.materialId,species+part);assert.equal(e.collider.solid,part!=='Foliage');
  }
});
test('broadleaf shapes are deterministic, lobed and layered, with heavier oak dimensions',()=>{
  assert.ok(OAK.trunk[0]>MAPLE.trunk[1]);assert.ok(OAK.branchRadius>MAPLE.branchRadius);
  for(const [parameters,sample,ids] of [[mapleParameters,sampleMapleVoxel,[13,14,15]],[oakParameters,sampleOakVoxel,[16,17,18]]]){
    const p=parameters(123456);assert.deepEqual(p,parameters(123456));assert.ok(p.lobes.length>=6);assert.ok(p.branches.length>=5);
    const seen=new Set();let minX=100,maxX=-100;
    for(let y=-1;y<=p.height;y++)for(let x=-25;x<=25;x++)for(let z=-25;z<=25;z++){
      const m=sample(x,y,z,123456,p);seen.add(m);if(m){assert.ok(y>=0&&y<p.height&&Math.abs(x)<=24&&Math.abs(z)<=24);if(m===ids[2]){minX=Math.min(minX,x);maxX=Math.max(maxX,x);}}
    }
    ids.forEach(id=>assert.ok(seen.has(id)));assert.equal(sample(0,0,0,123456,p),ids[0]);assert.ok(maxX-minX>p.height*.5);
  }
});
test('species regions, tree lines, spacing and cross-chunk regeneration are deterministic',()=>{
  const g=createVoxelGenerator(def),reloaded=createVoxelGenerator(JSON.parse(JSON.stringify(def)));
  for(const [cell,id] of [[[71,76,69],'MapleWood'],[[123,78,267],'OakWood'],[[1415,84,75],'PineWood']]){assert.equal(g.getVoxelMaterialId(...cell),id);assert.equal(reloaded.getVoxelMaterialId(...cell),id);}
  const trees=g.features.query([0,0,0],[512,512,512]).filter(f=>f.species!=='Sunflower');
  for(let i=0;i<trees.length;i++)for(let j=0;j<i;j++)assert.ok(Math.hypot(trees[i].origin[0]-trees[j].origin[0],trees[i].origin[2]-trees[j].origin[2])>=40);
  const fake={getTerrainHeight:()=>200,getBiome:()=> 'temperate'};assert.equal(treeSpeciesAt(0,0,fake,123456),'Pine');
  fake.getTerrainHeight=()=>TREE_ECOLOGY.pineLine;assert.equal(treeSpeciesAt(0,0,fake,123456),null);
  fake.getTerrainHeight=()=>80;fake.getBiome=()=> 'snowy-pine-forest';assert.equal(treeSpeciesAt(0,0,fake,123456),'Pine');
  for(const cell of [[1,2,2],[2,2,2],[3,2,8],[4,2,8]])assert.deepEqual(g.generateChunk(...cell),reloaded.generateChunk(...cell));
});
