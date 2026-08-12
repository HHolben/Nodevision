// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/Abilities/InspectionModificationAbilities/RotateGizmoAbility.mjs
// This file defines the rotate gizmo ability for Game View editor objects. It owns rotate handle creation, axis selection, drag rotation, scroll-compatible active-axis state, and cleanup.

import { installMovementApi } from "../movementContext.mjs";

export function installRotateGizmoAbility(ctx) {
  const { THREE, camera, movementState } = ctx;

  function disposeRotateState() {
    if (!ctx.rotateState) return;
    ctx.rotateState.handles?.forEach((handle) => handle?.parent?.remove(handle));
    ctx.rotateState.group?.parent?.remove(ctx.rotateState.group);
    window.removeEventListener("pointerdown", onRotatePointerDown, true);
    window.removeEventListener("pointermove", onRotatePointerMove, true);
    window.removeEventListener("mousemove", onRotatePointerMove, true);
    window.removeEventListener("pointerup", onRotatePointerUp, true);
    ctx.rotateState = null;
    ctx.rotateHoverHandle = null;
    ctx.lastHoverAxis = null;
  }

  function createRotateGizmo(target) {
    const group = new THREE.Group();
    const handles = [];
    const axes = [
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, 0, 1)
    ];
    axes.forEach((axis) => ctx.api.createHandleSprite(group, handles, axis, 0xb972ff, 0.32));
    target.add(group);
    ctx.rotateState = {
      target,
      group,
      handles,
      dragging: false,
      activeHandle: null,
      selectedHandle: null,
      activeAxis: null,
      lastPointerPos: null
    };
    ctx.api.ensureHoverListener();
    window.addEventListener("pointerdown", onRotatePointerDown, true);
    window.addEventListener("pointermove", onRotatePointerMove, true);
    window.addEventListener("mousemove", onRotatePointerMove, true);
    window.addEventListener("pointerup", onRotatePointerUp, true);
  }

  function pickRotateHandle(event) {
    if (!ctx.rotateState?.handles?.length) return null;
    ctx.raycaster.setFromCamera(ctx.api.getPointerNdc(event), camera);
    return ctx.raycaster.intersectObjects(ctx.rotateState.handles, false)[0]?.object || null;
  }

  function onRotatePointerDown(event) {
    if (!ctx.rotateState) return;
    const handle = pickRotateHandle(event);
    if (!handle) return;
    Object.assign(ctx.rotateState, {
      activeHandle: handle,
      selectedHandle: handle,
      activeAxis: handle.userData.axis?.clone?.() || null,
      startQuat: ctx.rotateState.target?.quaternion?.clone?.() || null,
      dragging: true,
      lastPointerPos: { x: event.clientX, y: event.clientY }
    });
    ctx.api.updateRotateHandleVisuals();
    movementState.skipClickFrame = true;
    event.preventDefault();
    event.stopPropagation();
  }

  function onRotatePointerMove(event) {
    if (!ctx.rotateState?.dragging || !ctx.rotateState.activeAxis || !ctx.rotateState.target) return;
    const { dx, dy } = ctx.api.pointerDelta(event, ctx.rotateState);
    ctx.rotateState.target.rotateOnAxis(ctx.rotateState.activeAxis, (-(dy || 0) + (dx || 0)) * 0.005);
    ctx.api.updateColliderForTarget(ctx.rotateState.target);
    event.preventDefault();
    event.stopPropagation();
  }

  function onRotatePointerUp() {
    if (!ctx.rotateState) return;
    ctx.rotateState.dragging = false;
    ctx.rotateState.activeHandle = null;
    ctx.rotateState.lastPointerPos = null;
  }

  return installMovementApi(ctx, {
    disposeRotateState,
    createRotateGizmo,
    pickRotateHandle,
    onRotatePointerDown,
    onRotatePointerMove,
    onRotatePointerUp
  });
}
