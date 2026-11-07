// Nodevision/ApplicationSystem/public/MetaWorld/TerrainDiagnostics/Diagnostics.test.mjs
// These tests verify that diagnostic snapshots count actual buffer storage and distinguish mesh residency, visibility, CPU work, and unavailable GPU measurements. They also verify bounded render-loop aggregation and disabled sampling.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../lib/three/three.module.js';
import { terrainDiagnostics } from './Snapshot.mjs';
import { createTerrainFrameSampler } from './Frames.mjs';

test('snapshot measures resident buffers and filters terrain ownership and visibility',()=>{
  const root=new THREE.Group(),geometry=new THREE.BoxGeometry(),mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial());root.add(mesh);
  const manager={radius:2,loaded:new Map([['0,0,0',{mesh,data:new Uint8Array(32768)}]]),queue:[[1,null,0],[1,0,0]],pending:{},stats:{generationMs:12,meshingMs:30,installationMs:2,generated:1,evicted:3}};
  root.userData.terrainRuntime={manager,definition:{id:'terrain',terrainSource:'geographic'},representation:'polygonal',renderDistance:16,generator:{cacheStats:()=>({columns:10})}};
  const context={objects:[root,new THREE.Mesh(new THREE.BoxGeometry(),mesh.material)]};
  const data=terrainDiagnostics(context),t=data.terrains[0];
  assert.equal(data.terrains.length,1);assert.equal(t.triangles,12);assert.equal(t.queuedColumns,1);assert.equal(t.queuedChunks,1);assert.equal(t.generating,1);
  assert.equal(t.occupancyBytes,32768);assert.equal(t.estimatedGeometryBytes,geometry.index.array.byteLength+Object.values(geometry.attributes).reduce((n,a)=>n+a.array.byteLength,0));
  assert.equal(t.generationCpuMs,12);assert.equal(t.installationCpuMs,2);assert.equal(t.gpuUploadMs,null);assert.equal(t.workerQueueLatencyMs,null);
  root.visible=false;assert.equal(terrainDiagnostics(context).terrains[0].visibleChunks,0);
  geometry.dispose();mesh.material.dispose();context.objects[1].geometry.dispose();
});

test('frame sampling is bounded and excludes time spent disabled',()=>{
  const sample=createTerrainFrameSampler(),context={};
  sample(context,10,1,false);assert.equal(context.terrainFrameStats,undefined);
  for(let i=1;i<=300;i++)sample(context,i*20,4,true);
  assert.equal(context.terrainFrameStats.samples,180);assert.equal(context.terrainFrameStats.averageMs,20);assert.equal(context.terrainFrameStats.approximateFps,50);assert.equal(context.terrainFrameStats.p95Ms,20);
  sample(context,100000,0,false);
  for(let i=1;i<=15;i++)sample(context,100000+i*10,2,true);
  assert.equal(context.terrainFrameStats.samples,14);assert.equal(context.terrainFrameStats.averageMs,10);
});
