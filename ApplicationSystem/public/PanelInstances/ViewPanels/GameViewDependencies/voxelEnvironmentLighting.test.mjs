// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/voxelEnvironmentLighting.test.mjs
// These regressions reproduce unlit legacy voxel scenes and verify brightness, authored lighting precedence, world transitions, and transient resource cleanup.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../lib/three/three.module.js';
import { createVoxelEnvironmentLighting } from './voxelEnvironmentLighting.mjs';
function fixture() {
  const scene = new THREE.Scene(), terrain = new THREE.Group();
  terrain.userData.proceduralVoxelRuntime = {};
  scene.add(terrain);
  const context = { scene, lights: [], currentWorldDefinition: {}, environmentBrightness: 1 };
  const lighting = createVoxelEnvironmentLighting(THREE, scene);
  const lights = () => { const result = []; scene.traverse(o => { if (o.isLight) result.push(o); }); return result; };
  return { scene, terrain, context, lighting, lights };
}
test('legacy voxel ground receives sky and directional light at full brightness', () => {
  const f = fixture();
  assert.equal(f.lights().length, 0);
  f.lighting.update(f.context);
  const lights = f.lights();
  assert.equal(lights.length, 2);
  assert.ok(lights.some(l => l.isHemisphereLight && l.intensity > 0));
  assert.ok(lights.some(l => l.isDirectionalLight && l.position.y > 0 && l.intensity > 0));
  for (const brightness of [0.5, 0, 1]) {
    f.context.environmentBrightness = brightness;
    f.lighting.update(f.context);
    assert.equal(f.lights().length, 2);
    for (const light of lights) assert.equal(light.intensity, light.userData.nvDayNightBaseIntensity * brightness);
  }
  f.lighting.dispose(); assert.equal(f.lights().length, 0);
});
test('authored lights including intentionally dark lights suppress the fallback', () => {
  const f = fixture(); f.lighting.update(f.context);
  const light = new THREE.AmbientLight('#ffffff', 0);
  f.context.lights.push(light); f.scene.add(light);
  f.lighting.update(f.context); assert.deepEqual(f.lights(), [light]);
  f.lighting.dispose(); assert.equal(light.parent, f.scene);
});
test('astronomy owns illumination even at night or with no declared sun', () => {
  const f = fixture(); f.lighting.update(f.context);
  f.context.currentWorldDefinition.metadata = { astronomy: { model: 'earth', bodies: [] } };
  f.lighting.update(f.context); assert.equal(f.lights().length, 0);
});
test('leaving a voxel world removes the transient environment lights', () => {
  const f = fixture(); f.lighting.update(f.context);
  f.terrain.removeFromParent(); f.lighting.update(f.context);
  assert.equal(f.lights().length, 0);
  f.scene.add(f.terrain); f.lighting.update(f.context);
  assert.equal(f.lights().length, 2);
  f.lighting.update({ scene: new THREE.Scene() }); assert.equal(f.lights().length, 0);
});
