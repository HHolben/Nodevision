// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/Abilities/InspectionModificationAbilities/ObjectGrabAbility.mjs
// This file defines the object grabbing ability for Game View editor movement. It keeps scroll-distance handling and grabbed-object following separate from placement and inspection logic.

import { installMovementApi } from "../movementContext.mjs";

export function installObjectGrabAbility(ctx) {
  const { THREE, camera, controls, movementState } = ctx;

  function startGrabFromHit(hit) {
    const target = hit?.object;
    if (!target?.isMesh) return false;
    const distance = Math.max(ctx.grabbedDistanceMin, Math.min(hit.distance || 2, ctx.grabbedDistanceMax));
    ctx.grabbedState = {
      object: target,
      distance,
      rotation: target.quaternion.clone(),
      colliderRef: target.userData?.colliderRef || null,
      forwardDir: ctx.api.getFacingDirection(new THREE.Vector3())
    };
    return true;
  }

  function releaseGrabbedObject() {
    ctx.grabbedState = null;
  }

  function updateGrabbedObjectFollow() {
    const state = ctx.grabbedState;
    if (!state || !state.object?.isMesh) {
      ctx.grabbedState = null;
      return;
    }
    state.distance = Math.max(ctx.grabbedDistanceMin, Math.min(state.distance, ctx.grabbedDistanceMax));
    const obj = state.object;
    const dir = ctx.api.getFacingDirection(new THREE.Vector3());
    const origin = controls?.getObject?.().getWorldPosition
      ? controls.getObject().getWorldPosition(new THREE.Vector3())
      : camera?.getWorldPosition
        ? camera.getWorldPosition(new THREE.Vector3())
        : controls?.getObject?.().position || new THREE.Vector3();
    obj.position.copy(origin.clone().addScaledVector(dir, state.distance));
    if (state.rotation) obj.quaternion.copy(state.rotation);
    ctx.api.updateColliderForTarget(obj);
  }

  function handleGrabScroll(event) {
    const dyRaw = Number.isFinite(event.deltaY) ? event.deltaY
      : (Number.isFinite(event.wheelDelta) ? -event.wheelDelta
        : (Number.isFinite(event.detail) ? event.detail : 0));
    const dy = dyRaw || 0;
    const activeAxis = ctx.rotateState?.activeAxis || ctx.rotateState?.selectedHandle?.userData?.axis;
    if (activeAxis && ctx.rotateState?.target) {
      const angle = THREE.MathUtils.clamp(-dy * 0.002, -0.35, 0.35);
      ctx.rotateState.target.rotateOnAxis(activeAxis, angle);
      ctx.rotateState.activeAxis = activeAxis.clone?.() || activeAxis;
      ctx.api.updateColliderForTarget(ctx.rotateState.target);
      event.preventDefault?.();
      event.stopPropagation?.();
      return;
    }
    if (!ctx.grabbedState) return;
    const step = THREE.MathUtils.clamp(Math.abs(dy) * 0.002, 0.05, 0.6);
    const dirSign = dy === 0 ? 0 : (dy > 0 ? 1 : -1);
    ctx.grabbedState.distance += dirSign > 0 ? step : -step;
    ctx.grabbedState.distance = Math.max(ctx.grabbedDistanceMin, Math.min(ctx.grabbedState.distance, ctx.grabbedDistanceMax));
    updateGrabbedObjectFollow();
    event.preventDefault?.();
    event.stopPropagation?.();
  }

  function ensureWheelHandler() {
    if (ctx.wheelHandlerAttached) return;
    window.addEventListener("wheel", handleGrabScroll, { passive: false, capture: true });
    ctx.wheelHandlerAttached = true;
  }

  return installMovementApi(ctx, {
    startGrabFromHit,
    releaseGrabbedObject,
    updateGrabbedObjectFollow,
    handleGrabScroll,
    ensureWheelHandler
  });
}
