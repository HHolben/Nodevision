// Nodevision/public/PanelInstances/ViewPanels/GameViewDependencies/initScene.mjs
// This file builds the scene context and wires input, rendering, and resizing.

import { createSceneBase } from "./sceneBase.mjs";
import { addCrosshair } from "./crosshair.mjs";
import { createCameraModeController } from "./cameraModes.mjs";
import { createInputHandlers } from "./inputHandlers.mjs";
import { createMovementUpdater } from "./movementUpdate.mjs";
import { startRenderLoop } from "./renderLoop.mjs";
import { setupResizeObserver } from "./resizeObserver.mjs";
import { createPlayerInventory } from "./playerInventory.mjs";
import { createObjectInspector } from "./objectInspector.mjs";

export function initScene({ THREE, PointerLockControls, panel, canvas, state, loadWorldFromFile, getBindings, normalizeKeyName }) {
  const { scene, renderer, camera, objects, colliders, lights } = createSceneBase({ THREE, panel, canvas });
  const portals = [];
  const collisionActions = [];
  const useTargets = [];
  const spawnPoints = [];
  const waterVolumes = [];
  const measurementVisuals = [];

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
    waterVolumes,
    measurementVisuals,
    currentWorldPath: state.currentWorldPath || null,
    loadWorldFromFile: (filePath, options) => loadWorldFromFile(filePath, state, THREE, options)
  };

  const controls = new PointerLockControls(camera, renderer.domElement);
  panel._vrControls = controls;
  panel._vrRenderer = renderer;
  const onCanvasClick = () => controls.lock();
  const onCanvasContextMenu = (event) => event.preventDefault();
  canvas.addEventListener("click", onCanvasClick);
  canvas.addEventListener("contextmenu", onCanvasContextMenu);
  panel._vrCanvasClickHandler = onCanvasClick;
  panel._vrCanvasContextMenuHandler = onCanvasContextMenu;
  panel._vrCanvas = canvas;
  const crosshair = addCrosshair(panel);

  const movementState = {
    isFlying: false,
    flyToggleLatch: false,
    jumpLatch: false,
    useLatch: false,
    attackLatch: false,
    inspectLatch: false,
    suppressAttackUntilMs: 0,
    velocityY: 0,
    isGrounded: true,
    isSwimming: false,
    playerHeight: 1.75,
    worldMode: "3d",
    planeZ: 0,
    requestCycleCamera: false,
    playerBuoyancy: 0.015,
    swimSpeedMultiplier: 0.72,
    crouchJumpMultiplier: 1.85
  };
  window.VRWorldContext.controls = controls;
  window.VRWorldContext.movementState = movementState;

  const inventory = createPlayerInventory({ panel });
  panel._vrInventory = inventory;
  window.VRWorldContext.inventory = inventory;

  const objectInspector = createObjectInspector({
    THREE,
    panel,
    sceneObjects: objects,
    colliders
  });
  panel._vrObjectInspector = objectInspector;
  window.VRWorldContext.objectInspector = objectInspector;

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

  const { heldKeys, dispose: disposeInputHandlers } = createInputHandlers({ getBindings, normalizeKeyName, movementState });
  panel._vrDisposeInputHandlers = disposeInputHandlers;
  const movementUpdate = createMovementUpdater({
    THREE,
    scene,
    objects,
    camera,
    controls,
    colliders,
    portals,
    collisionActions,
    useTargets,
    spawnPoints,
    waterVolumes,
    objectInspector,
    loadWorldFromFile: (filePath, options) => loadWorldFromFile(filePath, state, THREE, options),
    getBindings,
    heldKeys,
    movementState
  });
  const update = () => {
    movementUpdate();
    viewController.update();
  };
  const stopRenderLoop = startRenderLoop(renderer, scene, () => viewController.getActiveCamera(), update);
  panel._vrStopRenderLoop = stopRenderLoop;
  setupResizeObserver(panel, [camera, viewController.followCamera], renderer);

  if (state.pendingWorldPath) {
    loadWorldFromFile(state.pendingWorldPath, state, THREE, state.pendingWorldOptions);
    state.pendingWorldPath = null;
    state.pendingWorldOptions = null;
  }

  fetch("/UserSettings/PlayerCharacterInformation.json", { cache: "no-store" })
    .then((res) => (res.ok ? res.json() : null))
    .then((cfg) => {
      if (!cfg || typeof cfg !== "object") return;
      if (Number.isFinite(cfg.buoyancy)) {
        movementState.playerBuoyancy = cfg.buoyancy;
      }
      if (Number.isFinite(cfg.swimSpeedMultiplier)) {
        movementState.swimSpeedMultiplier = cfg.swimSpeedMultiplier;
      }
      if (Number.isFinite(cfg.crouchJumpMultiplier)) {
        movementState.crouchJumpMultiplier = cfg.crouchJumpMultiplier;
      }
    })
    .catch((err) => {
      console.warn("GameView: failed to load PlayerCharacterInformation.json", err);
    });
}
