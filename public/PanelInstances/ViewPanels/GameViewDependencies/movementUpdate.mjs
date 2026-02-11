// Nodevision/public/PanelInstances/ViewPanels/GameViewDependencies/movementUpdate.mjs
// This file wires movement state to per-frame update logic.

import { createCollisionChecker } from "./collisionCheck.mjs";
import { applyDirectionalMovement, applyFlyingMovement, applyGroundMovement, applyRollPitch } from "./movementSteps.mjs";

export function createMovementUpdater({ THREE, camera, controls, colliders, portals, collisionActions, useTargets, spawnPoints, loadWorldFromFile, getBindings, heldKeys, movementState }) {
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

  movementState.playerHeight = basePlayerHeight;
  const wouldCollide = createCollisionChecker({ colliders, movementState, playerRadius });

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

  return function update() {
    if (!controls.isLocked) return;
    const speed = 0.2;
    const bindings = getBindings();
    const crouching = heldKeys[bindings.crouch];
    const crawling = heldKeys[bindings.crawl];
    const using = heldKeys[bindings.use];

    if (!heldKeys[bindings.fly]) movementState.flyToggleLatch = false;
    if (!using) movementState.useLatch = false;
    if (!movementState.isFlying) {
      movementState.playerHeight = crawling ? crawlHeight : crouching ? crouchHeight : basePlayerHeight;
    }

    applyDirectionalMovement({
      THREE,
      controls,
      movementState,
      heldKeys,
      bindings,
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
      applyFlyingMovement({ THREE, controls, heldKeys, bindings, speed, wouldCollide });
    } else {
      applyGroundMovement({ controls, heldKeys, bindings, movementState, gravity, jumpSpeed, groundLevel, wouldCollide });
    }

    applyRollPitch({ camera, heldKeys, bindings });

    const actionHit = findCollisionActionHit(controls.getObject().position, performance.now());
    if (actionHit) {
      for (const action of actionHit.actions) {
        applyCollisionAction(action);
      }
      return;
    }

    if (using && !movementState.useLatch) {
      movementState.useLatch = true;
      const useHit = findUseTarget(controls.getObject().position, performance.now());
      if (useHit) {
        for (const action of useHit.actions) {
          applyCollisionAction(action);
        }
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
