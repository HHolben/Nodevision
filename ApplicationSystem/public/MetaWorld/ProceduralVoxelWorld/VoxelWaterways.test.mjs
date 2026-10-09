// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelWaterways.test.mjs
// These regressions verify canonical new vegetation, downhill drainage, finite liquid columns and deterministic chunk composition across the expanded landscape.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createVoxelGenerator } from './VoxelTerrainGenerator.mjs';
import { createWaterways } from './VoxelWaterways.mjs';
import { terrainDefinition as def,voxelMaterialOptions } from './VoxelMaterialTestFixtures.mjs';
import { resolveWorldObjectMaterial } from '../Materials/WorldObjectMaterialResolver.mjs';
import { VOXEL_MATERIAL_IDS } from './VoxelMaterialIds.mjs';
import { magnoliaParameters,sampleMagnoliaVoxel } from './Features/MagnoliaShape.mjs';

test('new vegetation resolves canonical physical properties and magnolia blossoms',async()=>{
  for(const id of VOXEL_MATERIAL_IDS.slice(19)){
    const material=await resolveWorldObjectMaterial(id,voxelMaterialOptions);
    assert.equal(material.materialId,id);assert.equal(material.collider.solid,/(Wood|Bark)$/.test(id)||id==='moss');
  }
  const p=magnoliaParameters(123456),seen=new Set();
  for(let y=0;y<p.height;y++)for(let z=-24;z<=24;z++)for(let x=-24;x<=24;x++)seen.add(sampleMagnoliaVoxel(x,y,z,123456,p));
  for(const id of [19,20,21,22])assert.ok(seen.has(id));
});
test('ponds, creeks, streams and waterfalls use actual finite water voxels over carved beds',()=>{
  const g=createVoxelGenerator(def),again=createVoxelGenerator(def);
  assert.equal(g.getVoxelMaterialId(1472,84,56),'moss');
  for(const [kind,x,z] of [['pond',1484,52],['creek',3876,116],['waterfall',3882,116],['stream',3002,332]]){
    const w=g.getWaterway(x,z);assert.equal(w.kind,kind);assert.deepEqual(w,again.getWaterway(x,z));
    assert.ok(g.getTerrainHeight(x,z)<=w.bed);assert.equal(g.getVoxelMaterialId(x,w.top-1,z),'water');
    assert.notEqual(g.getVoxelMaterialId(x,g.getSolidHeight(x,z)-1,z),'water');
    if(kind==='waterfall')assert.ok(w.top-w.bed>=4);
    const chunk=[x,w.top-1,z].map(v=>Math.floor(v/32));assert.deepEqual(g.generateChunk(...chunk),again.generateChunk(...chunk));
    assert.ok(g.getChunkLevels(chunk[0],chunk[2]).includes(chunk[1]));
  }
  assert.equal(g.getWaterway(-1,100),null);assert.equal(g.getVoxel(-1,80,100),0);
});
test('regional paths descend and stay bounded while vegetation regenerates',()=>{
  const drainage=createWaterways((x,z)=>300-Math.floor(x/8)-Math.floor(z/8),[4000,512,4000],123456);
  let segments=0;
  for(let z=0;z<4;z++)for(let x=0;x<4;x++)for(const s of drainage.region(x,z).segments){assert.ok(s.end.top<s.top);segments++;}
  assert.ok(segments>0);
  const g=createVoxelGenerator(def),features=g.features.query([0,0,0],[1024,512,1024]);
  assert.ok(features.some(f=>f.species==='Magnolia'));
  assert.ok(features.every(f=>f.species!=='Sunflower'));
});
