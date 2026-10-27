// Nodevision/ApplicationSystem/public/MetaWorld/SessionVoxels/SessionLayer.test.mjs
// Exercises sparse opinion semantics, atomic limits, interpolated brushes, transaction restoration and effective ray targeting.
import assert from 'node:assert/strict';
import {createSessionLayer,strokePoints,MAX_BATCH} from './SessionLayer.mjs';
import {raycastCells} from './Raycast.mjs';
import {meshGreedyVoxelChunk} from '../ProceduralVoxelWorld/VoxelGreedyMesher.mjs';
import {surfaceNetSteps} from '../TerrainRepresentation/SurfaceNets.mjs';
import {drainSteps} from '../ProceduralVoxelWorld/ProgressiveTerrain.mjs';
import {composeSession} from './TerrainSession.mjs';
const stone={materialId:'limestone',rgba:[150,140,130,255],solid:true},wood={materialId:'PineWood',rgba:[90,60,20,127],solid:true};
const transactions=[],dirty=[];const layer=createSessionLayer({persistent:p=>p[1]===0?stone:null,contains:p=>p.every(n=>Math.abs(n)<100),changed:p=>dirty.push(p),record:tx=>transactions.push(tx)});
layer.edit('erase',[[0,0,0]]);assert.equal(layer.opinion([0,0,0]),null);assert.equal(layer.effective([0,0,0]),null);assert.deepEqual(layer.persistent([0,0,0]),stone);
layer.edit('revert',[[0,0,0]]);assert.equal(layer.count,0);assert.deepEqual(layer.effective([0,0,0]),stone);
layer.edit('add',[[0,1,0]],wood);assert.deepEqual(layer.effective([0,1,0]),wood);layer.edit('add',[[0,1,0]],stone);assert.deepEqual(layer.effective([0,1,0]),wood);layer.edit('erase',[[0,1,0]]);assert.equal(layer.count,0);
layer.edit('paint',[[0,0,0]],wood);assert.deepEqual(layer.effective([0,0,0]),wood);layer.edit('erase',[[0,0,0]]);assert.equal(layer.opinion([0,0,0]),null);transactions.at(-1).undo();assert.deepEqual(layer.effective([0,0,0]),wood);transactions.at(-1).redo();assert.equal(layer.effective([0,0,0]),null);
layer.clear();const history=transactions.length;layer.begin();layer.edit('brush',strokePoints([30,1,30],[34,1,34],{size:2,shape:'box'}),wood);layer.edit('paint',[[31,1,31]],stone);layer.finish();assert.equal(transactions.length,history+1);const count=layer.count;assert(count>20);assert(layer.column(0,0).length&&layer.column(1,1).length);transactions.at(-1).undo();assert.equal(layer.count,0);transactions.at(-1).redo();assert.equal(layer.count,count);
const cube=strokePoints(null,[0,0,0],{size:3,shape:'box'}),sphere=strokePoints(null,[0,0,0],{size:3,shape:'sphere'});assert.equal(cube.length,27);assert(sphere.length<27);assert.equal(new Set(cube.map(String)).size,cube.length);
const old=layer.count;assert.throws(()=>layer.batch([{at:[0,2,0],value:wood},{at:[NaN,0,0],value:null}]));assert.equal(layer.count,old);assert.throws(()=>layer.edit('add',[[100,3,0]],wood));assert.throws(()=>layer.batch(Array(MAX_BATCH+1).fill({at:[0,2,0],value:wood})));assert.throws(()=>strokePoints([0,0,0],[2000,0,0],{size:16,shape:'box'}));
layer.clear();layer.edit('add',[[-1,3,-1]],wood);assert.deepEqual(layer.column(-1,-1),[0]);const hit=raycastCells([-.125,2,-.125],[0,-1,0],p=>layer.effective(p));assert.deepEqual(hit.at,[-1,3,-1]);assert.deepEqual(hit.normal,[0,1,0]);layer.edit('erase',[[-1,3,-1]]);assert.deepEqual(raycastCells([-.125,2,-.125],[0,-1,0],p=>layer.effective(p)).at,[-1,0,-1]);
const base={dimensions:[64,64,64],getVoxel:(x,y,z)=>y===0?3:0,getRenderVoxel:(x,y,z)=>y===0?3:0,getFeatureVoxel:()=>0,getVoxelMaterialId:()=> 'limestone',getSolidHeight:()=>1,generateChunk:()=>new Uint8Array(32768),*generateChunkSteps(){return new Uint8Array(32768);},getChunkLevels:()=>[0],*getChunkLevelsSteps(){return [0];}};
const composed=composeSession(base);composed.bindSession({session:layer,toCell:p=>p,material:()=>300});layer.edit('add',[[31,40,31]],wood);assert.equal(composed.getVoxel(31,40,31),300);assert.equal(composed.getRenderVoxel(31,40,31),300);assert.equal(base.getVoxel(31,40,31),0);assert(composed.getChunkLevels(0,0).includes(1));assert.equal(composed.getSolidHeight(31,31),41);assert.equal(composed.generateChunk(0,1,0)[31+32*(31+32*8)],300);
layer.dispose();assert.equal(layer.count,0);assert.throws(()=>layer.edit('add',[[1,2,1]],wood));
console.log('Session voxel semantics, brushes, atomic transactions, raycasting and composition passed');

const colored=new Uint16Array(32768);colored[16+32*(16+32*16)]=300;const sampleColor=(x,y,z)=>x===16&&y===16&&z===16?300:0;for(const mesh of [meshGreedyVoxelChunk(colored,[0,0,0],sampleColor),drainSteps(surfaceNetSteps(colored,[0,0,0],sampleColor))]){assert(mesh.faceCount>0);assert(mesh.groups.every(g=>g.materialIndex===299));}
