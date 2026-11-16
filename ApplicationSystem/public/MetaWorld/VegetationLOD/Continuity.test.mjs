// Nodevision/ApplicationSystem/public/MetaWorld/VegetationLOD/Continuity.test.mjs
// Exercise feature-wide delayed readiness, bounded scheduling, lifetime, invalidation and actual merged-mesh attribution. Visual framebuffer tests separately verify the shader rather than inferring continuity from these states.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../lib/three/three.module.js';
import {vegetationOwnership} from './Ownership.mjs';
import {vegetationDetail} from './Detail.mjs';
import {finishTerrainChunk} from '../ProceduralVoxelWorld/FinishTerrainChunk.mjs';
import {meshVoxelChunkSteps} from '../ProceduralVoxelWorld/VoxelChunkMesher.mjs';
import {drainSteps} from '../ProceduralVoxelWorld/ProgressiveTerrain.mjs';
import {voxelIndex} from '../ProceduralVoxelWorld/VoxelCoordinates.mjs';
import {vegetationDither} from './Dither.mjs';
import {prioritizeVegetation} from './Priority.mjs';
import {createProceduralVoxelWorld} from '../ProceduralVoxelWorld/ProceduralVoxelWorldRuntime.mjs';
import {voxelMaterialOptions,terrainDefinition} from '../ProceduralVoxelWorld/VoxelMaterialTestFixtures.mjs';
const feature={id:'pine:-1,0',species:'Pine',seed:7,origin:[-1,32,31],min:[-8,28,24],max:[8,70,40]},keys=[];
for(let z=0;z<2;z++)for(let y=0;y<3;y++)for(let x=-1;x<1;x++)keys.push(`${x},${y},${z}`);
function setup(options={}){let time=0;const manager={loaded:new Map(),invalidated:new Set(),columnLevels:new Map()},o=vegetationOwnership(THREE,manager,{now:()=>time,...options});o.tick(0,8,true);return {manager,o,setTime:t=>time=t};}
function install(manager,list=keys){for(const key of list)manager.loaded.set(key,{mesh:{visible:true}});}
test('one tree holds its complete proxy through partial and arbitrarily late detail, then fades once for 350 ms',()=>{
 const {manager,o,setTime}=setup();o.retain(feature,'proxy');o.retain(feature,'detail');o.tick();install(manager,keys.slice(0,6));setTime(5000);o.tick();assert.equal(o.value(feature.id),0);assert.equal(o.snapshot().transitioning,0);
 install(manager);o.tick();assert.equal(o.value(feature.id),0);setTime(5175);o.tick();assert.equal(o.value(feature.id),.5);setTime(5350);o.tick();assert.equal(o.value(feature.id),1);assert.equal(o.snapshot().completed,1);o.tick();assert.equal(o.snapshot().completed,1);
 assert.equal(o.snapshot().lateUpgrades,1);assert.ok(o.snapshot().timeNearBeforeReadyMs>=5000);o.dispose();
});
test('invalidated or hidden sections cannot finish a handoff; explicit empty column levels can',()=>{
 const {manager,o,setTime}=setup();o.retain(feature,'proxy');install(manager);manager.invalidated.add(keys[0]);o.tick();assert.equal(o.snapshot().transitioning,0);manager.invalidated.clear();manager.loaded.get(keys[0]).mesh.visible=false;o.tick();assert.equal(o.snapshot().transitioning,0);
 manager.loaded.delete(keys[0]);manager.columnLevels.set('-1,0',[1,2]);o.tick();setTime(350);o.tick();assert.equal(o.value(feature.id),1);o.dispose();
});
test('shared region/chunk references keep stable slots, reclaim them on eviction and never retain travel history',()=>{
 const {o}=setup(),slot=o.retain(feature,'proxy');assert.equal(o.retain(feature,'proxy'),slot);assert.equal(o.retain(feature,'detail'),slot);o.release(feature.id,'proxy');o.release(feature.id,'detail');assert.equal(o.slot(feature.id),slot);o.release(feature.id,'proxy');assert.equal(o.snapshot().trackedFeatures,0);
 for(let i=0;i<6000;i++){const f={...feature,id:'signed:'+(-i)};o.retain(f,'proxy');o.release(f.id,'proxy');}assert.equal(o.snapshot().trackedFeatures,0);assert.equal(o.snapshot().failures,0);o.dispose();
});
test('concurrent upgrades are capped and waiting nearby identities eventually transition',()=>{
 const {manager,o,setTime}=setup({maxTransitions:2});install(manager);for(let i=0;i<7;i++)o.retain({...feature,id:'tree:'+i},'proxy');o.tick();assert.equal(o.snapshot().transitioning,2);
 for(let i=1;i<=5;i++){setTime(i*350);o.tick();assert.ok(o.snapshot().transitioning<=2);}assert.equal(o.snapshot().completed,7);o.dispose();
});
test('disabling proxies restores full detail, and relocation or lost residency recovers safe coverage',()=>{
 const {manager,o,setTime}=setup();o.retain(feature,'proxy');install(manager);o.tick();setTime(175);o.tick();assert.equal(o.value(feature.id),.5);o.tick(1000,-1000,false);assert.equal(o.value(feature.id),1);assert.equal(o.snapshot().transitioning,0);
 manager.loaded.clear();o.tick(0,0,true);assert.equal(o.value(feature.id),0);o.release(feature.id,'proxy');assert.equal(o.snapshot().trackedFeatures,0);o.dispose();
});
test('near-tree priorities reorder only the bounded existing work, never add residency requests',()=>{
 const {manager,o}=setup();o.retain(feature,'proxy');manager.queue=[[5,null,0],[-1,1,0],[0,null,0],[1,0,0]];const before=manager.queue.map(c=>c.join(',')).sort();prioritizeVegetation(manager,o,[0,8],[-1,8]);assert.deepEqual(manager.queue.map(c=>c.join(',')).sort(),before);assert.ok(manager.queue.findIndex(c=>c[0]===-1)<manager.queue.findIndex(c=>c[0]===5));o.dispose();
});
test('procedural shader ownership leaves canonical materials and opacity/depth behavior unchanged',()=>{
 const material=new THREE.MeshStandardMaterial({color:0x224422}),{o}=setup(),clone=vegetationDither(material,o.texture);assert.notEqual(clone,material);assert.equal(material.onBeforeCompile,THREE.Material.prototype.onBeforeCompile);assert.equal(clone.transparent,false);assert.equal(clone.depthWrite,true);clone.dispose();o.dispose();material.dispose();
});
test('actual runtime retains descriptor identity, attributes detail only when enabled, and disposes transition resources',async()=>{
 const definition={...terrainDefinition,size:[512,128,512],generation:{vegetation:true,water:false,caves:false},streaming:{enabled:true,vegetationEnabled:true,vegetationDistance:64,visibilityDistance:64}},root=createProceduralVoxelWorld(THREE,definition,[],voxelMaterialOptions),r=root.userData.terrainRuntime;await r.ready;
 const features=r.generator.features.query([0,0,0],[1024,512,1024]),f=features.find(f=>f.species==='Pine');assert.ok(f);const position=new THREE.Vector3(f.origin[0]*.25,30,f.origin[2]*.25);
 const end=performance.now()+15000;let fadeObserved=false;
 while(performance.now()<end){r.update(position);const v=r.vegetation.ownership.value(f.id);fadeObserved ||=v>0&&v<1;const record=[...r.vegetation.ownership.records()].find(t=>t.id===f.id);if(fadeObserved&&record?.value===1)break;await new Promise(resolve=>setTimeout(resolve,2));}
 assert.ok(fadeObserved,'late actual chunk installation has intermediate frames');assert.equal(r.vegetation.ownership.value(f.id),1);assert.ok([...r.manager.loaded.values()].some(e=>e.mesh?.geometry.attributes.nvTree));
 const record=[...r.vegetation.ownership.records()].find(t=>t.id===f.id),key=record.chunks.find(k=>r.manager.loaded.has(k)),version=r.manager.loaded.revision;
 assert.ok(key);assert.equal(r.vegetation.states().find(t=>t.id===f.id)?.level,0);
 r.manager.invalidated.add(key);r.vegetation.sync();assert.equal(r.manager.loaded.revision,version);assert.equal(r.vegetation.ownership.value(f.id),0);
 assert.ok(r.vegetation.states().find(t=>t.id===f.id)?.level>0,'invalidation restores the complete proxy without a loaded-map revision');
 for(const e of r.manager.loaded.values()){const sections=e.mesh?.userData.vegetationSections;if(!sections)continue;for(const [index,ids] of sections.sections)if(ids.includes(f.id))assert.notEqual(e.mesh.material[index],sections.base[index],'invalidation reapplies coverage to detailed sections');}
 r.manager.invalidated.delete(key);r.vegetation.sync();assert.equal(r.vegetation.ownership.value(f.id),0);await new Promise(resolve=>setTimeout(resolve,360));r.vegetation.sync();assert.equal(r.vegetation.ownership.value(f.id),1);assert.equal(r.vegetation.states().find(t=>t.id===f.id)?.level,0);

 const identity=[f.id,f.species,f.origin,f.seed],before=r.serialize().generator.seed;r.lod.configure({...r.lod.settings,vegetationEnabled:false});r.update(position);assert.ok([...r.manager.loaded.values()].every(e=>!e.mesh?.geometry.attributes.nvTree));assert.equal(r.serialize().generator.seed,before);assert.deepEqual([f.id,f.species,f.origin,f.seed],identity);
 r.dispose();assert.equal(r.vegetation.snapshot().bytes,0);assert.equal(r.vegetation.ownership.snapshot().trackedFeatures,0);assert.equal(r.vegetation.ownership.snapshot().stateBytes,0);
});
test('proxy-owned hidden procedural sections remain raycastable without changing source geometry',()=>{
 const f={...feature,id:'pickable',origin:[2,8,2],min:[0,0,0],max:[32,32,32]},get=(x,y,z)=>x===2&&y===8&&z===2?6:0,generator={features:{query:()=>[f]},getFeatureVoxel:get,getRenderVoxel:get},manager={loaded:new Map(),invalidated:new Set(),columnLevels:new Map()},o=vegetationOwnership(THREE,manager);o.tick(0,0,true);o.retain(f,'proxy');const controller=vegetationDetail(THREE,generator,o),data=new Uint16Array(32768);data[voxelIndex(2,8,2)]=6;
 const result=drainSteps(meshVoxelChunkSteps(data,[0,0,0],get)),root=new THREE.Group(),materials=Array.from({length:8},()=>new THREE.MeshBasicMaterial()),entry=finishTerrainChunk(THREE,root,{materials},0,{id:'tree'},[0,0,0],result,0,0),before=Array.from(entry.mesh.geometry.index.array);controller.attach(entry,[0,0,0]);controller.sync();assert.equal(entry.mesh.material[5].visible,false);assert.deepEqual(Array.from(entry.mesh.geometry.index.array),before);root.updateMatrixWorld(true);const hits=[];entry.mesh.raycast(new THREE.Raycaster(new THREE.Vector3(.625,4,.625),new THREE.Vector3(0,-1,0)),hits);assert.ok(hits.length);assert.equal(hits[0].point.y,2.25);entry.mesh.userData.disposeVegetation();controller.dispose();o.release(f.id,'proxy');o.dispose();entry.mesh.geometry.dispose();materials.forEach(m=>m.dispose());
});
test('same-ID source height changes refresh complete-tree readiness while old geometry references still exist',()=>{
 const {manager,o,setTime}=setup();o.retain(feature,'proxy');install(manager);o.tick();setTime(350);o.tick();assert.equal(o.value(feature.id),1);const raised={...feature,origin:feature.origin.map((v,a)=>v+(a===1?64:0)),min:feature.min.map((v,a)=>v+(a===1?64:0)),max:feature.max.map((v,a)=>v+(a===1?64:0))};o.retain(raised,'proxy');o.tick();assert.equal(o.value(feature.id),0);assert.equal(o.snapshot().transitioning,0);const record=[...o.records()][0];assert.deepEqual(record.feature.origin,raised.origin);install(manager,record.chunks);o.tick();setTime(700);o.tick();assert.equal(o.value(feature.id),1);o.dispose();
});
test('coverage revisions refresh visibility at ownership boundaries, without repeating work for fade progress',()=>{
 const {manager,o,setTime}=setup();o.retain(feature,'proxy');install(manager);o.tick();const initial=o.revision;setTime(100);o.tick();assert.ok(o.revision>initial);const fading=o.revision;setTime(200);o.tick();assert.equal(o.revision,fading);setTime(350);o.tick();assert.ok(o.revision>fading);const settled=o.revision;o.tick();assert.equal(o.revision,settled);manager.invalidated.add(keys[0]);o.tick();assert.ok(o.revision>settled);assert.equal(o.value(feature.id),0);o.dispose();
});
