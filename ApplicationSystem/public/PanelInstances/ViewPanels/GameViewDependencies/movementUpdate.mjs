// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/movementUpdate.mjs
// This file defines browser-side movement Update logic for the Nodevision UI. It renders interface components and handles user interactions.

import { createCollisionChecker } from "./collisionCheck.mjs";
import { applyDirectionalMovement, applyFlyingMovement, applyGroundMovement, applyRollPitch } from "./movementSteps.mjs";
import { triggerSvgCameraCapture } from "./svgCameraTool.mjs";

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

  function getPlacementHit() {
    raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    const objectCandidates = (objects || []).filter((obj) => obj?.isMesh && obj?.visible);
    const candidates = [];
    if (ground?.visible) candidates.push(ground);
    candidates.push(...objectCandidates);
    const hits = raycaster.intersectObjects(candidates, false);
    return hits.find((h) => Number.isFinite(h.distance) && h.distance <= useRangeMax && h.object?.visible) || null;
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

    const ref = grabbedState.colliderRef;
    if (ref?.type === "box" && ref.box) {
      const half = resolveHalfExtents(ref);
      ref.box.min.set(pos.x - half.x, pos.y - half.y, pos.z - half.z);
      ref.box.max.set(pos.x + half.x, pos.y + half.y, pos.z + half.z);
    } else if (ref?.type === "sphere" && ref.center) {
      ref.center.copy(pos);
    } else if (ref?.type === "cylinder") {
      ref.center = pos.clone();
    }
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

  function updateColliderForTarget(target) {
    const ref = target?.userData?.colliderRef;
    if (!ref) return;
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
        box: new THREE.Box3(
          new THREE.Vector3(placePos.x - half.x, placePos.y - half.y, placePos.z - half.z),
          new THREE.Vector3(placePos.x + half.x, placePos.y + half.y, placePos.z + half.z)
        )
      };
      colliders.push(colliderRef);
      mesh.userData.colliderRef = colliderRef;
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

  movementState.playerHeight = basePlayerHeight;
  const wouldCollide = createCollisionChecker({ colliders, movementState, playerRadius });

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

    const forward = readGamepadBinding(gp, gpBindings.moveForward);
    const backward = readGamepadBinding(gp, gpBindings.moveBackward);
    const left = readGamepadBinding(gp, gpBindings.moveLeft);
    const rightward = readGamepadBinding(gp, gpBindings.moveRight);

    const moveForward = heldKeys[bindings.moveForward] || forward > 0;
    const moveBackward = heldKeys[bindings.moveBackward] || backward > 0;
    const moveLeft = heldKeys[bindings.moveLeft] || left > 0;
    const moveRight = heldKeys[bindings.moveRight] || rightward > 0;

    const jump = heldKeys[bindings.jump] || readGamepadBinding(gp, gpBindings.jump) > 0;
    const crouch = heldKeys[bindings.crouch];
    const crawl = heldKeys[bindings.crawl];
    const useBinding = String(bindings.use || "").toLowerCase();
    const useBindingIsMouse0 = useBinding === "mouse0";
    const use = (!useBindingIsMouse0 && heldKeys[bindings.use]) || heldKeys.r || readGamepadBinding(gp, gpBindings.use) > 0 || rightBumperPressed; // place
    const grab = heldKeys.mouse0; // left click (translate select / grab on double)
    const stretch = heldKeys.g; // keyboard stretch toggle (double right-click handled separately)
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

    const rollLeft = heldKeys[bindings.rollLeft];
    const rollRight = heldKeys[bindings.rollRight];
    const pitchUp = heldKeys[bindings.pitchUp];
    const pitchDown = heldKeys[bindings.pitchDown];

    const lookYaw = readGamepadBinding(gp, gpBindings.lookYaw);
    const lookPitch = readGamepadBinding(gp, gpBindings.lookPitch);

    const cycleCamera = heldKeys[bindings.cycleCamera] || heldKeys.u || readGamepadBinding(gp, gpBindings.cycleCamera) > 0;
    const pause = heldKeys[bindings.pause] || readGamepadBinding(gp, gpBindings.pause) > 0;
    const openInventory = heldKeys[bindings.openInventory] || readGamepadBinding(gp, gpBindings.openInventory) > 0;
    const inventoryMenuUp = heldKeys.arrowup || !!gp?.buttons?.[12]?.pressed;
    const inventoryMenuDown = heldKeys.arrowdown || !!gp?.buttons?.[13]?.pressed;
    const inventoryMenuLeft = heldKeys.arrowleft || !!gp?.buttons?.[14]?.pressed;
    const inventoryMenuRight = heldKeys.arrowright || !!gp?.buttons?.[15]?.pressed;
    const inventoryMenuConfirm = heldKeys.enter || readGamepadBinding(gp, gpBindings.jump) > 0;

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
      rollLeft,
      rollRight,
      pitchUp,
      pitchDown,
      lookYaw,
      lookPitch,
      cycleCamera,
      pause,
      openInventory,
      inventoryMenuUp,
      inventoryMenuDown,
      inventoryMenuLeft,
      inventoryMenuRight,
      inventoryMenuConfirm
    };
  }

  function applyMouseLikeLookDelta(deltaX, deltaY) {
    if (!Number.isFinite(deltaX) && !Number.isFinite(deltaY)) return;
    const dx = Number.isFinite(deltaX) ? deltaX : 0;
    const dy = Number.isFinite(deltaY) ? deltaY : 0;
    if (dx === 0 && dy === 0) return;

    const pointerSpeed = Number.isFinite(controls.pointerSpeed) ? controls.pointerSpeed : 1;
    const minPolar = Number.isFinite(controls.minPolarAngle) ? controls.minPolarAngle : 0;
    const maxPolar = Number.isFinite(controls.maxPolarAngle) ? controls.maxPolarAngle : Math.PI;

    mouseLikeEuler.setFromQuaternion(camera.quaternion);
    mouseLikeEuler.y -= dx * 0.002 * pointerSpeed;
    mouseLikeEuler.x -= dy * 0.002 * pointerSpeed;
    mouseLikeEuler.x = Math.max(halfPi - maxPolar, Math.min(halfPi - minPolar, mouseLikeEuler.x));
    camera.quaternion.setFromEuler(mouseLikeEuler);
  }

  function isSameWorldTarget(value) {
    if (typeof value !== "string") return false;
    const normalized = value.trim().toLowerCase();
    return normalized === "self" || normalized === "." || normalized === "same" || normalized === "current";
  }

  function findPortalHit(position, nowMs) {
    if (!portals || portals.length === 0) return null;
    const playerMinY = position.y - movementState.playerHeight;
    const playerMaxY = position.y;
    for (const portal of portals) {
      if (!portal?.box || (!portal?.targetWorld && !portal?.sameWorld)) continue;
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
    if (Array.isArray(spawnPoints) && spawnPoints.length > 0) {
      if (typeof spawnPointId === "string" && spawnPointId.trim()) {
        const match = spawnPoints.find(point => point?.id === spawnPointId.trim());
        if (match?.position) return match;
      }
      const idx = Math.floor(Math.random() * spawnPoints.length);
      const fallback = spawnPoints[idx];
      if (fallback?.position) return fallback;
    }
    return { position: [0, 0, 0], yaw: null };
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

  function applyCollisionAction(action) {
    if (!action || !action.type) return;
    if (action.type === "portal") {
      const sameWorld = action.sameWorld === true || isSameWorldTarget(action.targetWorld);
      const targetWorld = sameWorld ? null : action.targetWorld;
      const hasSpawn = Array.isArray(action.spawn) && action.spawn.length >= 3;
      if (!sameWorld) {
        if (!targetWorld || typeof loadWorldFromFile !== "function") {
          console.warn("Portal action missing targetWorld or loader.", action);
          return;
        }
        loadWorldFromFile(targetWorld, {
          spawnPoint: typeof action.spawnPoint === "string" ? action.spawnPoint : null,
          spawnYaw: Number.isFinite(action.spawnYaw) ? action.spawnYaw : null,
          skipAutoSpawn: hasSpawn
        });
      }
      if (hasSpawn) {
        controls.getObject().position.set(action.spawn[0], action.spawn[1], action.spawn[2]);
        movementState.velocityY = 0;
        movementState.isGrounded = true;
        if (Number.isFinite(action.spawnYaw)) {
          controls.getObject().rotation.y = action.spawnYaw;
        }
      } else if (sameWorld && typeof action.spawnPoint === "string") {
        applySpawnChoice(action.spawnPoint, action.spawnYaw);
      }
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

  function intersectsExistingColliders(position, shape) {
    if (!shape) return false;
    const overlapEpsilon = 0.001;

    function boxesPenetrate(a, b) {
      const overlapX = Math.min(a.max.x, b.max.x) - Math.max(a.min.x, b.min.x);
      const overlapY = Math.min(a.max.y, b.max.y) - Math.max(a.min.y, b.min.y);
      const overlapZ = Math.min(a.max.z, b.max.z) - Math.max(a.min.z, b.min.z);
      return overlapX > overlapEpsilon && overlapY > overlapEpsilon && overlapZ > overlapEpsilon;
    }

    for (const collider of colliders) {
      if (shape.type === "box" && collider.type === "box") {
        const newBox = new THREE.Box3(
          new THREE.Vector3(position.x - shape.half.x, position.y - shape.half.y, position.z - shape.half.z),
          new THREE.Vector3(position.x + shape.half.x, position.y + shape.half.y, position.z + shape.half.z)
        );
        if (boxesPenetrate(newBox, collider.box)) return true;
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
    const candidates = (objects || []).filter((obj) => (
      obj?.isMesh
      && obj?.visible
      && obj?.userData?.isMeasure !== true
      && obj?.userData?.isWater !== true
    ));
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

    if (placement.collider?.type === "box") {
      const half = placement.collider.half;
      const colliderRef = {
        type: "box",
        box: new THREE.Box3(
          new THREE.Vector3(placePos.x - half.x, placePos.y - half.y, placePos.z - half.z),
          new THREE.Vector3(placePos.x + half.x, placePos.y + half.y, placePos.z + half.z)
        )
      };
      colliders.push(colliderRef);
      mesh.userData.colliderRef = colliderRef;
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

  function tryUseSelectedTool() {
    if (movementState.worldMode === "2d") return false;
    if (!canUseAbility("allowToolUse")) return false;
    const inventory = window.VRWorldContext?.inventory;
    const selected = inventory?.getSelectedItem?.();
    if (!selected?.id) return false;
    const toolId = String(selected.id).toLowerCase();

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

    return false;
  }

  function tryBreakTargetBlock() {
    if (movementState.worldMode === "2d") return false;
    if (!canUseAbility("allowBreak")) return false;
    raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    const worldCandidates = (objects || []).filter((obj) => obj?.isMesh && obj?.visible);
    const measureCandidates = getMeasurementVisualsStore().filter((obj) => obj?.isMesh && obj?.visible);
    const candidates = worldCandidates.concat(measureCandidates);
    const hits = raycaster.intersectObjects(candidates, false);
    const hit = hits.find((h) => Number.isFinite(h.distance) && h.distance <= useRangeMax && h.object?.visible);
    if (!hit?.object) return false;
    const target = hit.object;
    if (target.userData?.isMeasureEndpoint === "second") {
      removeMeasurementVisual(target);
      movementState.tapeMeasureSecondMarker = null;
      movementState.tapeMeasureSecondPoint = null;
      updateTapeMeasurePreview();
      return true;
    }
    if (target.userData?.isPortal) return false;
    if (target.userData?.breakable === false) return false;
    if (!target.userData?.breakable && !target.userData?.placedByPlayer) return false;

    scene.remove(target);
    const objIndex = objects.indexOf(target);
    if (objIndex !== -1) objects.splice(objIndex, 1);

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
    const useTargetRef = target.userData?.useTargetRef;
    if (useTargetRef) {
      const idx = useTargets.indexOf(useTargetRef);
      if (idx !== -1) useTargets.splice(idx, 1);
    }

    const inventory = window.VRWorldContext?.inventory;
    const itemType = target.userData?.nvType;
    if (inventory?.addItem && typeof itemType === "string" && itemType) {
      if (
        itemType === "box"
        || itemType === "sphere"
        || itemType === "cylinder"
        || itemType === "console"
        || itemType === "math-function"
        || itemType === "object-file"
        || itemType === "image-plane"
      ) {
        inventory.addItem(itemType, 1, itemType.charAt(0).toUpperCase() + itemType.slice(1));
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
      if (!water?.box || typeof water.box.containsPoint !== "function") continue;
      if (water.box.containsPoint(position)) return water;
    }
    return null;
  }

  function getInspectHit() {
    raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    const candidates = (objects || []).filter((obj) => obj?.isMesh && obj?.visible);
    const hits = raycaster.intersectObjects(candidates, false);
    return hits.find((h) => Number.isFinite(h.distance) && h.distance <= useRangeMax && h.object?.visible) || null;
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
      return;
    }
    if (enabled && existing) {
      existing.box = new THREE.Box3().setFromObject(target);
    }
  }

  function tryUseConsoleTarget() {
    const hit = getInspectHit();
    const consoleMesh = hit?.object;
    if (!consoleMesh || String(consoleMesh.userData?.nvType || "").toLowerCase() !== "console") return false;
    consolePanels?.openUsePanel?.(consoleMesh);
    return true;
  }

  function handleInspectAction() {
    const hit = getInspectHit();
    const target = hit?.object;
    if (target) {
      const type = String(target.userData?.nvType || "").toLowerCase();
      if (type === "console" && consolePanels?.openInspectPanel) {
        return consolePanels.openInspectPanel(target, hit.distance, {
          onApply: (mesh, config) => {
            applyConsoleConfig(mesh, config);
          }
        });
      }
      if (objectInspector) {
        return objectInspector.inspectTarget(target, hit.distance);
      }
    }
    if (!hit) {
      worldPropertiesPanel?.open?.();
      return true;
    }
    return false;
  }

  return function update() {
    // Ensure wheel handler is always present so scroll works after turning 180°.
    ensureWheelHandler();
    if (!controls.isLocked) {
      // Keep grabbed objects in sync even when pointer lock drops.
      updateGrabbedObjectFollow();
      updateGizmoHandleOrientations();
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
    const speed = 0.2;
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

    if (inputState.openInventory && !inventoryToggleLatch) {
      inventoryToggleLatch = true;
      if (inventory?.toggleMenu) inventory.toggleMenu();
    } else if (!inputState.openInventory) {
      inventoryToggleLatch = false;
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
    }
    if (!grabbing) {
      movementState.grabLatch = false;
    }
    if (!stretching) {
      movementState.stretchLatch = false;
    }
    if (!attacking) movementState.attackLatch = false;
    // Allow repeated inspect/modify usage even on the same object; latch is not needed here.
    if (!inspecting) movementState.inspectLatch = false;
    if (!movementState.isFlying) {
      movementState.playerHeight = crawling ? crawlHeight : crouching ? crouchHeight : basePlayerHeight;
    }
    if (movementState.worldMode === "2d" && Number.isFinite(movementState.planeZ)) {
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
    const torsoPosition = playerPos.clone();
    torsoPosition.y = playerPos.y - Math.max(0.35, movementState.playerHeight * 0.45);
    const activeWaterVolume = getWaterVolumeAtPosition(torsoPosition);
    const swimActive = Boolean(activeWaterVolume);
    movementState.isSwimming = swimActive;

    updateGrabbedObjectFollow();
    updateGizmoHandleOrientations();

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

    if (movementState.isFlying || swimActive) {
      const buoyancyBase = Number.isFinite(movementState.playerBuoyancy) ? movementState.playerBuoyancy : 0;
      const waterScale = swimActive && Number.isFinite(activeWaterVolume?.buoyancyScale) ? activeWaterVolume.buoyancyScale : 1;
      const buoyancy = swimActive ? buoyancyBase * waterScale : 0;
      const swimSpeed = swimActive
        ? speed * (Number.isFinite(movementState.swimSpeedMultiplier) ? movementState.swimSpeedMultiplier : baseSwimSpeedMultiplier)
        : speed;
      movementState.isGrounded = false;
      applyFlyingMovement({ THREE, controls, inputState, speed: swimSpeed, wouldCollide, buoyancy });
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
        groundLevel,
        wouldCollide
      });
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

    const rollPitchInput = {
      ...inputState,
      rollLeft: canUseAbility("allowRoll") ? inputState.rollLeft : false,
      rollRight: canUseAbility("allowRoll") ? inputState.rollRight : false,
      pitchUp: canUseAbility("allowPitch") ? inputState.pitchUp : false,
      pitchDown: canUseAbility("allowPitch") ? inputState.pitchDown : false
    };
    applyRollPitch({ camera, inputState: rollPitchInput });
    updateTapeMeasurePreview();

    const actionHit = findCollisionActionHit(controls.getObject().position, performance.now());
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
      if (tryBreakTargetBlock()) {
        return;
      }
    }

    if (inspecting) {
      movementState.lastInspectMs = nowMs;
      movementState.inspectLatch = false;
      if (handleInspectAction()) return;
    }

    const portalHit = findPortalHit(controls.getObject().position, performance.now());
    if (portalHit) {
      const sameWorld = portalHit.sameWorld === true || isSameWorldTarget(portalHit.targetWorld);
      const hasSpawn = Array.isArray(portalHit.spawn) && portalHit.spawn.length >= 3;
      if (!sameWorld) {
        if (typeof loadWorldFromFile !== "function") return;
        loadWorldFromFile(portalHit.targetWorld, {
          spawnPoint: typeof portalHit.spawnPoint === "string" ? portalHit.spawnPoint : null,
          spawnYaw: Number.isFinite(portalHit.spawnYaw) ? portalHit.spawnYaw : null,
          skipAutoSpawn: hasSpawn
        });
      }
      if (hasSpawn) {
        controls.getObject().position.set(portalHit.spawn[0], portalHit.spawn[1], portalHit.spawn[2]);
        movementState.velocityY = 0;
        movementState.isGrounded = true;
        if (Number.isFinite(portalHit.spawnYaw)) {
          controls.getObject().rotation.y = portalHit.spawnYaw;
        }
      } else if (sameWorld && typeof portalHit.spawnPoint === "string") {
        applySpawnChoice(portalHit.spawnPoint, portalHit.spawnYaw);
      }
    }
  };
}
