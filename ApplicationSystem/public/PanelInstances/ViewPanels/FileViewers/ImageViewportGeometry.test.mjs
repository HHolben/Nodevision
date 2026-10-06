// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ImageViewportGeometry.test.mjs
// These tests verify that image-local panning composes into visible keyboard directions at quarter rotations and arbitrary angles without changing native dimensions.
import assert from 'node:assert/strict';
import { imageViewMatrix, imageViewBounds, screenToImageDelta } from './ImageViewportGeometry.mjs';
for (const angle of [0, 90, 180, 270, 37]) for (const zoom of [.25, 1, 2]) for (const [x,y] of [[-20,0],[20,0],[0,-20],[0,20]]) {
  const m = imageViewMatrix(angle, zoom), local = screenToImageDelta(m, x, y);
  assert.ok(Math.abs(m.a * local.x + m.c * local.y - x) < 1e-9);
  assert.ok(Math.abs(m.b * local.x + m.d * local.y - y) < 1e-9);
}
assert.deepEqual(imageViewBounds(640, 480), { width: 640, height: 480 });
assert.ok(Math.abs(imageViewBounds(640, 480, 90).width - 480) < 1e-9);
