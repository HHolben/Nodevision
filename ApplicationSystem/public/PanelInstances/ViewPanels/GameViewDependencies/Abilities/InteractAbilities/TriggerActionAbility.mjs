// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/Abilities/InteractAbilities/TriggerActionAbility.mjs
// This file defines proximity use targets and collision-triggered actions for Game View worlds. It applies portal, impulse, and console actions without bloating the movement update loop.

import { installMovementApi } from "../movementContext.mjs";

export function installTriggerActionAbility(ctx) {
  const { THREE, controls, collisionActions, useTargets, movementState, forward, consolePanels } = ctx;

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
      const minX = trigger.box.min.x - ctx.playerRadius;
      const maxX = trigger.box.max.x + ctx.playerRadius;
      const minZ = trigger.box.min.z - ctx.playerRadius;
      const maxZ = trigger.box.max.z + ctx.playerRadius;
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
    if (closest) closest.lastTriggeredAt = nowMs;
    return closest;
  }

  function applyCollisionAction(action) {
    if (!action || !action.type) return;
    if (action.type === "portal") {
      ctx.api.applyPortalTravel(action);
    } else if (action.type === "impulse") {
      applyImpulseAction(action);
    } else if (action.type === "console") {
      if (!consolePanels?.runConsoleAction?.(action)) console.warn("Console action failed:", action);
    } else {
      console.warn("Unhandled collision action:", action.type, action);
    }
  }

  function applyImpulseAction(action) {
    const impulse = Array.isArray(action.impulse) ? action.impulse : null;
    const upBoost = Number.isFinite(action.up) ? action.up : null;
    const forwardBoost = Number.isFinite(action.forward) ? action.forward : null;
    const player = controls.getObject();
    if (impulse && impulse.length >= 3) {
      player.position.x += Number(impulse[0]) || 0;
      player.position.y += Number(impulse[1]) || 0;
      player.position.z += Number(impulse[2]) || 0;
    } else {
      if (Number.isFinite(upBoost)) player.position.y += upBoost;
      if (Number.isFinite(forwardBoost) && Math.abs(forwardBoost) > 0) {
        controls.getDirection(forward);
        forward.y = 0;
        if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1);
        forward.normalize();
        player.position.addScaledVector(forward, forwardBoost);
      }
    }
    if (Number.isFinite(action.velocityY)) movementState.velocityY = action.velocityY;
    else if (Number.isFinite(upBoost)) movementState.velocityY = Math.max(movementState.velocityY || 0, upBoost * 0.55);
    else if (impulse && impulse.length >= 2) movementState.velocityY = Math.max(movementState.velocityY || 0, (Number(impulse[1]) || 0) * 0.55);
    movementState.isGrounded = false;
  }

  return installMovementApi(ctx, {
    findCollisionActionHit,
    findUseTarget,
    applyCollisionAction,
    applyImpulseAction
  });
}
