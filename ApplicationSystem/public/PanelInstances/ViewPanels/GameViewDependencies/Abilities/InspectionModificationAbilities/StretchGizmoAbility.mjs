// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/Abilities/InspectionModificationAbilities/StretchGizmoAbility.mjs
// This file defines the stretch gizmo ability for editor-mode Game View objects. It owns scale handles and their pointer lifecycle so construction tools can stay focused on placing objects.

import { installMovementApi } from "../movementContext.mjs";

export function installStretchGizmoAbility(ctx) {
  const { THREE, camera, scene, movementState } = ctx;

  function disposeStretchState() {
    if (!ctx.stretchState) return;
    ctx.stretchState.handles?.forEach((h) => h?.parent?.remove(h));
    ctx.stretchState.group?.parent?.remove(ctx.stretchState.group);
    window.removeEventListener("pointerdown", onStretchPointerDown, true);
    window.removeEventListener("pointermove", onStretchPointerMove, true);
    window.removeEventListener("pointerup", onStretchPointerUp, true);
    ctx.stretchState = null;
  }

  function createStretchGizmo(target) {
    const group = new THREE.Group();
    const handleGeo = new THREE.ConeGeometry(0.08, 0.24, 12);
    const handleMat = new THREE.MeshStandardMaterial({ color: 0x48b0ff });
    const handles = [];
    const axes = [
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(-1, 0, 0),
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, -1, 0),
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 0, -1)
    ];
    const corners = [];
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      corners.push(new THREE.Vector3(sx, sy, sz).normalize());
    }
    const makeHandle = (dir, isCorner = false) => {
      const mesh = new THREE.Mesh(handleGeo, handleMat.clone());
      mesh.userData.axis = dir.clone();
      mesh.userData.isCorner = isCorner;
      mesh.position.copy(dir).multiplyScalar(1.05);
      mesh.lookAt(dir.clone().multiplyScalar(2));
      group.add(mesh);
      handles.push(mesh);
    };
    axes.forEach((axis) => makeHandle(axis, false));
    corners.forEach((corner) => makeHandle(corner, true));
    target.add(group);
    ctx.stretchState = { target, group, handles, dragging: false, activeHandle: null, startScale: null };
    window.addEventListener("pointerdown", onStretchPointerDown, true);
    window.addEventListener("pointermove", onStretchPointerMove, true);
    window.addEventListener("pointerup", onStretchPointerUp, true);
  }

  function pickStretchHandle(evt) {
    if (!ctx.stretchState?.handles?.length) return null;
    ctx.raycaster.setFromCamera(ctx.api.getPointerNdc(evt), camera);
    return ctx.raycaster.intersectObjects(ctx.stretchState.handles, false)[0]?.object || null;
  }

  function onStretchPointerDown(e) {
    if (e.button !== 0 || !ctx.stretchState) return;
    const handle = pickStretchHandle(e);
    if (!handle) return;
    Object.assign(ctx.stretchState, {
      dragging: true,
      activeHandle: handle,
      startScale: ctx.stretchState.target.scale.clone()
    });
    movementState.skipClickFrame = true;
    e.preventDefault();
    e.stopPropagation();
  }

  function onStretchPointerMove(e) {
    if (!ctx.stretchState?.dragging || !ctx.stretchState.activeHandle) return;
    const axis = ctx.stretchState.activeHandle.userData.axis;
    const isCorner = ctx.stretchState.activeHandle.userData.isCorner;
    const delta = (-(e.movementY || 0) + (e.movementX || 0)) * 0.01;
    const target = ctx.stretchState.target;
    if (!target) {
      disposeStretchState();
      return;
    }
    if (isCorner) {
      target.scale.multiplyScalar(Math.max(0.1, Math.min(8, 1 + delta)));
    } else {
      target.scale.set(
        Math.max(0.1, Math.min(50, target.scale.x * (1 + axis.x * delta))),
        Math.max(0.1, Math.min(50, target.scale.y * (1 + axis.y * delta))),
        Math.max(0.1, Math.min(50, target.scale.z * (1 + axis.z * delta)))
      );
    }
    ctx.api.updateColliderForTarget(target);
    e.preventDefault();
  }

  function onStretchPointerUp(e) {
    if (!ctx.stretchState || e.button !== 0) return;
    ctx.stretchState.dragging = false;
    ctx.stretchState.activeHandle = null;
  }

  return installMovementApi(ctx, {
    disposeStretchState,
    createStretchGizmo,
    pickStretchHandle,
    onStretchPointerDown,
    onStretchPointerMove,
    onStretchPointerUp
  });
}
