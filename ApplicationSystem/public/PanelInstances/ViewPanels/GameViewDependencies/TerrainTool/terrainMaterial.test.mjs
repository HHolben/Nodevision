// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/TerrainTool/terrainMaterial.test.mjs
// These regressions exercise browser canvas materials to ensure terrain preserves its authored color and uses light-responsive solid materials.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../../lib/three/three.module.js';
import { createTerrainMaterial } from './terrainMaterial.mjs';

test('canvas terrain applies its color once in the correct color space', () => {
  const previous = globalThis.document;
  const context = { fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {} };
  globalThis.document = { createElement: () => ({ getContext: () => context }) };
  try {
    for (const texture of ['speckled', 'striated', 'cracked', 'ripples']) {
      for (const isLiquid of [false, true]) {
        const material = createTerrainMaterial(THREE, { color: '#527d35', texture, isLiquid });
        assert.equal(material.color.getHexString(), 'ffffff');
        assert.equal(material.map.colorSpace, THREE.SRGBColorSpace);
        if (!isLiquid) assert.equal(material.isMeshStandardMaterial, true);
        material.map.dispose(); material.dispose();
      }
    }
    const solid = createTerrainMaterial(THREE, { color: '#527d35' });
    assert.equal(solid.color.getHexString(), '527d35');
    assert.equal(solid.map, null);
    solid.dispose();
  } finally {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  }
});
