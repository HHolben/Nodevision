// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/Abilities/InteractAbilities/PortalTravelAbility.mjs
// This file defines portal travel for Game View worlds. It resolves same-world exits, linked portals, spawn points, and external world loads without embedding travel rules in the movement loop.

import { installMovementApi } from "../movementContext.mjs";

export function installPortalTravelAbility(ctx) {
  const { THREE, controls, objects, portals, spawnPoints, movementState, loadWorldFromFile } = ctx;

  function isSameWorldTarget(value) {
    if (typeof value !== "string") return false;
    const normalized = value.trim().toLowerCase();
    return normalized === "self" || normalized === "." || normalized === "same" || normalized === "current";
  }

  function readLinkedPortalId(portal) {
    const value = portal?.linkedPortalId || portal?.portalLinkedPortalId || portal?.targetPortalId || portal?.portalTargetId;
    return typeof value === "string" && value.trim() ? value.trim() : "";
  }

  function findPortalHit(position, nowMs) {
    if (!portals || portals.length === 0) return null;
    const playerMinY = position.y - movementState.playerHeight;
    const playerMaxY = position.y;
    for (const portal of portals) {
      const portalObject = portal?.object3d || null;
      if (portalObject?.visible === false) continue;
      if (portalObject?.updateWorldMatrix) {
        portalObject.updateWorldMatrix(true, false);
        portal.box = new THREE.Box3().setFromObject(portalObject);
      }
      const linkedPortalId = readLinkedPortalId(portal);
      if (!portal?.box || (!portal?.targetWorld && !portal?.sameWorld && !linkedPortalId)) continue;
      if (nowMs - portal.lastTriggeredAt < portal.cooldownMs) continue;
      const minX = portal.box.min.x - ctx.playerRadius;
      const maxX = portal.box.max.x + ctx.playerRadius;
      const minZ = portal.box.min.z - ctx.playerRadius;
      const maxZ = portal.box.max.z + ctx.playerRadius;
      const overlapsY = playerMaxY >= portal.box.min.y && playerMinY <= portal.box.max.y;
      if (position.x >= minX && position.x <= maxX && position.z >= minZ && position.z <= maxZ && overlapsY) {
        portal.lastTriggeredAt = nowMs;
        return portal;
      }
    }
    return null;
  }

  function resolveSpawnChoice(spawnPointId) {
    ctx.api.refreshSpawnRefs();
    if (Array.isArray(spawnPoints) && spawnPoints.length > 0) {
      const requestedId = typeof spawnPointId === "string" ? spawnPointId.trim() : "";
      if (requestedId) {
        const match = spawnPoints.find((point) => String(point?.id || "").trim() === requestedId)
          || spawnPoints.find((point) => String(point?.id || "").trim().toLowerCase() === requestedId.toLowerCase());
        if (match?.position) return match;
      }
      const fallback = spawnPoints.find((point) => point?.position);
      if (fallback?.position) return fallback;
    }
    return { position: [0, movementState.playerHeight || ctx.basePlayerHeight, 0], yaw: null };
  }

  function applySpawnChoice(spawnPointId, spawnYaw) {
    const chosen = resolveSpawnChoice(spawnPointId);
    if (Array.isArray(chosen?.position) && chosen.position.length >= 3) {
      controls.getObject().position.set(chosen.position[0], chosen.position[1], chosen.position[2]);
      movementState.velocityY = 0;
      movementState.isGrounded = true;
    }
    const yaw = Number.isFinite(spawnYaw) ? spawnYaw : (Number.isFinite(chosen?.yaw) ? chosen.yaw : null);
    if (Number.isFinite(yaw)) controls.getObject().rotation.y = yaw;
  }

  function findPortalObjectById(portalId) {
    if (typeof portalId !== "string" || !portalId.trim() || !Array.isArray(objects)) return null;
    const id = portalId.trim();
    return objects.find((object) => {
      if (!object?.userData?.isPortal) return false;
      const ref = object.userData.portalRef;
      return object.userData.metaWorldLayerId === id || object.userData.tag === id || object.name === id || ref?.objectId === id;
    }) || null;
  }

  function readPortalExitPosition(targetObject) {
    if (!targetObject) return null;
    const worldPosition = new THREE.Vector3();
    const worldQuaternion = new THREE.Quaternion();
    targetObject.getWorldPosition?.(worldPosition);
    targetObject.getWorldQuaternion?.(worldQuaternion);
    const direction = new THREE.Vector3(0, 0, 1).applyQuaternion(worldQuaternion);
    if (direction.lengthSq() < 1e-6) direction.set(0, 0, 1);
    direction.normalize();
    const exit = worldPosition.addScaledVector(direction, Math.max(ctx.playerRadius * 4, 1.25));
    exit.y = Math.max(exit.y + 0.35, movementState.playerHeight || ctx.basePlayerHeight);
    return exit;
  }

  function applyPortalExitObject(targetObject, spawnYaw, nowMs = performance.now()) {
    const exit = readPortalExitPosition(targetObject);
    if (!exit) return false;
    controls.getObject().position.copy(exit);
    movementState.velocityY = 0;
    movementState.isGrounded = true;
    if (Number.isFinite(spawnYaw)) controls.getObject().rotation.y = spawnYaw;
    const targetRef = targetObject.userData?.portalRef;
    if (targetRef) {
      targetRef.lastTriggeredAt = nowMs;
      targetObject.updateWorldMatrix?.(true, false);
      targetRef.box = new THREE.Box3().setFromObject(targetObject);
    }
    return true;
  }

  function applyPortalTravel(portalLike, nowMs = performance.now()) {
    if (!portalLike) return false;
    const sameWorld = portalLike.sameWorld === true || isSameWorldTarget(portalLike.targetWorld);
    const targetWorld = sameWorld ? null : portalLike.targetWorld;
    const linkedPortalId = readLinkedPortalId(portalLike);
    const hasSpawn = Array.isArray(portalLike.spawn) && portalLike.spawn.length >= 3;
    if (linkedPortalId) {
      if (sameWorld) {
        const linkedPortal = findPortalObjectById(linkedPortalId);
        if (linkedPortal && applyPortalExitObject(linkedPortal, portalLike.spawnYaw, nowMs)) {
          portalLike.lastTriggeredAt = nowMs;
          return true;
        }
        console.warn("Linked portal target not found:", linkedPortalId);
      } else if (targetWorld && typeof loadWorldFromFile === "function") {
        loadWorldFromFile(targetWorld, {
          portalTargetId: linkedPortalId,
          spawnYaw: Number.isFinite(portalLike.spawnYaw) ? portalLike.spawnYaw : null,
          skipAutoSpawn: false
        });
        return true;
      }
    }
    if (!sameWorld) {
      if (!targetWorld || typeof loadWorldFromFile !== "function") {
        console.warn("Portal action missing targetWorld or loader.", portalLike);
        return false;
      }
      loadWorldFromFile(targetWorld, {
        spawnPoint: typeof portalLike.spawnPoint === "string" ? portalLike.spawnPoint : null,
        spawnYaw: Number.isFinite(portalLike.spawnYaw) ? portalLike.spawnYaw : null,
        skipAutoSpawn: hasSpawn
      });
      return true;
    }
    if (hasSpawn) {
      controls.getObject().position.set(portalLike.spawn[0], portalLike.spawn[1], portalLike.spawn[2]);
      movementState.velocityY = 0;
      movementState.isGrounded = true;
      if (Number.isFinite(portalLike.spawnYaw)) controls.getObject().rotation.y = portalLike.spawnYaw;
      return true;
    }
    if (typeof portalLike.spawnPoint === "string") {
      applySpawnChoice(portalLike.spawnPoint, portalLike.spawnYaw);
      return true;
    }
    return false;
  }

  return installMovementApi(ctx, {
    isSameWorldTarget,
    readLinkedPortalId,
    findPortalHit,
    resolveSpawnChoice,
    applySpawnChoice,
    findPortalObjectById,
    readPortalExitPosition,
    applyPortalExitObject,
    applyPortalTravel
  });
}
