// Nodevision/public/PanelInstances/ViewPanels/GameViewDependencies/initScene.mjs
// This file builds the scene context and wires input, rendering, and resizing.

import { createSceneBase } from "./sceneBase.mjs";
import { addCrosshair } from "./crosshair.mjs";
import { createInputHandlers } from "./inputHandlers.mjs";
import { createMovementUpdater } from "./movementUpdate.mjs";
import { startRenderLoop } from "./renderLoop.mjs";
import { setupResizeObserver } from "./resizeObserver.mjs";

export function initScene({ THREE, PointerLockControls, panel, canvas, state, loadWorldFromFile, getBindings, normalizeKeyName }) {
  const { scene, renderer, camera, objects, colliders, lights } = createSceneBase({ THREE, panel, canvas });
  const portals = [];
  const collisionActions = [];

  window.VRWorldContext = {
    THREE,
    scene,
    camera,
    renderer,
    objects,
    colliders,
    lights,
    portals,
    collisionActions,
    loadWorldFromFile: (filePath) => loadWorldFromFile(filePath, state, THREE)
  };

  const controls = new PointerLockControls(camera, renderer.domElement);
  canvas.addEventListener("click", () => controls.lock());
  addCrosshair(panel);

  const movementState = {
    isFlying: false,
    flyToggleLatch: false,
    jumpLatch: false,
    velocityY: 0,
    isGrounded: true,
    playerHeight: 1.75
  };

  const { heldKeys } = createInputHandlers({ getBindings, normalizeKeyName, movementState });
  const update = createMovementUpdater({
    THREE,
    camera,
    controls,
    colliders,
    portals,
    collisionActions,
    loadWorldFromFile: (filePath) => loadWorldFromFile(filePath, state, THREE),
    getBindings,
    heldKeys,
    movementState
  });
  startRenderLoop(renderer, scene, camera, update);
  setupResizeObserver(panel, camera, renderer);

  if (state.pendingWorldPath) {
    loadWorldFromFile(state.pendingWorldPath, state, THREE);
    state.pendingWorldPath = null;
  }
}
