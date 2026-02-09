// Nodevision/public/PanelInstances/ViewPanels/GameViewDependencies/movementUpdate.mjs
// This file wires movement state to per-frame update logic.

import { createCollisionChecker } from "./collisionCheck.mjs";
import { applyDirectionalMovement, applyFlyingMovement, applyGroundMovement, applyRollPitch } from "./movementSteps.mjs";

export function createMovementUpdater({ THREE, camera, controls, colliders, portals, collisionActions, loadWorldFromFile, getBindings, heldKeys, movementState }) {
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

  function findPortalHit(position, nowMs) {
    if (!portals || portals.length === 0) return null;
    const playerMinY = position.y - movementState.playerHeight;
    const playerMaxY = position.y;
    for (const portal of portals) {
      if (!portal?.box || !portal?.targetWorld) continue;
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

  function applyCollisionAction(action) {
    if (!action || !action.type) return;
    if (action.type === "portal") {
      const targetWorld = action.targetWorld;
      if (!targetWorld || typeof loadWorldFromFile !== "function") {
        console.warn("Portal action missing targetWorld or loader.", action);
        return;
      }
      loadWorldFromFile(targetWorld);
      if (Array.isArray(action.spawn) && action.spawn.length >= 3) {
        controls.getObject().position.set(action.spawn[0], action.spawn[1], action.spawn[2]);
        movementState.velocityY = 0;
        movementState.isGrounded = true;
      }
      if (Number.isFinite(action.spawnYaw)) {
        controls.getObject().rotation.y = action.spawnYaw;
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

    if (!heldKeys[bindings.fly]) movementState.flyToggleLatch = false;
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

    const portalHit = findPortalHit(controls.getObject().position, performance.now());
    if (portalHit && typeof loadWorldFromFile === "function") {
      loadWorldFromFile(portalHit.targetWorld);
      if (Array.isArray(portalHit.spawn) && portalHit.spawn.length >= 3) {
        controls.getObject().position.set(portalHit.spawn[0], portalHit.spawn[1], portalHit.spawn[2]);
        movementState.velocityY = 0;
        movementState.isGrounded = true;
      }
      if (Number.isFinite(portalHit.spawnYaw)) {
        controls.getObject().rotation.y = portalHit.spawnYaw;
      }
    }
  };
}
