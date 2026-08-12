// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/Abilities/MovementAbilities/GravityAbility.mjs
// This file defines non-flat gravity movement abilities for Game View worlds. It handles point-mass gravity, zero-gravity surface kicks, and the movement-state values that make those forces inspectable.

import { normalizeGravityModel } from "../../gravityModel.mjs";
import { installMovementApi } from "../movementContext.mjs";

export function installGravityAbility(ctx) {
  const { THREE, controls, objects, movementState } = ctx;

  function readActiveGravityModel() {
    const worldDef = window.VRWorldContext?.currentWorldDefinition || {};
    const model = normalizeGravityModel(
      movementState?.gravityModel
      || worldDef.gravityModel
      || worldDef.metadata?.gravityModel
      || worldDef.physics?.gravityModel
      || { mode: "flat", flatG: ctx.gravity }
    );
    movementState.gravityModel = model;
    movementState.activeGravityModel = model.mode;
    return model;
  }

  function clearVectorGravityMotion({ preserveScalarVelocity = false } = {}) {
    ctx.vectorGravityVelocity.set(0, 0, 0);
    ctx.vectorGravityAcceleration.set(0, 0, 0);
    movementState.vectorGravityVelocity = { x: 0, y: 0, z: 0 };
    movementState.vectorGravityAcceleration = { x: 0, y: 0, z: 0 };
    if (!preserveScalarVelocity) movementState.velocityY = 0;
  }

  function writeVectorGravityState() {
    movementState.vectorGravityVelocity = {
      x: ctx.vectorGravityVelocity.x,
      y: ctx.vectorGravityVelocity.y,
      z: ctx.vectorGravityVelocity.z
    };
    movementState.vectorGravityAcceleration = {
      x: ctx.vectorGravityAcceleration.x,
      y: ctx.vectorGravityAcceleration.y,
      z: ctx.vectorGravityAcceleration.z
    };
    movementState.velocityY = ctx.vectorGravityVelocity.y;
  }

  function objectIdMatchesGravityPoint(obj, pointObjectId) {
    if (!pointObjectId || !obj) return false;
    const key = pointObjectId.toLowerCase();
    const userData = obj.userData || {};
    const candidates = [obj.name, userData.id, userData.nvId, userData.objectId, userData.worldObjectId, userData.mathFunctionProperties?.id, userData.mathFunctionProperties?.name];
    return candidates.some((candidate) => String(candidate || "").trim().toLowerCase() === key);
  }

  function resolveGravityPointPosition(gravityModel) {
    const pointObjectId = String(gravityModel?.pointObjectId || "").trim();
    const sourceObject = pointObjectId ? (objects || []).find((obj) => objectIdMatchesGravityPoint(obj, pointObjectId)) : null;
    if (sourceObject?.getWorldPosition) {
      sourceObject.getWorldPosition(ctx.gravityPointPosition);
      return ctx.gravityPointPosition;
    }
    const point = gravityModel?.position || {};
    ctx.gravityPointPosition.set(Number(point.x) || 0, Number(point.y) || 0, Number(point.z) || 0);
    return ctx.gravityPointPosition;
  }

  function applyVectorGravityMovement(gravityModel, { applyAcceleration = false } = {}) {
    const object = controls.getObject();
    if (applyAcceleration) {
      const point = resolveGravityPointPosition(gravityModel);
      ctx.vectorGravityAcceleration.copy(point).sub(object.position);
      const distanceSq = Math.max(0.0001, ctx.vectorGravityAcceleration.lengthSq());
      const acceleration = Math.max(0, Number(gravityModel.bigG) || 0) * Math.max(0, Number(gravityModel.mass) || 0) / distanceSq;
      if (ctx.vectorGravityAcceleration.lengthSq() > 1e-8 && acceleration > 0) {
        ctx.vectorGravityAcceleration.normalize().multiplyScalar(Math.min(4, acceleration));
        ctx.vectorGravityVelocity.add(ctx.vectorGravityAcceleration);
      } else ctx.vectorGravityAcceleration.set(0, 0, 0);
      movementState.activeGravityPoint = { x: point.x, y: point.y, z: point.z };
      movementState.activeGravityAcceleration = acceleration;
    } else {
      ctx.vectorGravityAcceleration.set(0, 0, 0);
      movementState.activeGravityAcceleration = 0;
    }
    writeVectorGravityState();
    if (ctx.vectorGravityVelocity.lengthSq() < 1e-10) return;
    ctx.vectorGravityNextPosition.copy(object.position).add(ctx.vectorGravityVelocity);
    if (movementState.worldMode === "2d" && movementState.cameraMode === "side" && Number.isFinite(movementState.planeZ)) {
      ctx.vectorGravityNextPosition.z = movementState.planeZ;
    }
    if (!ctx.wouldCollide(ctx.vectorGravityNextPosition)) {
      object.position.copy(ctx.vectorGravityNextPosition);
      movementState.isGrounded = false;
      writeVectorGravityState();
      return;
    }
    movementState.lastVectorGravityCollision = movementState.lastCollisionCollider || null;
    clearVectorGravityMotion();
    movementState.isGrounded = true;
  }

  function tryZeroGravitySurfaceKick(gravityModel, inputState, baseJumpForce) {
    if (!inputState?.jump) {
      movementState.jumpLatch = false;
      return;
    }
    if (movementState.jumpLatch) return;
    movementState.jumpLatch = true;
    const hit = ctx.api.getOppositeFacingSurfaceHit(gravityModel.surfaceKickRange || ctx.useRangeMax);
    if (!hit) {
      movementState.lastZeroGravityKick = { ok: false, reason: "no-surface" };
      return;
    }
    controls.getDirection(ctx.zeroGravityKickDirection);
    if (ctx.zeroGravityKickDirection.lengthSq() < 1e-8) ctx.zeroGravityKickDirection.set(0, 0, -1);
    ctx.zeroGravityKickDirection.normalize();
    const explicitMultiplier = Number(inputState.jumpForceMultiplier);
    const jumpMultiplier = Number.isFinite(explicitMultiplier) && explicitMultiplier > 0 ? Math.max(0.05, Math.min(4, explicitMultiplier)) : 1;
    const impulse = Math.max(0.001, Number(baseJumpForce) || gravityModel.propellantImpulse || ctx.jumpSpeed) * jumpMultiplier;
    ctx.vectorGravityVelocity.addScaledVector(ctx.zeroGravityKickDirection, impulse);
    movementState.lastZeroGravityKick = { ok: true, distance: hit.distance, impulse, targetType: String(hit.object?.userData?.nvType || hit.object?.type || "surface") };
    movementState.isGrounded = false;
    writeVectorGravityState();
  }

  return installMovementApi(ctx, {
    readActiveGravityModel,
    clearVectorGravityMotion,
    writeVectorGravityState,
    objectIdMatchesGravityPoint,
    resolveGravityPointPosition,
    applyVectorGravityMovement,
    tryZeroGravitySurfaceKick
  });
}
