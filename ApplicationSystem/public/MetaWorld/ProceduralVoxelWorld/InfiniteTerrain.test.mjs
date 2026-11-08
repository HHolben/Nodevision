// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/InfiniteTerrain.test.mjs
// These regressions exercise signed procedural coordinates, deterministic eviction, bounded streaming and persistence without changing finite source coverage. They use the actual generator, runtime, geometry and authoring definition rather than a replacement terrain implementation.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../lib/three/three.module.js';
import {createVoxelGenerator} from './VoxelTerrainGenerator.mjs';
import {createProceduralVoxelWorld} from './ProceduralVoxelWorldRuntime.mjs';
import {voxelMaterialOptions} from './VoxelMaterialTestFixtures.mjs';
import {voxelWorldForm,definitionFromVoxelForm} from './VoxelAuthoringDefinition.mjs';
import {containsVoxel} from './VoxelCoordinates.mjs';
import {findVoxelSpawn} from './VoxelSpawn.mjs';
import {validateExtentTransition} from './WorldExtent.mjs';
const def={id:'infinite',name:'Infinite',type:'procedural-voxel-world',position:[0,0,0],size:[64,64,64],voxelSize:.25,generator:{id:'nodevision-terrain-v1',version:1,seed:42},chunks:{voxelsPerAxis:32,loadRadius:1},worldExtent:{mode:'infinite'},generation:{vegetation:true,water:false,caves:false},streaming:{enabled:true,vegetationEnabled:true,visibilityDistance:64,vegetationDistance:32}};
function drain(r,p){const end=performance.now()+20000;do{r.update(p);}while((r.manager.queue.length||r.manager.pending||r.lod.snapshot().queue||r.vegetation.snapshot().queue)&&performance.now()<end);assert.equal(r.manager.queue.length,0);assert.equal(r.manager.pending,null);assert.equal(r.lod.snapshot().queue,0);assert.equal(r.vegetation.snapshot().queue,0);}
test('signed terrain is deterministic after cache eviction and finite worlds keep their boundaries',()=>{
 const g=createVoxelGenerator(def),finite=createVoxelGenerator({...def,worldExtent:{mode:'finite'}});
 const points=[[-400000,200000],[-4000,-8000],[-1,-1],[0,0],[4000,8000],[400000,-200000]];
 const sample=(x,z)=>{const h=g.getTerrainHeight(x,z);return [h,g.getVoxelMaterialId(x,h-1,z),g.getBiome(x,z),g.getSlope(x,z)];};
 const first=points.map(p=>sample(...p));assert.ok(first.every(v=>v[0]>0));
 const trees=()=>g.features.query([-2048,0,-2048],[-1024,256,-1024]).map(f=>[f.id,f.species,f.seed,f.origin]);
 const forest=trees();assert.ok(forest.length>0,'negative-coordinate forest generated');
 for(let n=-300;n<300;n++){g.getTerrainHeight(n*137,n*179);g.features.query([n*512,0,n*512],[n*512+32,256,n*512+32]);}
 g.clearColumns();g.features.clear();assert.deepEqual(points.map(p=>sample(...p)),first);assert.deepEqual(trees(),forest);
 assert.equal(finite.getVoxel(-1,1,-1),0);assert.equal(finite.getSolidHeight(4000,8000),0);
 assert.equal(g.terrainSampler.sample(-1000,-1000).covered,true);assert.equal(finite.terrainSampler.sample(-1,-1).covered,false);
 assert.equal(containsVoxel([-10,0,-10],g.dimensions),true);assert.equal(containsVoxel([-10,-1,-10],g.dimensions),false);
 const spawn=findVoxelSpawn(g,-4000,-8000,1.75);assert.ok(spawn[0]<0&&spawn[2]<0);
});
test('detailed/coarse/vegetation streaming, collision and reopen work beyond both former boundaries',async()=>{
 const root=createProceduralVoxelWorld(THREE,def,[],voxelMaterialOptions),r=root.userData.terrainRuntime;assert.ok(await r.ready);
 const start=new THREE.Vector3(-128,40,-128);drain(r,start);
 assert.ok([...r.manager.loaded.values()].some(e=>e.cell[0]<0&&e.mesh?.geometry.attributes.position.count));assert.ok(r.lod.snapshot().tiles>0);
 assert.ok(Number.isFinite(root.userData.colliderRef.sampleGroundY(-128,-128)));assert.equal(root.userData.colliderRef.containsPlayer,undefined);
 const first=r.generator.getTerrainHeight(-512,-512);
 for(const distance of [100,1000,10000,-10000,-1000,-128]){
  const p=new THREE.Vector3(distance,40,distance);drain(r,p);
  assert.ok(r.manager.loaded.size<=384);assert.ok(r.manager.columnLevels.size<100);assert.ok(r.lod.snapshot().tiles<=128);assert.ok(r.vegetation.snapshot().regions<=64);
  assert.ok([...r.manager.loaded.values()].every(e=>Math.abs(e.cell[0]-Math.floor(distance/8))<16),'no intervening route generated or retained');
 }
 assert.equal(r.generator.getTerrainHeight(-512,-512),first);
 await r.setRepresentation('polygonal');drain(r,start);assert.equal(r.representation,'polygonal');assert.ok(Number.isFinite(root.userData.colliderRef.sampleGroundY(-128,-128)));
 const saved=JSON.parse(JSON.stringify(r.serialize()));r.dispose();assert.equal(root.children.length,0);
 const reopened=createProceduralVoxelWorld(THREE,saved,[],voxelMaterialOptions),rr=reopened.userData.terrainRuntime;await rr.ready;
 assert.equal(rr.definition.worldExtent.mode,'infinite');assert.equal(rr.generator.getTerrainHeight(-512,-512),first);rr.dispose();
});
test('authoring preserves seed/origin, rejects map infinity and protects reverse conversion',()=>{
 const finite={...def,worldExtent:{mode:'finite'}},values=voxelWorldForm(finite),next=definitionFromVoxelForm({...values,worldExtentMode:'infinite'},finite);
 assert.deepEqual(next.position,finite.position);assert.deepEqual(next.generator,finite.generator);assert.equal(next.worldExtent.mode,'infinite');
 assert.throws(()=>validateExtentTransition(next,finite),/protect authored content/);
 assert.throws(()=>definitionFromVoxelForm({...voxelWorldForm(next),worldExtentMode:'finite'},next),/protect authored content/);
});
test('non-LOD streaming keeps the column registry bounded across repeated relocations',async()=>{
 const {VoxelChunkManager}=await import('./VoxelChunkManager.mjs'),g=createVoxelGenerator(def);
 const m=new VoxelChunkManager({...g,getChunkLevels:()=>[0]},1,()=>({solidVoxels:0,faceCount:0,residentBytes:0,generationMs:0,meshingMs:0}),()=>{});
 for(let n=0;n<300;n++){const x=(n%2?-1:1)*n*320;for(let i=0;i<10;i++)m.update([x,40,x]);assert.ok(m.loaded.size<=16);assert.ok(m.columnLevels.size<=16);assert.ok(m.queue.length<=9);}
 m.dispose();assert.equal(m.columnLevels.size,0);assert.equal(m.loaded.size,0);
});
test('Aegean remains deterministic beyond its original coastal footprint',async()=>{
 const {AEGEAN_DEFAULTS}=await import('../Aegean/AegeanDefinition.mjs');
 const g=createVoxelGenerator({...def,environment:{...AEGEAN_DEFAULTS},generation:{vegetation:true,water:true,caves:true}});
 const p=[-4000,-8000],first=g.getEnvironment(...p);assert.ok(first.height>0);g.clearColumns();assert.deepEqual(g.getEnvironment(...p),first);
 assert.equal(g.terrainSampler.sample(-1000,-2000).covered,true);
});
