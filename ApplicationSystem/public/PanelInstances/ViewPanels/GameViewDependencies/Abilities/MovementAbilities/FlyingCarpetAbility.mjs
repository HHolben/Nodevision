// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/Abilities/MovementAbilities/FlyingCarpetAbility.mjs
// This file defines the flying carpet riding ability for Game View worlds. It handles boarding, dismounting, rider alignment, and mounted movement while relying on the runtime helper module for carpet mesh metadata.

import { setStatus } from "/StatusBar.mjs";
import { installMovementApi } from "../movementContext.mjs";

export function installFlyingCarpetAbility(ctx) {
  const { THREE, controls, movementState, forward, right, up } = ctx;

  function alignPlayerToFlyingCarpet(mount) {
    const carpet = mount?.object;
    if (!carpet) return;
    const player = controls.getObject();
    const half = ctx.api.readFlyingCarpetHalfExtents(carpet);
    const config = ctx.api.ensureFlyingCarpetRuntime(carpet) || {};
    const offset = mount.riderLocalOffset || new THREE.Vector3(0, 0, 0);
    player.position.x = carpet.position.x + ctx.api.clampOffset(Number(offset.x) || 0, Math.max(0, half.x - ctx.playerRadius * 0.35));
    player.position.z = carpet.position.z + ctx.api.clampOffset(Number(offset.z) || 0, Math.max(0, half.z - ctx.playerRadius * 0.35));
    player.position.y = carpet.position.y + half.y + movementState.playerHeight + (Number(config.riderSurfaceOffset) || 0);
  }

  function dismountMountedVehicle({ showStatus = true } = {}) {
    const mount = movementState.mountedVehicle || null;
    if (!mount) return false;
    if (mount.object?.userData) mount.object.userData.vehicleMounted = false;
    Object.assign(movementState, { mountedVehicle: null, isMounted: false, activeVehicleType: "", velocityY: 0, isGrounded: true });
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
    if (!object || !object.parent || object.visible === false || !ctx.api.isFlyingCarpetObject(object)) {
      dismountMountedVehicle({ showStatus: false });
      return null;
    }
    ctx.api.ensureFlyingCarpetRuntime(object);
    movementState.isMounted = true;
    movementState.activeVehicleType = mount.type || ctx.FLYING_CARPET_ITEM_ID;
    return mount;
  }

  function boardFlyingCarpet(carpet) {
    if (!ctx.api.isFlyingCarpetObject(carpet)) return false;
    if (movementState.mountedVehicle?.object === carpet) return true;
    if (movementState.mountedVehicle) dismountMountedVehicle({ showStatus: false });
    const config = ctx.api.ensureFlyingCarpetRuntime(carpet) || {};
    const player = controls.getObject();
    const half = ctx.api.readFlyingCarpetHalfExtents(carpet);
    const offset = new THREE.Vector3(player.position.x - carpet.position.x, 0, player.position.z - carpet.position.z);
    offset.x = ctx.api.clampOffset(offset.x, Math.max(0, half.x - ctx.playerRadius * 0.35));
    offset.z = ctx.api.clampOffset(offset.z, Math.max(0, half.z - ctx.playerRadius * 0.35));
    carpet.userData.vehicleMounted = true;
    movementState.mountedVehicle = {
      type: ctx.FLYING_CARPET_ITEM_ID,
      object: carpet,
      riderLocalOffset: offset,
      riderSurfaceOffset: Number(config.riderSurfaceOffset) || 0.03
    };
    Object.assign(movementState, { isMounted: true, activeVehicleType: ctx.FLYING_CARPET_ITEM_ID, isFlying: false, velocityY: 0, isGrounded: false });
    alignPlayerToFlyingCarpet(movementState.mountedVehicle);
    setStatus("Boarded flying carpet. Use movement, ascend, and descend controls to fly.");
    return true;
  }

  function tryUseFlyingCarpet() {
    if (movementState.worldMode === "2d") return false;
    if (getActiveMountedVehicle()) return dismountMountedVehicle();
    const carpet = ctx.api.findBoardableFlyingCarpet(controls.getObject().position);
    return carpet ? boardFlyingCarpet(carpet) : false;
  }

  function updateMountedFlyingCarpet(mount, inputState, speed) {
    const carpet = mount?.object || null;
    if (!ctx.api.isFlyingCarpetObject(carpet)) return false;
    const config = ctx.api.ensureFlyingCarpetRuntime(carpet) || {};
    const half = ctx.api.readFlyingCarpetHalfExtents(carpet);
    const moveSpeed = speed * (Number.isFinite(Number(config.speedMultiplier)) ? Number(config.speedMultiplier) : ctx.FLYING_CARPET_SPEED_MULTIPLIER);
    const verticalSpeed = speed * (Number.isFinite(Number(config.verticalSpeedMultiplier)) ? Number(config.verticalSpeedMultiplier) : ctx.FLYING_CARPET_VERTICAL_SPEED_MULTIPLIER);
    const delta = mountedCarpetDelta(inputState, moveSpeed, verticalSpeed);
    if (delta.lengthSq() > 0) moveMountedCarpet(carpet, half, delta);
    Object.assign(movementState, { velocityY: 0, isGrounded: false, isFlying: false });
    alignPlayerToFlyingCarpet(mount);
    return true;
  }

  function mountedCarpetDelta(inputState, moveSpeed, verticalSpeed) {
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
    return delta;
  }

  function moveMountedCarpet(carpet, half, delta) {
    const player = controls.getObject();
    const nextCarpetPosition = carpet.position.clone().add(delta);
    if (nextCarpetPosition.y < half.y) nextCarpetPosition.y = half.y;
    const actualDelta = nextCarpetPosition.clone().sub(carpet.position);
    const nextPlayerPosition = player.position.clone().add(actualDelta);
    const config = ctx.api.ensureFlyingCarpetRuntime(carpet) || {};
    nextPlayerPosition.y = nextCarpetPosition.y + half.y + movementState.playerHeight + (Number(config.riderSurfaceOffset) || 0);
    const ignoreCollider = carpet.userData?.colliderRef || null;
    const carpetShape = { type: "box", half };
    if (!ctx.wouldCollide(nextPlayerPosition, { ignoreCollider }) && !ctx.api.intersectsExistingColliders(nextCarpetPosition, carpetShape, { ignoreCollider })) {
      carpet.position.copy(nextCarpetPosition);
      ctx.api.updateColliderForTarget(carpet);
    }
  }

  return installMovementApi(ctx, {
    alignPlayerToFlyingCarpet,
    dismountMountedVehicle,
    getActiveMountedVehicle,
    boardFlyingCarpet,
    tryUseFlyingCarpet,
    updateMountedFlyingCarpet,
    mountedCarpetDelta,
    moveMountedCarpet
  });
}
