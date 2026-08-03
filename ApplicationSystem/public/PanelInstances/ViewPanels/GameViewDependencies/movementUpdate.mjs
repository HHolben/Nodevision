// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/movementUpdate.mjs
// This file defines browser-side movement Update logic for the Nodevision UI. It renders interface components and handles user interactions.

import { createCollisionChecker } from "./collisionCheck.mjs";
import { getPlaneRayIntersection } from "./equationColliderTool.mjs";
import { applyDirectionalMovement, applyFlyingMovement, applyGroundMovement, applyRollPitch } from "./movementSteps.mjs";
import { triggerSvgCameraCapture } from "./svgCameraTool.mjs";
import { setStatus } from "/StatusBar.mjs";
import { DEFAULT_WORLD_OBJECT_MATERIAL_ID, loadWorldObjectMaterialCatalog, materialFileForWorldObjectMaterial } from "/MetaWorld/Materials/WorldObjectMaterialDefaults.mjs";

export function createMovementUpdater({ THREE, scene, objects, camera, controls, colliders, portals, collisionActions, useTargets, spawnPoints, waterVolumes, objectInspector, worldPropertiesPanel, functionPlotterPanel, loadWorldFromFile, getBindings, heldKeys, movementState, terrainToolController, consolePanels, ground }) {
  const playerRadius = 0.35;
  const basePlayerHeight = 1.75;
  const crouchHeight = 1.2;
  const crawlHeight = 0.6;
  const up = new THREE.Vector3(0, 1, 0);
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const gravity = 0.012;
  const jumpSpeed = 0.28;
  const groundLevel = 0;
  const stepHeight = 0.5;
  const gamepadDeadZone = 0.2;
  const gamepadLookMouseScale = 16;
  const useRangeMax = 6;
  const useRepeatMs = 180;
  const baseSwimSpeedMultiplier = 0.72;
  const defaultCrouchJumpMultiplier = 1.85;
  let cycleCameraLatch = false;
  let pauseLatch = false;
  let inventoryToggleLatch = false;
  let inventoryMenuUpLatch = false;
  let inventoryMenuDownLatch = false;
  let inventoryMenuLeftLatch = false;
  let inventoryMenuRightLatch = false;
  let inventoryMenuConfirmLatch = false;
  let inventoryHandSwitchLatch = false;
  let hotbarSlotLatch = null;
  let phaseToggleLatch = false;
  const raycaster = new THREE.Raycaster();
  raycaster.params.Sprite = { threshold: 0.4 }; // expand hit area for 2D sprite handles
  const raycastDirection = new THREE.Vector3();
  const mouseLikeEuler = new THREE.Euler(0, 0, 0, "YXZ");
  const halfPi = Math.PI / 2;
  let noTroubleSplash = null;
  let noTroubleTimer = 0;
  let objectFileGeometryApplier = null;
  let objectFileGeometryLoaderPromise = null;
  let imagePlaneTextureApplier = null;
  let imagePlaneLoaderPromise = null;
  let grabbedState = null;
  let grabbedDistanceMin = 0.1;
  let grabbedDistanceMax = 30;
  let stretchState = null;
  let translateState = null;
  let rotateState = null;
  let wheelHandlerAttached = false;
  const inspectRepeatMs = 220;
  const doubleClickMs = 350;
  let stlVertexMarkers = [];
  const lastGrabDir = new THREE.Vector3(0, 0, -1);
  const boundsPickBox = new THREE.Box3();
  const boundsPickPoint = new THREE.Vector3();
  const selectedItemActions = new Map();
  const VOXEL_PLACER_TOOL_ID = "voxel-placer";
  const VOXEL_EXTRUDER_TOOL_ID = "voxel-extruder";
  const FLYING_CARPET_ITEM_ID = "flying-carpet";
  const FLYING_CARPET_WIDTH = 2;
  const FLYING_CARPET_HEIGHT = 0.08;
  const FLYING_CARPET_DEPTH = 2;
  const FLYING_CARPET_COLOR = 0x6f63d9;
  const FLYING_CARPET_EMISSIVE = 0x24205f;
  const FLYING_CARPET_SPEED_MULTIPLIER = 0.92;
  const FLYING_CARPET_VERTICAL_SPEED_MULTIPLIER = 0.78;
  const DEFAULT_VOXEL_PLACER_CONFIG = Object.freeze({
    size: 1,
    materialId: DEFAULT_WORLD_OBJECT_MATERIAL_ID,
    materialFile: materialFileForWorldObjectMaterial(DEFAULT_WORLD_OBJECT_MATERIAL_ID),
    color: "#8ee6c1",
    collider: true
  });
  let voxelMaterialCatalogPromise = null;

  function getFacingDirection(out = new THREE.Vector3()) {
    const ctrlObj = controls?.getObject?.();
    // Prefer the camera orientation directly; controls.getDirection can be stale when pointer lock fails.
    if (camera?.getWorldDirection) {
      camera.getWorldDirection(out);
    } else if (typeof controls.getDirection === "function") {
      controls.getDirection(out);
    } else if (ctrlObj?.getWorldDirection) {
      ctrlObj.getWorldDirection(out);
    } else {
      out.set(0, 0, -1);
    }
    if (out.lengthSq() < 1e-6) {
      out.copy(lastGrabDir);
    } else {
      out.normalize();
      lastGrabDir.copy(out);
    }
    return out;
  }
  // Skip click-triggered actions for one frame (used when clicking gizmo handles)
  movementState.skipClickFrame = movementState.skipClickFrame || false;

  const textureLoader = new THREE.TextureLoader();
  let positionArrowTexture = null;

  function ensurePositionArrowTexture() {
    if (positionArrowTexture) return positionArrowTexture;
    positionArrowTexture = textureLoader.load("/icons/PositionArrowIcon.png");
    positionArrowTexture.anisotropy = 4;
    positionArrowTexture.minFilter = THREE.NearestFilter;
    positionArrowTexture.magFilter = THREE.NearestFilter;
    positionArrowTexture.generateMipmaps = false; // keep pixel art crisp
    return positionArrowTexture;
  }

  function getPointerNdc(event) {
    // Pointer-lock mode lacks absolute coords; default to center crosshair.
    if (controls?.isLocked || !event || typeof event.clientX !== "number" || typeof event.clientY !== "number") {
      return { x: 0, y: 0 };
    }
    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;
    return {
      x: (event.clientX / w) * 2 - 1,
      y: -(event.clientY / h) * 2 + 1
    };
  }

  const tmpCenter = new THREE.Vector3();
  const tmpHandle = new THREE.Vector3();
  const tmpCenterNdc = new THREE.Vector3();
  const tmpHandleNdc = new THREE.Vector3();

  function orientSpriteHandles(state) {
    if (!state?.handles?.length || !state.target) return;
    state.target.getWorldPosition(tmpCenter);
    tmpCenterNdc.copy(tmpCenter).project(camera);
    for (const handle of state.handles) {
      if (!handle?.isSprite || !handle.material) continue;
      handle.getWorldPosition(tmpHandle);
      tmpHandleNdc.copy(tmpHandle).project(camera);
      const dx = tmpHandleNdc.x - tmpCenterNdc.x;
      const dy = tmpHandleNdc.y - tmpCenterNdc.y;
      handle.material.rotation = Math.atan2(dy, dx);
    }
  }

  function updateGizmoHandleOrientations() {
    orientSpriteHandles(translateState);
    orientSpriteHandles(rotateState);
  }

  const hoverColors = {
    translate: new THREE.Color(0x00e5ff),
    rotate: new THREE.Color(0x00e5ff)
  };
  const baseTranslateColor = new THREE.Color(0xffb347);
  const baseRotateColor = new THREE.Color(0xb972ff);
  const selectedRotateColor = new THREE.Color(0xffd166);
  let hoverListenerAttached = false;
  let translateHoverHandle = null;
  let rotateHoverHandle = null;
  let lastHoverAxis = null;

  function applyHoverState(state, hoverHandle, baseColor) {
    if (!state?.handles) return;
    for (const h of state.handles) {
      if (!h?.material) continue;
      const isHover = h === hoverHandle;
      h.material.color.copy(isHover ? hoverColors.translate : baseColor);
      h.material.opacity = isHover ? 0.45 : 1; // fade on hover for clearer feedback
      h.material.needsUpdate = true;
    }
  }

  function updateRotateHandleVisuals() {
    if (!rotateState?.handles?.length) return;
    for (const h of rotateState.handles) {
      if (!h?.material) continue;
      const isHover = h === rotateHoverHandle;
      const isSelected = h === rotateState.selectedHandle;
      h.material.color.copy(isSelected ? selectedRotateColor : isHover ? hoverColors.rotate : baseRotateColor);
      h.material.opacity = isHover || isSelected ? 0.55 : 1;
      h.material.needsUpdate = true;
    }
  }

  function onPointerHover(e) {
    if (!translateState && !rotateState) return;
    const ndc = getPointerNdc(e);
    raycaster.setFromCamera(ndc, camera);

    translateHoverHandle = null;
    rotateHoverHandle = null;

    if (translateState?.handles?.length) {
      const hits = raycaster.intersectObjects(translateState.handles, false);
      translateHoverHandle = hits[0]?.object || null;
      applyHoverState(translateState, translateHoverHandle, baseTranslateColor);
      const axisStr = translateHoverHandle ? translateHoverHandle.userData.axis?.toArray?.().join(",") : null;
      if (axisStr !== lastHoverAxis) {
        lastHoverAxis = axisStr;
      }
    }

    if (rotateState?.handles?.length) {
      const hits = raycaster.intersectObjects(rotateState.handles, false);
      rotateHoverHandle = hits[0]?.object || null;
      if (rotateHoverHandle) {
        const axisStr = rotateHoverHandle.userData.axis?.toArray?.().join(",");
        if (axisStr !== lastHoverAxis) {
          lastHoverAxis = axisStr;
        }
      }
      updateRotateHandleVisuals();
    }
  }

  async function ensureObjectFileGeometryApplier() {
    if (objectFileGeometryApplier) return objectFileGeometryApplier;
    if (!objectFileGeometryLoaderPromise) {
      objectFileGeometryLoaderPromise = import("./objectFileLoader.mjs")
        .then((mod) => {
          objectFileGeometryApplier = mod.applyObjectFileGeometry;
          return objectFileGeometryApplier;
        })
        .catch((err) => {
          console.warn("Object file geometry loader failed to load:", err);
          objectFileGeometryLoaderPromise = null;
          objectFileGeometryApplier = null;
          return null;
        });
    }
    return objectFileGeometryLoaderPromise;
  }

  function shouldUseBoundsPicking(target) {
    if (!target?.isMesh) return false;
    if (target.userData?.isPortal === true || String(target.userData?.nvType || "").toLowerCase() === "portal") return true;
    if (target.userData?.objectFileUseBoundsPicking === true) return true;
    const objectPath = String(target.userData?.objectFilePath || "").toLowerCase().split(/[?#]/)[0];
    return objectPath.endsWith(".stl") || objectPath.endsWith(".obj");
  }

  function boundsPickHit(target) {
    if (!target?.isMesh || target.visible === false) return null;
    target.updateMatrixWorld?.(true);
    boundsPickBox.setFromObject(target);
    if (boundsPickBox.isEmpty()) return null;
    const point = boundsPickBox.containsPoint(raycaster.ray.origin)
      ? boundsPickPoint.copy(raycaster.ray.origin)
      : raycaster.ray.intersectBox(boundsPickBox, boundsPickPoint);
    if (!point) return null;
    const distance = raycaster.ray.origin.distanceTo(point);
    if (!Number.isFinite(distance) || distance > useRangeMax) return null;
    return {
      distance,
      point: point.clone(),
      object: target,
      boundsPick: true
    };
  }

  function splitBoundsPickCandidates(candidates = []) {
    const bounds = [];
    const raycast = [];
    for (const candidate of candidates) {
      if (shouldUseBoundsPicking(candidate)) bounds.push(candidate);
      else raycast.push(candidate);
    }
    return { bounds, raycast };
  }

  function getPlacementHit({ maxDistance = useRangeMax } = {}) {
    raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    const objectCandidates = (objects || []).filter((obj) => obj?.isMesh && obj?.visible);
    const split = splitBoundsPickCandidates(objectCandidates);
    const candidates = [];
    if (ground?.visible) candidates.push(ground);
    candidates.push(...split.raycast);
    const meshHits = raycaster.intersectObjects(candidates, false);
    const boundsHits = split.bounds
      .map(boundsPickHit)
      .filter(Boolean)
      .filter((h) => Number.isFinite(h.distance) && h.distance <= maxDistance && h.object?.visible);
    return meshHits
      .concat(boundsHits)
      .filter((h) => Number.isFinite(h.distance) && h.distance <= maxDistance && h.object?.visible)
      .sort((a, b) => a.distance - b.distance)[0] || null;
  }

  function getTerrainPaintHit() {
    raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -groundLevel);
    const floorPoint = new THREE.Vector3();
    const point = raycaster.ray.intersectPlane(floorPlane, floorPoint);
    if (point) {
      return {
        point: floorPoint,
        distance: raycaster.ray.origin.distanceTo(floorPoint),
        object: ground || null
      };
    }
    return getPlacementHit({ maxDistance: Infinity });
  }

  function buildConsoleMeshFromConfig(config) {
    if (!config) return null;
    const width = Number.isFinite(config.size?.[0]) ? config.size[0] : 0.9;
    const height = Number.isFinite(config.size?.[1]) ? config.size[1] : 1.15;
    const depth = Number.isFinite(config.size?.[2]) ? config.size[2] : 0.7;
    const material = new THREE.MeshStandardMaterial({ color: config.color || "#33ccaa" });
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      material
    );
    mesh.userData.consoleProperties = {
      collider: config.collider !== false,
      color: config.color || "#33ccaa",
      objectFile: config.objectFile || "",
      linkedObject: config.linkedObject || ""
    };
    mesh.userData.nvType = "console";
    return {
      mesh,
      collider: config.collider !== false ? {
        type: "box",
        half: new THREE.Vector3(width * 0.5, height * 0.5, depth * 0.5)
      } : null
    };
  }

  function resolveHalfExtents(collider) {
    if (!collider) return { x: 0.5, y: 0.5, z: 0.5 };
    if (collider.type === "box" && collider.half) {
      return { x: collider.half.x, y: collider.half.y, z: collider.half.z };
    }
    if (collider.type === "sphere" && Number.isFinite(collider.radius)) {
      const r = collider.radius;
      return { x: r, y: r, z: r };
    }
    if (collider.type === "cylinder" && Number.isFinite(collider.radius) && Number.isFinite(collider.halfHeight)) {
      return { x: collider.radius, y: collider.halfHeight, z: collider.radius };
    }
    return { x: 0.5, y: 0.5, z: 0.5 };
  }

  function computePlacePosition(hit, normal, collider, { snapToGrid = false } = {}) {
    const half = resolveHalfExtents(collider);
    const n = normal.clone().normalize();
    // Project half extents onto the surface normal to sit flush; tiny epsilon avoids z-fight.
    const eps = 0.001;
    const offset =
      Math.abs(n.x) * half.x +
      Math.abs(n.y) * half.y +
      Math.abs(n.z) * half.z +
      eps;

    const placePos = hit.point.clone().addScaledVector(n, offset);
    if (snapToGrid) {
      placePos.x = Math.round(placePos.x);
      placePos.y = Math.round(placePos.y);
      placePos.z = Math.round(placePos.z);
    }
    if (placePos.y < 0.5) placePos.y = 0.5;
    return placePos;
  }

  function startGrabFromHit(hit) {
    const target = hit?.object;
    if (!target?.isMesh) return false;
    const distance = Math.max(grabbedDistanceMin, Math.min(hit.distance || 2, grabbedDistanceMax));
    const forward = getFacingDirection(new THREE.Vector3());
    grabbedState = {
      object: target,
      distance,
      rotation: target.quaternion.clone(),
      colliderRef: target.userData?.colliderRef || null,
      forwardDir: forward
    };
    return true;
  }

  function releaseGrabbedObject() {
    grabbedState = null;
  }

  function updateGrabbedObjectFollow() {
    if (!grabbedState || !grabbedState.object?.isMesh) {
      grabbedState = null;
      return;
    }
    grabbedState.distance = Math.max(grabbedDistanceMin, Math.min(grabbedState.distance, grabbedDistanceMax));
    const obj = grabbedState.object;
    const dir = getFacingDirection(new THREE.Vector3());
    const origin = controls?.getObject?.().getWorldPosition
      ? controls.getObject().getWorldPosition(new THREE.Vector3())
      : camera?.getWorldPosition
        ? camera.getWorldPosition(new THREE.Vector3())
        : controls?.getObject?.().position || new THREE.Vector3();
    const pos = origin.clone().addScaledVector(dir, grabbedState.distance);
    obj.position.copy(pos);
    if (grabbedState.rotation) obj.quaternion.copy(grabbedState.rotation);

    updateColliderForTarget(obj);
  }

  function handleGrabScroll(event) {
    const dyRaw = Number.isFinite(event.deltaY) ? event.deltaY
      : (Number.isFinite(event.wheelDelta) ? -event.wheelDelta
        : (Number.isFinite(event.detail) ? event.detail : 0));
    const dy = dyRaw || 0;
    const dirProbe = getFacingDirection(new THREE.Vector3());
    const ctrlObjProbe = controls?.getObject?.();
    console.log("[VW][grabScroll][raw]", {
      wheelDeltaY: dy,
      grabbed: Boolean(grabbedState),
      dirFacing: { x: Number(dirProbe.x.toFixed(3)), y: Number(dirProbe.y.toFixed(3)), z: Number(dirProbe.z.toFixed(3)) },
      cameraYaw: Number((ctrlObjProbe?.rotation?.y ?? camera.rotation.y).toFixed(3)),
      cameraPitch: Number((ctrlObjProbe?.rotation?.x ?? camera.rotation.x).toFixed(3))
    });

    // Rotation via scroll when an axis is selected.
    const activeAxis = rotateState?.activeAxis || rotateState?.selectedHandle?.userData?.axis;
    if (activeAxis && rotateState?.target) {
      const angle = THREE.MathUtils.clamp(-dy * 0.002, -0.35, 0.35);
      rotateState.target.rotateOnAxis(activeAxis, angle);
      rotateState.activeAxis = activeAxis.clone?.() || activeAxis;
      updateColliderForTarget(rotateState.target);
      event.preventDefault?.();
      event.stopPropagation?.();
      return;
    }

    // Scroll adjusts grabbed object distance.
    if (grabbedState) {
      const dyMag = Math.abs(dy);
      const step = THREE.MathUtils.clamp(dyMag * 0.002, 0.05, 0.6);
      // Scroll up (negative deltaY) brings object closer; down pushes away.
      const before = grabbedState.distance;
      const dirSign = dy === 0 ? 0 : (dy > 0 ? 1 : -1);
      grabbedState.distance += (dirSign > 0 ? step : -step);
      const unclamped = grabbedState.distance;
      grabbedState.distance = Math.max(grabbedDistanceMin, Math.min(grabbedState.distance, grabbedDistanceMax));
      const clamped = grabbedState.distance !== unclamped;
      updateGrabbedObjectFollow(); // apply immediately so facing direction doesn't matter
      const dir = getFacingDirection(new THREE.Vector3());
      console.log("[VW][grabScroll]", {
        wheelDeltaY: dy,
        step,
        distance: grabbedState.distance,
        deltaDist: grabbedState.distance - before,
        dirFacing: { x: Number(dir.x.toFixed(3)), y: Number(dir.y.toFixed(3)), z: Number(dir.z.toFixed(3)) },
        cameraYaw: Number(controls?.getObject?.().rotation?.y?.toFixed?.(3) || camera.rotation.y.toFixed(3)),
        cameraPitch: Number(controls?.getObject?.().rotation?.x?.toFixed?.(3) || camera.rotation.x.toFixed(3)),
        atLimit: clamped,
        min: grabbedDistanceMin,
        max: grabbedDistanceMax
      });
      event.preventDefault?.();
      event.stopPropagation?.();
    }
  }

  function ensureWheelHandler() {
    if (wheelHandlerAttached) return;
    // Capture wheel early so object scrolling works even before pointer lock engages.
    window.addEventListener("wheel", handleGrabScroll, { passive: false, capture: true });
    wheelHandlerAttached = true;
  }

  function disposeStretchState() {
    if (!stretchState) return;
    stretchState.handles?.forEach((h) => h?.parent?.remove(h));
    stretchState.group?.parent?.remove(stretchState.group);
    window.removeEventListener("pointerdown", onStretchPointerDown, true);
    window.removeEventListener("pointermove", onStretchPointerMove, true);
    window.removeEventListener("pointerup", onStretchPointerUp, true);
    stretchState = null;
  }

  function createStretchGizmo(target) {
    const group = new THREE.Group();
    const handleGeo = new THREE.ConeGeometry(0.08, 0.24, 12);
    const handleMat = new THREE.MeshStandardMaterial({ color: 0x48b0ff });
    const handles = [];

    const axes = [
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(-1, 0, 0),
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, -1, 0),
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 0, -1)
    ];

    const corners = [];
    const signs = [-1, 1];
    for (const sx of signs) for (const sy of signs) for (const sz of signs) {
      corners.push(new THREE.Vector3(sx, sy, sz).normalize());
    }

    function makeHandle(dir, isCorner = false) {
      const mesh = new THREE.Mesh(handleGeo, handleMat.clone());
      mesh.userData.axis = dir.clone();
      mesh.userData.isCorner = isCorner;
      mesh.position.copy(dir).multiplyScalar(1.05);
      mesh.lookAt(dir.clone().multiplyScalar(2));
      group.add(mesh);
      handles.push(mesh);
    }

    axes.forEach((a) => makeHandle(a, false));
    corners.forEach((c) => makeHandle(c, true));

    target.add(group);
    stretchState = {
      target,
      group,
      handles,
      dragging: false,
      activeHandle: null,
      startScale: null
    };

    window.addEventListener("pointerdown", onStretchPointerDown, true);
    window.addEventListener("pointermove", onStretchPointerMove, true);
    window.addEventListener("pointerup", onStretchPointerUp, true);
  }

  function pickStretchHandle(evt) {
    if (!stretchState?.handles?.length) return null;
    raycaster.setFromCamera(getPointerNdc(evt), camera);
    const hits = raycaster.intersectObjects(stretchState.handles, false);
    return hits[0]?.object || null;
  }

  function onStretchPointerDown(e) {
    if (e.button !== 0) return;
    if (!stretchState) return;
    const handle = pickStretchHandle(e);
    if (!handle) return;
    stretchState.dragging = true;
    stretchState.activeHandle = handle;
    stretchState.startScale = stretchState.target.scale.clone();
    movementState.skipClickFrame = true;
    e.preventDefault();
    e.stopPropagation();
  }

  function onStretchPointerMove(e) {
    if (!stretchState?.dragging || !stretchState.activeHandle) return;
    const axis = stretchState.activeHandle.userData.axis;
    const isCorner = stretchState.activeHandle.userData.isCorner;
    const delta = (-(e.movementY || 0) + (e.movementX || 0)) * 0.01;
    const target = stretchState.target;
    if (!target) {
      disposeStretchState();
      return;
    }
    const scaleDelta = 1 + delta;
    if (isCorner) {
      target.scale.multiplyScalar(Math.max(0.1, Math.min(8, scaleDelta)));
    } else {
      const sx = Math.max(0.1, Math.min(50, target.scale.x * (1 + axis.x * delta)));
      const sy = Math.max(0.1, Math.min(50, target.scale.y * (1 + axis.y * delta)));
      const sz = Math.max(0.1, Math.min(50, target.scale.z * (1 + axis.z * delta)));
      target.scale.set(sx, sy, sz);
    }
    updateColliderForTarget(target);
    e.preventDefault();
  }

  function onStretchPointerUp(e) {
    if (!stretchState) return;
    if (e.button !== 0) return;
    stretchState.dragging = false;
    stretchState.activeHandle = null;
  }

  function disposeTranslateState() {
    if (!translateState) return;
   translateState.handles?.forEach((h) => h?.parent?.remove(h));
   translateState.group?.parent?.remove(translateState.group);
   window.removeEventListener("pointerdown", onTranslatePointerDown, true);
   window.removeEventListener("pointermove", onTranslatePointerMove, true);
    window.removeEventListener("mousemove", onTranslatePointerMove, true);
   window.removeEventListener("pointerup", onTranslatePointerUp, true);
   translateState = null;
   translateHoverHandle = null;
 }

  function disposeRotateState() {
    if (!rotateState) return;
    rotateState.handles?.forEach((h) => h?.parent?.remove(h));
    rotateState.group?.parent?.remove(rotateState.group);
   window.removeEventListener("pointerdown", onRotatePointerDown, true);
   window.removeEventListener("pointermove", onRotatePointerMove, true);
    window.removeEventListener("mousemove", onRotatePointerMove, true);
   window.removeEventListener("pointerup", onRotatePointerUp, true);
    rotateState = null;
    rotateHoverHandle = null;
    lastHoverAxis = null;
  }

  function createTranslateGizmo(target) {
    // If we're already showing a gizmo for this target, keep it (especially during drag)
    if (translateState?.target === target) {
      if (translateState.dragging) {
        return;
      }
      // reuse existing if not dragging
      disposeTranslateState();
    }
    const group = new THREE.Group();
    const handleGeo = new THREE.ConeGeometry(0.08, 0.28, 12);
    const handleMat = new THREE.MeshStandardMaterial({ color: 0xffb347 });
    const handles = [];

    const axes = [
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(-1, 0, 0),
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, -1, 0),
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 0, -1)
    ];

    const arrowMap = ensurePositionArrowTexture();

    function makeHandle(dir) {
      const mat = new THREE.SpriteMaterial({
        map: arrowMap,
        color: 0xffb347,
        depthTest: true,
        depthWrite: false,
        transparent: true
      });
      const sprite = new THREE.Sprite(mat);
      sprite.userData.axis = dir.clone();
      sprite.position.copy(dir).multiplyScalar(1.05);
      sprite.scale.set(0.35, 0.35, 0.35);
      sprite.lookAt(dir.clone().multiplyScalar(2));
      group.add(sprite);
      handles.push(sprite);
    }

    axes.forEach(makeHandle);

    target.add(group);
    translateState = {
      target,
      group,
      handles,
      dragging: false,
      activeHandle: null,
      lastPointerPos: null
    };

    if (!hoverListenerAttached) {
      window.addEventListener("pointermove", onPointerHover, true);
      window.addEventListener("mousemove", onPointerHover, true);
      hoverListenerAttached = true;
    }

    window.addEventListener("pointerdown", onTranslatePointerDown, true);
    window.addEventListener("pointermove", onTranslatePointerMove, true);
    window.addEventListener("mousemove", onTranslatePointerMove, true);
    window.addEventListener("pointerup", onTranslatePointerUp, true);
  }

  function pickTranslateHandle(evt) {
    if (!translateState?.handles?.length) return null;
    raycaster.setFromCamera(getPointerNdc(evt), camera);
    const hits = raycaster.intersectObjects(translateState.handles, false);
    if (hits[0]?.object) {
      const axisStr = hits[0].object.userData.axis?.toArray?.().join(",");
      // debug axis pick: intentionally silent unless needed
    }
    return hits[0]?.object || null;
  }

  function onTranslatePointerDown(e) {
    if (e.button !== 0) return;
    if (!translateState) return;
    const handle = pickTranslateHandle(e);
    if (!handle) return;
    translateState.dragging = true;
    translateState.activeHandle = handle;
    translateState.startPos = translateState.target.position.clone();
    translateState.lastPointerPos = { x: e.clientX, y: e.clientY };
    movementState.skipClickFrame = true;
    e.preventDefault();
    e.stopPropagation();
  }

  function isPortalLikeTarget(target) {
    return target?.userData?.isPortal === true || String(target?.userData?.nvType || "").toLowerCase() === "portal";
  }

  function markPortalInspectableTarget(target, portalRef = null) {
    if (!target) return null;
    if (!target.userData || typeof target.userData !== "object") target.userData = {};
    target.userData.isPortal = true;
    target.userData.nvType = "portal";
    if (portalRef) {
      target.userData.portalRef = portalRef;
      portalRef.object3d = target;
      if (!portalRef.objectId) {
        portalRef.objectId = target.userData.metaWorldLayerId || target.userData.tag || target.name || target.uuid || "";
      }
    }
    return target;
  }

  function findPortalRefForTarget(target) {
    if (!target) return null;
    if (target.userData?.portalRef) return target.userData.portalRef;
    if (!Array.isArray(portals)) return null;
    const objectId = target.userData?.metaWorldLayerId || target.userData?.tag || target.name || "";
    return portals.find((entry) => entry?.object3d === target || (objectId && entry?.objectId === objectId)) || null;
  }

  function updatePortalRuntimeForTarget(target) {
    if (!target || !isPortalLikeTarget(target)) return;
    let portalRef = findPortalRefForTarget(target);
    if (!portalRef && Array.isArray(portals)) {
      portalRef = { lastTriggeredAt: 0 };
      portals.push(portalRef);
    }
    if (!portalRef) return;
    target.updateWorldMatrix?.(true, false);
    const box = new THREE.Box3().setFromObject(target);
    const objectId = target.userData?.metaWorldLayerId || target.userData?.tag || target.name || target.uuid || "";
    portalRef.box = box;
    portalRef.object3d = target;
    if (objectId) portalRef.objectId = objectId;
    const targetWorld = typeof target.userData?.portalTarget === "string" ? target.userData.portalTarget : portalRef.targetWorld;
    portalRef.targetWorld = targetWorld || null;
    portalRef.sameWorld = typeof target.userData?.portalSameWorld === "boolean" ? target.userData.portalSameWorld : portalRef.sameWorld === true;
    portalRef.destinationMode = target.userData?.portalDestinationMode || portalRef.destinationMode;
    portalRef.linkedPortalId = typeof target.userData?.portalLinkedPortalId === "string" ? target.userData.portalLinkedPortalId : portalRef.linkedPortalId || "";
    portalRef.spawn = Array.isArray(target.userData?.portalSpawn) ? target.userData.portalSpawn.slice(0, 3) : (Array.isArray(portalRef.spawn) ? portalRef.spawn : null);
    portalRef.spawnPoint = typeof target.userData?.portalSpawnPoint === "string" ? target.userData.portalSpawnPoint : portalRef.spawnPoint || null;
    portalRef.spawnYaw = Number.isFinite(target.userData?.portalSpawnYaw) ? target.userData.portalSpawnYaw : (Number.isFinite(portalRef.spawnYaw) ? portalRef.spawnYaw : null);
    portalRef.cooldownMs = Number.isFinite(target.userData?.portalCooldownMs) ? target.userData.portalCooldownMs : portalRef.cooldownMs || 1200;
    target.userData.portalRef = portalRef;
    if (target.userData?.collisionActionRef) {
      target.userData.collisionActionRef.box = box;
      target.userData.collisionActionRef.object3d = target;
    }
  }

  function isSpawnPointTarget(target) {
    return target?.userData?.isSpawn === true
      || String(target?.userData?.nvType || "").toLowerCase() === "spawn"
      || Boolean(target?.userData?.spawnPointRef);
  }

  function readSpawnRuntimeId(target) {
    const candidates = [
      target?.userData?.spawnId,
      target?.userData?.spawnPointId,
      target?.userData?.metaWorldLayerId,
      target?.userData?.tag,
      target?.name,
      target?.uuid
    ];
    const explicit = candidates.find((value) => typeof value === "string" && value.trim());
    return explicit ? explicit.trim() : "";
  }

  function findSpawnRefForTarget(target) {
    if (!target) return null;
    if (target.userData?.spawnPointRef) return target.userData.spawnPointRef;
    if (!Array.isArray(spawnPoints)) return null;
    const spawnId = readSpawnRuntimeId(target);
    const objectId = target.userData?.metaWorldLayerId || target.userData?.tag || target.name || "";
    return spawnPoints.find((entry) => entry?.object3d === target
      || entry?.target === target
      || (objectId && entry?.objectId === objectId)
      || (spawnId && entry?.id === spawnId)) || null;
  }

  function updateSpawnRuntimeForTarget(target) {
    if (!target || !isSpawnPointTarget(target)) return null;
    let spawnRef = findSpawnRefForTarget(target);
    if (!spawnRef && Array.isArray(spawnPoints)) {
      spawnRef = {};
      spawnPoints.push(spawnRef);
    }
    if (!spawnRef) return null;

    const spawnId = readSpawnRuntimeId(target) || "default";
    const yaw = Number.isFinite(target.userData?.spawnYaw)
      ? target.userData.spawnYaw
      : (Number.isFinite(spawnRef.yaw) ? spawnRef.yaw : 0);
    target.userData.isSpawn = true;
    target.userData.nvType = "spawn";
    target.userData.spawnId = spawnId;
    target.userData.spawnYaw = yaw;
    target.userData.spawnPointRef = spawnRef;

    spawnRef.id = spawnId;
    spawnRef.objectId = target.userData?.metaWorldLayerId || spawnId;
    spawnRef.object3d = target;
    spawnRef.position = [target.position.x, target.position.y, target.position.z];
    spawnRef.yaw = yaw;
    return spawnRef;
  }

  function removeSpawnRuntimeForTarget(target) {
    if (!target || !Array.isArray(spawnPoints)) return;
    const spawnRef = target.userData?.spawnPointRef || null;
    const spawnId = readSpawnRuntimeId(target);
    for (let i = spawnPoints.length - 1; i >= 0; i -= 1) {
      const ref = spawnPoints[i];
      if (ref === spawnRef || ref?.object3d === target || ref?.target === target || (spawnRef == null && spawnId && ref?.id === spawnId)) {
        spawnPoints.splice(i, 1);
      }
    }
    delete target.userData.spawnPointRef;
  }

  function refreshSpawnRefs() {
    if (!Array.isArray(spawnPoints)) return;
    spawnPoints.slice().forEach((point) => {
      if (point?.object3d) updateSpawnRuntimeForTarget(point.object3d);
    });
  }

  function updateColliderForTarget(target) {
    updateSpawnRuntimeForTarget(target);
    updatePortalRuntimeForTarget(target);
    const ref = target?.userData?.colliderRef;
    if (!ref) return;
    if (ref.type === "compound" && typeof ref.update === "function") {
      ref.update();
      return;
    }
    const pos = target.position;
    if (ref.type === "box" && ref.box) {
      const half = resolveHalfExtents(ref);
      ref.box.min.set(pos.x - half.x, pos.y - half.y, pos.z - half.z);
      ref.box.max.set(pos.x + half.x, pos.y + half.y, pos.z + half.z);
    } else if (ref.type === "sphere" && ref.center) {
      ref.center.copy(pos);
    } else if (ref.type === "cylinder") {
      ref.center = pos.clone();
    }
  }

  function onTranslatePointerMove(e) {
    if (!translateState?.dragging || !translateState.activeHandle) return;
    const axis = translateState.activeHandle.userData.axis;
    let dx = 0, dy = 0;
    if (Number.isFinite(e.movementX) && Number.isFinite(e.movementY)) {
      dx = e.movementX;
      dy = e.movementY;
    } else if (translateState.lastPointerPos) {
      dx = e.clientX - translateState.lastPointerPos.x;
      dy = e.clientY - translateState.lastPointerPos.y;
    }
    translateState.lastPointerPos = { x: e.clientX, y: e.clientY };
    const delta = (-(dy || 0) + (dx || 0)) * 0.02;
    const target = translateState.target;
    if (!target) {
      disposeTranslateState();
      return;
    }
    target.position.addScaledVector(axis, delta);
    updateColliderForTarget(target);
    e.preventDefault();
    e.stopPropagation();
  }

  function onTranslatePointerUp(e) {
    if (!translateState) return;
    if (e.button !== 0) return;
    translateState.dragging = false;
    translateState.activeHandle = null;
  }

  function createRotateGizmo(target) {
    const group = new THREE.Group();
    const arrowMap = ensurePositionArrowTexture();
    const handleMat = new THREE.SpriteMaterial({
      map: arrowMap,
      color: 0xb972ff,
      depthTest: true,
      depthWrite: false,
      transparent: true
    });
    const handles = [];

    const axes = [
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, 0, 1)
    ];

    function makeHandle(axis) {
      const sprite = new THREE.Sprite(handleMat.clone());
      sprite.userData.axis = axis.clone();
      sprite.position.copy(axis).multiplyScalar(1.1);
      sprite.scale.set(0.32, 0.32, 0.32);
      sprite.lookAt(axis.clone().multiplyScalar(2));
      group.add(sprite);
      handles.push(sprite);
    }

    axes.forEach(makeHandle);

    target.add(group);
    rotateState = {
      target,
      group,
      handles,
      dragging: false,
      activeHandle: null,
      selectedHandle: null,
      activeAxis: null,
      lastPointerPos: null
    };

    if (!hoverListenerAttached) {
      window.addEventListener("pointermove", onPointerHover, true);
      window.addEventListener("mousemove", onPointerHover, true);
      hoverListenerAttached = true;
    }

    window.addEventListener("pointerdown", onRotatePointerDown, true);
    window.addEventListener("pointermove", onRotatePointerMove, true);
    window.addEventListener("mousemove", onRotatePointerMove, true);
    window.addEventListener("pointerup", onRotatePointerUp, true);
  }

  function pickRotateHandle(evt) {
    if (!rotateState?.handles?.length) return null;
    raycaster.setFromCamera(getPointerNdc(evt), camera);
    const hits = raycaster.intersectObjects(rotateState.handles, false);
    return hits[0]?.object || null;
  }

  function onRotatePointerDown(e) {
    // Allow either mouse button to select an axis, but still require rotate gizmo to be active.
    if (!rotateState) return;
    const handle = pickRotateHandle(e);
    if (!handle) return;
    rotateState.activeHandle = handle;
    rotateState.selectedHandle = handle;
    rotateState.activeAxis = handle.userData.axis?.clone?.() || null;
    rotateState.startQuat = rotateState.target?.quaternion?.clone?.() || null;
    rotateState.dragging = true;
    rotateState.lastPointerPos = { x: e.clientX, y: e.clientY };
    updateRotateHandleVisuals();
    movementState.skipClickFrame = true;
    e.preventDefault();
    e.stopPropagation();
  }

  function onRotatePointerMove(e) {
    if (!rotateState?.dragging || !rotateState.activeAxis || !rotateState.target) return;
    let dx = 0, dy = 0;
    if (Number.isFinite(e.movementX) && Number.isFinite(e.movementY)) {
      dx = e.movementX;
      dy = e.movementY;
    } else if (rotateState.lastPointerPos) {
      dx = e.clientX - rotateState.lastPointerPos.x;
      dy = e.clientY - rotateState.lastPointerPos.y;
    }
    rotateState.lastPointerPos = { x: e.clientX, y: e.clientY };
    const delta = (-(dy || 0) + (dx || 0)) * 0.005;
    rotateState.target.rotateOnAxis(rotateState.activeAxis, delta);
    updateColliderForTarget(rotateState.target);
    e.preventDefault();
    e.stopPropagation();
  }

  function onRotatePointerUp(e) {
    if (!rotateState) return;
    rotateState.dragging = false;
    rotateState.activeHandle = null;
    rotateState.lastPointerPos = null;
  }

  function finalizeConsolePlacement(hit, config, snapToGrid) {
    if (!hit) return false;
    const placement = buildConsoleMeshFromConfig(config);
    if (!placement) return false;
    const normal = (hit.face?.normal?.clone?.() || raycastDirection.set(0, 1, 0)).clone();
    const hitObject = hit.object;
    if (hitObject?.matrixWorld) {
      normal.transformDirection(hitObject.matrixWorld).normalize();
    }
    const placePos = computePlacePosition(hit, normal, placement.collider, { snapToGrid });

    if (placement.collider && intersectsPlayer(placePos, placement.collider)) return false;
    if (placement.collider && intersectsExistingColliders(placePos, placement.collider)) return false;

    const mesh = placement.mesh;
    mesh.position.copy(placePos);
    mesh.userData.isSolid = Boolean(placement.collider);
    mesh.userData.breakable = true;
    mesh.userData.placedByPlayer = true;
    scene.add(mesh);
    objects.push(mesh);

    if (mesh.userData?.objectFilePath) {
      console.debug("[MovementUpdate] queued object-file geometry for", mesh.userData.objectFilePath);
      void (async () => {
        const applier = await ensureObjectFileGeometryApplier();
        if (applier) {
          await applier(mesh);
        }
      })();
    }

    if (placement.collider?.type === "box") {
      const half = placement.collider.half;
      const colliderRef = {
        type: "box",
        half: half.clone?.() || half,
        box: new THREE.Box3(
          new THREE.Vector3(placePos.x - half.x, placePos.y - half.y, placePos.z - half.z),
          new THREE.Vector3(placePos.x + half.x, placePos.y + half.y, placePos.z + half.z)
        )
      };
      colliders.push(colliderRef);
      mesh.userData.colliderRef = colliderRef;
      mesh.userData.objectFileColliderFactory?.(colliderRef);
    }

    const inventory = window.VRWorldContext?.inventory;

    if (consolePanels?.hasPendingPlacement?.()) {
      const pendingHit = getPlacementHit();
      consolePanels.updatePlacementTarget?.(pendingHit);
    }
    inventory?.consumeSelected?.(1);
    return true;
  }

  function showNoTroubleSplash() {
    if (!noTroubleSplash) {
      noTroubleSplash = document.createElement("div");
      Object.assign(noTroubleSplash.style, {
        position: "fixed",
        left: "50%",
        top: "22%",
        transform: "translate(-50%, -50%)",
        padding: "12px 18px",
        borderRadius: "8px",
        border: "1px solid rgba(190, 220, 245, 0.95)",
        background: "rgba(10, 18, 30, 0.9)",
        color: "#f4fbff",
        font: "700 16px/1.2 serif",
        textAlign: "center",
        zIndex: "24000",
        pointerEvents: "none",
        opacity: "0",
        transition: "opacity 120ms ease-in-out"
      });
      document.body.appendChild(noTroubleSplash);
    }
    noTroubleSplash.textContent = "You find no trouble here.";
    noTroubleSplash.style.opacity = "1";
    if (noTroubleTimer) window.clearTimeout(noTroubleTimer);
    noTroubleTimer = window.setTimeout(() => {
      if (noTroubleSplash) noTroubleSplash.style.opacity = "0";
      noTroubleTimer = 0;
    }, 1700);
  }

  function playerMode() {
    const mode = String(movementState?.playerMode || "survival").toLowerCase();
    return mode === "creative" ? "creative" : "survival";
  }

  function canUseAbility(abilityKey) {
    if (playerMode() === "creative") return true;
    return movementState?.worldRules?.[abilityKey] === true;
  }

  function normalizeSkillKey(value) {
    return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
  }

  function readSkillLevelValue(value) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
    if (value && typeof value === "object") {
      const direct = [value.level, value.value, value.rank, value.skillLevel].map(Number).find(Number.isFinite);
      if (Number.isFinite(direct)) return direct;
      return 1;
    }
    return 0;
  }

  function skillNameMatches(entry, skillKeys) {
    const keys = Array.isArray(skillKeys) ? skillKeys.map(normalizeSkillKey) : [normalizeSkillKey(skillKeys)];
    const names = [entry?.id, entry?.name, entry?.skill, entry?.label, entry?.type].map(normalizeSkillKey);
    return names.some((name) => name && keys.includes(name));
  }

  function readSkillLevelFromSource(source, skillKeys) {
    if (!source) return 0;
    const keys = Array.isArray(skillKeys) ? skillKeys.map(normalizeSkillKey) : [normalizeSkillKey(skillKeys)];
    if (Array.isArray(source)) {
      for (const entry of source) {
        if (skillNameMatches(entry, keys)) return readSkillLevelValue(entry);
      }
      return 0;
    }
    if (typeof source === "object") {
      for (const key of keys) {
        const direct = source[key] ?? source[key.toLowerCase()];
        const level = readSkillLevelValue(direct);
        if (level > 0) return level;
      }
      for (const [name, entry] of Object.entries(source)) {
        if (keys.includes(normalizeSkillKey(name))) return readSkillLevelValue(entry);
        if (entry && typeof entry === "object" && skillNameMatches(entry, keys)) return readSkillLevelValue(entry);
      }
    }
    return 0;
  }

  function collectPlayerSkillSources() {
    const ctx = window.VRWorldContext || {};
    const worldDef = ctx.currentWorldDefinition || {};
    const metadata = worldDef.metadata || {};
    const playerCharacter = movementState.playerCharacter || ctx.playerCharacter || ctx.currentCharacter || metadata.playerCharacter || worldDef.playerCharacter || worldDef.character || {};
    return [
      movementState.playerSkills,
      movementState.skills,
      ctx.playerSkills,
      ctx.skills,
      playerCharacter.skills,
      playerCharacter.character?.skills,
      metadata.playerSkills,
      worldDef.playerSkills
    ];
  }

  function readPlayerSkillLevel(skillKeys) {
    for (const source of collectPlayerSkillSources()) {
      const level = readSkillLevelFromSource(source, skillKeys);
      if (level > 0) return level;
    }
    return 0;
  }

  function readRunSkillLevel() {
    if (playerMode() === "creative") {
      const editorLevel = Number(movementState.editorRunSkillLevel);
      return Number.isFinite(editorLevel) ? Math.max(1, editorLevel) : 5;
    }
    return readPlayerSkillLevel(["run", "running"]);
  }

  function runSpeedMultiplier(inputState, { crouching = false, crawling = false } = {}) {
    const moving = inputState?.moveForward || inputState?.moveBackward || inputState?.moveLeft || inputState?.moveRight;
    if (!inputState?.run || !moving || crouching || crawling) {
      movementState.isRunning = false;
      movementState.activeRunSkillLevel = 0;
      return 1;
    }
    const level = readRunSkillLevel();
    if (level <= 0) {
      movementState.isRunning = false;
      movementState.activeRunSkillLevel = 0;
      return 1;
    }
    movementState.isRunning = true;
    movementState.activeRunSkillLevel = level;
    return Math.max(1, Math.min(4, 1 + level / 10));
  }

  function getSelectedInventoryItem() {
    return window.VRWorldContext?.inventory?.getSelectedItem?.() || null;
  }

  function getSelectedItemId(item = getSelectedInventoryItem()) {
    return String(item?.id || "").trim().toLowerCase();
  }

  function handleSelectedItemAction(actionName, context = {}) {
    const actionMap = selectedItemActions.get(getSelectedItemId());
    const handler = actionMap && actionMap[actionName];
    if (typeof handler !== "function") return false;
    return handler(context) !== false;
  }

  function finiteFlyingCarpetSize(value, fallback, minimum = 0.02) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(minimum, Math.abs(n)) : fallback;
  }

  function readFlyingCarpetSize(mesh = null) {
    const config = mesh?.userData?.flyingCarpet && typeof mesh.userData.flyingCarpet === "object" ? mesh.userData.flyingCarpet : {};
    const configSize = Array.isArray(config.size) ? config.size : null;
    const params = mesh?.geometry?.parameters || {};
    const sx = Math.abs(mesh?.scale?.x || 1);
    const sy = Math.abs(mesh?.scale?.y || 1);
    const sz = Math.abs(mesh?.scale?.z || 1);
    const geometryWidth = Number(params.width);
    const geometryHeight = Number(params.height);
    const geometryDepth = Number(params.depth);
    const baseWidth = Number.isFinite(geometryWidth) ? geometryWidth : (configSize?.[0] ?? config.width ?? FLYING_CARPET_WIDTH);
    const baseHeight = Number.isFinite(geometryHeight) ? geometryHeight : (configSize?.[1] ?? config.height ?? FLYING_CARPET_HEIGHT);
    const baseDepth = Number.isFinite(geometryDepth) ? geometryDepth : (configSize?.[2] ?? config.depth ?? FLYING_CARPET_DEPTH);
    return {
      width: finiteFlyingCarpetSize(baseWidth * sx, FLYING_CARPET_WIDTH, 0.2),
      height: finiteFlyingCarpetSize(baseHeight * sy, FLYING_CARPET_HEIGHT, 0.02),
      depth: finiteFlyingCarpetSize(baseDepth * sz, FLYING_CARPET_DEPTH, 0.2)
    };
  }

  function readFlyingCarpetHalfExtents(mesh = null) {
    const size = readFlyingCarpetSize(mesh);
    return new THREE.Vector3(size.width / 2, size.height / 2, size.depth / 2);
  }

  function isFlyingCarpetObject(target) {
    const data = target?.userData || {};
    const type = String(data.nvType || data.vehicleType || "").toLowerCase();
    return target?.isMesh && (type === FLYING_CARPET_ITEM_ID || data.flyingCarpet);
  }

  function ensureFlyingCarpetRuntime(mesh) {
    if (!mesh?.isMesh) return null;
    const previous = mesh.userData?.flyingCarpet && typeof mesh.userData.flyingCarpet === "object" ? mesh.userData.flyingCarpet : {};
    const size = readFlyingCarpetSize(mesh);
    const speedMultiplier = Number(previous.speedMultiplier);
    const verticalSpeedMultiplier = Number(previous.verticalSpeedMultiplier);
    const riderSurfaceOffset = Number(previous.riderSurfaceOffset);
    mesh.userData.nvType = FLYING_CARPET_ITEM_ID;
    mesh.userData.isVehicle = true;
    mesh.userData.vehicleType = FLYING_CARPET_ITEM_ID;
    mesh.userData.mountable = true;
    mesh.userData.flyingCarpet = {
      ...previous,
      size: [size.width, size.height, size.depth],
      speedMultiplier: Number.isFinite(speedMultiplier) ? speedMultiplier : FLYING_CARPET_SPEED_MULTIPLIER,
      verticalSpeedMultiplier: Number.isFinite(verticalSpeedMultiplier) ? verticalSpeedMultiplier : FLYING_CARPET_VERTICAL_SPEED_MULTIPLIER,
      riderSurfaceOffset: Number.isFinite(riderSurfaceOffset) ? Math.max(0, riderSurfaceOffset) : 0.03
    };
    return mesh.userData.flyingCarpet;
  }

  function createFlyingCarpetMesh(size = []) {
    const width = finiteFlyingCarpetSize(size?.[0], FLYING_CARPET_WIDTH, 0.2);
    const height = finiteFlyingCarpetSize(size?.[1], FLYING_CARPET_HEIGHT, 0.02);
    const depth = finiteFlyingCarpetSize(size?.[2], FLYING_CARPET_DEPTH, 0.2);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      new THREE.MeshStandardMaterial({
        color: FLYING_CARPET_COLOR,
        emissive: FLYING_CARPET_EMISSIVE,
        emissiveIntensity: 0.2,
        roughness: 0.78,
        metalness: 0.03
      })
    );
    ensureFlyingCarpetRuntime(mesh);
    return mesh;
  }

  function flyingCarpetBox(mesh) {
    if (!mesh) return null;
    const colliderRef = mesh.userData?.colliderRef || null;
    if (colliderRef?.type === "box" && colliderRef.box) {
      updateColliderForTarget(mesh);
      return colliderRef.box;
    }
    mesh.updateWorldMatrix?.(true, false);
    const box = new THREE.Box3().setFromObject(mesh);
    return box.isEmpty?.() ? null : box;
  }

  function findBoardableFlyingCarpet(position) {
    if (!position || !Array.isArray(objects)) return null;
    const footY = position.y - movementState.playerHeight;
    const yTolerance = Math.max(0.38, Math.abs(Number(movementState.velocityY) || 0) + 0.18);
    let best = null;
    let bestDistanceSq = Infinity;
    for (const object of objects) {
      if (!isFlyingCarpetObject(object) || object.visible === false) continue;
      ensureFlyingCarpetRuntime(object);
      const box = flyingCarpetBox(object);
      if (!box) continue;
      const standingOnTop = footY >= box.max.y - 0.16 && footY <= box.max.y + yTolerance;
      const withinX = position.x >= box.min.x - 0.04 && position.x <= box.max.x + 0.04;
      const withinZ = position.z >= box.min.z - 0.04 && position.z <= box.max.z + 0.04;
      if (!standingOnTop || !withinX || !withinZ) continue;
      const dx = position.x - object.position.x;
      const dz = position.z - object.position.z;
      const distanceSq = dx * dx + dz * dz;
      if (distanceSq < bestDistanceSq) {
        best = object;
        bestDistanceSq = distanceSq;
      }
    }
    return best;
  }

  function clampOffset(value, limit) {
    return Math.max(-limit, Math.min(limit, value));
  }

  function alignPlayerToFlyingCarpet(mount) {
    const carpet = mount?.object;
    if (!carpet) return;
    const player = controls.getObject();
    const half = readFlyingCarpetHalfExtents(carpet);
    const config = ensureFlyingCarpetRuntime(carpet) || {};
    const offset = mount.riderLocalOffset || new THREE.Vector3(0, 0, 0);
    const limitX = Math.max(0, half.x - playerRadius * 0.35);
    const limitZ = Math.max(0, half.z - playerRadius * 0.35);
    player.position.x = carpet.position.x + clampOffset(Number(offset.x) || 0, limitX);
    player.position.z = carpet.position.z + clampOffset(Number(offset.z) || 0, limitZ);
    player.position.y = carpet.position.y + half.y + movementState.playerHeight + (Number(config.riderSurfaceOffset) || 0);
  }

  function dismountMountedVehicle({ showStatus = true } = {}) {
    const mount = movementState.mountedVehicle || null;
    if (!mount) return false;
    if (mount.object?.userData) mount.object.userData.vehicleMounted = false;
    movementState.mountedVehicle = null;
    movementState.isMounted = false;
    movementState.activeVehicleType = "";
    movementState.velocityY = 0;
    movementState.isGrounded = true;
    if (showStatus) setStatus("Stepped off flying carpet.");
    return true;
  }

  function getActiveMountedVehicle() {
    const mount = movementState.mountedVehicle || null;
    if (!mount) {
      movementState.isMounted = false;
      movementState.activeVehicleType = "";
      return null;
    }
    const object = mount.object || null;
    if (!object || !object.parent || object.visible === false || !isFlyingCarpetObject(object)) {
      dismountMountedVehicle({ showStatus: false });
      return null;
    }
    ensureFlyingCarpetRuntime(object);
    movementState.isMounted = true;
    movementState.activeVehicleType = mount.type || FLYING_CARPET_ITEM_ID;
    return mount;
  }

  function boardFlyingCarpet(carpet) {
    if (!isFlyingCarpetObject(carpet)) return false;
    if (movementState.mountedVehicle?.object === carpet) return true;
    if (movementState.mountedVehicle) dismountMountedVehicle({ showStatus: false });
    const config = ensureFlyingCarpetRuntime(carpet) || {};
    const player = controls.getObject();
    const half = readFlyingCarpetHalfExtents(carpet);
    const offset = new THREE.Vector3(player.position.x - carpet.position.x, 0, player.position.z - carpet.position.z);
    offset.x = clampOffset(offset.x, Math.max(0, half.x - playerRadius * 0.35));
    offset.z = clampOffset(offset.z, Math.max(0, half.z - playerRadius * 0.35));
    carpet.userData.vehicleMounted = true;
    movementState.mountedVehicle = {
      type: FLYING_CARPET_ITEM_ID,
      object: carpet,
      riderLocalOffset: offset,
      riderSurfaceOffset: Number(config.riderSurfaceOffset) || 0.03
    };
    movementState.isMounted = true;
    movementState.activeVehicleType = FLYING_CARPET_ITEM_ID;
    movementState.isFlying = false;
    movementState.velocityY = 0;
    movementState.isGrounded = false;
    alignPlayerToFlyingCarpet(movementState.mountedVehicle);
    setStatus("Boarded flying carpet. Use movement, ascend, and descend controls to fly.");
    return true;
  }

  function tryUseFlyingCarpet() {
    if (movementState.worldMode === "2d") return false;
    if (getActiveMountedVehicle()) return dismountMountedVehicle();
    const carpet = findBoardableFlyingCarpet(controls.getObject().position);
    return carpet ? boardFlyingCarpet(carpet) : false;
  }

  function updateMountedFlyingCarpet(mount, inputState, speed) {
    const carpet = mount?.object || null;
    if (!isFlyingCarpetObject(carpet)) return false;
    const config = ensureFlyingCarpetRuntime(carpet) || {};
    const half = readFlyingCarpetHalfExtents(carpet);
    const player = controls.getObject();
    const moveSpeed = speed * (Number.isFinite(Number(config.speedMultiplier)) ? Number(config.speedMultiplier) : FLYING_CARPET_SPEED_MULTIPLIER);
    const verticalSpeed = speed * (Number.isFinite(Number(config.verticalSpeedMultiplier)) ? Number(config.verticalSpeedMultiplier) : FLYING_CARPET_VERTICAL_SPEED_MULTIPLIER);
    const delta = new THREE.Vector3();
    controls.getDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() < 1e-8) forward.set(0, 0, -1);
    forward.normalize();
    right.crossVectors(forward, up);
    if (right.lengthSq() < 1e-8) right.set(1, 0, 0);
    right.normalize();
    if (inputState.moveForward) delta.add(forward);
    if (inputState.moveBackward) delta.sub(forward);
    if (inputState.moveRight) delta.add(right);
    if (inputState.moveLeft) delta.sub(right);
    if (delta.lengthSq() > 0) delta.normalize().multiplyScalar(moveSpeed);
    if (inputState.flyUp) delta.y += verticalSpeed;
    if (inputState.flyDown) delta.y -= verticalSpeed;

    if (delta.lengthSq() > 0) {
      const nextCarpetPosition = carpet.position.clone().add(delta);
      if (nextCarpetPosition.y < half.y) nextCarpetPosition.y = half.y;
      const actualDelta = nextCarpetPosition.clone().sub(carpet.position);
      const nextPlayerPosition = player.position.clone().add(actualDelta);
      nextPlayerPosition.y = nextCarpetPosition.y + half.y + movementState.playerHeight + (Number(config.riderSurfaceOffset) || 0);
      const ignoreCollider = carpet.userData?.colliderRef || null;
      const carpetShape = { type: "box", half };
      if (!wouldCollide(nextPlayerPosition, { ignoreCollider }) && !intersectsExistingColliders(nextCarpetPosition, carpetShape, { ignoreCollider })) {
        carpet.position.copy(nextCarpetPosition);
        updateColliderForTarget(carpet);
      }
    }

    movementState.velocityY = 0;
    movementState.isGrounded = false;
    movementState.isFlying = false;
    alignPlayerToFlyingCarpet(mount);
    return true;
  }

  function updateSoundObjectRuntimes(listenerPosition) {
    if (!Array.isArray(objects)) return;
    objects.forEach((object) => {
      object?.userData?.updateSoundObjectRuntime?.(listenerPosition);
    });
  }

  function normalizeVoxelSize(value, fallback = DEFAULT_VOXEL_PLACER_CONFIG.size) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.max(0.05, Math.min(20, numeric));
  }

  function isHexDigitChar(ch) {
    return "0123456789abcdefABCDEF".includes(ch);
  }

  function normalizeVoxelColor(value, fallback = DEFAULT_VOXEL_PLACER_CONFIG.color) {
    const text = typeof value === "string" ? value.trim() : "";
    if ((text.length === 4 || text.length === 7) && text[0] === "#") {
      let ok = true;
      for (let i = 1; i < text.length; i += 1) {
        if (!isHexDigitChar(text[i])) ok = false;
      }
      if (ok) return text;
    }
    return fallback;
  }

  function ensureVoxelPlacerConfig() {
    const existing = movementState.voxelPlacerConfig && typeof movementState.voxelPlacerConfig === "object"
      ? movementState.voxelPlacerConfig
      : {};
    const materialId = String(existing.materialId || DEFAULT_VOXEL_PLACER_CONFIG.materialId).trim() || DEFAULT_VOXEL_PLACER_CONFIG.materialId;
    const config = {
      size: normalizeVoxelSize(existing.size),
      materialId,
      materialFile: String(existing.materialFile || materialFileForWorldObjectMaterial(materialId) || DEFAULT_VOXEL_PLACER_CONFIG.materialFile),
      materialName: typeof existing.materialName === "string" ? existing.materialName : "",
      matterState: typeof existing.matterState === "string" ? existing.matterState : "",
      color: normalizeVoxelColor(existing.color),
      collider: existing.collider !== false
    };
    movementState.voxelPlacerConfig = config;
    return config;
  }

  function ensureVoxelMaterialCatalog() {
    if (!voxelMaterialCatalogPromise) {
      voxelMaterialCatalogPromise = loadWorldObjectMaterialCatalog()
        .catch((err) => {
          console.warn("Voxel material catalog failed to load:", err);
          return [];
        });
    }
    return voxelMaterialCatalogPromise;
  }

  function findVoxelMaterialEntry(materialId, catalog = []) {
    const key = String(materialId || "").trim().toLowerCase();
    return (Array.isArray(catalog) ? catalog : []).find((entry) => String(entry?.materialId || "").trim().toLowerCase() === key) || null;
  }

  function voxelColorFromMaterialEntry(entry, fallback = DEFAULT_VOXEL_PLACER_CONFIG.color) {
    return normalizeVoxelColor(entry?.color || entry?.materialDefinition?.defaultColor || entry?.materialDefinition?.rendering?.color, fallback);
  }

  function applyVoxelMaterialEntry(config, entry, { updateColor = false } = {}) {
    if (!entry) return config;
    config.materialId = String(entry.materialId || config.materialId || DEFAULT_VOXEL_PLACER_CONFIG.materialId);
    config.materialFile = String(entry.materialFile || materialFileForWorldObjectMaterial(config.materialId) || "");
    config.materialName = String(entry.displayName || entry.materialName || config.materialId || "");
    config.matterState = String(entry.matterState || entry.MatterState || config.matterState || "");
    if (updateColor) config.color = voxelColorFromMaterialEntry(entry, config.color);
    return config;
  }

  const bounceMaterialsByKey = new Map();

  function materialLookupKey(value) {
    return typeof value === "string" && value.trim() ? value.trim().toLowerCase() : "";
  }

  function readBounceNumber(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function materialBounceConfigFromEntry(entry = {}) {
    const def = entry.materialDefinition && typeof entry.materialDefinition === "object" ? entry.materialDefinition : entry;
    const colliderDef = def.collider && typeof def.collider === "object" ? def.collider : {};
    const playerBounce = colliderDef.playerBounce && typeof colliderDef.playerBounce === "object"
      ? colliderDef.playerBounce
      : (def.playerBounce && typeof def.playerBounce === "object" ? def.playerBounce : {});
    const restitution = readBounceNumber(playerBounce.restitution, readBounceNumber(colliderDef.restitution, 0));
    const enabled = playerBounce.enabled === true || restitution > 0;
    if (!enabled || restitution <= 0) return null;
    return {
      materialId: entry.materialId || def.id || entry.materialName || "",
      materialName: def.displayName || entry.displayName || entry.materialName || entry.materialId || "",
      restitution,
      damping: readBounceNumber(playerBounce.damping, 1),
      minIncomingSpeed: readBounceNumber(playerBounce.minIncomingSpeed, 0.08),
      minBounceSpeed: readBounceNumber(playerBounce.minBounceSpeed, 0),
      maxBounceSpeed: readBounceNumber(playerBounce.maxBounceSpeed, Infinity)
    };
  }

  function cacheBounceMaterial(entry = {}) {
    const config = materialBounceConfigFromEntry(entry);
    if (!config) return;
    [
      entry.materialId,
      entry.materialName,
      entry.displayName,
      entry.materialFile,
      entry.materialJSONfile,
      entry.materialDefinition?.id,
      entry.materialDefinition?.displayName
    ].forEach((key) => {
      const lookup = materialLookupKey(key);
      if (lookup) bounceMaterialsByKey.set(lookup, config);
    });
  }

  function refreshBounceMaterialCatalog(catalog = []) {
    bounceMaterialsByKey.clear();
    (Array.isArray(catalog) ? catalog : []).forEach(cacheBounceMaterial);
  }

  function bounceConfigForCollider(collider = null, context = {}) {
    if (collider?.box && context?.groundContact !== true) {
      const footY = Number(context.playerFootY);
      const topY = Number(collider.box.max?.y);
      const contactTolerance = Math.max(0.35, Math.abs(Number(context.incomingVelocityY) || 0) + 0.2);
      if (Number.isFinite(footY) && Number.isFinite(topY) && (footY < topY - 0.08 || footY > topY + contactTolerance)) return null;
    }
    const candidates = [
      collider?.materialId,
      collider?.physicsMaterialId,
      collider?.target?.userData?.physicsMaterialId,
      collider?.target?.userData?.physicsMaterialFile,
      collider?.target?.userData?.materialName,
      collider?.target?.userData?.terrain?.physicsMaterialId,
      collider?.target?.userData?.terrain?.physicsMaterialFile,
      collider?.target?.userData?.terrain?.materialName
    ];
    for (const candidate of candidates) {
      const config = bounceMaterialsByKey.get(materialLookupKey(candidate));
      if (config) return config;
    }
    return null;
  }

  void loadWorldObjectMaterialCatalog()
    .then(refreshBounceMaterialCatalog)
    .catch((err) => {
      console.warn("Bouncy material catalog failed to load:", err);
    });

  movementState.playerHeight = basePlayerHeight;
  const wouldCollide = createCollisionChecker({ colliders, movementState, playerRadius });

  function sampleExpressionTerrainGroundLevel(position, fallbackGroundLevel = groundLevel) {
    let best = fallbackGroundLevel;
    let bestColliderId = null;
    let bestCollider = null;
    if (!Array.isArray(colliders) || !position) {
      movementState.pendingExpressionTerrainColliderId = null;
      movementState.pendingGroundCollider = null;
      return best;
    }

    const footY = position.y - movementState.playerHeight;
    const snapDistance = Number.isFinite(movementState.groundSnapDistance) ? movementState.groundSnapDistance : 0.55;
    const maxStepUp = Math.max(stepHeight, snapDistance) + 0.05;
    const activeColliderId = movementState.isGrounded === true
      ? movementState.activeExpressionTerrainColliderId
      : null;
    const offsets = [
      [0, 0],
      [playerRadius * 0.65, 0],
      [-playerRadius * 0.65, 0],
      [0, playerRadius * 0.65],
      [0, -playerRadius * 0.65]
    ];

    for (const collider of colliders) {
      if (collider?.type !== "expression-heightfield" || typeof collider.sampleGroundY !== "function") continue;
      const colliderId = collider.layerId || collider.target?.uuid || "expression-heightfield";
      const isActiveSurface = activeColliderId && activeColliderId === colliderId;
      for (const [dx, dz] of offsets) {
        const y = collider.sampleGroundY(position.x + dx, position.z + dz);
        const canStepOnto = Number.isFinite(y) && y <= footY + maxStepUp;
        if ((canStepOnto || isActiveSurface) && Number.isFinite(y) && y > best) {
          best = y;
          bestColliderId = colliderId;
          bestCollider = collider;
        }
      }
    }

    movementState.pendingExpressionTerrainColliderId = bestColliderId;
    movementState.pendingGroundCollider = bestCollider;
    return best;
  }

  function getPrimaryGamepad() {
    if (typeof navigator === "undefined" || typeof navigator.getGamepads !== "function") return null;
    const pads = navigator.getGamepads();
    if (!pads) return null;
    for (const pad of pads) {
      if (pad && pad.connected) return pad;
    }
    return null;
  }

  function readGamepadBinding(gp, binding) {
    if (!gp || !binding || typeof binding.index !== "number") return 0;
    if (binding.type === "button") {
      return gp.buttons?.[binding.index]?.pressed ? 1 : 0;
    }
    if (binding.type === "axis") {
      const raw = Number(gp.axes?.[binding.index] ?? 0);
      if (!Number.isFinite(raw)) return 0;
      if (binding.direction === "+") return raw > gamepadDeadZone ? raw : 0;
      if (binding.direction === "-") return raw < -gamepadDeadZone ? -raw : 0;
      return Math.abs(raw) > gamepadDeadZone ? raw : 0;
    }
    return 0;
  }

  function buildInputState(bindings) {
    const gp = getPrimaryGamepad();
    const gpBindings = bindings?.gamepad || {};
    const rightBumperPressed = !!gp?.buttons?.[5]?.pressed;

    const shortcutModifierHeld = heldKeys.control === true || heldKeys.meta === true;
    const saveShortcutHeld = heldKeys.saveShortcutActive === true;

    const forward = readGamepadBinding(gp, gpBindings.moveForward);
    const backward = readGamepadBinding(gp, gpBindings.moveBackward);
    const left = readGamepadBinding(gp, gpBindings.moveLeft);
    const rightward = readGamepadBinding(gp, gpBindings.moveRight);

    const moveForward = heldKeys[bindings.moveForward] || forward > 0;
    const moveBackward = !saveShortcutHeld && (heldKeys[bindings.moveBackward] || backward > 0);
    const moveLeft = heldKeys[bindings.moveLeft] || left > 0;
    const moveRight = heldKeys[bindings.moveRight] || rightward > 0;

    const jump = heldKeys[bindings.jump] || readGamepadBinding(gp, gpBindings.jump) > 0;
    const crouch = heldKeys[bindings.crouch];
    const crawl = heldKeys[bindings.crawl];
    const useBinding = String(bindings.use || "").toLowerCase();
    const useBindingIsMouse0 = useBinding === "mouse0";
    const use = (!useBindingIsMouse0 && heldKeys[bindings.use]) || heldKeys.r || readGamepadBinding(gp, gpBindings.use) > 0 || rightBumperPressed; // place
    const grab = heldKeys.mouse0; // left click (translate select / grab on double)
    const stretch = heldKeys.g || (heldKeys.shift && heldKeys.s); // scale/stretch toggle
    const rotate = heldKeys.mouse2; // right click
    const attackBinding = String(bindings.attack || "").toLowerCase();
    const attackIsMouse = attackBinding === "mouse2" || attackBinding === "mouse1" || attackBinding === "mouse0";
    const attack = (!attackIsMouse && heldKeys[bindings.attack]) || heldKeys.t || readGamepadBinding(gp, gpBindings.attack) > 0; // destroy
    const inspectKey = String(bindings.inspect || "").toLowerCase();
    const inspect = heldKeys[inspectKey] || heldKeys.y || readGamepadBinding(gp, gpBindings.inspect) > 0;
    const snapPlace = !!heldKeys.shift && !!(heldKeys.r || heldKeys[bindings.use]);
    const fly = heldKeys[bindings.fly] || readGamepadBinding(gp, gpBindings.fly) > 0;
    const flyUp = heldKeys[bindings.flyUp] || jump;
    const flyDown = heldKeys[bindings.flyDown];
    const phase = heldKeys[bindings.phase] || heldKeys.v;
    const runKey = String(bindings.run || "e").toLowerCase();
    const run = heldKeys[runKey] || heldKeys.e || readGamepadBinding(gp, gpBindings.run) > 0;

    const standUp = heldKeys.standup === true || (shortcutModifierHeld && heldKeys.arrowup === true);
    const rollLeft = heldKeys[bindings.rollLeft];
    const rollRight = heldKeys[bindings.rollRight];
    const pitchUp = !standUp && heldKeys[bindings.pitchUp];
    const pitchDown = heldKeys[bindings.pitchDown];

    const lookYaw = readGamepadBinding(gp, gpBindings.lookYaw);
    const lookPitch = readGamepadBinding(gp, gpBindings.lookPitch);

    const cycleCamera = heldKeys[bindings.cycleCamera] || heldKeys.u || readGamepadBinding(gp, gpBindings.cycleCamera) > 0;
    const pause = heldKeys[bindings.pause] || readGamepadBinding(gp, gpBindings.pause) > 0;
    const openInventory = heldKeys[bindings.openInventory] || readGamepadBinding(gp, gpBindings.openInventory) > 0;
    const inventoryMenuUp = (!standUp && heldKeys.arrowup) || !!gp?.buttons?.[12]?.pressed;
    const inventoryMenuDown = heldKeys.arrowdown || !!gp?.buttons?.[13]?.pressed;
    const inventoryMenuLeft = heldKeys.arrowleft || !!gp?.buttons?.[14]?.pressed;
    const inventoryMenuRight = heldKeys.arrowright || !!gp?.buttons?.[15]?.pressed;
    const inventoryMenuConfirm = heldKeys.enter || readGamepadBinding(gp, gpBindings.jump) > 0;
    let hotbarSlot = null;
    for (let i = 1; i <= 9; i += 1) {
      if (heldKeys[String(i)]) {
        hotbarSlot = i - 1;
        break;
      }
    }
    const handSwitch = heldKeys["-"] || heldKeys.minus;

    return {
      moveForward,
      moveBackward,
      moveLeft,
      moveRight,
      jump,
      crouch,
      crawl,
      use,
      grab,
      stretch,
      rotate,
      snapPlace,
      attack,
      inspect,
      fly,
      flyUp,
      flyDown,
      phase,
      run,
      rollLeft,
      rollRight,
      pitchUp,
      pitchDown,
      standUp,
      lookYaw,
      lookPitch,
      cycleCamera,
      pause,
      openInventory,
      hotbarSlot,
      handSwitch,
      inventoryMenuUp,
      inventoryMenuDown,
      inventoryMenuLeft,
      inventoryMenuRight,
      inventoryMenuConfirm
    };
  }

  function applyStandUpAlignment() {
    camera.up?.set?.(0, 1, 0);
    camera.rotation.set(0, 0, 0);
    camera.updateMatrixWorld?.(true);
    movementState.velocityY = 0;
    movementState.isGrounded = true;
  }

  function applyMouseLikeLookDelta(deltaX, deltaY) {
    if (!Number.isFinite(deltaX) && !Number.isFinite(deltaY)) return;
    const dx = Number.isFinite(deltaX) ? deltaX : 0;
    const dy = Number.isFinite(deltaY) ? deltaY : 0;
    if (dx === 0 && dy === 0) return;

    const pointerSpeed = Number.isFinite(controls.pointerSpeed) ? controls.pointerSpeed : 1;
    const minPolar = Number.isFinite(controls.minPolarAngle) ? controls.minPolarAngle : 0;
    const maxPolar = Number.isFinite(controls.maxPolarAngle) ? controls.maxPolarAngle : Math.PI;

    const lookScale = 0.002 * pointerSpeed;
    mouseLikeEuler.setFromQuaternion(camera.quaternion, "YXZ");
    if (dx !== 0) mouseLikeEuler.y -= dx * lookScale;
    if (dy !== 0) mouseLikeEuler.x -= dy * lookScale;
    mouseLikeEuler.x = Math.max(halfPi - maxPolar, Math.min(halfPi - minPolar, mouseLikeEuler.x));
    camera.quaternion.setFromEuler(mouseLikeEuler);
  }

  function isSameWorldTarget(value) {
    if (typeof value !== "string") return false;
    const normalized = value.trim().toLowerCase();
    return normalized === "self" || normalized === "." || normalized === "same" || normalized === "current";
  }

  function readLinkedPortalId(portal) {
    const value = portal?.linkedPortalId || portal?.portalLinkedPortalId || portal?.targetPortalId || portal?.portalTargetId;
    return typeof value === "string" && value.trim() ? value.trim() : "";
  }

  function findPortalHit(position, nowMs) {
    if (!portals || portals.length === 0) return null;
    const playerMinY = position.y - movementState.playerHeight;
    const playerMaxY = position.y;
    for (const portal of portals) {
      const portalObject = portal?.object3d || null;
      if (portalObject?.visible === false) continue;
      if (portalObject?.updateWorldMatrix) {
        portalObject.updateWorldMatrix(true, false);
        portal.box = new THREE.Box3().setFromObject(portalObject);
      }
      const linkedPortalId = readLinkedPortalId(portal);
      if (!portal?.box || (!portal?.targetWorld && !portal?.sameWorld && !linkedPortalId)) continue;
      if (nowMs - portal.lastTriggeredAt < portal.cooldownMs) continue;
      const minX = portal.box.min.x - playerRadius;
      const maxX = portal.box.max.x + playerRadius;
      const minZ = portal.box.min.z - playerRadius;
      const maxZ = portal.box.max.z + playerRadius;
      const overlapsY = playerMaxY >= portal.box.min.y && playerMinY <= portal.box.max.y;
      if (position.x >= minX && position.x <= maxX && position.z >= minZ && position.z <= maxZ && overlapsY) {
        portal.lastTriggeredAt = nowMs;
        return portal;
      }
    }
    return null;
  }

  function findCollisionActionHit(position, nowMs) {
    if (!collisionActions || collisionActions.length === 0) return null;
    const playerMinY = position.y - movementState.playerHeight;
    const playerMaxY = position.y;
    for (const trigger of collisionActions) {
      const triggerObject = trigger?.object3d || null;
      if (triggerObject?.visible === false) continue;
      if (triggerObject?.updateWorldMatrix) {
        triggerObject.updateWorldMatrix(true, false);
        trigger.box = new THREE.Box3().setFromObject(triggerObject);
      }
      if (!trigger?.box || !trigger?.actions?.length) continue;
      if (nowMs - trigger.lastTriggeredAt < trigger.cooldownMs) continue;
      const minX = trigger.box.min.x - playerRadius;
      const maxX = trigger.box.max.x + playerRadius;
      const minZ = trigger.box.min.z - playerRadius;
      const maxZ = trigger.box.max.z + playerRadius;
      const overlapsY = playerMaxY >= trigger.box.min.y && playerMinY <= trigger.box.max.y;
      if (position.x >= minX && position.x <= maxX && position.z >= minZ && position.z <= maxZ && overlapsY) {
        trigger.lastTriggeredAt = nowMs;
        return trigger;
      }
    }
    return null;
  }

  function findUseTarget(position, nowMs) {
    if (!useTargets || useTargets.length === 0) return null;
    let closest = null;
    let closestDistSq = Infinity;
    for (const target of useTargets) {
      if (!target?.position || !target?.actions?.length) continue;
      if (nowMs - target.lastTriggeredAt < target.cooldownMs) continue;
      const dx = position.x - target.position.x;
      const dy = position.y - target.position.y;
      const dz = position.z - target.position.z;
      const range = Number.isFinite(target.range) ? target.range : 2;
      const distSq = dx * dx + dy * dy + dz * dz;
      if (distSq <= range * range && distSq < closestDistSq) {
        closest = target;
        closestDistSq = distSq;
      }
    }
    if (closest) {
      closest.lastTriggeredAt = nowMs;
    }
    return closest;
  }

  function resolveSpawnChoice(spawnPointId) {
    refreshSpawnRefs();
    if (Array.isArray(spawnPoints) && spawnPoints.length > 0) {
      const requestedId = typeof spawnPointId === "string" ? spawnPointId.trim() : "";
      if (requestedId) {
        const match = spawnPoints.find(point => String(point?.id || "").trim() === requestedId)
          || spawnPoints.find(point => String(point?.id || "").trim().toLowerCase() === requestedId.toLowerCase());
        if (match?.position) return match;
      }
      const fallback = spawnPoints.find(point => point?.position);
      if (fallback?.position) return fallback;
    }
    return { position: [0, movementState.playerHeight || basePlayerHeight, 0], yaw: null };
  }

  function applySpawnChoice(spawnPointId, spawnYaw) {
    const chosen = resolveSpawnChoice(spawnPointId);
    if (Array.isArray(chosen?.position) && chosen.position.length >= 3) {
      controls.getObject().position.set(chosen.position[0], chosen.position[1], chosen.position[2]);
      movementState.velocityY = 0;
      movementState.isGrounded = true;
    }
    const yaw = Number.isFinite(spawnYaw) ? spawnYaw : (Number.isFinite(chosen?.yaw) ? chosen.yaw : null);
    if (Number.isFinite(yaw)) {
      controls.getObject().rotation.y = yaw;
    }
  }

  function findPortalObjectById(portalId) {
    if (typeof portalId !== "string" || !portalId.trim() || !Array.isArray(objects)) return null;
    const id = portalId.trim();
    return objects.find((object) => {
      if (!object?.userData?.isPortal) return false;
      const ref = object.userData.portalRef;
      return object.userData.metaWorldLayerId === id
        || object.userData.tag === id
        || object.name === id
        || ref?.objectId === id;
    }) || null;
  }

  function readPortalExitPosition(targetObject) {
    if (!targetObject) return null;
    const worldPosition = new THREE.Vector3();
    const worldQuaternion = new THREE.Quaternion();
    targetObject.getWorldPosition?.(worldPosition);
    targetObject.getWorldQuaternion?.(worldQuaternion);
    const direction = new THREE.Vector3(0, 0, 1).applyQuaternion(worldQuaternion);
    if (direction.lengthSq() < 1e-6) direction.set(0, 0, 1);
    direction.normalize();
    const exit = worldPosition.addScaledVector(direction, Math.max(playerRadius * 4, 1.25));
    exit.y = Math.max(exit.y + 0.35, movementState.playerHeight || basePlayerHeight);
    return exit;
  }

  function applyPortalExitObject(targetObject, spawnYaw, nowMs = performance.now()) {
    const exit = readPortalExitPosition(targetObject);
    if (!exit) return false;
    controls.getObject().position.copy(exit);
    movementState.velocityY = 0;
    movementState.isGrounded = true;
    if (Number.isFinite(spawnYaw)) {
      controls.getObject().rotation.y = spawnYaw;
    }
    const targetRef = targetObject.userData?.portalRef;
    if (targetRef) {
      targetRef.lastTriggeredAt = nowMs;
      targetObject.updateWorldMatrix?.(true, false);
      targetRef.box = new THREE.Box3().setFromObject(targetObject);
    }
    return true;
  }

  function applyPortalTravel(portalLike, nowMs = performance.now()) {
    if (!portalLike) return false;
    const sameWorld = portalLike.sameWorld === true || isSameWorldTarget(portalLike.targetWorld);
    const targetWorld = sameWorld ? null : portalLike.targetWorld;
    const linkedPortalId = readLinkedPortalId(portalLike);
    const hasSpawn = Array.isArray(portalLike.spawn) && portalLike.spawn.length >= 3;

    if (linkedPortalId) {
      if (sameWorld) {
        const linkedPortal = findPortalObjectById(linkedPortalId);
        if (linkedPortal && applyPortalExitObject(linkedPortal, portalLike.spawnYaw, nowMs)) {
          portalLike.lastTriggeredAt = nowMs;
          return true;
        }
        console.warn("Linked portal target not found:", linkedPortalId);
      } else if (targetWorld && typeof loadWorldFromFile === "function") {
        loadWorldFromFile(targetWorld, {
          portalTargetId: linkedPortalId,
          spawnYaw: Number.isFinite(portalLike.spawnYaw) ? portalLike.spawnYaw : null,
          skipAutoSpawn: false
        });
        return true;
      }
    }

    if (!sameWorld) {
      if (!targetWorld || typeof loadWorldFromFile !== "function") {
        console.warn("Portal action missing targetWorld or loader.", portalLike);
        return false;
      }
      loadWorldFromFile(targetWorld, {
        spawnPoint: typeof portalLike.spawnPoint === "string" ? portalLike.spawnPoint : null,
        spawnYaw: Number.isFinite(portalLike.spawnYaw) ? portalLike.spawnYaw : null,
        skipAutoSpawn: hasSpawn
      });
      return true;
    }

    if (hasSpawn) {
      controls.getObject().position.set(portalLike.spawn[0], portalLike.spawn[1], portalLike.spawn[2]);
      movementState.velocityY = 0;
      movementState.isGrounded = true;
      if (Number.isFinite(portalLike.spawnYaw)) {
        controls.getObject().rotation.y = portalLike.spawnYaw;
      }
      return true;
    }

    if (typeof portalLike.spawnPoint === "string") {
      applySpawnChoice(portalLike.spawnPoint, portalLike.spawnYaw);
      return true;
    }

    return false;
  }

  function applyCollisionAction(action) {
    if (!action || !action.type) return;
    if (action.type === "portal") {
      applyPortalTravel(action);
    } else if (action.type === "impulse") {
      const impulse = Array.isArray(action.impulse) ? action.impulse : null;
      const upBoost = Number.isFinite(action.up) ? action.up : null;
      const forwardBoost = Number.isFinite(action.forward) ? action.forward : null;

      const player = controls.getObject();
      if (impulse && impulse.length >= 3) {
        player.position.x += Number(impulse[0]) || 0;
        player.position.y += Number(impulse[1]) || 0;
        player.position.z += Number(impulse[2]) || 0;
      } else {
        if (Number.isFinite(upBoost)) {
          player.position.y += upBoost;
        }
        if (Number.isFinite(forwardBoost) && Math.abs(forwardBoost) > 0) {
          controls.getDirection(forward);
          forward.y = 0;
          if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1);
          forward.normalize();
          player.position.addScaledVector(forward, forwardBoost);
        }
      }

      if (Number.isFinite(action.velocityY)) {
        movementState.velocityY = action.velocityY;
      } else if (Number.isFinite(upBoost)) {
        movementState.velocityY = Math.max(movementState.velocityY || 0, upBoost * 0.55);
      } else if (impulse && impulse.length >= 2) {
        movementState.velocityY = Math.max(movementState.velocityY || 0, (Number(impulse[1]) || 0) * 0.55);
      }
      movementState.isGrounded = false;
    } else if (action.type === "console") {
      if (!consolePanels?.runConsoleAction?.(action)) {
        console.warn("Console action failed:", action);
      }
    } else {
      console.warn("Unhandled collision action:", action.type, action);
    }
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function normalizeFunctionConfig(rawConfig) {
    const cfg = rawConfig || {};
    const equation = typeof cfg.equation === "string" && cfg.equation.trim()
      ? cfg.equation.trim()
      : "Math.sin(x)";
    const rawResolution = Number.parseInt(cfg.resolution, 10);
    const resolution = Number.isFinite(rawResolution) ? clamp(rawResolution, 16, 192) : 96;
    const rawLimits = Array.isArray(cfg.limits) ? cfg.limits : [-8, 8];
    let xMin = Number.parseFloat(rawLimits[0]);
    let xMax = Number.parseFloat(rawLimits[1]);
    if (!Number.isFinite(xMin)) xMin = -8;
    if (!Number.isFinite(xMax)) xMax = 8;
    if (xMin > xMax) {
      const t = xMin;
      xMin = xMax;
      xMax = t;
    }
    const safeWidth = clamp(xMax - xMin, 0.5, 80);
    xMax = xMin + safeWidth;
    return {
      equation,
      resolution,
      limits: [xMin, xMax],
      collider: cfg.collider !== false,
      color: typeof cfg.color === "string" && cfg.color ? cfg.color : "#44bbff"
    };
  }

  function evaluateFunctionY(equation, x) {
    try {
      const fn = new Function("x", "Math", `"use strict"; return (${equation});`);
      const y = fn(x, Math);
      if (!Number.isFinite(y)) return null;
      return clamp(y, -100, 100);
    } catch (_) {
      return clamp(Math.sin(x), -100, 100);
    }
  }

  async function ensureImagePlaneTextureApplier() {
    if (imagePlaneTextureApplier) return imagePlaneTextureApplier;
    if (!imagePlaneLoaderPromise) {
      imagePlaneLoaderPromise = import("./imagePlaneLoader.mjs")
        .then((mod) => {
          imagePlaneTextureApplier = mod.applyImagePlaneTexture;
          return imagePlaneTextureApplier;
        })
        .catch((err) => {
          console.warn("Image plane loader failed to load:", err);
          imagePlaneLoaderPromise = null;
          imagePlaneTextureApplier = null;
          return null;
        });
    }
    return imagePlaneLoaderPromise;
  }

  function normalizeNotebookPath(rawPath) {
    const candidate = String(rawPath || "").trim().replace(/\\/g, "/").replace(/^\/+/, "");
    const idx = candidate.indexOf("Notebook/");
    const stripped = idx !== -1 ? candidate.slice(idx + "Notebook/".length) : (candidate.startsWith("./") ? candidate.slice(2) : candidate);
    if (!stripped) return "";
    const parts = stripped.split("/").filter(Boolean);
    if (parts.some((part) => part === "." || part === "..")) return "";
    return parts.join("/");
  }

  function isAllowedImageExtension(path) {
    const ext = String(path || "").split(".").pop()?.toLowerCase() || "";
    return ext === "png" || ext === "svg";
  }

  function parseImagePlaneProperties(inventory, fallbackImagePath = "") {
    const defaultImage = String(
      fallbackImagePath
      || inventory?.getSelectedImageFile?.()
      || ""
    ).trim();
    const raw = prompt(
      "Image plane properties:\nimage (png/svg under Notebook); width (m); height (m)\nExample: images/hello.png;2;2",
      `${defaultImage};2;2`
    );
    if (raw === null) return null;
    const parts = String(raw).split(";").map((part) => part.trim());
    const normalized = normalizeNotebookPath(parts[0] || "");
    if (!normalized || !isAllowedImageExtension(normalized)) {
      alert("Image path must be a Notebook PNG or SVG (e.g. images/pic.png or images/pic.svg).");
      return null;
    }
    const width = Math.max(0.1, Math.min(50, Number.parseFloat(parts[1] || "2")));
    const height = Math.max(0.1, Math.min(50, Number.parseFloat(parts[2] || "2")));
    return {
      imageFilePath: normalized,
      width: Number.isFinite(width) ? width : 2,
      height: Number.isFinite(height) ? height : 2
    };
  }

  function parseIframeProperties() {
    const raw = prompt(
      "iFrame properties:\nsource URL or Notebook path; title; width (m); height (m)\nExample: pages/info.html;Info Page;1.6;0.9",
      "about:blank;Embedded Page;1.6;0.9"
    );
    if (raw === null) return null;
    const parts = String(raw).split(";").map((part) => part.trim());
    const src = parts[0] || "about:blank";
    const title = parts[1] || "Embedded Page";
    const width = Math.max(0.2, Math.min(30, Number.parseFloat(parts[2] || "1.6")));
    const height = Math.max(0.2, Math.min(30, Number.parseFloat(parts[3] || "0.9")));
    return {
      src,
      title,
      width: Number.isFinite(width) ? width : 1.6,
      height: Number.isFinite(height) ? height : 0.9,
      depth: 0.04,
      allow: "fullscreen",
      sandbox: "allow-scripts allow-same-origin allow-forms"
    };
  }

  function buildMathFunctionMesh(rawProps) {
    const props = normalizeFunctionConfig(rawProps);
    const [xMin, xMax] = props.limits;
    const segments = props.resolution;
    const points = [];
    for (let i = 0; i <= segments; i += 1) {
      const t = i / segments;
      const x = xMin + (xMax - xMin) * t;
      const y = evaluateFunctionY(props.equation, x);
      if (y === null) continue;
      points.push(new THREE.Vector3(x, y, 0));
    }
    if (points.length < 2) return null;
    const curve = new THREE.CatmullRomCurve3(points);
    const geometry = new THREE.TubeGeometry(curve, Math.max(16, segments), 0.035, 8, false);
    const material = new THREE.MeshStandardMaterial({
      color: props.color,
      emissive: props.color,
      emissiveIntensity: 0.18
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.mathFunctionProperties = props;
    return mesh;
  }

  function parseConsoleProperties(inventory) {
    const defaultObject = inventory?.getSelectedObjectFile?.() || "";
    const raw = prompt(
      "Console properties:\ncollider(true/false); color; 3D object file; linked object tag/name\nExample: true;#33ccaa;props/console.glb;target-a",
      `true;#33ccaa;${defaultObject};`
    );
    if (raw === null) return null;
    const parts = String(raw).split(";").map((part) => part.trim());
    return {
      collider: String(parts[0] || "true").toLowerCase() !== "false",
      color: parts[1] || "#33ccaa",
      objectFile: parts[2] || "",
      linkedObject: parts[3] || ""
    };
  }

  function makePlacedObjectId(mesh, prefix = "object") {
    const existing = [mesh?.userData?.metaWorldLayerId, mesh?.userData?.tag, mesh?.name]
      .find((value) => typeof value === "string" && value.trim());
    const objectId = existing ? existing.trim() : prefix + "-" + Date.now().toString(36) + "-" + Math.floor(Math.random() * 1000);
    mesh.userData.metaWorldLayerId = objectId;
    if (!mesh.userData.tag) mesh.userData.tag = objectId;
    if (!mesh.name) mesh.name = objectId;
    return objectId;
  }

  function registerPlacedPortal(mesh) {
    if (!mesh) return null;
    const objectId = makePlacedObjectId(mesh, "portal");
    mesh.userData.nvType = "portal";
    mesh.userData.isPortal = true;
    mesh.userData.isSolid = false;
    mesh.userData.breakable = false;
    mesh.userData.portalTarget = typeof mesh.userData.portalTarget === "string" && mesh.userData.portalTarget ? mesh.userData.portalTarget : null;
    mesh.userData.portalSameWorld = mesh.userData.portalSameWorld !== false;
    mesh.userData.portalDestinationMode = mesh.userData.portalDestinationMode || "coordinate";
    mesh.userData.portalLinkedPortalId = typeof mesh.userData.portalLinkedPortalId === "string" ? mesh.userData.portalLinkedPortalId : "";
    mesh.userData.portalSpawn = Array.isArray(mesh.userData.portalSpawn) ? mesh.userData.portalSpawn.slice(0, 3) : null;
    mesh.userData.portalSpawnPoint = typeof mesh.userData.portalSpawnPoint === "string" ? mesh.userData.portalSpawnPoint : null;
    mesh.userData.portalSpawnYaw = Number.isFinite(mesh.userData.portalSpawnYaw) ? mesh.userData.portalSpawnYaw : null;
    mesh.userData.portalCooldownMs = Number.isFinite(mesh.userData.portalCooldownMs) ? mesh.userData.portalCooldownMs : 1200;
    mesh.updateWorldMatrix?.(true, false);
    const portalRef = mesh.userData.portalRef || { lastTriggeredAt: 0 };
    portalRef.box = new THREE.Box3().setFromObject(mesh);
    portalRef.object3d = mesh;
    portalRef.objectId = objectId;
    portalRef.targetWorld = mesh.userData.portalTarget;
    portalRef.sameWorld = mesh.userData.portalSameWorld === true;
    portalRef.destinationMode = mesh.userData.portalDestinationMode;
    portalRef.linkedPortalId = mesh.userData.portalLinkedPortalId;
    portalRef.spawn = mesh.userData.portalSpawn;
    portalRef.spawnPoint = mesh.userData.portalSpawnPoint;
    portalRef.spawnYaw = mesh.userData.portalSpawnYaw;
    portalRef.cooldownMs = mesh.userData.portalCooldownMs;
    if (Array.isArray(portals) && !portals.includes(portalRef)) portals.push(portalRef);
    mesh.userData.portalRef = portalRef;
    return portalRef;
  }

  function registerPlacedSpawn(mesh) {
    if (!mesh) return null;
    const objectId = makePlacedObjectId(mesh, "spawn-point");
    mesh.userData.nvType = "spawn";
    mesh.userData.isSpawn = true;
    mesh.userData.isSolid = false;
    mesh.userData.spawnId = typeof mesh.userData.spawnId === "string" && mesh.userData.spawnId.trim()
      ? mesh.userData.spawnId.trim()
      : objectId;
    mesh.userData.spawnYaw = Number.isFinite(mesh.userData.spawnYaw) ? mesh.userData.spawnYaw : 0;
    return updateSpawnRuntimeForTarget(mesh);
  }

  function closeVoxelPlacerDialog() {
    const panel = movementState.voxelPlacerDialog;
    if (panel?.parentNode) panel.parentNode.removeChild(panel);
    movementState.voxelPlacerDialog = null;
  }

  function addVoxelDialogRow(form, labelText, control) {
    const label = document.createElement("label");
    Object.assign(label.style, {
      display: "grid",
      gridTemplateColumns: "90px minmax(0, 1fr)",
      alignItems: "center",
      gap: "10px",
      color: "#d9f7ef",
      font: "12px/1.3 system-ui, sans-serif"
    });
    const span = document.createElement("span");
    span.textContent = labelText;
    span.style.color = "rgba(230, 255, 247, 0.82)";
    label.appendChild(span);
    label.appendChild(control);
    form.appendChild(label);
    return label;
  }

  function styleVoxelDialogControl(control) {
    Object.assign(control.style, {
      width: "100%",
      boxSizing: "border-box",
      borderRadius: "6px",
      border: "1px solid rgba(132, 211, 190, 0.72)",
      background: "rgba(6, 22, 28, 0.95)",
      color: "#f0fffb",
      padding: "7px 8px",
      font: "12px/1.2 system-ui, sans-serif"
    });
  }

  function openVoxelPlacerDialog() {
    if (movementState.worldMode === "2d") return false;
    if (!canUseAbility("allowToolUse")) return false;
    if (movementState.voxelPlacerDialog?.isConnected) {
      movementState.voxelPlacerDialog.querySelector("input, select, button")?.focus?.();
      return true;
    }

    const config = ensureVoxelPlacerConfig();
    const overlay = document.createElement("div");
    movementState.voxelPlacerDialog = overlay;
    Object.assign(overlay.style, {
      position: "fixed",
      inset: "0",
      zIndex: "26000",
      display: "grid",
      placeItems: "center",
      background: "rgba(1, 9, 12, 0.42)",
      pointerEvents: "auto"
    });

    const panel = document.createElement("form");
    Object.assign(panel.style, {
      width: "min(360px, calc(100vw - 32px))",
      borderRadius: "8px",
      border: "1px solid rgba(153, 236, 214, 0.82)",
      background: "linear-gradient(180deg, rgba(12, 36, 43, 0.98), rgba(4, 18, 24, 0.98))",
      boxShadow: "0 18px 52px rgba(0, 0, 0, 0.48)",
      padding: "14px",
      color: "#f0fffb",
      font: "12px/1.4 system-ui, sans-serif"
    });
    overlay.appendChild(panel);

    const title = document.createElement("div");
    title.textContent = "Voxel Placer";
    Object.assign(title.style, {
      marginBottom: "12px",
      color: "#f6fffc",
      font: "700 16px/1.2 system-ui, sans-serif"
    });
    panel.appendChild(title);

    const sizeInput = document.createElement("input");
    sizeInput.type = "number";
    sizeInput.min = "0.05";
    sizeInput.max = "20";
    sizeInput.step = "0.05";
    sizeInput.value = String(config.size);
    styleVoxelDialogControl(sizeInput);
    addVoxelDialogRow(panel, "Size", sizeInput);

    const materialSelect = document.createElement("select");
    styleVoxelDialogControl(materialSelect);
    addVoxelDialogRow(panel, "Material", materialSelect);

    const colorInput = document.createElement("input");
    colorInput.type = "color";
    colorInput.value = normalizeVoxelColor(config.color);
    Object.assign(colorInput.style, {
      width: "100%",
      height: "34px",
      boxSizing: "border-box",
      borderRadius: "6px",
      border: "1px solid rgba(132, 211, 190, 0.72)",
      background: "rgba(6, 22, 28, 0.95)",
      padding: "3px"
    });
    addVoxelDialogRow(panel, "Color", colorInput);

    const colliderInput = document.createElement("input");
    colliderInput.type = "checkbox";
    colliderInput.checked = config.collider !== false;
    colliderInput.style.width = "18px";
    colliderInput.style.height = "18px";
    const colliderWrap = document.createElement("div");
    colliderWrap.style.display = "flex";
    colliderWrap.style.alignItems = "center";
    colliderWrap.style.gap = "8px";
    colliderWrap.appendChild(colliderInput);
    const colliderText = document.createElement("span");
    colliderText.textContent = "Collider";
    colliderText.style.color = "#f0fffb";
    colliderWrap.appendChild(colliderText);
    addVoxelDialogRow(panel, "Physics", colliderWrap);

    const actions = document.createElement("div");
    Object.assign(actions.style, {
      display: "flex",
      justifyContent: "end",
      gap: "8px",
      marginTop: "14px"
    });
    panel.appendChild(actions);

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.textContent = "Close";
    const applyButton = document.createElement("button");
    applyButton.type = "submit";
    applyButton.textContent = "Apply";
    [closeButton, applyButton].forEach((button) => {
      Object.assign(button.style, {
        borderRadius: "6px",
        border: "1px solid rgba(171, 240, 222, 0.8)",
        background: button === applyButton ? "#7edfc2" : "rgba(8, 31, 38, 0.9)",
        color: button === applyButton ? "#062018" : "#e8fff8",
        padding: "7px 12px",
        font: "700 12px/1 system-ui, sans-serif",
        cursor: "pointer"
      });
      actions.appendChild(button);
    });

    let catalog = [];
    const populateMaterials = (entries) => {
      catalog = Array.isArray(entries) ? entries : [];
      materialSelect.textContent = "";
      const source = catalog.length ? catalog : [{
        materialId: config.materialId,
        materialFile: config.materialFile,
        displayName: config.materialName || "Physics Solid",
        color: config.color,
        matterState: config.matterState
      }];
      source.forEach((entry) => {
        const option = document.createElement("option");
        option.value = String(entry.materialId || entry.materialName || "");
        option.textContent = String(entry.displayName || entry.materialName || entry.materialId || "Material");
        materialSelect.appendChild(option);
      });
      materialSelect.value = findVoxelMaterialEntry(config.materialId, source)?.materialId || source[0]?.materialId || config.materialId;
      const selectedEntry = findVoxelMaterialEntry(materialSelect.value, source);
      applyVoxelMaterialEntry(config, selectedEntry, { updateColor: false });
    };

    const selectedEntryFromControl = () => findVoxelMaterialEntry(materialSelect.value, catalog) || {
      materialId: materialSelect.value || config.materialId,
      materialFile: materialFileForWorldObjectMaterial(materialSelect.value || config.materialId),
      displayName: materialSelect.selectedOptions?.[0]?.textContent || materialSelect.value || config.materialName,
      color: colorInput.value,
      matterState: config.matterState
    };

    materialSelect.addEventListener("change", () => {
      const entry = selectedEntryFromControl();
      applyVoxelMaterialEntry(config, entry, { updateColor: true });
      colorInput.value = normalizeVoxelColor(config.color);
    });

    panel.addEventListener("submit", (event) => {
      event.preventDefault();
      const next = ensureVoxelPlacerConfig();
      next.size = normalizeVoxelSize(sizeInput.value);
      next.color = normalizeVoxelColor(colorInput.value, next.color);
      next.collider = colliderInput.checked;
      applyVoxelMaterialEntry(next, selectedEntryFromControl(), { updateColor: false });
      movementState.voxelPlacerConfig = { ...next };
      setStatus("Voxel Placer updated: size " + next.size + ", " + (next.collider ? "collider" : "visual only") + ".");
      closeVoxelPlacerDialog();
    });

    closeButton.addEventListener("click", closeVoxelPlacerDialog);
    overlay.addEventListener("pointerdown", (event) => {
      if (event.target === overlay) closeVoxelPlacerDialog();
    });
    panel.addEventListener("pointerdown", (event) => event.stopPropagation());
    panel.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeVoxelPlacerDialog();
      }
      event.stopPropagation();
    });

    populateMaterials([]);
    void ensureVoxelMaterialCatalog().then(populateMaterials);
    document.body.appendChild(overlay);
    controls?.unlock?.();
    window.setTimeout(() => sizeInput.focus(), 0);
    return true;
  }

  function computeVoxelPlacePosition(hit, normal, half, snapToGrid) {
    const n = normal.clone().normalize();
    const offset = Math.abs(n.x) * half.x + Math.abs(n.y) * half.y + Math.abs(n.z) * half.z + 0.001;
    const placePos = hit.point.clone().addScaledVector(n, offset);
    if (snapToGrid) {
      const size = Math.max(0.05, half.x * 2);
      const yOffset = half.y;
      placePos.x = Math.round(placePos.x / size) * size;
      placePos.y = Math.round((placePos.y - yOffset) / size) * size + yOffset;
      placePos.z = Math.round(placePos.z / size) * size;
    }
    if (placePos.y < half.y) placePos.y = half.y;
    return placePos;
  }

  function placementNormalFromHit(hit) {
    const normal = hit?.face?.normal?.clone?.() || new THREE.Vector3(0, 1, 0);
    if (hit?.object?.matrixWorld) normal.transformDirection(hit.object.matrixWorld).normalize();
    else normal.normalize();
    return normal;
  }

  function createVoxelColliderRef(mesh, half, materialId) {
    const position = mesh.position;
    const colliderRef = {
      type: "box",
      half: half.clone(),
      box: new THREE.Box3(
        new THREE.Vector3(position.x - half.x, position.y - half.y, position.z - half.z),
        new THREE.Vector3(position.x + half.x, position.y + half.y, position.z + half.z)
      ),
      target: mesh
    };
    if (materialId) {
      colliderRef.materialId = materialId;
      colliderRef.physicsMaterialId = materialId;
    }
    return colliderRef;
  }

  function markMeshAsVoxel(mesh, config, size, colliderEnabled) {
    const materialId = String(config.materialId || DEFAULT_WORLD_OBJECT_MATERIAL_ID);
    const materialFile = String(config.materialFile || materialFileForWorldObjectMaterial(materialId) || "");
    mesh.userData.nvType = "box";
    mesh.userData.isVoxel = true;
    mesh.userData.voxel = true;
    mesh.userData.voxelSize = size;
    mesh.userData.voxelPlacer = {
      size,
      materialId,
      materialFile,
      materialName: config.materialName || materialId,
      matterState: config.matterState || "",
      color: config.color,
      collider: colliderEnabled
    };
    mesh.userData.physicsMaterialId = materialId;
    mesh.userData.physicsMaterialFile = materialFile;
    mesh.userData.materialName = config.materialName || materialId;
    mesh.userData.MatterState = config.matterState || "";
    mesh.userData.matterState = mesh.userData.MatterState;
    mesh.userData.isSolid = colliderEnabled;
    mesh.userData.physicsEnabled = colliderEnabled;
    mesh.userData.breakable = true;
    mesh.userData.placedByPlayer = true;
    makePlacedObjectId(mesh, "voxel");
  }

  function tryPlaceVoxel({ snapToGrid = false } = {}) {
    if (movementState.worldMode === "2d") return false;
    if (!canUseAbility("allowPlace")) return false;
    const hit = getPlacementHit();
    if (!hit) {
      setStatus("No voxel placement target.");
      return true;
    }

    const config = ensureVoxelPlacerConfig();
    const size = normalizeVoxelSize(config.size);
    const half = new THREE.Vector3(size / 2, size / 2, size / 2);
    const shape = { type: "box", half };
    const placePos = computeVoxelPlacePosition(hit, placementNormalFromHit(hit), half, snapToGrid);
    const colliderEnabled = config.collider !== false;
    if (colliderEnabled && intersectsPlayer(placePos, shape)) {
      setStatus("Voxel would intersect the player.");
      return true;
    }
    if (colliderEnabled && intersectsExistingColliders(placePos, shape)) {
      setStatus("Voxel would overlap an existing collider.");
      return true;
    }

    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(size, size, size),
      new THREE.MeshStandardMaterial({ color: config.color, roughness: 0.74, metalness: 0.04 })
    );
    mesh.position.copy(placePos);
    markMeshAsVoxel(mesh, config, size, colliderEnabled);
    scene.add(mesh);
    objects.push(mesh);

    if (colliderEnabled) {
      const colliderRef = createVoxelColliderRef(mesh, half, mesh.userData.physicsMaterialId);
      colliders.push(colliderRef);
      mesh.userData.colliderRef = colliderRef;
    }

    setStatus("Voxel placed.");
    return true;
  }

  function isVoxelMesh(target) {
    return target?.isMesh && (target.userData?.isVoxel === true || target.userData?.voxel === true || target.userData?.voxelPlacer);
  }

  function removeVoxelMesh(target) {
    if (movementState.mountedVehicle?.object === target) {
      dismountMountedVehicle({ showStatus: false });
    }

    scene.remove(target);
    const objIndex = objects.indexOf(target);
    if (objIndex !== -1) objects.splice(objIndex, 1);
    const colliderRef = target.userData?.colliderRef;
    if (colliderRef) {
      const cIndex = colliders.indexOf(colliderRef);
      if (cIndex !== -1) colliders.splice(cIndex, 1);
      delete target.userData.colliderRef;
    }
    const collisionActionRef = target.userData?.collisionActionRef;
    if (collisionActionRef) {
      const idx = collisionActions.indexOf(collisionActionRef);
      if (idx !== -1) collisionActions.splice(idx, 1);
    }
    const useTargetRef = target.userData?.useTargetRef;
    if (useTargetRef) {
      const idx = useTargets.indexOf(useTargetRef);
      if (idx !== -1) useTargets.splice(idx, 1);
    }
    if (Array.isArray(waterVolumes)) {
      for (let i = waterVolumes.length - 1; i >= 0; i -= 1) {
        const ref = waterVolumes[i];
        if (ref === target.userData?.waterVolumeRef || ref?.target === target || ref?.object3d === target) {
          waterVolumes.splice(i, 1);
        }
      }
      delete target.userData.waterVolumeRef;
    }
    target.geometry?.dispose?.();
    if (Array.isArray(target.material)) target.material.forEach((mat) => mat?.dispose?.());
    else target.material?.dispose?.();
  }

  function tryDeleteVoxel() {
    if (movementState.worldMode === "2d") return false;
    if (!canUseAbility("allowBreak")) return true;
    const hit = getInspectHit({ includeMeasurements: false, allowInfinitePlanes: false });
    const target = hit?.object || null;
    if (!target) {
      setStatus("No voxel targeted.");
      return true;
    }
    if (!isVoxelMesh(target)) {
      setStatus("Voxel Placer only removes voxels.");
      return true;
    }
    removeVoxelMesh(target);
    setStatus("Voxel deleted.");
    return true;
  }

  function voxelHalfExtentsFromMesh(target) {
    const params = target?.geometry?.parameters || {};
    const scale = target?.scale || {};
    const width = Number(params.width);
    const height = Number(params.height);
    const depth = Number(params.depth);
    const fallbackSize = normalizeVoxelSize(target?.userData?.voxelSize || target?.userData?.voxelPlacer?.size || 1);
    return new THREE.Vector3(
      (Number.isFinite(width) && width > 0 ? width : fallbackSize) * Math.abs(Number(scale.x) || 1) * 0.5,
      (Number.isFinite(height) && height > 0 ? height : fallbackSize) * Math.abs(Number(scale.y) || 1) * 0.5,
      (Number.isFinite(depth) && depth > 0 ? depth : fallbackSize) * Math.abs(Number(scale.z) || 1) * 0.5
    );
  }

  function cloneVoxelMaterial(target) {
    if (Array.isArray(target?.material)) return target.material.map((mat) => mat?.clone?.() || mat);
    return target?.material?.clone?.() || new THREE.MeshStandardMaterial({
      color: target?.userData?.voxelPlacer?.color || "#8ee6c1",
      roughness: 0.74,
      metalness: 0.04
    });
  }

  function cloneVoxelUserData(target) {
    const data = target?.userData || {};
    const voxel = data.voxelPlacer && typeof data.voxelPlacer === "object" ? data.voxelPlacer : {};
    const cloned = {
      ...data,
      voxelPlacer: { ...voxel }
    };
    delete cloned.metaWorldLayerId;
    delete cloned.tag;
    delete cloned.colliderRef;
    delete cloned.collisionActionRef;
    delete cloned.useTargetRef;
    delete cloned.waterVolumeRef;
    cloned.isVoxel = true;
    cloned.voxel = true;
    cloned.breakable = true;
    cloned.placedByPlayer = true;
    return cloned;
  }

  function dominantAxisFromNormal(normal) {
    const x = Math.abs(normal.x);
    const y = Math.abs(normal.y);
    const z = Math.abs(normal.z);
    if (x >= y && x >= z) return new THREE.Vector3(Math.sign(normal.x) || 1, 0, 0);
    if (y >= x && y >= z) return new THREE.Vector3(0, Math.sign(normal.y) || 1, 0);
    return new THREE.Vector3(0, 0, Math.sign(normal.z) || 1);
  }

  function tryExtrudeVoxel({ snapToGrid = false } = {}) {
    if (movementState.worldMode === "2d") return false;
    if (!canUseAbility("allowPlace")) return true;
    const hit = getInspectHit({ includeMeasurements: false, allowInfinitePlanes: false });
    const target = hit?.object || null;
    if (!target) {
      setStatus("No voxel targeted.");
      return true;
    }
    if (!isVoxelMesh(target)) {
      setStatus("Voxel Extruder only clones voxels.");
      return true;
    }

    const sourceHalf = voxelHalfExtentsFromMesh(target);
    const cloneHalf = sourceHalf.clone();
    const axis = dominantAxisFromNormal(placementNormalFromHit(hit));
    const placePos = target.position.clone().add(new THREE.Vector3(
      axis.x * (sourceHalf.x + cloneHalf.x),
      axis.y * (sourceHalf.y + cloneHalf.y),
      axis.z * (sourceHalf.z + cloneHalf.z)
    ));

    if (snapToGrid) {
      const grid = Math.max(0.05, Math.min(sourceHalf.x, sourceHalf.y, sourceHalf.z) * 2);
      placePos.x = Math.round(placePos.x / grid) * grid;
      placePos.y = Math.round((placePos.y - cloneHalf.y) / grid) * grid + cloneHalf.y;
      placePos.z = Math.round(placePos.z / grid) * grid;
    }
    if (placePos.y < cloneHalf.y) placePos.y = cloneHalf.y;

    const colliderEnabled = target.userData?.colliderRef
      ? true
      : target.userData?.voxelPlacer?.collider !== false && target.userData?.isSolid === true;
    const shape = colliderEnabled ? { type: "box", half: cloneHalf } : null;
    if (shape && intersectsPlayer(placePos, shape)) {
      setStatus("Extruded voxel would intersect the player.");
      return true;
    }
    if (shape && intersectsExistingColliders(placePos, shape)) {
      setStatus("Extruded voxel would overlap an existing collider.");
      return true;
    }

    const mesh = target.clone(false);
    mesh.geometry = target.geometry?.clone?.() || new THREE.BoxGeometry(cloneHalf.x * 2, cloneHalf.y * 2, cloneHalf.z * 2);
    mesh.material = cloneVoxelMaterial(target);
    mesh.userData = cloneVoxelUserData(target);
    mesh.position.copy(placePos);
    mesh.rotation.copy(target.rotation);
    mesh.quaternion.copy(target.quaternion);
    mesh.scale.copy(target.scale);
    mesh.name = "";
    mesh.userData.isSolid = colliderEnabled;
    mesh.userData.physicsEnabled = colliderEnabled;
    if (mesh.userData.voxelPlacer) mesh.userData.voxelPlacer.collider = colliderEnabled;
    makePlacedObjectId(mesh, "voxel");
    scene.add(mesh);
    objects.push(mesh);

    if (colliderEnabled) {
      const colliderRef = createVoxelColliderRef(mesh, cloneHalf, mesh.userData.physicsMaterialId);
      colliders.push(colliderRef);
      mesh.userData.colliderRef = colliderRef;
    }

    setStatus("Voxel extruded.");
    return true;
  }

  function createPlacedMesh(selectedItem, inventory) {
    const id = String(selectedItem?.id || "").toLowerCase();
    if (id === "box") {
      return {
        mesh: new THREE.Mesh(
          new THREE.BoxGeometry(1, 1, 1),
          new THREE.MeshStandardMaterial({ color: 0xa0a0a0 })
        ),
        collider: { type: "box", half: new THREE.Vector3(0.5, 0.5, 0.5) }
      };
    }
    if (id === "sphere") {
      return {
        mesh: new THREE.Mesh(
          new THREE.SphereGeometry(0.5, 24, 24),
          new THREE.MeshStandardMaterial({ color: 0x7ec8ff })
        ),
        collider: { type: "sphere", radius: 0.5 }
      };
    }
    if (id === "cylinder") {
      return {
        mesh: new THREE.Mesh(
          new THREE.CylinderGeometry(0.5, 0.5, 1, 20),
          new THREE.MeshStandardMaterial({ color: 0xb5a67a })
        ),
        collider: { type: "cylinder", radius: 0.5, halfHeight: 0.5 }
      };
    }
    if (id === FLYING_CARPET_ITEM_ID) {
      return {
        mesh: createFlyingCarpetMesh(),
        collider: { type: "box", half: new THREE.Vector3(FLYING_CARPET_WIDTH / 2, FLYING_CARPET_HEIGHT / 2, FLYING_CARPET_DEPTH / 2) }
      };
    }
    if (id === "math-function") {
      const panelRef = functionPlotterPanel || window.VRWorldContext?.functionPlotterPanel;
      const pending = panelRef?.consumePendingConfig?.() || null;
      if (!pending) {
        panelRef?.open?.();
        return null;
      }
      const mesh = buildMathFunctionMesh(pending);
      if (!mesh) return null;
      return {
        mesh,
        collider: mesh.userData?.mathFunctionProperties?.collider ? { type: "sphere", radius: 0.7 } : null
      };
    }
    if (id === "portal") {
      const mesh = new THREE.Mesh(
        new THREE.TorusGeometry(0.72, 0.075, 16, 64),
        new THREE.MeshStandardMaterial({
          color: 0x55ccff,
          emissive: 0x55ccff,
          emissiveIntensity: 0.95,
          transparent: true,
          opacity: 0.72
        })
      );
      mesh.userData.portalSameWorld = true;
      mesh.userData.portalDestinationMode = "coordinate";
      mesh.userData.portalSpawn = null;
      return { mesh, collider: null };
    }
    if (id === "spawn" || id === "spawn-point" || id === "spawnpoint") {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 18, 14),
        new THREE.MeshStandardMaterial({
          color: 0x35d07f,
          emissive: 0x0a4f2a,
          emissiveIntensity: 0.45
        })
      );
      mesh.userData.isSpawn = true;
      mesh.userData.spawnYaw = 0;
      return { mesh, collider: null };
    }
    if (id === "console") {
      const props = parseConsoleProperties(inventory);
      if (!props) return null;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 1.15, 0.7),
        new THREE.MeshStandardMaterial({ color: props.color })
      );
      mesh.userData.consoleProperties = props;
      return {
        mesh,
        collider: props.collider ? { type: "box", half: new THREE.Vector3(0.45, 0.575, 0.35) } : null
      };
    }
    if (id === "iframe") {
      const props = parseIframeProperties();
      if (!props) return null;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(props.width, props.height, props.depth),
        new THREE.MeshStandardMaterial({ color: 0xf8fbff, emissive: 0x183a5f, emissiveIntensity: 0.28 })
      );
      mesh.userData.iframeSrc = props.src;
      mesh.userData.iframeTitle = props.title;
      mesh.userData.iframeAllow = props.allow;
      mesh.userData.iframeSandbox = props.sandbox;
      mesh.userData.iframeColor = "#f8fbff";
      mesh.userData.iframeObject = {
        src: props.src,
        iframeSrc: props.src,
        title: props.title,
        iframeTitle: props.title,
        allow: props.allow,
        sandbox: props.sandbox
      };
      return { mesh, collider: null };
    }
    if (id === "object-file") {
      const objectFilePath = String(
        selectedItem?.objectFilePath
        || inventory?.getSelectedObjectFile?.()
        || ""
      ).trim();
      if (!objectFilePath) return null;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial({ color: 0x6e80d8 })
      );
      mesh.userData.objectFilePath = objectFilePath;
      mesh.userData.objectFileColliderBinding = "geometry";
      return {
        mesh,
        collider: { type: "box", half: new THREE.Vector3(0.5, 0.5, 0.5) }
      };
    }
    if (id === "image-plane") {
      const presetPath = String(
        selectedItem?.imageFilePath
        || inventory?.getSelectedImageFile?.()
        || ""
      ).trim();
      const props = parseImagePlaneProperties(inventory, presetPath);
      if (!props) return null;
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(props.width, props.height),
        new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 1,
          side: THREE.DoubleSide
        })
      );
      mesh.userData.imageFilePath = props.imageFilePath;
      mesh.userData.imageWidth = props.width;
      mesh.userData.imageHeight = props.height;
      void (async () => {
        const applier = await ensureImagePlaneTextureApplier();
        if (applier) await applier(mesh, THREE);
      })();
      return {
        mesh,
        collider: null
      };
    }
    return null;
  }

  function intersectsPlayer(position, shape) {
    if (!shape) return false;
    const playerPos = controls.getObject().position;
    const playerMinY = playerPos.y - movementState.playerHeight;
    const playerMaxY = playerPos.y;

    if (shape.type === "box") {
      const minX = position.x - shape.half.x - playerRadius;
      const maxX = position.x + shape.half.x + playerRadius;
      const minZ = position.z - shape.half.z - playerRadius;
      const maxZ = position.z + shape.half.z + playerRadius;
      const overlapsY = playerMaxY >= (position.y - shape.half.y) && playerMinY <= (position.y + shape.half.y);
      return playerPos.x >= minX && playerPos.x <= maxX && playerPos.z >= minZ && playerPos.z <= maxZ && overlapsY;
    }

    const dx = playerPos.x - position.x;
    const dz = playerPos.z - position.z;
    const radialSq = dx * dx + dz * dz;
    const totalR = (shape.radius || 0.5) + playerRadius;
    const minY = shape.type === "cylinder" ? position.y - (shape.halfHeight || 0.5) : position.y - (shape.radius || 0.5);
    const maxY = shape.type === "cylinder" ? position.y + (shape.halfHeight || 0.5) : position.y + (shape.radius || 0.5);
    const overlapsY = playerMaxY >= minY && playerMinY <= maxY;
    return radialSq <= totalR * totalR && overlapsY;
  }

  function intersectsExistingColliders(position, shape, options = {}) {
    if (!shape) return false;
    const ignoreCollider = options?.ignoreCollider || null;
    const ignoreColliders = options?.ignoreColliders instanceof Set ? options.ignoreColliders : null;
    const overlapEpsilon = 0.001;

    function boxesPenetrate(a, b) {
      const overlapX = Math.min(a.max.x, b.max.x) - Math.max(a.min.x, b.min.x);
      const overlapY = Math.min(a.max.y, b.max.y) - Math.max(a.min.y, b.min.y);
      const overlapZ = Math.min(a.max.z, b.max.z) - Math.max(a.min.z, b.min.z);
      return overlapX > overlapEpsilon && overlapY > overlapEpsilon && overlapZ > overlapEpsilon;
    }

    for (const collider of colliders) {
      if (!collider || collider === ignoreCollider || ignoreColliders?.has(collider)) continue;
      if (shape.type === "box" && collider.type === "box") {
        const newBox = new THREE.Box3(
          new THREE.Vector3(position.x - shape.half.x, position.y - shape.half.y, position.z - shape.half.z),
          new THREE.Vector3(position.x + shape.half.x, position.y + shape.half.y, position.z + shape.half.z)
        );
        if (boxesPenetrate(newBox, collider.box)) return true;
      } else if (collider.type === "compound") {
        if (typeof collider.update === "function") collider.update();
        const parts = Array.isArray(collider.boxes) ? collider.boxes : [];
        for (const part of parts) {
          if (!part?.box) continue;
          if (shape.type === "box") {
            const newBox = new THREE.Box3(
              new THREE.Vector3(position.x - shape.half.x, position.y - shape.half.y, position.z - shape.half.z),
              new THREE.Vector3(position.x + shape.half.x, position.y + shape.half.y, position.z + shape.half.z)
            );
            if (boxesPenetrate(newBox, part.box)) return true;
          } else if (shape.type === "sphere" || shape.type === "cylinder") {
            const radius = shape.radius || 0.5;
            const x = Math.max(part.box.min.x, Math.min(position.x, part.box.max.x));
            const y = Math.max(part.box.min.y, Math.min(position.y, part.box.max.y));
            const z = Math.max(part.box.min.z, Math.min(position.z, part.box.max.z));
            const dx = position.x - x;
            const dy = position.y - y;
            const dz = position.z - z;
            const r = Math.max(0, radius - overlapEpsilon);
            if (dx * dx + dy * dy + dz * dz < r * r) return true;
          }
        }
      } else if (shape.type === "sphere" && collider.type === "sphere") {
        const dx = position.x - collider.center.x;
        const dy = position.y - collider.center.y;
        const dz = position.z - collider.center.z;
        const rr = Math.max(0, (shape.radius + collider.radius) - overlapEpsilon);
        if (dx * dx + dy * dy + dz * dz < rr * rr) return true;
      } else if (shape.type === "box" && collider.type === "sphere") {
        const x = Math.max(position.x - shape.half.x, Math.min(collider.center.x, position.x + shape.half.x));
        const y = Math.max(position.y - shape.half.y, Math.min(collider.center.y, position.y + shape.half.y));
        const z = Math.max(position.z - shape.half.z, Math.min(collider.center.z, position.z + shape.half.z));
        const dx = x - collider.center.x;
        const dy = y - collider.center.y;
        const dz = z - collider.center.z;
        const r = Math.max(0, collider.radius - overlapEpsilon);
        if (dx * dx + dy * dy + dz * dz < r * r) return true;
      } else if ((shape.type === "sphere" || shape.type === "cylinder") && collider.type === "box") {
        const radius = shape.radius || 0.5;
        const x = Math.max(collider.box.min.x, Math.min(position.x, collider.box.max.x));
        const y = Math.max(collider.box.min.y, Math.min(position.y, collider.box.max.y));
        const z = Math.max(collider.box.min.z, Math.min(position.z, collider.box.max.z));
        const dx = position.x - x;
        const dy = position.y - y;
        const dz = position.z - z;
        const r = Math.max(0, radius - overlapEpsilon);
        if (dx * dx + dy * dy + dz * dz < r * r) return true;
      }
    }
    return false;
  }

  function getMeasurementVisualsStore() {
    if (!window.VRWorldContext) return [];
    if (!Array.isArray(window.VRWorldContext.measurementVisuals)) {
      window.VRWorldContext.measurementVisuals = [];
    }
    return window.VRWorldContext.measurementVisuals;
  }

  function registerMeasurementVisual(entry) {
    if (!entry) return;
    const measurementVisuals = getMeasurementVisualsStore();
    if (!measurementVisuals.includes(entry)) {
      measurementVisuals.push(entry);
    }
  }

  function removeMeasurementVisual(entry) {
    if (!entry) return;
    if (entry?.parent) entry.parent.remove(entry);
    if (entry?.geometry?.dispose) entry.geometry.dispose();
    if (entry?.material?.dispose) entry.material.dispose();
    if (entry?.material?.map?.dispose) entry.material.map.dispose();
    const measurementVisuals = getMeasurementVisualsStore();
    const idx = measurementVisuals.indexOf(entry);
    if (idx !== -1) measurementVisuals.splice(idx, 1);
  }

  function clearMeasurementVisuals() {
    const measurementVisuals = getMeasurementVisualsStore();
    measurementVisuals.forEach((entry) => {
      if (entry?.parent) entry.parent.remove(entry);
      if (entry?.geometry?.dispose) entry.geometry.dispose();
      if (entry?.material?.dispose) entry.material.dispose();
      if (entry?.material?.map?.dispose) entry.material.map.dispose();
    });
    measurementVisuals.length = 0;
    movementState.tapeMeasureFirstPoint = null;
    movementState.tapeMeasureSecondPoint = null;
    movementState.tapeMeasureFirstMarker = null;
    movementState.tapeMeasureSecondMarker = null;
    movementState.tapeMeasureLine = null;
    movementState.tapeMeasureLabel = null;
  }

  function createMeasureMarker(point, endpointRole) {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 14, 14),
      new THREE.MeshStandardMaterial({
        color: 0xffdf5d,
        emissive: 0x6a4d00,
        emissiveIntensity: 0.8
      })
    );
    marker.position.copy(point);
    marker.userData.isMeasure = true;
    marker.userData.isMeasureEndpoint = endpointRole || null;
    return marker;
  }

  function createMeasureLine(startPoint, endPoint) {
    const geometry = new THREE.BufferGeometry().setFromPoints([startPoint.clone(), endPoint.clone()]);
    const line = new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 })
    );
    line.userData.isMeasure = true;
    return line;
  }

  function createDistanceLabel(text, position) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 192;
    const ctx = canvas.getContext("2d");
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false
      })
    );
    sprite.position.copy(position);
    sprite.scale.set(1.9, 0.7, 1);
    sprite.userData.isMeasure = true;
    sprite.userData.labelCanvas = canvas;
    sprite.userData.labelContext = ctx;
    sprite.userData.labelTexture = texture;
    updateDistanceLabel(sprite, text, position);
    return sprite;
  }

  function updateDistanceLabel(sprite, text, position) {
    const ctx = sprite?.userData?.labelContext;
    const canvas = sprite?.userData?.labelCanvas;
    const texture = sprite?.userData?.labelTexture;
    if (ctx && canvas) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "rgba(0, 0, 0, 0.62)";
      ctx.fillRect(40, 48, 432, 96);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
      ctx.lineWidth = 4;
      ctx.strokeRect(40, 48, 432, 96);
      ctx.fillStyle = "#f7fbff";
      ctx.font = "700 56px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    }
    if (texture) texture.needsUpdate = true;
    if (position && sprite?.position) {
      sprite.position.copy(position);
    }
  }

  function getTapeMeasureHit() {
    raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    const candidates = [];
    if (ground?.isMesh && ground?.visible) candidates.push(ground);
    candidates.push(...(objects || []).filter((obj) => (
      obj?.isMesh
      && obj?.visible
      && obj?.userData?.isMeasure !== true
      && obj?.userData?.isWater !== true
      && obj?.userData?.isLiquid !== true
    )));
    const hits = raycaster.intersectObjects(candidates, false);
    return hits.find((h) => Number.isFinite(h.distance) && h.distance <= useRangeMax && h.object?.visible) || null;
  }

  function ensureTapeMeasureLineAndLabel(startPoint, endPoint) {
    if (!startPoint || !endPoint) return;
    if (!movementState.tapeMeasureLine) {
      const line = createMeasureLine(startPoint, endPoint);
      scene.add(line);
      movementState.tapeMeasureLine = line;
      registerMeasurementVisual(line);
    } else {
      movementState.tapeMeasureLine.geometry.setFromPoints([startPoint.clone(), endPoint.clone()]);
      movementState.tapeMeasureLine.geometry.computeBoundingSphere();
    }
    const distanceMeters = startPoint.distanceTo(endPoint);
    const mid = startPoint.clone().add(endPoint).multiplyScalar(0.5);
    mid.y += 0.2;
    const text = `${distanceMeters.toFixed(2)} m`;
    if (!movementState.tapeMeasureLabel) {
      const label = createDistanceLabel(text, mid);
      scene.add(label);
      movementState.tapeMeasureLabel = label;
      registerMeasurementVisual(label);
    } else {
      updateDistanceLabel(movementState.tapeMeasureLabel, text, mid);
    }
  }

  function updateTapeMeasurePreview() {
    const firstPoint = movementState.tapeMeasureFirstPoint;
    const secondPoint = movementState.tapeMeasureSecondPoint;
    if (!firstPoint || secondPoint) return;
    const hit = getTapeMeasureHit();
    if (!hit?.point) {
      if (movementState.tapeMeasureLine) movementState.tapeMeasureLine.visible = false;
      if (movementState.tapeMeasureLabel) movementState.tapeMeasureLabel.visible = false;
      return;
    }
    ensureTapeMeasureLineAndLabel(firstPoint, hit.point);
    if (movementState.tapeMeasureLine) movementState.tapeMeasureLine.visible = true;
    if (movementState.tapeMeasureLabel) movementState.tapeMeasureLabel.visible = true;
  }

  function tryPlaceSelectedInventoryItem({ snapToGrid = false } = {}) {
    if (movementState.worldMode === "2d") return false;
    if (!canUseAbility("allowPlace")) return false;
    const inventory = window.VRWorldContext?.inventory;
    if (!inventory?.getSelectedItem || !inventory?.consumeSelected) return false;
    const selected = inventory.getSelectedItem();
    if (!selected || !selected.id || (Number.isFinite(selected.count) && selected.count <= 0)) return false;
    const hit = getPlacementHit();
    if (!hit) return false;

    if (String(selected.id || "").toLowerCase() === "console") {
      if (consolePanels?.openPlacementPanel?.(
        hit,
        {
          color: "#33ccaa",
          collider: true,
          size: [0.9, 1.15, 0.7]
        },
        snapToGrid,
        {
          onConfirm: (config, confirmHit, gridSnap) => {
            finalizeConsolePlacement(confirmHit || hit, config, gridSnap);
          },
          onCancel: () => {}
        }
      )) {
        return true;
      }
      // Fallback to prompt if panels missing
      const consoleProps = parseConsoleProperties(inventory);
      if (!consoleProps) return false;
      consoleProps.size = [0.9, 1.15, 0.7];
      finalizeConsolePlacement(hit, consoleProps, snapToGrid);
      return true;
    }

    const placement = createPlacedMesh(selected, inventory);
    if (!placement) return false;

    const normal = hit.face?.normal?.clone?.() || raycastDirection.set(0, 1, 0);
    normal.transformDirection(hit.object.matrixWorld).normalize();
    const placePos = computePlacePosition(hit, normal, placement.collider, { snapToGrid });

    if (placement.collider && intersectsPlayer(placePos, placement.collider)) return false;
    if (placement.collider && intersectsExistingColliders(placePos, placement.collider)) return false;

    const mesh = placement.mesh;
    mesh.position.copy(placePos);
    mesh.userData.isSolid = Boolean(placement.collider);
    mesh.userData.breakable = true;
    mesh.userData.placedByPlayer = true;
    mesh.userData.nvType = selected.id;
    scene.add(mesh);
    objects.push(mesh);

    const placedItemId = String(selected.id || "").toLowerCase();
    if (placedItemId === "portal") {
      registerPlacedPortal(mesh);
    } else if (placedItemId === "spawn" || placedItemId === "spawn-point" || placedItemId === "spawnpoint") {
      registerPlacedSpawn(mesh);
    }

    if (placement.collider?.type === "box") {
      const half = placement.collider.half;
      const colliderRef = {
        type: "box",
        half: half.clone?.() || half,
        box: new THREE.Box3(
          new THREE.Vector3(placePos.x - half.x, placePos.y - half.y, placePos.z - half.z),
          new THREE.Vector3(placePos.x + half.x, placePos.y + half.y, placePos.z + half.z)
        )
      };
      colliders.push(colliderRef);
      mesh.userData.colliderRef = colliderRef;
      mesh.userData.objectFileColliderFactory?.(colliderRef);
    } else if (placement.collider?.type === "sphere" || placement.collider?.type === "cylinder") {
      const colliderRef = {
        type: "sphere",
        center: placePos.clone(),
        radius: placement.collider.radius || 0.5
      };
      colliders.push(colliderRef);
      mesh.userData.colliderRef = colliderRef;
    }

    inventory.consumeSelected(1);
    return true;
  }

  function tryUseSelectedTool(context = {}) {
    if (movementState.worldMode === "2d") return false;
    if (!canUseAbility("allowToolUse")) return false;
    const inventory = window.VRWorldContext?.inventory;
    const selected = inventory?.getSelectedItem?.();
    if (!selected?.id) return false;
    const toolId = String(selected.id).toLowerCase();
    const selectedUseAction = selectedItemActions.get(toolId)?.use;
    if (typeof selectedUseAction === "function") return selectedUseAction(context) !== false;

    if (toolId === "svg-camera") {
      if (movementState.svgToolLatch) return true;
      movementState.svgToolLatch = true;
      if (movementState.svgCameraBusy) return true;
      const ctx = window.VRWorldContext || {};
      movementState.svgCameraBusy = true;
      triggerSvgCameraCapture({
        scene,
        camera,
        sourceRenderer: ctx.renderer,
        worldPath: ctx.currentWorldPath || window.selectedFilePath || ""
      }).catch((err) => {
        if (err?.name === "AbortError") return;
        console.warn("SVG Camera export failed:", err);
      }).finally(() => {
        movementState.svgCameraBusy = false;
      });
      return true;
    }

    if (toolId === "tape-measure") {
      const hit = getTapeMeasureHit();
      if (!hit?.point) return true;
      if (!movementState.tapeMeasureFirstPoint || movementState.tapeMeasureSecondPoint) {
        clearMeasurementVisuals();
        const firstPoint = hit.point.clone();
        const firstMarker = createMeasureMarker(firstPoint, "first");
        scene.add(firstMarker);
        registerMeasurementVisual(firstMarker);
        movementState.tapeMeasureFirstMarker = firstMarker;
        movementState.tapeMeasureFirstPoint = firstPoint;
        updateTapeMeasurePreview();
        return true;
      }

      const secondPoint = hit.point.clone();
      const firstPoint = movementState.tapeMeasureFirstPoint.clone();
      const secondMarker = createMeasureMarker(secondPoint, "second");
      scene.add(secondMarker);
      registerMeasurementVisual(secondMarker);
      movementState.tapeMeasureSecondMarker = secondMarker;
      movementState.tapeMeasureSecondPoint = secondPoint;
      ensureTapeMeasureLineAndLabel(firstPoint, secondPoint);
      if (movementState.tapeMeasureLine) movementState.tapeMeasureLine.visible = true;
      if (movementState.tapeMeasureLabel) movementState.tapeMeasureLabel.visible = true;
      return true;
    }

    if (toolId === "terrain-generator") {
      if (movementState.terrainToolLatch) return true;
      movementState.terrainToolLatch = true;
      const terrainTool = terrainToolController || window.VRWorldContext?.terrainToolController;
      terrainTool?.openPanel?.();
      return true;
    }

    if (toolId === "temporal-manipulator") {
      if (movementState.temporalToolLatch) return true;
      movementState.temporalToolLatch = true;
      window.VRWorldContext?.temporalManipulatorPanel?.open?.();
      return true;
    }

    return false;
  }

  selectedItemActions.set("svg-camera", {
    use: () => {
      if (movementState.svgToolLatch) return true;
      movementState.svgToolLatch = true;
      if (movementState.svgCameraBusy) return true;
      const ctx = window.VRWorldContext || {};
      movementState.svgCameraBusy = true;
      triggerSvgCameraCapture({
        scene,
        camera,
        sourceRenderer: ctx.renderer,
        worldPath: ctx.currentWorldPath || window.selectedFilePath || ""
      }).catch((err) => {
        if (err?.name === "AbortError") return;
        console.warn("SVG Camera export failed:", err);
      }).finally(() => {
        movementState.svgCameraBusy = false;
      });
      return true;
    }
  });

  selectedItemActions.set("tape-measure", {
    use: () => {
      const hit = getTapeMeasureHit();
      if (!hit?.point) return true;
      if (!movementState.tapeMeasureFirstPoint || movementState.tapeMeasureSecondPoint) {
        clearMeasurementVisuals();
        const firstPoint = hit.point.clone();
        const firstMarker = createMeasureMarker(firstPoint, "first");
        scene.add(firstMarker);
        registerMeasurementVisual(firstMarker);
        movementState.tapeMeasureFirstMarker = firstMarker;
        movementState.tapeMeasureFirstPoint = firstPoint;
        updateTapeMeasurePreview();
        return true;
      }
      const secondPoint = hit.point.clone();
      const firstPoint = movementState.tapeMeasureFirstPoint.clone();
      const secondMarker = createMeasureMarker(secondPoint, "second");
      scene.add(secondMarker);
      registerMeasurementVisual(secondMarker);
      movementState.tapeMeasureSecondMarker = secondMarker;
      movementState.tapeMeasureSecondPoint = secondPoint;
      ensureTapeMeasureLineAndLabel(firstPoint, secondPoint);
      if (movementState.tapeMeasureLine) movementState.tapeMeasureLine.visible = true;
      if (movementState.tapeMeasureLabel) movementState.tapeMeasureLabel.visible = true;
      return true;
    }
  });

  selectedItemActions.set("terrain-generator", {
    use: () => {
      if (tryPaintTerrain()) return true;
      if (movementState.terrainToolLatch) return true;
      movementState.terrainToolLatch = true;
      const terrainTool = terrainToolController || window.VRWorldContext?.terrainToolController;
      terrainTool?.openPanel?.();
      return true;
    }
  });

  selectedItemActions.set("temporal-manipulator", {
    use: () => {
      if (movementState.temporalToolLatch) return true;
      movementState.temporalToolLatch = true;
      window.VRWorldContext?.temporalManipulatorPanel?.open?.();
      return true;
    }
  });

  selectedItemActions.set(VOXEL_PLACER_TOOL_ID, {
    adjust: () => openVoxelPlacerDialog(),
    use: ({ snapToGrid = false } = {}) => tryPlaceVoxel({ snapToGrid }),
    attack: () => tryDeleteVoxel()
  });

  selectedItemActions.set(VOXEL_EXTRUDER_TOOL_ID, {
    use: ({ snapToGrid = false } = {}) => tryExtrudeVoxel({ snapToGrid }),
    attack: () => {
      setStatus("Voxel Extruder only clones voxels with use.");
      return true;
    },
    adjust: () => {
      setStatus("Voxel Extruder copies the targeted voxel onto the viewed face.");
      return true;
    }
  });

  function tryPaintTerrain() {
    if (movementState.worldMode === "2d") return false;
    if (!canUseAbility("allowToolUse")) return false;
    const terrainTool = terrainToolController || window.VRWorldContext?.terrainToolController;
    if (!terrainTool?.isPaintModeActive?.()) return false;
    const hit = getTerrainPaintHit();
    if (!hit?.point) {
      terrainTool?.notifyPaintMiss?.();
      return true;
    }
    terrainTool.paintAtPoint?.(hit.point);
    return true;
  }

  function isEquationObjectTarget(target) {
    const type = String(target?.userData?.nvType || "").toLowerCase();
    return type === "equation-collider-plane"
      || type === "equation-inequality"
      || target?.userData?.metaWorldExpressionLayer === true
      || type === "functionsurface"
      || type === "functioncurve"
      || type === "parametriccurve";
  }

  function tryBreakTargetBlock() {
    if (movementState.worldMode === "2d") return false;
    let hit = getInspectHit({ includeMeasurements: true, allowInfinitePlanes: true });
    if (!hit?.object) hit = getPortalInspectFallbackHit();
    if (!hit?.object) return false;
    let target = hit.object;
    let isEquationObject = isEquationObjectTarget(target);
    let isPortalTarget = isPortalLikeTarget(target);
    let isSpawnTarget = isSpawnPointTarget(target);
    if (!isEquationObject && !isPortalTarget && (target.userData?.breakable === false || (!target.userData?.breakable && !target.userData?.placedByPlayer))) {
      const portalHit = getPortalInspectFallbackHit();
      if (portalHit?.object) {
        hit = portalHit;
        target = hit.object;
        isEquationObject = isEquationObjectTarget(target);
        isPortalTarget = isPortalLikeTarget(target);
        isSpawnTarget = isSpawnPointTarget(target);
      }
    }
    if (!isEquationObject && !canUseAbility("allowBreak")) return false;
    if (target.userData?.isMeasureEndpoint === "second") {
      removeMeasurementVisual(target);
      movementState.tapeMeasureSecondMarker = null;
      movementState.tapeMeasureSecondPoint = null;
      updateTapeMeasurePreview();
      return true;
    }
    if (!isEquationObject && !isPortalTarget) {
      if (target.userData?.breakable === false) return false;
      if (!target.userData?.breakable && !target.userData?.placedByPlayer) return false;
    }

    const breakHandler = target.userData?.onBreakTarget;
    if (typeof breakHandler === "function") {
      const handled = breakHandler({ target, scene, objects, colliders, collisionActions, useTargets }) !== false;
      if (handled) return true;
    }

    if (movementState.mountedVehicle?.object === target) {
      dismountMountedVehicle({ showStatus: false });
    }

    scene.remove(target);
    const objIndex = objects.indexOf(target);
    if (objIndex !== -1) objects.splice(objIndex, 1);

    if (isPortalTarget && Array.isArray(portals)) {
      for (let i = portals.length - 1; i >= 0; i -= 1) {
        const ref = portals[i];
        if (ref === target.userData?.portalRef || ref?.object3d === target || ref?.objectId === target.userData?.metaWorldLayerId) {
          portals.splice(i, 1);
        }
      }
      delete target.userData.portalRef;
    }

    if (isSpawnTarget) {
      removeSpawnRuntimeForTarget(target);
    }

    const colliderRef = target.userData?.colliderRef;
    if (colliderRef) {
      const cIndex = colliders.indexOf(colliderRef);
      if (cIndex !== -1) colliders.splice(cIndex, 1);
    }
    const collisionActionRef = target.userData?.collisionActionRef;
    if (collisionActionRef) {
      const idx = collisionActions.indexOf(collisionActionRef);
      if (idx !== -1) collisionActions.splice(idx, 1);
    }
    if (isPortalTarget && Array.isArray(collisionActions)) {
      for (let i = collisionActions.length - 1; i >= 0; i -= 1) {
        const ref = collisionActions[i];
        if (ref?.object3d === target || ref === collisionActionRef) collisionActions.splice(i, 1);
      }
    }
    const useTargetRef = target.userData?.useTargetRef;
    if (useTargetRef) {
      const idx = useTargets.indexOf(useTargetRef);
      if (idx !== -1) useTargets.splice(idx, 1);
    }
    if (Array.isArray(waterVolumes)) {
      for (let i = waterVolumes.length - 1; i >= 0; i -= 1) {
        const ref = waterVolumes[i];
        if (ref === target.userData?.waterVolumeRef || ref?.target === target || ref?.object3d === target) {
          waterVolumes.splice(i, 1);
        }
      }
      delete target.userData.waterVolumeRef;
    }

    const inventory = window.VRWorldContext?.inventory;
    const itemType = target.userData?.nvType;
    if (inventory?.addItem && typeof itemType === "string" && itemType) {
      if (
        itemType === "box"
        || itemType === "sphere"
        || itemType === "cylinder"
        || itemType === FLYING_CARPET_ITEM_ID
        || itemType === "console"
        || itemType === "portal"
        || itemType === "spawn"
        || itemType === "math-function"
        || itemType === "object-file"
        || itemType === "image-plane"
        || itemType === "iframe"
      ) {
        const label = itemType === FLYING_CARPET_ITEM_ID ? "Flying Carpet" : itemType.charAt(0).toUpperCase() + itemType.slice(1);
        inventory.addItem(itemType, 1, label);
        if (itemType === "object-file" && target.userData?.objectFilePath && inventory?.setSelectedObjectFile) {
          inventory.setSelectedObjectFile(target.userData.objectFilePath);
        }
        if (itemType === "image-plane" && target.userData?.imageFilePath && inventory?.setSelectedImageFile) {
          inventory.setSelectedImageFile(target.userData.imageFilePath);
        }
      }
    }

    return true;
  }

  function getWaterVolumeAtPosition(position) {
    if (!Array.isArray(waterVolumes) || waterVolumes.length === 0) return null;
    for (const water of waterVolumes) {
      if (typeof water?.containsPoint === "function" && water.containsPoint(position)) return water;
      if (!water?.box || typeof water.box.containsPoint !== "function") continue;
      if (water.box.containsPoint(position)) return water;
    }
    return null;
  }

  function getEquationPlaneRayHits() {
    const ray = raycaster.ray;
    return (objects || [])
      .filter((obj) => obj?.isMesh && obj?.visible && ["equation-collider-plane", "equation-inequality"].includes(String(obj.userData?.nvType || "").toLowerCase()))
      .map((mesh) => getPlaneRayIntersection(THREE, mesh, ray))
      .filter((hit) => hit && Number.isFinite(hit.distance) && hit.object?.visible);
  }

  function getPortalRefInspectHit() {
    if (!Array.isArray(portals) || portals.length === 0) return null;
    const hits = [];
    for (const portal of portals) {
      const target = portal?.object3d || null;
      if (target?.visible === false) continue;
      if (target?.updateWorldMatrix) {
        target.updateWorldMatrix(true, false);
        portal.box = new THREE.Box3().setFromObject(target);
      }
      const box = portal?.box;
      if (!box || box.isEmpty?.()) continue;
      const point = box.containsPoint(raycaster.ray.origin)
        ? boundsPickPoint.copy(raycaster.ray.origin)
        : raycaster.ray.intersectBox(box, boundsPickPoint);
      if (!point) continue;
      const distance = raycaster.ray.origin.distanceTo(point);
      if (!Number.isFinite(distance) || distance > useRangeMax) continue;
      if (!target) continue;
      markPortalInspectableTarget(target, portal);
      hits.push({
        distance,
        point: point.clone(),
        object: target,
        portalRef: portal,
        boundsPick: true
      });
    }
    return hits.sort((a, b) => a.distance - b.distance)[0] || null;
  }

  function collectPortalInspectCandidates() {
    const candidates = [];
    const seen = new Set();
    const add = (target, portalRef = null) => {
      if (!target || target.visible === false || seen.has(target)) return;
      if (portalRef) {
        markPortalInspectableTarget(target, portalRef);
      } else if (!isPortalLikeTarget(target)) {
        return;
      }
      seen.add(target);
      candidates.push(target);
    };
    (objects || []).forEach((target) => add(target));
    if (Array.isArray(portals)) {
      portals.forEach((portal) => add(portal?.object3d, portal));
    }
    return candidates;
  }

  function getPortalInspectFallbackHit() {
    raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    const hits = [];
    const maxDistance = Math.max(useRangeMax, 40);
    for (const target of collectPortalInspectCandidates()) {
      target.updateWorldMatrix?.(true, false);
      const box = new THREE.Box3().setFromObject(target);
      if (box.isEmpty()) continue;
      const directPoint = box.containsPoint(raycaster.ray.origin)
        ? raycaster.ray.origin.clone()
        : raycaster.ray.intersectBox(box, new THREE.Vector3());
      if (directPoint) {
        const distance = raycaster.ray.origin.distanceTo(directPoint);
        if (Number.isFinite(distance) && distance <= maxDistance) {
          hits.push({ distance, point: directPoint.clone(), object: target, boundsPick: true, portalFallback: true });
        }
        continue;
      }

      const center = box.getCenter(new THREE.Vector3());
      const toCenter = center.clone().sub(raycaster.ray.origin);
      const projected = toCenter.dot(raycaster.ray.direction);
      if (!Number.isFinite(projected) || projected < 0 || projected > maxDistance) continue;
      const closest = raycaster.ray.origin.clone().addScaledVector(raycaster.ray.direction, projected);
      const size = box.getSize(new THREE.Vector3());
      const pickRadius = Math.max(0.55, Math.min(1.75, size.length() * 0.35));
      if (center.distanceTo(closest) > pickRadius) continue;
      hits.push({ distance: projected, point: center, object: target, boundsPick: true, portalFallback: true });
    }
    return hits.sort((a, b) => a.distance - b.distance)[0] || null;
  }

  function getInspectHit(options = {}) {
    raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    const includeMeasurements = options.includeMeasurements === true;
    const worldCandidates = (objects || []).filter((obj) => obj?.isMesh && obj?.visible);
    const measureCandidates = includeMeasurements ? getMeasurementVisualsStore().filter((obj) => obj?.isMesh && obj?.visible) : [];
    const split = splitBoundsPickCandidates(worldCandidates);
    const meshHits = raycaster
      .intersectObjects(split.raycast.concat(measureCandidates), false)
      .filter((h) => Number.isFinite(h.distance) && h.distance <= useRangeMax && h.object?.visible);
    const boundsHits = split.bounds
      .map(boundsPickHit)
      .filter(Boolean);
    const planeHits = options.allowInfinitePlanes === false ? [] : getEquationPlaneRayHits();
    const portalRefHit = getPortalRefInspectHit();
    return meshHits.concat(boundsHits, planeHits, portalRefHit ? [portalRefHit] : []).sort((a, b) => a.distance - b.distance)[0] || null;
  }

  function clearStlVertexMarkers() {
    stlVertexMarkers.forEach((m) => {
      if (m?.parent) m.parent.remove(m);
      m.geometry?.dispose?.();
      m.material?.dispose?.();
    });
    stlVertexMarkers.length = 0;
  }

  function refreshStlVertexMarkers() {
    clearStlVertexMarkers();
    if (!movementState.stlEdit || !Array.isArray(movementState.stlVertices)) return;
    if (movementState.stlVertices.length > 500) return; // avoid flooding scene for dense meshes
    const mat = new THREE.MeshStandardMaterial({ color: 0xff8844, emissive: 0xff6600, emissiveIntensity: 0.35 });
    for (const v of movementState.stlVertices) {
      const marker = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 10), mat.clone());
      marker.position.set(v.x || 0, v.y || 0, v.z || 0);
      marker.userData.isStlVertex = true;
      scene.add(marker);
      stlVertexMarkers.push(marker);
    }
  }

  function addStlVertex(point) {
    if (!movementState.stlEdit) return false;
    if (!Array.isArray(movementState.stlVertices)) movementState.stlVertices = [];
    movementState.stlVertices.push({ x: point.x, y: point.y, z: point.z });
    movementState.stlNeedsMarkerRefresh = true;
    return true;
  }

  function applyColorToMeshTarget(target, colorHex) {
    if (!target || !colorHex) return;
    const queue = [];
    target.traverse?.((node) => {
      if (node?.isMesh) queue.push(node);
    });
    if (queue.length === 0 && target?.isMesh) queue.push(target);
    queue.forEach((mesh) => {
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((mat) => {
          if (mat?.color) mat.color.set(colorHex);
        });
      } else if (mesh.material?.color) {
        mesh.material.color.set(colorHex);
      }
    });
  }

  function applyConsoleConfig(target, config) {
    if (!target || !config) return;
    if (config.color) {
      applyColorToMeshTarget(target, config.color);
    }
    setBoxColliderEnabled(target, config.collider);
    const existing = target.userData?.consoleProperties || {};
    target.userData.consoleProperties = {
      ...existing,
      color: config.color || existing.color,
      collider: config.collider !== false,
      objectFile: config.objectFile || existing.objectFile || "",
      linkedObject: config.linkedObject || existing.linkedObject || ""
    };
  }

  function setBoxColliderEnabled(target, enabled) {
    if (!target) return;
    const existing = target.userData?.colliderRef;
    if (!enabled && existing) {
      const idx = colliders.indexOf(existing);
      if (idx !== -1) colliders.splice(idx, 1);
      delete target.userData.colliderRef;
      return;
    }
    if (enabled && !existing) {
      const colliderRef = { type: "box", box: new THREE.Box3().setFromObject(target) };
      colliders.push(colliderRef);
      target.userData.colliderRef = colliderRef;
      target.userData.objectFileColliderFactory?.(colliderRef);
      return;
    }
    if (enabled && existing) {
      if (existing.type === "compound" && typeof existing.update === "function") existing.update();
      else existing.box = new THREE.Box3().setFromObject(target);
    }
  }

  function tryUseConsoleTarget() {
    const hit = getInspectHit();
    const consoleMesh = hit?.object;
    if (!consoleMesh || String(consoleMesh.userData?.nvType || "").toLowerCase() !== "console") return false;
    consolePanels?.openUsePanel?.(consoleMesh);
    return true;
  }

  function openInspectTarget(target, distance = null) {
    if (!target) return false;
    const type = String(target.userData?.nvType || "").toLowerCase();
    if (["equation-collider-plane", "equation-inequality"].includes(type) && window.VRWorldContext?.equationObjectsPanel?.openForTarget) {
      return window.VRWorldContext.equationObjectsPanel.openForTarget(target);
    }
    if (type === "console" && consolePanels?.openInspectPanel) {
      return consolePanels.openInspectPanel(target, distance, {
        onApply: (mesh, config) => {
          applyConsoleConfig(mesh, config);
        }
      });
    }
    if (objectInspector) {
      return objectInspector.inspectTarget(target, distance);
    }
    return false;
  }

  function handleInspectAction() {
    const hit = getInspectHit();
    if (hit?.object && openInspectTarget(hit.object, hit.distance)) return true;

    const portalHit = getPortalInspectFallbackHit();
    if (portalHit?.object && openInspectTarget(portalHit.object, portalHit.distance)) return true;

    if (!hit) {
      objectInspector?.hide?.();
      worldPropertiesPanel?.open?.();
      return true;
    }
    objectInspector?.hide?.();
    return false;
  }

  return function update() {
    // Ensure wheel handler is always present so scroll works after turning 180°.
    ensureWheelHandler();
    const focusedElement = document.activeElement;
    const typingIntoField = focusedElement && (
      ["INPUT", "TEXTAREA", "SELECT"].includes(focusedElement.tagName)
      || focusedElement.isContentEditable === true
    );
    const unlockedBindings = typeof getBindings === "function" ? getBindings() : {};
    const unlockedInspectKey = String(unlockedBindings.inspect || "y").toLowerCase();
    const unlockedInspecting = !typingIntoField && (heldKeys?.[unlockedInspectKey] || heldKeys?.y);
    const listenerPosition = controls?.getObject?.()?.position || camera?.position || null;
    updateSoundObjectRuntimes(listenerPosition);
    if (!controls.isLocked) {
      // Keep grabbed objects in sync even when pointer lock drops.
      updateGrabbedObjectFollow();
      updateGizmoHandleOrientations();
      if (unlockedInspecting && !movementState.inspectLatch) {
        movementState.inspectLatch = true;
        movementState.lastInspectMs = performance.now();
        if (handleInspectAction()) return;
      } else if (!unlockedInspecting) {
        movementState.inspectLatch = false;
      }
      return;
    }
    if (movementState.stlEdit) {
      if (movementState.stlNeedsMarkerRefresh) {
        refreshStlVertexMarkers();
        movementState.stlNeedsMarkerRefresh = false;
      }
    } else if (stlVertexMarkers.length) {
      clearStlVertexMarkers();
    }
    ensureWheelHandler();
    const nowMs = performance.now();
    const baseSpeed = 0.2;
    const bindings = getBindings();
    const inputState = buildInputState(bindings);
    const crouching = inputState.crouch;
    const crawling = inputState.crawl;
    let using = inputState.use;       // place
    let grabbing = inputState.grab;   // left click
    let stretching = inputState.stretch; // 'g' toggle for stretch gizmo
    let rotating = inputState.rotate;    // right click toggles rotation gizmo
    const attacking = inputState.attack; // destroy (t)
    const inspecting = inputState.inspect;
    const inventory = window.VRWorldContext?.inventory;
    const inEditorMode = playerMode() === "creative";
    const speed = baseSpeed * runSpeedMultiplier(inputState, { crouching, crawling });

    if (inputState.openInventory && !inventoryToggleLatch) {
      inventoryToggleLatch = true;
      if (inventory?.toggleMenu) inventory.toggleMenu();
    } else if (!inputState.openInventory) {
      inventoryToggleLatch = false;
    }

    if (inputState.handSwitch && !inventoryHandSwitchLatch) {
      inventoryHandSwitchLatch = true;
      inventory?.switchHand?.();
    } else if (!inputState.handSwitch) {
      inventoryHandSwitchLatch = false;
    }

    if (Number.isInteger(inputState.hotbarSlot) && hotbarSlotLatch !== inputState.hotbarSlot) {
      hotbarSlotLatch = inputState.hotbarSlot;
      inventory?.selectDominantSlot?.(inputState.hotbarSlot);
    } else if (!Number.isInteger(inputState.hotbarSlot)) {
      hotbarSlotLatch = null;
    }

    if (movementState.skipClickFrame) {
      using = false;
      // keep grabbing true so drag state stays latched
      stretching = false;
      // skipClickFrame – suppressing use/stretch only
      movementState.skipClickFrame = false;
    }

    if (movementState.stlEdit) {
      if (using && !movementState.stlPlaceLatch) {
        const hit = getInspectHit();
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        const origin = controls.getObject().position.clone();
        const point = hit?.point?.clone?.() || origin.addScaledVector(dir, 2);
        addStlVertex(point);
        movementState.stlPlaceLatch = true;
        return;
      }
      if (!using) movementState.stlPlaceLatch = false;
    }

    if (inventory?.isMenuOpen?.()) {
      if (inputState.inventoryMenuUp && !inventoryMenuUpLatch) {
        inventoryMenuUpLatch = true;
        inventory.moveSelection?.(0, -1);
      } else if (!inputState.inventoryMenuUp) {
        inventoryMenuUpLatch = false;
      }
      if (inputState.inventoryMenuDown && !inventoryMenuDownLatch) {
        inventoryMenuDownLatch = true;
        inventory.moveSelection?.(0, 1);
      } else if (!inputState.inventoryMenuDown) {
        inventoryMenuDownLatch = false;
      }
      if (inputState.inventoryMenuLeft && !inventoryMenuLeftLatch) {
        inventoryMenuLeftLatch = true;
        inventory.moveSelection?.(-1, 0);
      } else if (!inputState.inventoryMenuLeft) {
        inventoryMenuLeftLatch = false;
      }
      if (inputState.inventoryMenuRight && !inventoryMenuRightLatch) {
        inventoryMenuRightLatch = true;
        inventory.moveSelection?.(1, 0);
      } else if (!inputState.inventoryMenuRight) {
        inventoryMenuRightLatch = false;
      }
      if (inputState.inventoryMenuConfirm && !inventoryMenuConfirmLatch) {
        inventoryMenuConfirmLatch = true;
        inventory.applySelection?.();
        // Keep the menu open so the player can immediately change items again
      } else if (!inputState.inventoryMenuConfirm) {
        inventoryMenuConfirmLatch = false;
      }
      return;
    }
    inventoryMenuUpLatch = false;
    inventoryMenuDownLatch = false;
    inventoryMenuLeftLatch = false;
    inventoryMenuRightLatch = false;
    inventoryMenuConfirmLatch = false;

    if (!inEditorMode && movementState.phaseThroughObjects === true) {
      movementState.phaseThroughObjects = false;
      setStatus("Object phasing disabled outside editor mode.");
    }
    if (inEditorMode && inputState.phase && !phaseToggleLatch) {
      movementState.phaseThroughObjects = movementState.phaseThroughObjects !== true;
      phaseToggleLatch = true;
      setStatus(movementState.phaseThroughObjects ? "Object phasing on. World floor still blocks movement." : "Object phasing off.");
    } else if (!inputState.phase) {
      phaseToggleLatch = false;
    }

    const editorGravityEnabled = movementState.editorGravityEnabled !== false;
    const editorGravityDisabled = inEditorMode && !editorGravityEnabled;
    if (editorGravityDisabled) {
      movementState.velocityY = 0;
    }

    if (inputState.fly && !movementState.flyToggleLatch) {
      if (canUseAbility("allowFly")) {
        movementState.isFlying = !movementState.isFlying;
      }
      movementState.flyToggleLatch = true;
    }
    if (!inputState.fly) movementState.flyToggleLatch = false;
    if (!using) {
      movementState.useLatch = false;
      movementState.lastUseActionMs = 0;
      movementState.svgToolLatch = false;
      movementState.terrainToolLatch = false;
      movementState.temporalToolLatch = false;
    }
    if (!grabbing) {
      movementState.grabLatch = false;
    }
    if (!stretching) {
      movementState.stretchLatch = false;
      movementState.selectedItemAdjustLatch = false;
    }
    if (!attacking) movementState.attackLatch = false;
    if (!inspecting) movementState.inspectLatch = false;
    if (!movementState.isFlying) {
      movementState.playerHeight = crawling ? crawlHeight : crouching ? crouchHeight : basePlayerHeight;
    }
    if (movementState.worldMode === "2d" && movementState.cameraMode === "side" && Number.isFinite(movementState.planeZ)) {
      controls.getObject().position.z = movementState.planeZ;
    }
    if (!inEditorMode && grabbedState) {
      releaseGrabbedObject();
    }
    if (!inEditorMode && stretchState) {
      disposeStretchState();
    }
    if (stretchState && (!stretchState.target?.isMesh || !stretchState.target.parent)) {
      disposeStretchState();
    }
    if (!inEditorMode && translateState) {
      disposeTranslateState();
    }
    if (translateState && (!translateState.target?.isMesh || !translateState.target.parent)) {
      disposeTranslateState();
    }
    if (!inEditorMode && rotateState) {
      disposeRotateState();
    }
    if (rotateState && (!rotateState.target?.isMesh || !rotateState.target.parent)) {
      disposeRotateState();
    }
    if (!Number.isFinite(movementState.lastInspectMs)) {
      movementState.lastInspectMs = 0;
    }

    const playerPos = controls.getObject().position;
    const mountedVehicle = getActiveMountedVehicle();
    let swimActive = false;
    let movementGroundLevel = groundLevel;

    updateGrabbedObjectFollow();
    updateGizmoHandleOrientations();

    if (mountedVehicle) {
      movementState.playerHeight = basePlayerHeight;
      movementState.isSwimming = false;
      updateMountedFlyingCarpet(mountedVehicle, inputState, speed);
    } else {
      const torsoPosition = playerPos.clone();
      torsoPosition.y = playerPos.y - Math.max(0.35, movementState.playerHeight * 0.45);
      const activeWaterVolume = getWaterVolumeAtPosition(torsoPosition);
      swimActive = Boolean(activeWaterVolume);
      movementState.isSwimming = swimActive;

      applyDirectionalMovement({
        THREE,
        controls,
        movementState,
        inputState,
        forward,
        right,
        up,
        speed,
        crawling,
        crouching,
        wouldCollide,
        stepHeight,
        allowVerticalMovement: movementState.isFlying || swimActive
      });

      movementGroundLevel = sampleExpressionTerrainGroundLevel(controls.getObject().position, groundLevel);

      if (movementState.isFlying || swimActive) {
        const buoyancyBase = Number.isFinite(movementState.playerBuoyancy) ? movementState.playerBuoyancy : 0;
        const waterScale = swimActive && Number.isFinite(activeWaterVolume?.buoyancyScale) ? activeWaterVolume.buoyancyScale : 1;
        const buoyancy = swimActive ? buoyancyBase * waterScale : 0;
        const swimSpeed = swimActive
          ? speed * (Number.isFinite(movementState.swimSpeedMultiplier) ? movementState.swimSpeedMultiplier : baseSwimSpeedMultiplier)
          : speed;
        movementState.isGrounded = false;
        applyFlyingMovement({ THREE, controls, inputState, speed: swimSpeed, wouldCollide, buoyancy });
      } else if (editorGravityDisabled) {
        movementState.isGrounded = false;
      } else {
        applyGroundMovement({
          controls,
          inputState,
          movementState,
          gravity,
          jumpSpeed,
          crouching,
          crouchJumpMultiplier: Number.isFinite(movementState.crouchJumpMultiplier)
            ? movementState.crouchJumpMultiplier
            : defaultCrouchJumpMultiplier,
          groundLevel: movementGroundLevel,
          wouldCollide,
          resolveGroundBounce: bounceConfigForCollider
        });
      }
    }

    if (!mountedVehicle && !movementState.isFlying && !swimActive) {
      const onExpressionGround = movementState.isGrounded === true
        && movementState.pendingExpressionTerrainColliderId
        && movementGroundLevel > groundLevel + 0.001;
      movementState.activeExpressionTerrainColliderId = onExpressionGround
        ? movementState.pendingExpressionTerrainColliderId
        : null;
    }

    if (movementState.phaseThroughObjects === true) {
      const floorY = movementGroundLevel + movementState.playerHeight;
      if (playerPos.y < floorY) {
        playerPos.y = floorY;
        movementState.velocityY = Math.max(0, movementState.velocityY || 0);
        movementState.isGrounded = true;
      }
    }

    if (movementState.worldMode !== "2d" && (Math.abs(inputState.lookYaw) > 0 || Math.abs(inputState.lookPitch) > 0)) {
      const virtualMouseDx = inputState.lookYaw * gamepadLookMouseScale;
      const virtualMouseDy = inputState.lookPitch * gamepadLookMouseScale;
      applyMouseLikeLookDelta(virtualMouseDx, virtualMouseDy);
    }

    if (inputState.cycleCamera && !cycleCameraLatch) {
      movementState.requestCycleCamera = true;
      cycleCameraLatch = true;
    } else if (!inputState.cycleCamera) {
      cycleCameraLatch = false;
    }

    if (inputState.pause && !pauseLatch) {
      controls.unlock();
      pauseLatch = true;
    } else if (!inputState.pause) {
      pauseLatch = false;
    }

    if (inputState.standUp && !movementState.standUpLatch) {
      if (canUseAbility("allowRoll") || canUseAbility("allowPitch")) {
        applyStandUpAlignment();
        setStatus("Player stood up.");
      } else {
        setStatus("Stand up is not available in this world.");
      }
      movementState.standUpLatch = true;
    } else if (!inputState.standUp) {
      movementState.standUpLatch = false;
    }

    const rollPitchInput = {
      ...inputState,
      rollLeft: canUseAbility("allowRoll") ? inputState.rollLeft : false,
      rollRight: canUseAbility("allowRoll") ? inputState.rollRight : false,
      pitchUp: canUseAbility("allowPitch") ? inputState.pitchUp : false,
      pitchDown: canUseAbility("allowPitch") ? inputState.pitchDown : false
    };
    applyRollPitch({ camera, inputState: rollPitchInput });
    updateTapeMeasurePreview();

    if (inspecting && !movementState.inspectLatch) {
      movementState.inspectLatch = true;
      movementState.lastInspectMs = nowMs;
      if (handleInspectAction()) return;
    }

    const actionHit = inspecting ? null : findCollisionActionHit(controls.getObject().position, performance.now());
    if (actionHit) {
      for (const action of actionHit.actions) {
        applyCollisionAction(action);
      }
      return;
    }

    const lastUseActionMs = Number(movementState.lastUseActionMs || 0);
    const canRepeatUse = movementState.useLatch && (nowMs - lastUseActionMs >= useRepeatMs);

    if (stretchState?.dragging || rotateState?.dragging) {
      movementState.grabLatch = true;
    }
    const newGrabPress = grabbing && !movementState.grabLatch && !stretchState?.dragging && !rotateState?.dragging;
    if (newGrabPress) {
      const clickHit = getInspectHit();
      const clickUseRef = clickHit?.object?.userData?.useTargetRef;
      if (clickUseRef?.actions?.length) {
        movementState.grabLatch = true;
        for (const action of clickUseRef.actions) {
          applyCollisionAction(action);
        }
        movementState.suppressAttackUntilMs = nowMs + 220;
        return;
      }
    }
    if (newGrabPress && inEditorMode) {
      movementState.grabLatch = true;
      const nowClick = nowMs;
      const lastClick = movementState.lastLeftClickMs || 0;
      const isDoubleClick = (nowClick - lastClick) <= doubleClickMs;
      movementState.lastLeftClickMs = nowClick;

      if (isDoubleClick) {
        if (translateState?.dragging) {
          return;
        }
        disposeTranslateState();
        if (grabbedState) {
          releaseGrabbedObject();
          movementState.suppressAttackUntilMs = nowMs + 200;
          return;
        }
        const grabHit = getInspectHit();
        if (grabHit?.object && startGrabFromHit(grabHit)) {
          movementState.suppressAttackUntilMs = nowMs + 200;
          return;
        }
        // Double-click with no target: do nothing.
      } else {
        if (translateState?.dragging) {
          return;
        }
        disposeTranslateState();
        const translateHit = getInspectHit();
        if (translateHit?.object) {
          createTranslateGizmo(translateHit.object);
          movementState.suppressAttackUntilMs = nowMs + 180;
          return;
        }
      }
    }

    const newAdjustPress = stretching && !movementState.selectedItemAdjustLatch;
    if (newAdjustPress) {
      movementState.selectedItemAdjustLatch = true;
      if (handleSelectedItemAction("adjust", { nowMs })) {
        movementState.stretchLatch = true;
        return;
      }
    }

    const newStretchPress = stretching && !movementState.stretchLatch;
    if (newStretchPress && inEditorMode) {
      movementState.stretchLatch = true;
      disposeTranslateState();
      disposeRotateState();
      if (stretchState) {
        disposeStretchState();
      } else {
        const stretchHit = getInspectHit();
        if (stretchHit?.object) {
          createStretchGizmo(stretchHit.object);
        }
      }
    }

    const newRotatePress = rotating && !movementState.rotateLatch;
    if (newRotatePress && inEditorMode) {
      const nowClick = nowMs;
      const lastRightClick = movementState.lastRightClickMs || 0;
      const isDoubleRightClick = (nowClick - lastRightClick) <= doubleClickMs;
      movementState.lastRightClickMs = nowClick;

      // Double right-click toggles stretch gizmo
      if (isDoubleRightClick) {
        movementState.rotateLatch = true;
        disposeTranslateState();
        disposeRotateState();
        if (stretchState) {
          disposeStretchState();
        } else {
          const stretchHit = getInspectHit();
          if (stretchHit?.object) {
            createStretchGizmo(stretchHit.object);
          }
        }
        return;
      }

      // Single right-click toggles rotation gizmo
      movementState.rotateLatch = true;
      disposeTranslateState();
      disposeStretchState();
      if (rotateState) {
        disposeRotateState();
      } else {
        const rotHit = getInspectHit();
        if (rotHit?.object) {
          createRotateGizmo(rotHit.object);
        }
      }
    }
    if (!rotating) movementState.rotateLatch = false;
    if (using && (!movementState.useLatch || canRepeatUse)) {
      if (grabbedState) return;
      movementState.useLatch = true;
      movementState.lastUseActionMs = nowMs;
      // Same physical input can map to both use + attack (e.g. RB). Suppress attack for this press window.
      movementState.attackLatch = true;
      movementState.suppressAttackUntilMs = nowMs + 180;
      if (tryUseFlyingCarpet()) {
        movementState.suppressAttackUntilMs = nowMs + 220;
        return;
      }
      if (handleSelectedItemAction("use", { snapToGrid: !!inputState.snapPlace, nowMs })) {
        movementState.suppressAttackUntilMs = nowMs + 220;
        return;
      }
      if (tryPaintTerrain()) {
        movementState.suppressAttackUntilMs = nowMs + 220;
        return;
      }
      const useHit = findUseTarget(controls.getObject().position, performance.now());
      if (useHit) {
        for (const action of useHit.actions) {
          applyCollisionAction(action);
        }
        return;
      }
      if (tryUseConsoleTarget()) {
        movementState.suppressAttackUntilMs = nowMs + 220;
        return;
      }
      if (tryUseSelectedTool()) {
        movementState.suppressAttackUntilMs = nowMs + 220;
        return;
      }
      if (tryPlaceSelectedInventoryItem({ snapToGrid: !!inputState.snapPlace })) {
        movementState.suppressAttackUntilMs = nowMs + 260;
        return;
      }
    }

    if (attacking && !movementState.attackLatch && nowMs >= (movementState.suppressAttackUntilMs || 0)) {
      movementState.attackLatch = true;
      if (handleSelectedItemAction("attack", { nowMs })) {
        return;
      }
      if (tryBreakTargetBlock()) {
        return;
      }
    }

    if (!inspecting) {
      const portalHit = findPortalHit(controls.getObject().position, performance.now());
      if (portalHit) {
        applyPortalTravel(portalHit);
      }
    }
  };
}
