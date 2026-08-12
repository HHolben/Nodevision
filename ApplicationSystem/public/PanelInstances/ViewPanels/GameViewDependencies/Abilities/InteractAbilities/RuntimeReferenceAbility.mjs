// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/Abilities/InteractAbilities/RuntimeReferenceAbility.mjs
// This file keeps Game View runtime references synchronized for portals, spawn points, and colliders. It lets editing abilities change objects while preserving the world arrays used by movement, interaction, and saving behavior.

import { installMovementApi } from "../movementContext.mjs";

export function installRuntimeReferenceAbility(ctx) {
  const { THREE, portals, spawnPoints } = ctx;

  function isPortalLikeTarget(target) {
    return target?.userData?.isPortal === true || String(target?.userData?.nvType || "").toLowerCase() === "portal";
  }

  function markPortalInspectableTarget(target, portalRef = null) {
    if (!target) return null;
    if (!target.userData || typeof target.userData !== "object") target.userData = {};
    target.userData.isPortal = true;
    target.userData.nvType = "portal";
    if (portalRef) {
      target.userData.portalRef = portalRef;
      portalRef.object3d = target;
      if (!portalRef.objectId) {
        portalRef.objectId = target.userData.metaWorldLayerId || target.userData.tag || target.name || target.uuid || "";
      }
    }
    return target;
  }

  function findPortalRefForTarget(target) {
    if (!target) return null;
    if (target.userData?.portalRef) return target.userData.portalRef;
    if (!Array.isArray(portals)) return null;
    const objectId = target.userData?.metaWorldLayerId || target.userData?.tag || target.name || "";
    return portals.find((entry) => entry?.object3d === target || (objectId && entry?.objectId === objectId)) || null;
  }

  function updatePortalRuntimeForTarget(target) {
    if (!target || !isPortalLikeTarget(target)) return;
    let portalRef = findPortalRefForTarget(target);
    if (!portalRef && Array.isArray(portals)) {
      portalRef = { lastTriggeredAt: 0 };
      portals.push(portalRef);
    }
    if (!portalRef) return;
    target.updateWorldMatrix?.(true, false);
    const box = new THREE.Box3().setFromObject(target);
    const objectId = target.userData?.metaWorldLayerId || target.userData?.tag || target.name || target.uuid || "";
    portalRef.box = box;
    portalRef.object3d = target;
    if (objectId) portalRef.objectId = objectId;
    portalRef.targetWorld = typeof target.userData?.portalTarget === "string" ? target.userData.portalTarget : portalRef.targetWorld || null;
    portalRef.sameWorld = typeof target.userData?.portalSameWorld === "boolean" ? target.userData.portalSameWorld : portalRef.sameWorld === true;
    portalRef.destinationMode = target.userData?.portalDestinationMode || portalRef.destinationMode;
    portalRef.linkedPortalId = typeof target.userData?.portalLinkedPortalId === "string" ? target.userData.portalLinkedPortalId : portalRef.linkedPortalId || "";
    portalRef.spawn = Array.isArray(target.userData?.portalSpawn) ? target.userData.portalSpawn.slice(0, 3) : (Array.isArray(portalRef.spawn) ? portalRef.spawn : null);
    portalRef.spawnPoint = typeof target.userData?.portalSpawnPoint === "string" ? target.userData.portalSpawnPoint : portalRef.spawnPoint || null;
    portalRef.spawnYaw = Number.isFinite(target.userData?.portalSpawnYaw) ? target.userData.portalSpawnYaw : (Number.isFinite(portalRef.spawnYaw) ? portalRef.spawnYaw : null);
    portalRef.cooldownMs = Number.isFinite(target.userData?.portalCooldownMs) ? target.userData.portalCooldownMs : portalRef.cooldownMs || 1200;
    target.userData.portalRef = portalRef;
    if (target.userData?.collisionActionRef) {
      target.userData.collisionActionRef.box = box;
      target.userData.collisionActionRef.object3d = target;
    }
  }

  function isSpawnPointTarget(target) {
    return target?.userData?.isSpawn === true
      || String(target?.userData?.nvType || "").toLowerCase() === "spawn"
      || Boolean(target?.userData?.spawnPointRef);
  }

  function readSpawnRuntimeId(target) {
    const candidates = [target?.userData?.spawnId, target?.userData?.spawnPointId, target?.userData?.metaWorldLayerId, target?.userData?.tag, target?.name, target?.uuid];
    const explicit = candidates.find((value) => typeof value === "string" && value.trim());
    return explicit ? explicit.trim() : "";
  }

  function findSpawnRefForTarget(target) {
    if (!target) return null;
    if (target.userData?.spawnPointRef) return target.userData.spawnPointRef;
    if (!Array.isArray(spawnPoints)) return null;
    const spawnId = readSpawnRuntimeId(target);
    const objectId = target.userData?.metaWorldLayerId || target.userData?.tag || target.name || "";
    return spawnPoints.find((entry) => entry?.object3d === target || entry?.target === target || (objectId && entry?.objectId === objectId) || (spawnId && entry?.id === spawnId)) || null;
  }

  function updateSpawnRuntimeForTarget(target) {
    if (!target || !isSpawnPointTarget(target)) return null;
    let spawnRef = findSpawnRefForTarget(target);
    if (!spawnRef && Array.isArray(spawnPoints)) {
      spawnRef = {};
      spawnPoints.push(spawnRef);
    }
    if (!spawnRef) return null;
    const spawnId = readSpawnRuntimeId(target) || "default";
    const yaw = Number.isFinite(target.userData?.spawnYaw) ? target.userData.spawnYaw : (Number.isFinite(spawnRef.yaw) ? spawnRef.yaw : 0);
    Object.assign(target.userData, { isSpawn: true, nvType: "spawn", spawnId, spawnYaw: yaw, spawnPointRef: spawnRef });
    Object.assign(spawnRef, {
      id: spawnId,
      objectId: target.userData?.metaWorldLayerId || spawnId,
      object3d: target,
      position: [target.position.x, target.position.y, target.position.z],
      yaw
    });
    return spawnRef;
  }

  function removeSpawnRuntimeForTarget(target) {
    if (!target || !Array.isArray(spawnPoints)) return;
    const spawnRef = target.userData?.spawnPointRef || null;
    const spawnId = readSpawnRuntimeId(target);
    for (let i = spawnPoints.length - 1; i >= 0; i -= 1) {
      const ref = spawnPoints[i];
      if (ref === spawnRef || ref?.object3d === target || ref?.target === target || (spawnRef == null && spawnId && ref?.id === spawnId)) spawnPoints.splice(i, 1);
    }
    delete target.userData.spawnPointRef;
  }

  function refreshSpawnRefs() {
    if (!Array.isArray(spawnPoints)) return;
    spawnPoints.slice().forEach((point) => {
      if (point?.object3d) updateSpawnRuntimeForTarget(point.object3d);
    });
  }

  function updateColliderForTarget(target) {
    updateSpawnRuntimeForTarget(target);
    updatePortalRuntimeForTarget(target);
    const ref = target?.userData?.colliderRef;
    if (!ref) return;
    if (ref.type === "compound" && typeof ref.update === "function") {
      ref.update();
      return;
    }
    const pos = target.position;
    if (ref.type === "box" && ref.box) {
      const half = ctx.api.resolveHalfExtents ? ctx.api.resolveHalfExtents(ref) : ref.half || { x: 0.5, y: 0.5, z: 0.5 };
      ref.box.min.set(pos.x - half.x, pos.y - half.y, pos.z - half.z);
      ref.box.max.set(pos.x + half.x, pos.y + half.y, pos.z + half.z);
    } else if (ref.type === "sphere" && ref.center) ref.center.copy(pos);
    else if (ref.type === "cylinder") ref.center = pos.clone();
  }

  return installMovementApi(ctx, {
    isPortalLikeTarget,
    markPortalInspectableTarget,
    findPortalRefForTarget,
    updatePortalRuntimeForTarget,
    isSpawnPointTarget,
    readSpawnRuntimeId,
    findSpawnRefForTarget,
    updateSpawnRuntimeForTarget,
    removeSpawnRuntimeForTarget,
    refreshSpawnRefs,
    updateColliderForTarget
  });
}
