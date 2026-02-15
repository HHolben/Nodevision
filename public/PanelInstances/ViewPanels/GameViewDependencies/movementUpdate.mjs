// Nodevision/public/PanelInstances/ViewPanels/GameViewDependencies/movementUpdate.mjs
// This file wires movement state to per-frame update logic.

import { createCollisionChecker } from "./collisionCheck.mjs";
import { applyDirectionalMovement, applyFlyingMovement, applyGroundMovement, applyRollPitch } from "./movementSteps.mjs";
import { triggerSvgCameraCapture } from "./svgCameraTool.mjs";

export function createMovementUpdater({ THREE, scene, objects, camera, controls, colliders, portals, collisionActions, useTargets, spawnPoints, loadWorldFromFile, getBindings, heldKeys, movementState }) {
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
  let cycleCameraLatch = false;
  let pauseLatch = false;
  let inventoryToggleLatch = false;
  let inventoryMenuUpLatch = false;
  let inventoryMenuDownLatch = false;
  let inventoryMenuLeftLatch = false;
  let inventoryMenuRightLatch = false;
  let inventoryMenuConfirmLatch = false;
  const raycaster = new THREE.Raycaster();
  const raycastDirection = new THREE.Vector3();
  const mouseLikeEuler = new THREE.Euler(0, 0, 0, "YXZ");
  const halfPi = Math.PI / 2;

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
    const use = heldKeys[bindings.use] || heldKeys.r || heldKeys.mouse0 || readGamepadBinding(gp, gpBindings.use) > 0 || rightBumperPressed;
    const attack = heldKeys[bindings.attack] || heldKeys.t || heldKeys.mouse2 || readGamepadBinding(gp, gpBindings.attack) > 0 || rightBumperPressed;
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

    const cycleCamera = readGamepadBinding(gp, gpBindings.cycleCamera) > 0;
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
      snapPlace,
      attack,
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
    } else {
      console.warn("Unhandled collision action:", action.type, action);
    }
  }

  function createPlacedMesh(itemId) {
    const id = String(itemId || "").toLowerCase();
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
    return null;
  }

  function intersectsPlayer(position, shape) {
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

  function tryPlaceSelectedInventoryItem({ snapToGrid = false } = {}) {
    if (movementState.worldMode === "2d") return false;
    const inventory = window.VRWorldContext?.inventory;
    if (!inventory?.getSelectedItem || !inventory?.consumeSelected) return false;
    const selected = inventory.getSelectedItem();
    if (!selected || !selected.id || (Number.isFinite(selected.count) && selected.count <= 0)) return false;
    const placement = createPlacedMesh(selected.id);
    if (!placement) return false;

    raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    const candidates = (objects || []).filter((obj) => obj?.isMesh);
    const hits = raycaster.intersectObjects(candidates, false);
    const hit = hits.find((h) => Number.isFinite(h.distance) && h.distance <= useRangeMax && h.object?.visible);
    if (!hit) return false;

    const normal = hit.face?.normal?.clone?.() || raycastDirection.set(0, 1, 0);
    normal.transformDirection(hit.object.matrixWorld).normalize();
    const placePos = hit.point.clone().addScaledVector(normal, 0.55);
    if (snapToGrid) {
      // 1m grid snap mode for Shift+R.
      placePos.x = Math.round(placePos.x);
      placePos.y = Math.round(placePos.y);
      placePos.z = Math.round(placePos.z);
    }
    if (placePos.y < 0.5) placePos.y = 0.5;

    if (intersectsPlayer(placePos, placement.collider)) return false;
    if (intersectsExistingColliders(placePos, placement.collider)) return false;

    const mesh = placement.mesh;
    mesh.position.copy(placePos);
    mesh.userData.isSolid = true;
    mesh.userData.breakable = true;
    mesh.userData.placedByPlayer = true;
    mesh.userData.nvType = selected.id;
    scene.add(mesh);
    objects.push(mesh);

    if (placement.collider.type === "box") {
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
    } else {
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

    return false;
  }

  function tryBreakTargetBlock() {
    if (movementState.worldMode === "2d") return false;
    raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    const candidates = (objects || []).filter((obj) => obj?.isMesh && obj?.visible);
    const hits = raycaster.intersectObjects(candidates, false);
    const hit = hits.find((h) => Number.isFinite(h.distance) && h.distance <= useRangeMax && h.object?.visible);
    if (!hit?.object) return false;
    const target = hit.object;
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
      if (itemType === "box" || itemType === "sphere" || itemType === "cylinder") {
        inventory.addItem(itemType, 1, itemType.charAt(0).toUpperCase() + itemType.slice(1));
      }
    }

    return true;
  }

  return function update() {
    if (!controls.isLocked) return;
    const nowMs = performance.now();
    const speed = 0.2;
    const bindings = getBindings();
    const inputState = buildInputState(bindings);
    const crouching = inputState.crouch;
    const crawling = inputState.crawl;
    const using = inputState.use;
    const attacking = inputState.attack;
    const inventory = window.VRWorldContext?.inventory;

    if (inputState.openInventory && !inventoryToggleLatch) {
      inventoryToggleLatch = true;
      if (inventory?.toggleMenu) inventory.toggleMenu();
    } else if (!inputState.openInventory) {
      inventoryToggleLatch = false;
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
        inventory.setMenuOpen?.(false);
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
      movementState.isFlying = !movementState.isFlying;
      movementState.flyToggleLatch = true;
    }
    if (!inputState.fly) movementState.flyToggleLatch = false;
    if (!using) {
      movementState.useLatch = false;
      movementState.lastUseActionMs = 0;
      movementState.svgToolLatch = false;
    }
    if (!attacking) movementState.attackLatch = false;
    if (!movementState.isFlying) {
      movementState.playerHeight = crawling ? crawlHeight : crouching ? crouchHeight : basePlayerHeight;
    }
    if (movementState.worldMode === "2d" && Number.isFinite(movementState.planeZ)) {
      controls.getObject().position.z = movementState.planeZ;
    }

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
      stepHeight
    });

    if (movementState.isFlying) {
      applyFlyingMovement({ THREE, controls, inputState, speed, wouldCollide });
    } else {
      applyGroundMovement({ controls, inputState, movementState, gravity, jumpSpeed, groundLevel, wouldCollide });
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

    applyRollPitch({ camera, inputState });

    const actionHit = findCollisionActionHit(controls.getObject().position, performance.now());
    if (actionHit) {
      for (const action of actionHit.actions) {
        applyCollisionAction(action);
      }
      return;
    }

    const lastUseActionMs = Number(movementState.lastUseActionMs || 0);
    const canRepeatUse = movementState.useLatch && (nowMs - lastUseActionMs >= useRepeatMs);
    if (using && (!movementState.useLatch || canRepeatUse)) {
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
