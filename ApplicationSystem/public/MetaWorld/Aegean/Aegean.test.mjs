// Nodevision/ApplicationSystem/public/MetaWorld/Aegean/Aegean.test.mjs
// These tests exercise version safety, reusable materials, deterministic ecology, finite coastal voxels and legacy-compatible serialization.
import { regenerateVegetationDefinition } from './Regeneration.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { AEGEAN_DEFAULTS } from './AegeanDefinition.mjs';
import { AEGEAN_SPECIES, plantParameters, samplePlant } from './PlantPlacement.mjs';
import { AEGEAN_BIOMES } from './Biomes.mjs';
import { validateVoxelWorld } from '../ProceduralVoxelWorld/VoxelWorldDefinition.mjs';
import { createVoxelGenerator } from '../ProceduralVoxelWorld/VoxelTerrainGenerator.mjs';
import { voxelWorldForm, definitionFromVoxelForm } from '../ProceduralVoxelWorld/VoxelAuthoringDefinition.mjs';
import { VOXEL_MATERIAL_IDS } from '../ProceduralVoxelWorld/VoxelMaterialIds.mjs';
import { voxelIndex } from '../ProceduralVoxelWorld/VoxelCoordinates.mjs';
import { voxelMaterialOptions } from '../ProceduralVoxelWorld/VoxelMaterialTestFixtures.mjs';
import { resolveWorldObjectMaterial } from '../Materials/WorldObjectMaterialResolver.mjs';
export const fixture={id:'aegean-test',type:'procedural-voxel-world',position:[-64,0,-64],size:[128,80,128],heightLimits:{min:-16,max:64},voxelSize:.25,generator:{id:'nodevision-terrain-v1',version:1,seed:123456},chunks:{voxelsPerAxis:32,loadRadius:1},environment:{...AEGEAN_DEFAULTS},generation:{vegetation:true,water:true,caves:false}};
test('Aegean configuration round trips and rejects unavailable versions and invalid bounds',()=>{
  assert.deepEqual(validateVoxelWorld(fixture).environment,fixture.environment);
  const from=definitionFromVoxelForm(voxelWorldForm(fixture),fixture);assert.deepEqual(from.environment,fixture.environment);
  for(const patch of [{version:2},{seaLevel:80},{vegetationDensity:NaN},{geology:'unknown'}])assert.throws(()=>validateVoxelWorld({...fixture,environment:{...fixture.environment,...patch}}),/Aegean/);
  assert.equal(VOXEL_MATERIAL_IDS.length,new Set(VOXEL_MATERIAL_IDS).size);assert.ok(VOXEL_MATERIAL_IDS.length<=256);
});
test('all species and biome references resolve canonical materials and deterministic finite plant shapes',async()=>{
  assert.equal(Object.keys(AEGEAN_SPECIES).length,35);assert.equal(AEGEAN_BIOMES.length,10);
  for(const biome of AEGEAN_BIOMES)for(const [id,w] of Object.entries(biome.species))if(w>0)assert.ok(AEGEAN_SPECIES[id],id);
  for(const s of Object.values(AEGEAN_SPECIES)){
    for(const material of s.dependencies){const resolved=await resolveWorldObjectMaterial(material,voxelMaterialOptions);assert.equal(resolved.materialId,material);assert.equal(resolved.materialDefinition.id,material);}
    for(const form of s.growthForms){const p=plantParameters(s,19,form);assert.deepEqual(p,plantParameters(s,19,form));assert.ok(p.height>0&&p.height<=72);
      let filled=0;for(let y=0;y<p.height;y++)for(let x=-20;x<=20;x+=2)for(let z=-20;z<=20;z+=2){const v=samplePlant(s,19,p,x,y,z);assert.ok(Number.isInteger(v)&&v>=0&&v<VOXEL_MATERIAL_IDS.length);filled+=v>0;}
      assert.ok(filled>0,s.id+' '+form);
    }
  }
});
test('coastal terrain and features are finite, order independent and consistent across chunk seams',()=>{
  const g=createVoxelGenerator(fixture),saved=createVoxelGenerator(JSON.parse(JSON.stringify(fixture)));let wet=0,dry=0;
  for(let z=0;z<512;z+=13)for(let x=0;x<512;x+=13){const h=g.getTerrainHeight(x,z);assert.equal(h,saved.getTerrainHeight(x,z));assert.ok(h>0&&h<320);if(h<64)wet++;else dry++;}
  assert.ok(wet>50&&dry>50);
  for(const chunk of [[7,2,7],[0,1,0],[8,2,7],[7,3,7]]){
    const data=g.generateChunk(...chunk);assert.deepEqual(data,saved.generateChunk(...chunk));
    for(let z=0;z<32;z+=7)for(let y=0;y<32;y+=5)for(let x=0;x<32;x+=7)assert.equal(data[voxelIndex(x,y,z)],g.getVoxel(chunk[0]*32+x,chunk[1]*32+y,chunk[2]*32+z));
  }
  const features=g.features.query([0,0,0],[512,320,512]);assert.ok(features.length>0);
  for(const f of features){assert.ok(AEGEAN_SPECIES[f.species]);assert.ok(f.origin[1]>=g.getWaterTop(f.origin[0],f.origin[2]));}
  assert.equal(g.getVoxel(-1,0,0),0);assert.equal(g.getVoxel(512,0,0),0);
});
test('optional geology and biomes remain opt-in and water obeys configured sea level',()=>{
  for(const geology of ['limestone','metamorphic','volcanic','mixed']){
    const def={...fixture,environment:{...fixture.environment,geology}},g=createVoxelGenerator(def);
    assert.equal(g.getWaterTop(0,0),64);assert.match(g.getVoxelMaterialId(0,63,0),/^Aegean.*Water$/);
    assert.ok(!['upland-oak','rocky-mountain'].includes(g.getBiome(256,256)));
    if(geology==='volcanic')assert.equal(g.getVoxelMaterialId(256,0,256),'basalt');
  }
});
test('protected ground retains its original height, geology and water after regeneration',()=>{
  const original=createVoxelGenerator(fixture),region={id:'authored-test',min:[150,150],max:[220,220],seed:fixture.generator.seed,environment:structuredClone(fixture.environment),generation:fixture.generation};
  const changed={...fixture,generator:{...fixture.generator,seed:9382},environment:{...fixture.environment,geology:'volcanic'},protectedRegions:[region]};
  validateVoxelWorld(changed);const next=createVoxelGenerator(changed);
  for(let z=150;z<220;z+=9)for(let x=150;x<220;x+=9){assert.equal(next.getTerrainHeight(x,z),original.getTerrainHeight(x,z));for(let y=0;y<140;y+=11)assert.equal(next.base.getVoxel(x,y,z),original.base.getVoxel(x,y,z));}
  for(const feature of next.features.query([150,0,150],[220,320,220]))assert.fail('protected region contains procedural vegetation: '+feature.id);
  assert.throws(()=>validateVoxelWorld({...changed,protectedRegions:[{...region,environment:{...region.environment,version:2}}]}),/unavailable/);
});

test('vegetation-only regeneration changes local plant seeds while preserving ground and unrelated scopes',()=>{
  const revised=regenerateVegetationDefinition(fixture,{bounds:[0,0,256,512]}),before=createVoxelGenerator(fixture),after=createVoxelGenerator(revised);
  const a=before.features.query([0,0,0],[512,320,512]),b=after.features.query([0,0,0],[512,320,512]);
  assert.notDeepEqual(a.map(f=>[f.id,f.seed]),b.map(f=>[f.id,f.seed]));
  assert.deepEqual(a.filter(f=>f.origin[0]>280).map(f=>[f.id,f.seed]),b.filter(f=>f.origin[0]>280).map(f=>[f.id,f.seed]));
  for(let z=0;z<512;z+=23)for(let x=0;x<512;x+=23)assert.equal(before.getTerrainHeight(x,z),after.getTerrainHeight(x,z));
  assert.equal(fixture.vegetationRevisions,undefined);
  assert.throws(()=>regenerateVegetationDefinition(fixture,{bounds:[0,0,9999,512]}),/bounds/);
});
