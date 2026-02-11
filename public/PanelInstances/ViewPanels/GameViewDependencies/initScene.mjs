// Nodevision/public/PanelInstances/ViewPanels/GameViewDependencies/initScene.mjs
// This file builds the scene context and wires input, rendering, and resizing.

import { createSceneBase } from "./sceneBase.mjs";
import { addCrosshair } from "./crosshair.mjs";
import { createCameraModeController } from "./cameraModes.mjs";
import { createInputHandlers } from "./inputHandlers.mjs";
import { createMovementUpdater } from "./movementUpdate.mjs";
import { startRenderLoop } from "./renderLoop.mjs";
import { setupResizeObserver } from "./resizeObserver.mjs";

export function initScene({ THREE, PointerLockControls, panel, canvas, state, loadWorldFromFile, getBindings, normalizeKeyName }) {
  const { scene, renderer, camera, objects, colliders, lights } = createSceneBase({ THREE, panel, canvas });
  const portals = [];
  const collisionActions = [];
  const useTargets = [];
  const spawnPoints = [];

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
    useTargets,
    spawnPoints,
    loadWorldFromFile: (filePath, options) => loadWorldFromFile(filePath, state, THREE, options)
  };

  const controls = new PointerLockControls(camera, renderer.domElement);
  canvas.addEventListener("click", () => controls.lock());
  const crosshair = addCrosshair(panel);

  const movementState = {
    isFlying: false,
    flyToggleLatch: false,
    jumpLatch: false,
    useLatch: false,
    velocityY: 0,
    isGrounded: true,
    playerHeight: 1.75
  };
  window.VRWorldContext.controls = controls;
  window.VRWorldContext.movementState = movementState;

  const viewController = createCameraModeController({
    THREE,
    panel,
    scene,
    playerCamera: camera,
    controls,
    movementState,
    crosshair
  });
  panel._vrViewController = viewController;

  const { heldKeys } = createInputHandlers({ getBindings, normalizeKeyName, movementState });
  const movementUpdate = createMovementUpdater({
    THREE,
    camera,
    controls,
    colliders,
    portals,
    collisionActions,
    useTargets,
    spawnPoints,
    loadWorldFromFile: (filePath, options) => loadWorldFromFile(filePath, state, THREE, options),
    getBindings,
    heldKeys,
    movementState
  });
  const update = () => {
    movementUpdate();
    viewController.update();
  };
  startRenderLoop(renderer, scene, () => viewController.getActiveCamera(), update);
  setupResizeObserver(panel, [camera, viewController.followCamera], renderer);

  if (state.pendingWorldPath) {
    loadWorldFromFile(state.pendingWorldPath, state, THREE, state.pendingWorldOptions);
    state.pendingWorldPath = null;
    state.pendingWorldOptions = null;
  }
}
