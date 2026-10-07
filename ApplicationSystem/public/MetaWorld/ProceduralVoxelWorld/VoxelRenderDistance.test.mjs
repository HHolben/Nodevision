// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelRenderDistance.test.mjs
// These tests verify live distance changes invalidate stationary chunk queues without altering saved terrain definitions or resurrecting disposed worlds.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../lib/three/three.module.js';
import { createProceduralVoxelWorld } from './ProceduralVoxelWorldRuntime.mjs';
import { terrainDefinition, voxelMaterialOptions } from './VoxelMaterialTestFixtures.mjs';
test('render distance updates stationary streaming with bounded session-only values', async () => {
  const root=createProceduralVoxelWorld(THREE,terrainDefinition,[],voxelMaterialOptions);
  const runtime=root.userData.proceduralVoxelRuntime;
  await runtime.ready;
  const position=new THREE.Vector3(100,25,100);
  runtime.update(position);
  const initial=runtime.stats.queued, saved=runtime.serialize();
  runtime.setRenderDistance(32);
  assert.equal(runtime.renderDistance,32);
  assert.ok(runtime.stats.queued>initial);
  runtime.setRenderDistance(8);
  assert.equal(runtime.renderDistance,8);
  assert.ok(runtime.manager.queue.every(([x,,z])=>Math.abs(x-12)<=1&&Math.abs(z-12)<=1));
  runtime.setRenderDistance(Infinity);assert.equal(runtime.renderDistance,8);
  runtime.setRenderDistance(900);assert.equal(runtime.renderDistance,64);
  runtime.setRenderDistance(-10);assert.equal(runtime.renderDistance,8);
  assert.deepEqual(runtime.serialize(),saved);
  runtime.dispose();runtime.setRenderDistance(64);
  assert.equal(runtime.stats.loaded,0);assert.equal(runtime.stats.queued,0);
});
