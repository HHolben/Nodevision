// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/Abilities/InspectionModificationAbilities/TranslateGizmoAbility.mjs
// This file defines the translate gizmo ability for Game View editor objects. It owns translate handle creation, picking, drag movement, collider updates, and cleanup.

import { installMovementApi } from "../movementContext.mjs";

export function installTranslateGizmoAbility(ctx) {
  const { THREE, camera, movementState } = ctx;

  function disposeTranslateState() {
    if (!ctx.translateState) return;
    ctx.translateState.handles?.forEach((handle) => handle?.parent?.remove(handle));
    ctx.translateState.group?.parent?.remove(ctx.translateState.group);
    window.removeEventListener("pointerdown", onTranslatePointerDown, true);
    window.removeEventListener("pointermove", onTranslatePointerMove, true);
    window.removeEventListener("mousemove", onTranslatePointerMove, true);
    window.removeEventListener("pointerup", onTranslatePointerUp, true);
    ctx.translateState = null;
    ctx.translateHoverHandle = null;
  }

  function createTranslateGizmo(target) {
    if (ctx.translateState?.target === target) {
      if (ctx.translateState.dragging) return;
      disposeTranslateState();
    }
    const group = new THREE.Group();
    const handles = [];
    const axes = [
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(-1, 0, 0),
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, -1, 0),
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 0, -1)
    ];
    axes.forEach((axis) => ctx.api.createHandleSprite(group, handles, axis, 0xffb347, 0.35));
    target.add(group);
    ctx.translateState = { target, group, handles, dragging: false, activeHandle: null, lastPointerPos: null };
    ctx.api.ensureHoverListener();
    window.addEventListener("pointerdown", onTranslatePointerDown, true);
    window.addEventListener("pointermove", onTranslatePointerMove, true);
    window.addEventListener("mousemove", onTranslatePointerMove, true);
    window.addEventListener("pointerup", onTranslatePointerUp, true);
  }

  function pickTranslateHandle(event) {
    if (!ctx.translateState?.handles?.length) return null;
    ctx.raycaster.setFromCamera(ctx.api.getPointerNdc(event), camera);
    return ctx.raycaster.intersectObjects(ctx.translateState.handles, false)[0]?.object || null;
  }

  function onTranslatePointerDown(event) {
    if (event.button !== 0 || !ctx.translateState) return;
    const handle = pickTranslateHandle(event);
    if (!handle) return;
    Object.assign(ctx.translateState, {
      dragging: true,
      activeHandle: handle,
      startPos: ctx.translateState.target.position.clone(),
      lastPointerPos: { x: event.clientX, y: event.clientY }
    });
    movementState.skipClickFrame = true;
    event.preventDefault();
    event.stopPropagation();
  }

  function onTranslatePointerMove(event) {
    if (!ctx.translateState?.dragging || !ctx.translateState.activeHandle) return;
    const target = ctx.translateState.target;
    if (!target) {
      disposeTranslateState();
      return;
    }
    const { dx, dy } = ctx.api.pointerDelta(event, ctx.translateState);
    target.position.addScaledVector(ctx.translateState.activeHandle.userData.axis, (-(dy || 0) + (dx || 0)) * 0.02);
    ctx.api.updateColliderForTarget(target);
    event.preventDefault();
    event.stopPropagation();
  }

  function onTranslatePointerUp(event) {
    if (!ctx.translateState || event.button !== 0) return;
    ctx.translateState.dragging = false;
    ctx.translateState.activeHandle = null;
  }

  return installMovementApi(ctx, {
    disposeTranslateState,
    createTranslateGizmo,
    pickTranslateHandle,
    onTranslatePointerDown,
    onTranslatePointerMove,
    onTranslatePointerUp
  });
}
