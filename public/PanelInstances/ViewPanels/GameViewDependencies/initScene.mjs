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
import { createTerrainToolController } from "./terrainGeneratorTool.mjs";
import { saveCurrentWorldFile } from "./worldSave.mjs";
import { createWorldPropertiesPanel } from "./worldPropertiesPanel.mjs";
import { createFunctionPlotterPanel } from "./functionPlotterPanel.mjs";
import { createConsolePanels } from "./consolePanels.mjs";

export function initScene({ THREE, PointerLockControls, panel, canvas, state, loadWorldFromFile, getBindings, normalizeKeyName }) {
  const normalizePlayerMode = (value) => {
    const mode = String(value || "").toLowerCase();
    return mode === "creative" ? "creative" : "survival";
  };
  const preferredMode = normalizePlayerMode(
    state?.preferredPlayerMode
    || window.NodevisionState?.virtualWorldMode
    || "survival"
  );

  const { scene, renderer, camera, objects, colliders, lights, ground } = createSceneBase({ THREE, panel, canvas });
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
    currentWorldDefinition: state.currentWorldDefinition || null,
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
    playerMode: preferredMode,
    worldMode: "3d",
    planeZ: 0,
    requestCycleCamera: false,
    playerBuoyancy: 0.015,
    swimSpeedMultiplier: 0.72,
    crouchJumpMultiplier: 1.85,
    worldRules: {
      allowFly: false,
      allowRoll: false,
      allowPitch: false,
      allowPlace: false,
      allowBreak: false,
      allowInspect: false,
      allowToolUse: false,
      allowSave: false
    }
  };
  window.VRWorldContext.controls = controls;
  window.VRWorldContext.movementState = movementState;
  window.VRWorldContext.setPlayerMode = (nextMode) => {
    const normalized = normalizePlayerMode(nextMode);
    movementState.playerMode = normalized;
    if (window.NodevisionState) {
      window.NodevisionState.virtualWorldMode = normalized;
      window.NodevisionState.currentMode = normalized === "creative"
        ? "Virtual World Editing"
        : "Virtual World Viewing";
    }
  };
  window.VRWorldContext.setPlayerMode(preferredMode);

  const consolePanels = createConsolePanels({
    THREE,
    scene,
    ground,
    movementState
  });
  panel._vrConsolePanels = consolePanels;
  window.VRWorldContext.consolePanels = consolePanels;

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

  const worldPropertiesPanel = createWorldPropertiesPanel({ movementState });
  panel._vrWorldPropertiesPanel = worldPropertiesPanel;
  window.VRWorldContext.worldPropertiesPanel = worldPropertiesPanel;

  const functionPlotterPanel = createFunctionPlotterPanel();
  panel._vrFunctionPlotterPanel = functionPlotterPanel;
  window.VRWorldContext.functionPlotterPanel = functionPlotterPanel;

  const terrainToolController = createTerrainToolController({
    THREE,
    scene,
    objects,
    colliders
  });
  panel._vrTerrainToolController = terrainToolController;
  window.VRWorldContext.terrainToolController = terrainToolController;

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
    worldPropertiesPanel,
    functionPlotterPanel,
    loadWorldFromFile: (filePath, options) => loadWorldFromFile(filePath, state, THREE, options),
    getBindings,
    heldKeys,
    movementState,
    terrainToolController,
    consolePanels
  });

  const saveVirtualWorldFile = async () => {
    return saveCurrentWorldFile({
      state,
      movementState,
      objects,
      lights
    });
  };
  panel._vrSaveVirtualWorldFile = saveVirtualWorldFile;
  window.saveVirtualWorldFile = saveVirtualWorldFile;
  window.VRWorldContext.saveVirtualWorldFile = saveVirtualWorldFile;
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
