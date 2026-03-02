// Nodevision/public/PanelInstances/ViewPanels/GameViewDependencies/movementUpdate.mjs
// This file wires movement state to per-frame update logic.

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
  const raycastDirection = new THREE.Vector3();
  const mouseLikeEuler = new THREE.Euler(0, 0, 0, "YXZ");
  const halfPi = Math.PI / 2;
  let noTroubleSplash = null;
  let noTroubleTimer = 0;
  let objectFileGeometryApplier = null;
  let objectFileGeometryLoaderPromise = null;

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

  function finalizeConsolePlacement(hit, config, snapToGrid) {
    if (!hit) return false;
    const placement = buildConsoleMeshFromConfig(config);
    if (!placement) return false;
    const normal = (hit.face?.normal?.clone?.() || raycastDirection.set(0, 1, 0)).clone();
    const hitObject = hit.object;
    if (hitObject?.matrixWorld) {
      normal.transformDirection(hitObject.matrixWorld).normalize();
    }
    const placePos = hit.point.clone().addScaledVector(normal, 0.55);
    if (snapToGrid) {
      placePos.x = Math.round(placePos.x);
      placePos.y = Math.round(placePos.y);
      placePos.z = Math.round(placePos.z);
    }
    if (placePos.y < 0.5) placePos.y = 0.5;

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
    const use = heldKeys[bindings.use] || heldKeys.r || heldKeys.mouse0 || readGamepadBinding(gp, gpBindings.use) > 0 || rightBumperPressed;
    const attack = heldKeys[bindings.attack] || heldKeys.t || heldKeys.mouse2 || readGamepadBinding(gp, gpBindings.attack) > 0 || rightBumperPressed;
    const inspect = heldKeys[bindings.inspect] || heldKeys.y || readGamepadBinding(gp, gpBindings.inspect) > 0;
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
    const placePos = hit.point.clone().addScaledVector(normal, 0.55);
    if (snapToGrid) {
      // 1m grid snap mode for Shift+R.
      placePos.x = Math.round(placePos.x);
      placePos.y = Math.round(placePos.y);
      placePos.z = Math.round(placePos.z);
    }
    if (placePos.y < 0.5) placePos.y = 0.5;

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
      ) {
        inventory.addItem(itemType, 1, itemType.charAt(0).toUpperCase() + itemType.slice(1));
        if (itemType === "object-file" && target.userData?.objectFilePath && inventory?.setSelectedObjectFile) {
          inventory.setSelectedObjectFile(target.userData.objectFilePath);
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
    if (target && canUseAbility("allowInspect")) {
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
      if (playerMode() === "creative") {
        worldPropertiesPanel?.open?.();
        return true;
      }
      showNoTroubleSplash();
      return true;
    }
    return false;
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
    const inspecting = inputState.inspect;
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
    if (!attacking) movementState.attackLatch = false;
    if (!inspecting) movementState.inspectLatch = false;
    if (!movementState.isFlying) {
      movementState.playerHeight = crawling ? crawlHeight : crouching ? crouchHeight : basePlayerHeight;
    }
    if (movementState.worldMode === "2d" && Number.isFinite(movementState.planeZ)) {
      controls.getObject().position.z = movementState.planeZ;
    }

    const playerPos = controls.getObject().position;
    const torsoPosition = playerPos.clone();
    torsoPosition.y = playerPos.y - Math.max(0.35, movementState.playerHeight * 0.45);
    const activeWaterVolume = getWaterVolumeAtPosition(torsoPosition);
    const swimActive = Boolean(activeWaterVolume);
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

    if (inspecting && !movementState.inspectLatch) {
      movementState.inspectLatch = true;
      if (handleInspectAction()) {
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
