// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/Abilities/InspectionModificationAbilities/TransformGizmoVisualAbility.mjs
// This file defines shared visual helpers for Game View transform gizmos. It orients sprite handles, manages hover highlighting, and creates arrow handle sprites for translate and rotate abilities.

import { installMovementApi } from "../movementContext.mjs";

export function installTransformGizmoVisualAbility(ctx) {
  const { THREE, camera } = ctx;
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
      handle.material.rotation = Math.atan2(tmpHandleNdc.y - tmpCenterNdc.y, tmpHandleNdc.x - tmpCenterNdc.x);
    }
  }

  function updateGizmoHandleOrientations() {
    orientSpriteHandles(ctx.translateState);
    orientSpriteHandles(ctx.rotateState);
  }

  function applyHoverState(state, hoverHandle, baseColor) {
    if (!state?.handles) return;
    for (const handle of state.handles) {
      if (!handle?.material) continue;
      handle.material.color.copy(handle === hoverHandle ? ctx.hoverColors.translate : baseColor);
      handle.material.opacity = handle === hoverHandle ? 0.45 : 1;
      handle.material.needsUpdate = true;
    }
  }

  function updateRotateHandleVisuals() {
    if (!ctx.rotateState?.handles?.length) return;
    for (const handle of ctx.rotateState.handles) {
      if (!handle?.material) continue;
      const isHover = handle === ctx.rotateHoverHandle;
      const isSelected = handle === ctx.rotateState.selectedHandle;
      handle.material.color.copy(isSelected ? ctx.selectedRotateColor : isHover ? ctx.hoverColors.rotate : ctx.baseRotateColor);
      handle.material.opacity = isHover || isSelected ? 0.55 : 1;
      handle.material.needsUpdate = true;
    }
  }

  function onPointerHover(event) {
    if (!ctx.translateState && !ctx.rotateState) return;
    ctx.raycaster.setFromCamera(ctx.api.getPointerNdc(event), camera);
    ctx.translateHoverHandle = null;
    ctx.rotateHoverHandle = null;
    if (ctx.translateState?.handles?.length) {
      ctx.translateHoverHandle = ctx.raycaster.intersectObjects(ctx.translateState.handles, false)[0]?.object || null;
      applyHoverState(ctx.translateState, ctx.translateHoverHandle, ctx.baseTranslateColor);
    }
    if (ctx.rotateState?.handles?.length) {
      ctx.rotateHoverHandle = ctx.raycaster.intersectObjects(ctx.rotateState.handles, false)[0]?.object || null;
      updateRotateHandleVisuals();
    }
  }

  function ensureHoverListener() {
    if (ctx.hoverListenerAttached) return;
    window.addEventListener("pointermove", onPointerHover, true);
    window.addEventListener("mousemove", onPointerHover, true);
    ctx.hoverListenerAttached = true;
  }

  function createHandleSprite(group, handles, dir, color, scale) {
    const material = new THREE.SpriteMaterial({
      map: ctx.api.ensurePositionArrowTexture(),
      color,
      depthTest: true,
      depthWrite: false,
      transparent: true
    });
    const sprite = new THREE.Sprite(material);
    sprite.userData.axis = dir.clone();
    sprite.position.copy(dir).multiplyScalar(scale === 0.32 ? 1.1 : 1.05);
    sprite.scale.set(scale, scale, scale);
    sprite.lookAt(dir.clone().multiplyScalar(2));
    group.add(sprite);
    handles.push(sprite);
  }

  function pointerDelta(event, state) {
    let dx = 0;
    let dy = 0;
    if (Number.isFinite(event.movementX) && Number.isFinite(event.movementY)) {
      dx = event.movementX;
      dy = event.movementY;
    } else if (state.lastPointerPos) {
      dx = event.clientX - state.lastPointerPos.x;
      dy = event.clientY - state.lastPointerPos.y;
    }
    state.lastPointerPos = { x: event.clientX, y: event.clientY };
    return { dx, dy };
  }

  return installMovementApi(ctx, {
    orientSpriteHandles,
    updateGizmoHandleOrientations,
    applyHoverState,
    updateRotateHandleVisuals,
    onPointerHover,
    ensureHoverListener,
    createHandleSprite,
    pointerDelta
  });
}
