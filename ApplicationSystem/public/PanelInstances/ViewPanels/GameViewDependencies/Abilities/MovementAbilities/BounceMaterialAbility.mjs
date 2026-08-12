// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/Abilities/MovementAbilities/BounceMaterialAbility.mjs
// This file defines bounce-material lookup for Game View movement. It loads user-visible world-object material metadata and exposes collider bounce settings to grounded movement without mixing catalog parsing into frame logic.

import { loadWorldObjectMaterialCatalog } from "/MetaWorld/Materials/WorldObjectMaterialDefaults.mjs";
import { installMovementApi } from "../movementContext.mjs";

export function installBounceMaterialAbility(ctx) {
  function materialLookupKey(value) {
    return typeof value === "string" && value.trim() ? value.trim().toLowerCase() : "";
  }

  function readBounceNumber(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function materialBounceConfigFromEntry(entry = {}) {
    const def = entry.materialDefinition && typeof entry.materialDefinition === "object" ? entry.materialDefinition : entry;
    const colliderDef = def.collider && typeof def.collider === "object" ? def.collider : {};
    const playerBounce = colliderDef.playerBounce && typeof colliderDef.playerBounce === "object"
      ? colliderDef.playerBounce
      : (def.playerBounce && typeof def.playerBounce === "object" ? def.playerBounce : {});
    const restitution = readBounceNumber(playerBounce.restitution, readBounceNumber(colliderDef.restitution, 0));
    const springConstantNewtonsPerMeter = readBounceNumber(
      playerBounce.springConstantNewtonsPerMeter,
      readBounceNumber(
        playerBounce.springConstant,
        readBounceNumber(
          colliderDef.springConstantNewtonsPerMeter,
          readBounceNumber(colliderDef.springConstant, readBounceNumber(def.springConstantNewtonsPerMeter, readBounceNumber(def.springConstant, 0)))
        )
      )
    );
    const enabled = playerBounce.enabled === true || restitution > 0;
    if (!enabled || restitution <= 0) return null;
    return {
      materialId: entry.materialId || def.id || entry.materialName || "",
      materialName: def.displayName || entry.displayName || entry.materialName || entry.materialId || "",
      restitution,
      damping: readBounceNumber(playerBounce.damping, 1),
      minIncomingSpeed: readBounceNumber(playerBounce.minIncomingSpeed, 0.08),
      minBounceSpeed: readBounceNumber(playerBounce.minBounceSpeed, 0),
      maxBounceSpeed: readBounceNumber(playerBounce.maxBounceSpeed, Infinity),
      springConstantNewtonsPerMeter,
      playerMassKg: readBounceNumber(playerBounce.playerMassKg, readBounceNumber(colliderDef.playerMassKg, 80)),
      surfaceCompressionScale: readBounceNumber(playerBounce.surfaceCompressionScale, readBounceNumber(colliderDef.surfaceCompressionScale, 30)),
      minSurfaceCompression: readBounceNumber(playerBounce.minSurfaceCompression, readBounceNumber(colliderDef.minSurfaceCompression, 0.015)),
      maxSurfaceCompression: readBounceNumber(playerBounce.maxSurfaceCompression, readBounceNumber(colliderDef.maxSurfaceCompression, 0.65)),
      surfaceReturnRate: readBounceNumber(playerBounce.surfaceReturnRate, readBounceNumber(colliderDef.surfaceReturnRate, NaN))
    };
  }

  function cacheBounceMaterial(entry = {}) {
    const config = materialBounceConfigFromEntry(entry);
    if (!config) return;
    [
      entry.materialId,
      entry.materialName,
      entry.displayName,
      entry.materialFile,
      entry.materialJSONfile,
      entry.materialDefinition?.id,
      entry.materialDefinition?.displayName
    ].forEach((key) => {
      const lookup = materialLookupKey(key);
      if (lookup) ctx.bounceMaterialsByKey.set(lookup, config);
    });
  }

  function refreshBounceMaterialCatalog(catalog = []) {
    ctx.bounceMaterialsByKey.clear();
    (Array.isArray(catalog) ? catalog : []).forEach(cacheBounceMaterial);
  }

  function bounceConfigForCollider(collider = null, context = {}) {
    if (collider?.box && context?.groundContact !== true) {
      const footY = Number(context.playerFootY);
      const topY = Number(collider.box.max?.y);
      const tolerance = Math.max(0.35, Math.abs(Number(context.incomingVelocityY) || 0) + 0.2);
      if (Number.isFinite(footY) && Number.isFinite(topY) && (footY < topY - 0.08 || footY > topY + tolerance)) return null;
    }
    const candidates = [
      collider?.materialId,
      collider?.physicsMaterialId,
      collider?.target?.userData?.physicsMaterialId,
      collider?.target?.userData?.physicsMaterialFile,
      collider?.target?.userData?.materialName,
      collider?.target?.userData?.terrain?.physicsMaterialId,
      collider?.target?.userData?.terrain?.physicsMaterialFile,
      collider?.target?.userData?.terrain?.materialName
    ];
    for (const candidate of candidates) {
      const config = ctx.bounceMaterialsByKey.get(materialLookupKey(candidate));
      if (config) return config;
    }
    return null;
  }

  void loadWorldObjectMaterialCatalog()
    .then(refreshBounceMaterialCatalog)
    .catch((err) => console.warn("Bouncy material catalog failed to load:", err));

  return installMovementApi(ctx, {
    materialLookupKey,
    readBounceNumber,
    materialBounceConfigFromEntry,
    cacheBounceMaterial,
    refreshBounceMaterialCatalog,
    bounceConfigForCollider
  });
}
