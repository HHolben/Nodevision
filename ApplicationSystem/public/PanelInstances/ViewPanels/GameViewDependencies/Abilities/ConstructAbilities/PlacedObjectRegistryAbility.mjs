// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/Abilities/ConstructAbilities/PlacedObjectRegistryAbility.mjs
// This file registers constructed Game View objects with stable runtime identifiers. It keeps portal and spawn placement metadata synchronized with the arrays used by travel and respawn interactions.

import { installMovementApi } from "../movementContext.mjs";

export function installPlacedObjectRegistryAbility(ctx) {
  const { THREE, portals } = ctx;

  function makePlacedObjectId(mesh, prefix = "object") {
    const existing = [mesh?.userData?.metaWorldLayerId, mesh?.userData?.tag, mesh?.name]
      .find((value) => typeof value === "string" && value.trim());
    const objectId = existing ? existing.trim() : prefix + "-" + Date.now().toString(36) + "-" + Math.floor(Math.random() * 1000);
    mesh.userData.metaWorldLayerId = objectId;
    if (!mesh.userData.tag) mesh.userData.tag = objectId;
    if (!mesh.name) mesh.name = objectId;
    return objectId;
  }

  function registerPlacedPortal(mesh) {
    if (!mesh) return null;
    const objectId = makePlacedObjectId(mesh, "portal");
    Object.assign(mesh.userData, {
      nvType: "portal",
      isPortal: true,
      isSolid: false,
      breakable: false,
      portalTarget: typeof mesh.userData.portalTarget === "string" && mesh.userData.portalTarget ? mesh.userData.portalTarget : null,
      portalSameWorld: mesh.userData.portalSameWorld !== false,
      portalDestinationMode: mesh.userData.portalDestinationMode || "coordinate",
      portalLinkedPortalId: typeof mesh.userData.portalLinkedPortalId === "string" ? mesh.userData.portalLinkedPortalId : "",
      portalSpawn: Array.isArray(mesh.userData.portalSpawn) ? mesh.userData.portalSpawn.slice(0, 3) : null,
      portalSpawnPoint: typeof mesh.userData.portalSpawnPoint === "string" ? mesh.userData.portalSpawnPoint : null,
      portalSpawnYaw: Number.isFinite(mesh.userData.portalSpawnYaw) ? mesh.userData.portalSpawnYaw : null,
      portalCooldownMs: Number.isFinite(mesh.userData.portalCooldownMs) ? mesh.userData.portalCooldownMs : 1200
    });
    mesh.updateWorldMatrix?.(true, false);
    const portalRef = mesh.userData.portalRef || { lastTriggeredAt: 0 };
    Object.assign(portalRef, {
      box: new THREE.Box3().setFromObject(mesh),
      object3d: mesh,
      objectId,
      targetWorld: mesh.userData.portalTarget,
      sameWorld: mesh.userData.portalSameWorld === true,
      destinationMode: mesh.userData.portalDestinationMode,
      linkedPortalId: mesh.userData.portalLinkedPortalId,
      spawn: mesh.userData.portalSpawn,
      spawnPoint: mesh.userData.portalSpawnPoint,
      spawnYaw: mesh.userData.portalSpawnYaw,
      cooldownMs: mesh.userData.portalCooldownMs
    });
    if (Array.isArray(portals) && !portals.includes(portalRef)) portals.push(portalRef);
    mesh.userData.portalRef = portalRef;
    return portalRef;
  }

  function registerPlacedSpawn(mesh) {
    if (!mesh) return null;
    const objectId = makePlacedObjectId(mesh, "spawn-point");
    mesh.userData.nvType = "spawn";
    mesh.userData.isSpawn = true;
    mesh.userData.isSolid = false;
    mesh.userData.spawnId = typeof mesh.userData.spawnId === "string" && mesh.userData.spawnId.trim() ? mesh.userData.spawnId.trim() : objectId;
    mesh.userData.spawnYaw = Number.isFinite(mesh.userData.spawnYaw) ? mesh.userData.spawnYaw : 0;
    return ctx.api.updateSpawnRuntimeForTarget(mesh);
  }

  return installMovementApi(ctx, {
    makePlacedObjectId,
    registerPlacedPortal,
    registerPlacedSpawn
  });
}
