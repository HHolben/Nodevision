// Nodevision/ApplicationSystem/public/MetaWorld/VegetationLOD/Vegetation.test.mjs
// These tests exercise authoritative feature placement, real instanced proxy geometry, deterministic detail changes, composition exclusions, bounded residency, and shared runtime ownership.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../lib/three/three.module.js';
import {createVoxelGenerator} from '../ProceduralVoxelWorld/VoxelTerrainGenerator.mjs';
import {createProceduralVoxelWorld} from '../ProceduralVoxelWorld/ProceduralVoxelWorldRuntime.mjs';
import {terrainDefinition,voxelMaterialOptions} from '../ProceduralVoxelWorld/VoxelMaterialTestFixtures.mjs';
import {drainSteps} from '../ProceduralVoxelWorld/ProgressiveTerrain.mjs';
import {vegetationRegion,vegetationCells} from './Sampling.mjs';
import {vegetationInstances} from './Instances.mjs';
import {createVegetationLOD} from './Runtime.mjs';
import {terrainStreaming} from '../TerrainLOD/Settings.mjs';
const def={...terrainDefinition,size:[512,128,512]},settings=terrainStreaming({vegetationDistance:64});
function fixture(){const g=createVoxelGenerator(def);for(let z=0;z<8;z++)for(let x=0;x<8;x++){const r=drainSteps(vegetationRegion(g,x,z));if(r.features.length>2)return {g,r};}throw Error('No forest fixture');}
function pump(runtime,position,predicate){const end=performance.now()+15000;do{runtime.update(position,settings);}while(!predicate()&&performance.now()<end);assert.ok(predicate(),'streaming completes');}
test('authoritative identities survive cache eviction and detail levels use different real geometry',()=>{
 const {g,r}=fixture(),a=drainSteps(vegetationCells(g,r,1)),b=drainSteps(vegetationCells(g,r,2));
 assert.ok(a.cells.length>b.cells.length*2);assert.ok(b.cells.length>0);
 for(const f of b.identities)assert.deepEqual(a.identities.find(v=>v.id===f.id),f);
 g.features.clear();const again=drainSteps(vegetationRegion(g,r.rx,r.rz));assert.deepEqual(again.features.map(f=>[f.id,f.species,f.origin,f.seed]),r.features.map(f=>[f.id,f.species,f.origin,f.seed]));
 const geometry=new THREE.BoxGeometry(),materials=Array.from({length:256},()=>new THREE.MeshBasicMaterial());
 const tile=vegetationInstances(THREE,b,geometry,materials,0);assert.ok(tile.group.children.every(m=>m.isInstancedMesh));
 const full=tile.mask(()=>false);assert.ok(full.cells>0);assert.equal(tile.mask(()=>true).cells,0);assert.equal(tile.mask(()=>false).cells,full.cells);
 tile.dispose();assert.ok(geometry.attributes.position);geometry.dispose();materials.forEach(m=>m.dispose());
});
test('composed exclusions and authoritative coverage suppress proxy cells',()=>{
 const {g,r}=fixture(),original=drainSteps(vegetationCells(g,r,2));assert.ok(original.cells.length);
 const excluded={...g,getFeatureVoxel:()=>0};assert.equal(drainSteps(vegetationCells(excluded,r,2)).cells.length,0);
 const missing={...g,terrainSampler:{sample:()=>({covered:false})}};assert.equal(drainSteps(vegetationCells(missing,r,2)).cells.length,0);
 assert.equal(drainSteps(vegetationCells(missing,r,2,true)).cells.length,original.cells.length,'explicit procedural map fallback remains vegetated');
 assert.equal(drainSteps(vegetationCells({...missing,terrainSampler:{sample:()=>({covered:false,pending:true})}},r,2,true)).cells.length,0,'pending map data is not a procedural fallback');
 const feature=r.features[0],min=feature.min.map(v=>v*.25),max=feature.max.map(v=>v*.25);
 g.setConstructions([{bounds:{min,max},extent:{min,max},cuts:[{min,max}],sample:()=>null}]);
 const cut=drainSteps(vegetationCells(g,r,2));assert.ok(cut.cells.every(c=>c.id!==feature.id),'construction removes sampled vegetation');
});
test('real proxy installation is independent of detailed chunks and retains bounded resources through travel',()=>{
 const {g,r}=fixture(),root=new THREE.Group(),manager={loaded:new Map()},materials=Array.from({length:256},()=>new THREE.MeshBasicMaterial());
 const runtime=createVegetationLOD(THREE,root,def,g,manager,()=>materials,null),point={x:r.rx*32+16,z:r.rz*32+16};
 pump(runtime,point,()=>runtime.snapshot().representedTrees>0);assert.equal(manager.loaded.size,0);
 const states=runtime.states();assert.ok(states.some(f=>f.level>0));assert.ok(root.getObjectByName('Vegetation distance detail').children.length);
 for(let n=0;n<15;n++){runtime.update({x:n%2?400:16,z:n*24},settings);const s=runtime.snapshot();assert.ok(s.regions<=64);assert.ok(s.queue<=65);assert.ok(s.bytes<=8*1048576);}
 runtime.dispose();assert.equal(root.children.length,0);assert.equal(runtime.snapshot().bytes,0);materials.forEach(m=>m.dispose());
});
test('shared Editor and Viewer runtime preserves definitions, appearance, collider and authored siblings',async()=>{
 const root=createProceduralVoxelWorld(THREE,def,[],voxelMaterialOptions),r=root.userData.terrainRuntime;assert.ok(await r.ready);
 const authored=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());authored.userData.id='mnemonic-tree';root.add(authored);
 const before=JSON.stringify(r.serialize()),p=new THREE.Vector3(80,40,16);
 pump({update:()=>r.vegetation.update(p,settings)},p,()=>r.vegetation.snapshot().representedTrees>0);
 const ids=r.vegetation.states().map(f=>[f.id,f.origin,f.species]);await r.setRepresentation('polygonal');assert.deepEqual(r.vegetation.states().map(f=>[f.id,f.origin,f.species]),ids);
 assert.equal(authored.parent,root);assert.equal(r.serialize().streaming,undefined);assert.equal(JSON.parse(before).generator.seed,r.serialize().generator.seed);
 assert.ok(Number.isFinite(root.userData.colliderRef.sampleGroundY(80,16)));r.dispose();assert.equal(authored.parent,root);authored.geometry.dispose();authored.material.dispose();
});
test('movement schedules ahead, hysteresis retains installed proxies, and repeated invalidation stays bounded',()=>{
 const {g,r}=fixture(),root=new THREE.Group(),manager={loaded:new Map()},materials=Array.from({length:256},()=>new THREE.MeshBasicMaterial());
 const runtime=createVegetationLOD(THREE,root,def,g,manager,()=>materials,null),point={x:r.rx*32+16,z:r.rz*32+16};
 pump(runtime,point,()=>runtime.snapshot().representedTrees>0);const before=runtime.states();
 runtime.update({x:point.x+8,z:point.z},settings);assert.ok(runtime.snapshot().regions>0,'outgoing regions retained');
 pump(runtime,{x:point.x+16,z:point.z},()=>runtime.snapshot().aheadRequests>0);
 assert.ok(runtime.snapshot().aheadRequests>0);assert.ok(before.length);
 for(let n=0;n<20;n++){runtime.invalidate({minX:point.x,maxX:point.x+1,minZ:point.z,maxZ:point.z+1});runtime.update(point,settings);assert.ok(runtime.snapshot().queue<=65);}
 runtime.dispose();materials.forEach(m=>m.dispose());
});
test('road exclusion and session removal remain authoritative for distant vegetation',async()=>{
 const {validatePath}=await import('../Paths/PathDefinition.mjs'),{samplePath,ribbonForPath}=await import('../Paths/PathGeometry.mjs');
 const {composeSession}=await import('../SessionVoxels/TerrainSession.mjs');
 const {g,r}=fixture(),f=r.features[0],[x,y,z]=f.origin.map(v=>v*.25);
 const path=validatePath({id:'forest-road',terrainInteraction:'grade',proceduralExclusion:true,interpolation:'straight',elevationMode:'authored',controlPoints:[[x-8,y,z],[x+8,y,z]],width:4});
 g.setPathConstraints([ribbonForPath(path,samplePath(THREE,path))]);
 const excluded=drainSteps(vegetationRegion(g,r.rx,r.rz));assert.ok(!excluded.features.some(v=>v.id===f.id));
 g.setPathConstraints([]);const restored=drainSteps(vegetationRegion(g,r.rx,r.rz));assert.ok(restored.features.some(v=>v.id===f.id));
 const session=composeSession(g);session.bindSession({session:{opinion:()=>null},toCell:p=>p,material:()=>1});
 assert.equal(drainSteps(vegetationCells(session,restored,2)).cells.length,0);
});
