// Nodevision/ApplicationSystem/public/MetaWorld/VegetationLOD/Shapes.test.mjs
// Verify descriptor reuse, thin structure support, polygonal empty regions, signed seams, canonical materials and disposal using actual coarse extraction and installed geometry.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../lib/three/three.module.js';
import {vegetationCells} from './Sampling.mjs';
import {polygonalVegetationSteps,polygonalVegetation} from './Polygonal.mjs';
import {featureCulling} from './FeatureCulling.mjs';
import {vegetationOwnership} from './Ownership.mjs';
import {drainSteps} from '../ProceduralVoxelWorld/ProgressiveTerrain.mjs';
const material=Array.from({length:16},()=>new THREE.MeshBasicMaterial({color:0x447744}));
const feature={id:'pine:-1,-1',species:'Pine',seed:42,variant:'fallen',origin:[-9,1,-7],parameters:{height:24,lean:.3},min:[-12,0,-12],max:[8,32,8],sample:(x,y,z)=>x===-9&&z===-7&&y<20||x===-1&&y===19&&z<4&&z>=-7?6:y>14&&y<28&&Math.hypot(x+4,z+4)<7?8:0};
const region={rx:-1,rz:-1,min:[-128,0,-128],max:[128,64,128],features:[feature]},generator={getFeatureVoxel:(x,y,z)=>feature.sample(x,y,z)};
function owner(){return vegetationOwnership(THREE,{loaded:new Map(),columnLevels:new Map(),invalidated:new Set()});}
test('voxel proxies retain descriptor identity/state across levels without changing deterministic occupancy',()=>{
 const a=drainSteps(vegetationCells(generator,region,1)),b=drainSteps(vegetationCells(generator,region,2));assert.deepEqual(a.identities,b.identities);assert.equal(b.identities[0].variant,'fallen');assert.equal(b.identities[0].seed,42);assert.deepEqual(b.identities[0].origin,feature.origin);

 assert.deepEqual(drainSteps(vegetationCells(generator,region,2)),b);assert.ok(a.cells.length>b.cells.length);
});
test('empty polygonal regions install valid zero-work geometry and dispose without leaking identities',()=>{
 const data=drainSteps(polygonalVegetationSteps({region:{...region,features:[]},level:2,step:4,cells:[],identities:[]})),o=owner(),tile=polygonalVegetation(THREE,data,material,0,{ownership:o,fade:{value:1},direction:{value:0}});
 assert.equal(tile.triangles(),0);assert.equal(tile.drawCalls(),0);assert.equal(tile.mask(()=>false).ids.size,0);tile.dispose();assert.equal(o.snapshot().trackedFeatures,0);o.dispose();
});
test('polygonal proxies use coherent source surfaces, stable signed coordinates and canonical palette batches',()=>{
 const data=drainSteps(polygonalVegetationSteps(drainSteps(vegetationCells(generator,region,1)))),again=drainSteps(polygonalVegetationSteps(drainSteps(vegetationCells(generator,region,1))));assert.deepEqual(data,again);assert.ok(data.polygonal.some(p=>p.cell[0]<0));
 const o=owner();o.tick(0,0,true);const tile=polygonalVegetation(THREE,data,material,0,{ownership:o,fade:{value:1},direction:{value:0}});assert.ok(tile.triangles()>0);assert.equal(tile.group.children.length,1);assert.ok(!tile.group.children[0].isInstancedMesh);assert.ok(tile.group.children[0].geometry.attributes.nvTree);assert.ok(tile.mask(()=>false).ids.has(feature.id));assert.equal(tile.mask(()=>true).cells,0);assert.equal(tile.triangles(),0);tile.dispose();assert.equal(o.snapshot().trackedFeatures,0);o.dispose();
});
test('removed or uncovered source opinions cannot reappear through conservative subcell sampling',()=>{
 assert.equal(drainSteps(vegetationCells({getFeatureVoxel:()=>0},region,2)).cells.length,0);
 assert.equal(drainSteps(vegetationCells({...generator,terrainSampler:{sample:()=>({pending:true,covered:false})}},region,2,true)).cells.length,0);
});
test('polygonal feature culling preserves signed transforms and avoids stationary rescans',()=>{
 const f={...feature,min:[-4,0,-4],max:[4,80,4]},culling=featureCulling(THREE,[f],0,1),matrix=new THREE.Matrix4().makeTranslation(-500,0,-500),camera=new THREE.PerspectiveCamera(50,4/3,.1,200);camera.position.set(-500,10,-475);camera.lookAt(-500,10,-500);camera.updateWorldMatrix(true,false);
 assert.ok(culling.prepare(camera,matrix).has(f.id));assert.equal(culling.prepare(camera,matrix),undefined);assert.equal(culling.snapshot().scans,1);camera.position.x=-450;camera.lookAt(-450,10,-500);camera.updateWorldMatrix(true,false);assert.equal(culling.prepare(camera,matrix).size,0);assert.equal(culling.prepare(new THREE.ArrayCamera(),matrix),null);
});
test('stable proxies use original opaque shaders; only active transitions select dither materials',()=>{
 let time=0;const manager={loaded:new Map(),columnLevels:new Map(),invalidated:new Set()},o=vegetationOwnership(THREE,manager,{now:()=>time});o.tick(0,0,true);const data=drainSteps(polygonalVegetationSteps(drainSteps(vegetationCells(generator,region,1)))),tile=polygonalVegetation(THREE,data,material,0,{ownership:o,fade:{value:1},direction:{value:0}}),camera=new THREE.PerspectiveCamera(50,4/3,.1,100);camera.position.set(0,10,20);camera.lookAt(0,4,0);camera.updateWorldMatrix(true,false);
 tile.prepareView(camera);assert.ok(tile.group.children[0].material.every(m=>!m.userData.vegetationDither));for(const r of o.records())for(const key of r.chunks)manager.loaded.set(key,{mesh:{visible:true}});o.tick();time=175;o.tick();tile.prepareView(camera);assert.ok(tile.group.children[0].material.some(m=>m.userData.vegetationDither));time=350;o.tick();tile.prepareView(camera);assert.ok(tile.group.children[0].material.every(m=>!m.userData.vegetationDither));tile.dispose();o.dispose();
});
test('distant upright trunk envelopes follow the source axis and exact ground contact without extra coarse cells',()=>{
 const f={...feature,variant:'living',sample:(x,y,z)=>x===-9&&z===-7&&y>=1&&y<20?6:0},g={getFeatureVoxel:(x,y,z)=>f.sample(x,y,z)},data=drainSteps(vegetationCells(g,{...region,features:[f]},2)),box=data.cells.find(c=>c.voxelBox)?.voxelBox;assert.ok(box);assert.equal(box.p[0],-9);assert.equal(box.p[2],-7);assert.equal(box.p[1],1);assert.deepEqual(box.size,[1,3,1]);assert.ok(data.cells.every(c=>c.id===f.id));
});
