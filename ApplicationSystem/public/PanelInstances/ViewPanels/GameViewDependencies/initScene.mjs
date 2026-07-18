// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/initScene.mjs
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
import {
  createEquationColliderController,
  expressionUsesTimeVariable,
  resolveTemporalPlaneEquationConfig,
  resizeEquationColliderPlaneMesh,
  syncPlaneColliderRef,
  syncPlaneWaterVolumeRef,
} from "./equationColliderTool.mjs";
import { saveCurrentWorldFile } from "./worldSave.mjs";
import { createWorldPropertiesPanel } from "./worldPropertiesPanel.mjs";
import { createMetaWorldMultiplayerClient } from "/MetaWorld/MetaWorldMultiplayerClient.mjs";
import { createFunctionPlotterPanel } from "./functionPlotterPanel.mjs";
import { createEquationObjectsPanel } from "./equationObjectsPanel.mjs";
import { createConsolePanels } from "./consolePanels.mjs";
import { createFloatingInventoryPanel } from "/PanelInstances/InfoPanels/PlayerInventory.mjs";

function clampTemporalNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function createTemporalController({ THREE, objects, waterVolumes, movementState }) {
  const now = () => (typeof performance !== "undefined" && performance.now ? performance.now() : Date.now());
  const state = {
    elapsedSeconds: 0,
    staticTimeEnabled: false,
    staticTimeSeconds: 0,
    timeScale: 1,
    samplingRateHz: 10,
    lastRealNowMs: now(),
    lastSampleMs: 0,
    lastSampleTimeSeconds: NaN
  };

  function syncMovementState() {
    if (!movementState) return;
    movementState.temporal = {
      elapsedSeconds: state.elapsedSeconds,
      staticTimeEnabled: state.staticTimeEnabled,
      staticTimeSeconds: state.staticTimeSeconds,
      timeScale: state.timeScale,
      samplingRateHz: state.samplingRateHz
    };
  }

  function getTimeSeconds() {
    return state.staticTimeEnabled ? state.staticTimeSeconds : state.elapsedSeconds;
  }

  function getSettings() {
    return {
      elapsedSeconds: state.elapsedSeconds,
      currentTimeSeconds: getTimeSeconds(),
      staticTimeEnabled: state.staticTimeEnabled,
      staticTimeSeconds: state.staticTimeSeconds,
      timeScale: state.timeScale,
      samplingRateHz: state.samplingRateHz
    };
  }

  function applySettings(settings = {}, options = {}) {
    if (!settings || typeof settings !== "object") return getSettings();
    if (Number.isFinite(settings.elapsedSeconds) || options.resetElapsed === true) {
      state.elapsedSeconds = clampTemporalNumber(settings.elapsedSeconds, -1000000000, 1000000000, 0);
    }
    state.staticTimeEnabled = settings.staticTimeEnabled === true;
    state.staticTimeSeconds = clampTemporalNumber(settings.staticTimeSeconds, -1000000000, 1000000000, state.staticTimeSeconds);
    state.timeScale = clampTemporalNumber(settings.timeScale, -128, 128, state.timeScale);
    state.samplingRateHz = clampTemporalNumber(settings.samplingRateHz, 0.1, 120, state.samplingRateHz);
    state.lastRealNowMs = now();
    syncMovementState();
    forceSample();
    return getSettings();
  }

  function isTemporalEquationObject(object) {
    const data = object?.userData || {};
    const expression = data.equationExpression || data.equationCollider?.expression || "";
    return object?.isMesh === true
      && (data.nvType === "equation-collider-plane" || data.nvType === "equation-inequality")
      && (data.equationTemporal === true || data.equationCollider?.equationTemporal === true || expressionUsesTimeVariable(expression));
  }

  function sampleTemporalObject(mesh, timeSeconds) {
    if (!THREE || !mesh?.userData) return false;
    const previous = mesh.userData.equationCollider || {};
    const expression = mesh.userData.equationExpression || previous.expression || previous.equationExpression || "";
    const rawConfig = {
      ...previous,
      expression,
      equationExpression: expression,
      equationTemporal: true,
      equationBaseExpression: mesh.userData.equationBaseExpression || previous.equationBaseExpression || expression,
      timeSeconds
    };
    const config = resolveTemporalPlaneEquationConfig(rawConfig, timeSeconds);
    resizeEquationColliderPlaneMesh(THREE, mesh, config);
    mesh.userData.equationTimeSeconds = timeSeconds;
    mesh.userData.equationTemporal = config.equationTemporal === true;
    mesh.userData.equationBaseExpression = config.equationBaseExpression || expression;
    if (mesh.userData.colliderRef) syncPlaneColliderRef(THREE, mesh);
    const liquidEnabled = mesh.userData.isLiquid === true || mesh.userData.MatterState === "liquid" || mesh.userData.matterState === "liquid";
    syncPlaneWaterVolumeRef(THREE, waterVolumes, mesh, config, {
      liquid: liquidEnabled,
      side: mesh.userData.equationLiquidSide || config.inequalitySide,
      infinite: mesh.userData.equationLiquidInfinite !== false,
      buoyancyScale: Number.isFinite(mesh.userData.liquidBuoyancyScale) ? mesh.userData.liquidBuoyancyScale : 1
    });
    return true;
  }

  function sampleAll() {
    const timeSeconds = getTimeSeconds();
    let count = 0;
    (objects || []).forEach((object) => {
      if (isTemporalEquationObject(object) && sampleTemporalObject(object, timeSeconds)) count += 1;
    });
    state.lastSampleMs = now();
    state.lastSampleTimeSeconds = timeSeconds;
    syncMovementState();
    return count;
  }

  function forceSample() {
    return sampleAll();
  }

  function update() {
    const currentNow = now();
    const deltaSeconds = Math.max(0, (currentNow - state.lastRealNowMs) / 1000);
    state.lastRealNowMs = currentNow;
    if (state.staticTimeEnabled !== true) {
      state.elapsedSeconds += deltaSeconds * state.timeScale;
    }
    const intervalMs = 1000 / Math.max(0.1, state.samplingRateHz);
    const timeSeconds = getTimeSeconds();
    if (currentNow - state.lastSampleMs >= intervalMs || state.lastSampleTimeSeconds !== timeSeconds && state.staticTimeEnabled === true) {
      sampleAll();
    }
  }

  syncMovementState();
  return { update, forceSample, getTimeSeconds, getSettings, applySettings };
}

function createTemporalManipulatorPanel({ temporalController }) {
  let visible = false;
  const floatingPanel = createFloatingInventoryPanel({
    title: "Temporal Manipulator",
    closeBehavior: "hide",
    onRequestClose: () => {
      visible = false;
      floatingPanel.setVisible(false);
    }
  });
  floatingPanel.setVisible(false);
  const root = document.createElement("div");
  root.style.display = "grid";
  root.style.gap = "10px";
  root.style.font = "12px/1.35 monospace";
  root.style.minWidth = "280px";
  floatingPanel.content.appendChild(root);

  const staticLabel = document.createElement("label");
  staticLabel.style.display = "flex";
  staticLabel.style.alignItems = "center";
  staticLabel.style.gap = "6px";
  const staticInput = document.createElement("input");
  staticInput.type = "checkbox";
  staticLabel.appendChild(staticInput);
  staticLabel.appendChild(document.createTextNode("Static Time"));
  root.appendChild(staticLabel);

  function addNumber(labelText, value, step) {
    const label = document.createElement("label");
    label.style.display = "grid";
    label.style.gap = "4px";
    label.textContent = labelText;
    const input = document.createElement("input");
    input.type = "number";
    input.step = step;
    input.value = String(value);
    label.appendChild(input);
    root.appendChild(label);
    return input;
  }

  const staticTimeInput = addNumber("Time Seconds", 0, "0.1");
  const samplingInput = addNumber("Sampling Rate Hz", 10, "0.1");
  samplingInput.min = "0.1";
  samplingInput.max = "120";
  const speedInput = addNumber("Time Speed", 1, "0.1");

  const buttonRow = document.createElement("div");
  buttonRow.style.display = "flex";
  buttonRow.style.gap = "8px";
  buttonRow.style.flexWrap = "wrap";
  root.appendChild(buttonRow);
  function addButton(labelText, handler) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = labelText;
    button.addEventListener("click", handler);
    buttonRow.appendChild(button);
    return button;
  }

  const statusLine = document.createElement("div");
  statusLine.style.opacity = "0.86";
  root.appendChild(statusLine);

  function readControls() {
    return {
      staticTimeEnabled: staticInput.checked === true,
      staticTimeSeconds: clampTemporalNumber(staticTimeInput.value, -1000000000, 1000000000, 0),
      samplingRateHz: clampTemporalNumber(samplingInput.value, 0.1, 120, 10),
      timeScale: clampTemporalNumber(speedInput.value, -128, 128, 1)
    };
  }

  function updateStatusFromController() {
    const settings = temporalController?.getSettings?.() || {};
    const currentTime = Number.isFinite(settings.currentTimeSeconds) ? settings.currentTimeSeconds : 0;
    statusLine.textContent = "Time " + currentTime.toFixed(2) + " s";
  }

  function syncFromController() {
    const settings = temporalController?.getSettings?.() || {};
    staticInput.checked = settings.staticTimeEnabled === true;
    staticTimeInput.value = String(Number.isFinite(settings.staticTimeSeconds) ? settings.staticTimeSeconds : 0);
    samplingInput.value = String(Number.isFinite(settings.samplingRateHz) ? settings.samplingRateHz : 10);
    speedInput.value = String(Number.isFinite(settings.timeScale) ? settings.timeScale : 1);
    updateStatusFromController();
  }

  function applyControls() {
    temporalController?.applySettings?.(readControls());
    syncFromController();
  }

  function resetTimeToZero() {
    staticTimeInput.value = "0";
    temporalController?.applySettings?.({
      ...readControls(),
      elapsedSeconds: 0,
      staticTimeSeconds: 0
    }, { resetElapsed: true });
    syncFromController();
  }

  [staticInput, staticTimeInput, samplingInput, speedInput].forEach((input) => input.addEventListener("change", applyControls));
  addButton("Reverse", () => { speedInput.value = String(-Math.abs(clampTemporalNumber(speedInput.value, -128, 128, 1) || 1)); applyControls(); });
  addButton("Pause", () => { speedInput.value = "0"; applyControls(); });
  addButton("1x", () => { speedInput.value = "1"; staticInput.checked = false; applyControls(); });
  addButton("Reset", resetTimeToZero);
  addButton("Sample", () => { temporalController?.forceSample?.(); syncFromController(); });

  const timer = window.setInterval(() => {
    if (visible) updateStatusFromController();
  }, 250);

  return {
    open() {
      visible = true;
      syncFromController();
      floatingPanel.setVisible(true);
    },
    isVisible() { return visible; },
    dispose() {
      window.clearInterval(timer);
      floatingPanel.dispose();
    }
  };
}

export function initScene({ THREE, PointerLockControls, panel, canvas, state, loadWorldFromFile, getBindings, normalizeKeyName }) {
  console.log("[VW] initScene start");
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
    state,
    panel,
    canvas,
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
    standUpLatch: false,
    suppressAttackUntilMs: 0,
    velocityY: 0,
    isGrounded: true,
    isSwimming: false,
    playerHeight: 1.75,
    playerMode: preferredMode,
    worldMode: "3d",
    viewMode: "",
    movementMode: "",
    cameraMode: "first",
    cameraModeInitialized: false,
    planeZ: 0,
    requestCycleCamera: false,
    stlEdit: false,
    stlVertices: [],
    stlNeedsMarkerRefresh: false,
    stlPlaceLatch: false,
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
    },
    multiplayer: {
      enabled: false,
      publishRateMs: 700,
      snapshotRateMs: 1000,
      staleMs: 12000,
      avatarScale: 1,
      showNames: true
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
    scene,
    sceneObjects: objects,
    colliders,
    portals,
    spawnPoints
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

  const equationColliderController = createEquationColliderController({
    THREE,
    scene,
    objects,
    colliders,
    waterVolumes
  });
  panel._vrEquationColliderController = equationColliderController;
  window.VRWorldContext.equationColliderController = equationColliderController;

  const equationObjectsPanel = createEquationObjectsPanel({
    THREE,
    controller: equationColliderController,
    colliders,
    waterVolumes,
    hostPanel: panel,
    canvas
  });
  panel._vrEquationObjectsPanel = equationObjectsPanel;
  window.VRWorldContext.equationObjectsPanel = equationObjectsPanel;

  const temporalController = createTemporalController({
    THREE,
    objects,
    waterVolumes,
    movementState
  });
  panel._vrTemporalController = temporalController;
  window.VRWorldContext.temporalController = temporalController;

  const temporalManipulatorPanel = createTemporalManipulatorPanel({ temporalController });
  panel._vrTemporalManipulatorPanel = temporalManipulatorPanel;
  window.VRWorldContext.temporalManipulatorPanel = temporalManipulatorPanel;

  const multiplayerClient = createMetaWorldMultiplayerClient({
    THREE,
    scene,
    camera,
    controls,
    movementState,
    panel
  });
  panel._vrMetaWorldMultiplayerClient = multiplayerClient;
  window.VRWorldContext.multiplayerClient = multiplayerClient;

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
    consolePanels,
    ground
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
    temporalController.update();
    consolePanels.updateEnvironmentLighting?.(temporalController.getTimeSeconds?.() ?? 0);
    movementUpdate();
    viewController.update();
    multiplayerClient.update();
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
