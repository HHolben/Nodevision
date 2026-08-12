// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/Abilities/InspectionModificationAbilities/PickingAbility.mjs
// This file defines shared ray-picking helpers for Game View movement abilities. It gives construction, inspection, terrain painting, and zero-gravity movement modules a common way to find surfaces without duplicating browser-side raycaster behavior.

import { installMovementApi } from "../movementContext.mjs";

export function installPickingAbility(ctx) {
  const { THREE, camera, controls, objects, ground } = ctx;

  function getFacingDirection(out = new THREE.Vector3()) {
    const ctrlObj = controls?.getObject?.();
    if (camera?.getWorldDirection) camera.getWorldDirection(out);
    else if (typeof controls.getDirection === "function") controls.getDirection(out);
    else if (ctrlObj?.getWorldDirection) ctrlObj.getWorldDirection(out);
    else out.set(0, 0, -1);
    if (out.lengthSq() < 1e-6) out.copy(ctx.lastGrabDir);
    else {
      out.normalize();
      ctx.lastGrabDir.copy(out);
    }
    return out;
  }

  function ensurePositionArrowTexture() {
    if (ctx.positionArrowTexture) return ctx.positionArrowTexture;
    ctx.positionArrowTexture = ctx.textureLoader.load("/icons/PositionArrowIcon.png");
    ctx.positionArrowTexture.anisotropy = 4;
    ctx.positionArrowTexture.minFilter = THREE.NearestFilter;
    ctx.positionArrowTexture.magFilter = THREE.NearestFilter;
    ctx.positionArrowTexture.generateMipmaps = false;
    return ctx.positionArrowTexture;
  }

  function getPointerNdc(event) {
    if (controls?.isLocked || !event || typeof event.clientX !== "number" || typeof event.clientY !== "number") {
      return { x: 0, y: 0 };
    }
    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;
    return { x: (event.clientX / w) * 2 - 1, y: -(event.clientY / h) * 2 + 1 };
  }

  function shouldUseBoundsPicking(target) {
    if (!target?.isMesh) return false;
    if (target.userData?.isPortal === true || String(target.userData?.nvType || "").toLowerCase() === "portal") return true;
    if (target.userData?.objectFileUseBoundsPicking === true) return true;
    const objectPath = String(target.userData?.objectFilePath || "").toLowerCase().split(/[?#]/)[0];
    return objectPath.endsWith(".stl") || objectPath.endsWith(".obj");
  }

  function boundsPickHit(target) {
    if (!target?.isMesh || target.visible === false) return null;
    target.updateMatrixWorld?.(true);
    ctx.boundsPickBox.setFromObject(target);
    if (ctx.boundsPickBox.isEmpty()) return null;
    const point = ctx.boundsPickBox.containsPoint(ctx.raycaster.ray.origin)
      ? ctx.boundsPickPoint.copy(ctx.raycaster.ray.origin)
      : ctx.raycaster.ray.intersectBox(ctx.boundsPickBox, ctx.boundsPickPoint);
    if (!point) return null;
    const distance = ctx.raycaster.ray.origin.distanceTo(point);
    if (!Number.isFinite(distance) || distance > ctx.useRangeMax) return null;
    return { distance, point: point.clone(), object: target, boundsPick: true };
  }

  function splitBoundsPickCandidates(candidates = []) {
    const bounds = [];
    const raycast = [];
    for (const candidate of candidates) {
      if (shouldUseBoundsPicking(candidate)) bounds.push(candidate);
      else raycast.push(candidate);
    }
    return { bounds, raycast };
  }

  function getPlacementHit({ maxDistance = ctx.useRangeMax } = {}) {
    ctx.raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    const objectCandidates = (objects || []).filter((obj) => obj?.isMesh && obj?.visible);
    const split = splitBoundsPickCandidates(objectCandidates);
    const candidates = [];
    if (ground?.visible) candidates.push(ground);
    candidates.push(...split.raycast);
    const meshHits = ctx.raycaster.intersectObjects(candidates, false);
    const boundsHits = split.bounds.map(boundsPickHit).filter(Boolean);
    return meshHits.concat(boundsHits)
      .filter((h) => Number.isFinite(h.distance) && h.distance <= maxDistance && h.object?.visible)
      .sort((a, b) => a.distance - b.distance)[0] || null;
  }

  function getOppositeFacingSurfaceHit(maxDistance = ctx.useRangeMax) {
    const object = controls.getObject();
    const origin = camera.getWorldPosition ? camera.getWorldPosition(new THREE.Vector3()) : object.position.clone();
    controls.getDirection(ctx.zeroGravityKickDirection);
    if (ctx.zeroGravityKickDirection.lengthSq() < 1e-8) ctx.zeroGravityKickDirection.set(0, 0, -1);
    ctx.zeroGravityKickDirection.normalize();
    ctx.raycaster.set(origin, ctx.zeroGravityKickDirection.clone().negate(), 0, maxDistance);
    const objectCandidates = (objects || []).filter((obj) => obj?.isMesh && obj?.visible);
    const split = splitBoundsPickCandidates(objectCandidates);
    const candidates = [];
    if (ground?.visible) candidates.push(ground);
    candidates.push(...split.raycast);
    const meshHits = ctx.raycaster.intersectObjects(candidates, false);
    const boundsHits = split.bounds.map(boundsPickHit).filter(Boolean);
    return meshHits.concat(boundsHits)
      .filter((h) => Number.isFinite(h.distance) && h.distance <= maxDistance && h.object?.visible)
      .sort((a, b) => a.distance - b.distance)[0] || null;
  }

  function getTerrainPaintHit() {
    ctx.raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -ctx.groundLevel);
    const floorPoint = new THREE.Vector3();
    const point = ctx.raycaster.ray.intersectPlane(floorPlane, floorPoint);
    if (point) return { point: floorPoint, distance: ctx.raycaster.ray.origin.distanceTo(floorPoint), object: ground || null };
    return getPlacementHit({ maxDistance: Infinity });
  }

  return installMovementApi(ctx, {
    getFacingDirection,
    ensurePositionArrowTexture,
    getPointerNdc,
    shouldUseBoundsPicking,
    boundsPickHit,
    splitBoundsPickCandidates,
    getPlacementHit,
    getOppositeFacingSurfaceHit,
    getTerrainPaintHit
  });
}
