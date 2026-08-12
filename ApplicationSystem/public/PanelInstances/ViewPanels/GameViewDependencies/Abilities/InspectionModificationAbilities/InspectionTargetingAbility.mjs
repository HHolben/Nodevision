// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/Abilities/InspectionModificationAbilities/InspectionTargetingAbility.mjs
// This file defines inspection-target ray selection for Game View. It unifies regular mesh hits, bounds-picked object files, measurement visuals, equation planes, and portal fallbacks.

import { getPlaneRayIntersection } from "../../equationColliderTool.mjs";
import { installMovementApi } from "../movementContext.mjs";

export function installInspectionTargetingAbility(ctx) {
  const { THREE, camera, objects, portals } = ctx;

  function isEquationObjectTarget(target) {
    const type = String(target?.userData?.nvType || "").toLowerCase();
    return type === "equation-collider-plane"
      || type === "equation-inequality"
      || target?.userData?.metaWorldExpressionLayer === true
      || type === "functionsurface"
      || type === "functioncurve"
      || type === "parametriccurve";
  }

  function getEquationPlaneRayHits() {
    const ray = ctx.raycaster.ray;
    return (objects || [])
      .filter((obj) => obj?.isMesh && obj?.visible && ["equation-collider-plane", "equation-inequality"].includes(String(obj.userData?.nvType || "").toLowerCase()))
      .map((mesh) => getPlaneRayIntersection(THREE, mesh, ray))
      .filter((hit) => hit && Number.isFinite(hit.distance) && hit.object?.visible);
  }

  function getPortalRefInspectHit() {
    if (!Array.isArray(portals) || portals.length === 0) return null;
    const hits = [];
    for (const portal of portals) {
      const target = portal?.object3d || null;
      if (target?.visible === false) continue;
      if (target?.updateWorldMatrix) {
        target.updateWorldMatrix(true, false);
        portal.box = new THREE.Box3().setFromObject(target);
      }
      const box = portal?.box;
      if (!box || box.isEmpty?.()) continue;
      const point = box.containsPoint(ctx.raycaster.ray.origin)
        ? ctx.boundsPickPoint.copy(ctx.raycaster.ray.origin)
        : ctx.raycaster.ray.intersectBox(box, ctx.boundsPickPoint);
      if (!point) continue;
      const distance = ctx.raycaster.ray.origin.distanceTo(point);
      if (!Number.isFinite(distance) || distance > ctx.useRangeMax || !target) continue;
      ctx.api.markPortalInspectableTarget(target, portal);
      hits.push({ distance, point: point.clone(), object: target, portalRef: portal, boundsPick: true });
    }
    return hits.sort((a, b) => a.distance - b.distance)[0] || null;
  }

  function collectPortalInspectCandidates() {
    const candidates = [];
    const seen = new Set();
    const add = (target, portalRef = null) => {
      if (!target || target.visible === false || seen.has(target)) return;
      if (portalRef) ctx.api.markPortalInspectableTarget(target, portalRef);
      else if (!ctx.api.isPortalLikeTarget(target)) return;
      seen.add(target);
      candidates.push(target);
    };
    (objects || []).forEach((target) => add(target));
    if (Array.isArray(portals)) portals.forEach((portal) => add(portal?.object3d, portal));
    return candidates;
  }

  function getPortalInspectFallbackHit() {
    ctx.raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    const hits = [];
    const maxDistance = Math.max(ctx.useRangeMax, 40);
    for (const target of collectPortalInspectCandidates()) {
      target.updateWorldMatrix?.(true, false);
      const box = new THREE.Box3().setFromObject(target);
      if (box.isEmpty()) continue;
      const directPoint = box.containsPoint(ctx.raycaster.ray.origin)
        ? ctx.raycaster.ray.origin.clone()
        : ctx.raycaster.ray.intersectBox(box, new THREE.Vector3());
      if (directPoint) {
        const distance = ctx.raycaster.ray.origin.distanceTo(directPoint);
        if (Number.isFinite(distance) && distance <= maxDistance) hits.push({ distance, point: directPoint.clone(), object: target, boundsPick: true, portalFallback: true });
        continue;
      }
      const center = box.getCenter(new THREE.Vector3());
      const toCenter = center.clone().sub(ctx.raycaster.ray.origin);
      const projected = toCenter.dot(ctx.raycaster.ray.direction);
      if (!Number.isFinite(projected) || projected < 0 || projected > maxDistance) continue;
      const closest = ctx.raycaster.ray.origin.clone().addScaledVector(ctx.raycaster.ray.direction, projected);
      const pickRadius = Math.max(0.55, Math.min(1.75, box.getSize(new THREE.Vector3()).length() * 0.35));
      if (center.distanceTo(closest) <= pickRadius) hits.push({ distance: projected, point: center, object: target, boundsPick: true, portalFallback: true });
    }
    return hits.sort((a, b) => a.distance - b.distance)[0] || null;
  }

  function getInspectHit(options = {}) {
    ctx.raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    const includeMeasurements = options.includeMeasurements === true;
    const worldCandidates = (objects || []).filter((obj) => obj?.isMesh && obj?.visible);
    const measureCandidates = includeMeasurements ? ctx.api.getMeasurementVisualsStore().filter((obj) => obj?.isMesh && obj?.visible) : [];
    const split = ctx.api.splitBoundsPickCandidates(worldCandidates);
    const meshHits = ctx.raycaster.intersectObjects(split.raycast.concat(measureCandidates), false)
      .filter((h) => Number.isFinite(h.distance) && h.distance <= ctx.useRangeMax && h.object?.visible);
    const boundsHits = split.bounds.map(ctx.api.boundsPickHit).filter(Boolean);
    const planeHits = options.allowInfinitePlanes === false ? [] : getEquationPlaneRayHits();
    const portalRefHit = getPortalRefInspectHit();
    return meshHits.concat(boundsHits, planeHits, portalRefHit ? [portalRefHit] : []).sort((a, b) => a.distance - b.distance)[0] || null;
  }

  return installMovementApi(ctx, {
    isEquationObjectTarget,
    getEquationPlaneRayHits,
    getPortalRefInspectHit,
    collectPortalInspectCandidates,
    getPortalInspectFallbackHit,
    getInspectHit
  });
}
