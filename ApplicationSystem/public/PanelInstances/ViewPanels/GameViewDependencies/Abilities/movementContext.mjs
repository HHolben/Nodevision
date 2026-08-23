// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/Abilities/movementContext.mjs
// This file builds the shared runtime context used by the browser-side Game View movement ability modules. It keeps mutable frame state in one transparent object so the movement updater can be composed from small modules without hiding user-owned world behavior inside a monolithic closure.

import { createCollisionChecker } from "../collisionCheck.mjs";
import { DEFAULT_WORLD_OBJECT_MATERIAL_ID, materialFileForWorldObjectMaterial } from "/MetaWorld/Materials/WorldObjectMaterialDefaults.mjs";

export function installMovementApi(ctx, methods) {
  Object.assign(ctx.api, methods);
  return methods;
}

export function createMovementContext(dependencies) {
  const { THREE, controls, camera, colliders, movementState } = dependencies;
  const ctx = {
    ...dependencies,
    api: {},
    playerRadius: 0.35,
    basePlayerHeight: 1.75,
    crouchHeight: 1.2,
    crawlHeight: 0.6,
    gravity: 0.012,
    jumpSpeed: 0.28,
    groundLevel: 0,
    stepHeight: 0.5,
    gamepadDeadZone: 0.2,
    gamepadLookMouseScale: 16,
    useRangeMax: 6,
    useRepeatMs: 180,
    baseSwimSpeedMultiplier: 0.72,
    defaultCrouchJumpMultiplier: 1.5,
    cycleCameraLatch: false,
    pauseLatch: false,
    inventoryToggleLatch: false,
    inventoryMenuUpLatch: false,
    inventoryMenuDownLatch: false,
    inventoryMenuLeftLatch: false,
    inventoryMenuRightLatch: false,
    inventoryMenuConfirmLatch: false,
    inventoryHandSwitchLatch: false,
    hotbarSlotLatch: null,
    phaseToggleLatch: false,
    noTroubleSplash: null,
    noTroubleTimer: 0,
    objectFileGeometryApplier: null,
    objectFileGeometryLoaderPromise: null,
    imagePlaneTextureApplier: null,
    imagePlaneLoaderPromise: null,
    grabbedState: null,
    grabbedDistanceMin: 0.1,
    grabbedDistanceMax: 30,
    stretchState: null,
    translateState: null,
    rotateState: null,
    wheelHandlerAttached: false,
    inspectRepeatMs: 220,
    doubleClickMs: 350,
    stlVertexMarkers: [],
    selectedItemActions: new Map(),
    VOXEL_PLACER_TOOL_ID: "voxel-placer",
    VOXEL_EXTRUDER_TOOL_ID: "voxel-extruder",
    FLYING_CARPET_ITEM_ID: "flying-carpet",
    FLYING_CARPET_WIDTH: 2,
    FLYING_CARPET_HEIGHT: 0.08,
    FLYING_CARPET_DEPTH: 2,
    FLYING_CARPET_COLOR: 0x6f63d9,
    FLYING_CARPET_EMISSIVE: 0x24205f,
    FLYING_CARPET_SPEED_MULTIPLIER: 0.92,
    FLYING_CARPET_VERTICAL_SPEED_MULTIPLIER: 0.78,
    DEFAULT_WORLD_OBJECT_MATERIAL_ID,
    DEFAULT_VOXEL_PLACER_CONFIG: Object.freeze({
      size: 1,
      materialId: DEFAULT_WORLD_OBJECT_MATERIAL_ID,
      materialFile: materialFileForWorldObjectMaterial(DEFAULT_WORLD_OBJECT_MATERIAL_ID),
      color: "#8ee6c1",
      opacity: 1,
      collider: true
    }),
    voxelMaterialCatalogPromise: null,
    bounceMaterialsByKey: new Map()
  };

  ctx.up = new THREE.Vector3(0, 1, 0);
  ctx.forward = new THREE.Vector3();
  ctx.right = new THREE.Vector3();
  ctx.raycaster = new THREE.Raycaster();
  ctx.raycaster.params.Sprite = { threshold: 0.4 };
  ctx.raycastDirection = new THREE.Vector3();
  ctx.vectorGravityVelocity = new THREE.Vector3();
  ctx.vectorGravityAcceleration = new THREE.Vector3();
  ctx.vectorGravityNextPosition = new THREE.Vector3();
  ctx.gravityPointPosition = new THREE.Vector3();
  ctx.zeroGravityKickDirection = new THREE.Vector3();
  ctx.mouseLikeEuler = new THREE.Euler(0, 0, 0, "YXZ");
  ctx.halfPi = Math.PI / 2;
  ctx.lastGrabDir = new THREE.Vector3(0, 0, -1);
  ctx.boundsPickBox = new THREE.Box3();
  ctx.boundsPickPoint = new THREE.Vector3();
  ctx.textureLoader = new THREE.TextureLoader();
  ctx.positionArrowTexture = null;
  ctx.hoverColors = {
    translate: new THREE.Color(0x00e5ff),
    rotate: new THREE.Color(0x00e5ff)
  };
  ctx.baseTranslateColor = new THREE.Color(0xffb347);
  ctx.baseRotateColor = new THREE.Color(0xb972ff);
  ctx.selectedRotateColor = new THREE.Color(0xffd166);
  ctx.hoverListenerAttached = false;
  ctx.translateHoverHandle = null;
  ctx.rotateHoverHandle = null;
  ctx.lastHoverAxis = null;
  movementState.skipClickFrame = movementState.skipClickFrame || false;
  movementState.playerHeight = ctx.basePlayerHeight;
  ctx.wouldCollide = createCollisionChecker({
    colliders,
    movementState,
    playerRadius: ctx.playerRadius
  });
  ctx.playerObject = () => controls.getObject();
  ctx.listenerPosition = () => controls?.getObject?.()?.position || camera?.position || null;
  return ctx;
}
