// Nodevision/ApplicationSystem/public/MetaWorld/Geographic/ProgressiveChunks.test.mjs
// These tests verify that cooperative chunk work retains existing mesh output while residency budgets and teleport cancellation prevent stale geographic work from accumulating.
import test from 'node:test';
import assert from 'node:assert/strict';
import { VoxelChunkManager } from '../ProceduralVoxelWorld/VoxelChunkManager.mjs';
import { meshVoxelChunk,meshVoxelChunkSteps } from '../ProceduralVoxelWorld/VoxelChunkMesher.mjs';
import { drainSteps } from '../ProceduralVoxelWorld/ProgressiveTerrain.mjs';
test('cooperative meshing is identical to synchronous meshing',()=>{
  const data=new Uint8Array(32**3);data.fill(3,0,1024);const at=(x,y,z)=>y===0&&x>=0&&x<32&&z>=0&&z<32?3:0;
  assert.deepEqual(drainSteps(meshVoxelChunkSteps(data,[0,0,0],at)),meshVoxelChunk(data,[0,0,0],at));
});
test('resident chunk and mesh-byte budgets remain bounded at large coordinates',()=>{
  let released=0;const generator={dimensions:[131072,1024,131072],*getChunkLevelsSteps(){yield;return [0,1,2];}};
  const manager=new VoxelChunkManager(generator,2,function*(){yield;return {solidVoxels:1,faceCount:1,generationMs:1,meshingMs:1,residentBytes:64};},()=>released++,{budgetMs:5,maxChunks:2,maxBytes:128});
  for(let i=0;i<80;i++)manager.update([100000,0,100000]);assert.ok(manager.stats.generated>2);assert.ok(manager.loaded.size<=2&&manager.stats.residentBytes<=128);assert.ok(released>0);
  manager.update([10,0,10]);assert.ok([...manager.loaded.values()].every(e=>e.cell[0]<10));manager.dispose();assert.equal(manager.stats.residentBytes,0);
});
test('teleporting cancels unfinished chunk work before it can commit',()=>{
  let returned=false;const generator={dimensions:[30000,1024,30000],*getChunkLevelsSteps(){return [0];}};
  const manager=new VoxelChunkManager(generator,1,function*(){try{for(let i=0;i<1e7;i++)yield;}finally{returned=true;}return {solidVoxels:0,faceCount:0,residentBytes:0,generationMs:0,meshingMs:0};},()=>{}, {budgetMs:1,maxChunks:8,maxBytes:1024});
  manager.update([100,0,100]);assert.ok(manager.pending);manager.update([20000,0,20000]);assert.ok(returned);assert.ok(manager.stats.cancelled>0);assert.equal(manager.stats.loaded,0);manager.dispose();
});
