// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/Abilities/MovementAbilities/CameraMovementAbility.mjs
// This file defines camera-alignment movement abilities for Game View. It handles stand-up realignment and gamepad-style look deltas without mixing camera math into action handling.

import { installMovementApi } from "../movementContext.mjs";

export function installCameraMovementAbility(ctx) {
  const { camera, controls, movementState } = ctx;

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
    ctx.mouseLikeEuler.setFromQuaternion(camera.quaternion, "YXZ");
    if (dx !== 0) ctx.mouseLikeEuler.y -= dx * lookScale;
    if (dy !== 0) ctx.mouseLikeEuler.x -= dy * lookScale;
    ctx.mouseLikeEuler.x = Math.max(ctx.halfPi - maxPolar, Math.min(ctx.halfPi - minPolar, ctx.mouseLikeEuler.x));
    camera.quaternion.setFromEuler(ctx.mouseLikeEuler);
  }

  return installMovementApi(ctx, { applyStandUpAlignment, applyMouseLikeLookDelta });
}
