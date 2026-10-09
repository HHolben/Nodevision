// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelOrchardTrees.test.mjs
// These regressions verify fruitless apple, pear and cherry shapes, canonical materials, seeded habitat placement and shared chunk composition for living, dead and fallen trees.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ORCHARD_SHAPES } from './Features/OrchardTreeShapes.mjs';
import { createTreePlacement } from './Features/TreePlacement.mjs';
import { createBaseTerrain } from './VoxelBaseTerrain.mjs';
import { createVoxelGenerator } from './VoxelTerrainGenerator.mjs';
import { treeMaterialIndices, VOXEL_MATERIAL_IDS } from './VoxelMaterialIds.mjs';
import { resolveWorldObjectMaterial } from '../Materials/WorldObjectMaterialResolver.mjs';
import { meshVoxelChunk } from './VoxelChunkMesher.mjs';
import { voxelIndex } from './VoxelCoordinates.mjs';
import { terrainDefinition as def, voxelMaterialOptions } from './VoxelMaterialTestFixtures.mjs';
const fixtures={Apple:[[23,20],[7,32],[7,33]],Pear:[[19,0],[23,7],[39,7]],Cherry:[[20,1],[39,25],[56,9]]};

test('orchard species resolve solid wood and bark with non-solid foliage, without fruit materials',async()=>{
  for(const species of Object.keys(fixtures)){
    assert.deepEqual(VOXEL_MATERIAL_IDS.filter(id=>id.startsWith(species)),['Wood','Bark','Foliage'].map(part=>species+part));
    for(const part of ['Wood','Bark','Foliage']){
      const entry=await resolveWorldObjectMaterial(species+' '+part,voxelMaterialOptions);
      assert.equal(entry.materialId,species+part);assert.equal(entry.collider.solid,part!=='Foliage');
    }
  }
});
test('distinct bounded crowns contain only their own wood, bark and leaves',()=>{
  const dimensions=[];
  for(const [species,[parameters,sample]] of Object.entries(ORCHARD_SHAPES)){
    const p=parameters(123456),ids=treeMaterialIndices(species),seen=new Set();
    assert.deepEqual(p,parameters(123456));dimensions.push([p.height,p.crownRadius]);
    const radius=Math.ceil(p.crownRadius*1.34);
    for(let y=-1;y<=p.height;y++)for(let z=-24;z<=24;z++)for(let x=-24;x<=24;x++){
      const id=sample(x,y,z,123456,p);seen.add(id);
      assert.ok(id===0||ids.includes(id));
      if(id)assert.ok(y>=0&&y<p.height&&Math.abs(x)<=radius&&Math.abs(z)<=radius);
    }
    ids.forEach(id=>assert.ok(seen.has(id)));assert.equal(sample(0,0,0,123456,p),ids[0]);
  }
  assert.equal(new Set(dimensions.map(JSON.stringify)).size,3);
});
test('all species generate living, dead and fallen forms and preserve canonical chunk geometry on reload',()=>{
  const base=createBaseTerrain(def),provider=createTreePlacement(base,def.generator.seed),g=createVoxelGenerator(def),other=createVoxelGenerator(def);
  for(const [species,locations] of Object.entries(fixtures)){
    for(const [i,cell] of locations.entries()){
      const tree=provider.candidate(...cell);assert.equal(tree.species,species);assert.equal(tree.variant,['living','dead','fallen'][i]);
      assert.ok(tree.min.every(v=>v>=0)&&tree.max.every((v,a)=>v<=base.dimensions[a]));
    }
    const tree=provider.candidate(...locations[0]),chunk=tree.origin.map(v=>Math.floor(v/32)),data=g.generateChunk(...chunk);
    assert.deepEqual(data,other.generateChunk(...chunk));
    for(let z=0;z<32;z++)for(let x=0;x<32;x++)for(let y=0;y<32;y++)assert.equal(data[voxelIndex(x,y,z)],g.getVoxel(chunk[0]*32+x,chunk[1]*32+y,chunk[2]*32+z));
    const mesh=meshVoxelChunk(data,chunk,g.getVoxel),bark=treeMaterialIndices(species)[1];
    assert.ok(mesh.groups.some(group=>group.materialIndex===bark-1));
  }
});
