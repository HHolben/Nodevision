// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/Abilities/AttackAbilities/BreakTargetAbility.mjs
// This file defines the general break-target attack ability for Game View. It removes breakable world objects, cleans runtime references, and returns recognized placed items to inventory.

import { installMovementApi } from "../movementContext.mjs";

const RETURNABLE_ITEM_TYPES = new Set([
  "box",
  "sphere",
  "cylinder",
  "flying-carpet",
  "console",
  "portal",
  "spawn",
  "math-function",
  "object-file",
  "image-plane",
  "iframe"
]);

export function installBreakTargetAbility(ctx) {
  const { scene, objects, colliders, collisionActions, useTargets, portals, waterVolumes, movementState } = ctx;

  function tryBreakTargetBlock() {
    if (movementState.worldMode === "2d") return false;
    let hit = ctx.api.getInspectHit({ includeMeasurements: true, allowInfinitePlanes: true });
    if (!hit?.object) hit = ctx.api.getPortalInspectFallbackHit();
    if (!hit?.object) return false;
    let target = hit.object;
    let isEquationObject = ctx.api.isEquationObjectTarget(target);
    let isPortalTarget = ctx.api.isPortalLikeTarget(target);
    let isSpawnTarget = ctx.api.isSpawnPointTarget(target);
    if (shouldFallbackToPortal(target, isEquationObject, isPortalTarget)) {
      const portalHit = ctx.api.getPortalInspectFallbackHit();
      if (portalHit?.object) {
        hit = portalHit;
        target = hit.object;
        isEquationObject = ctx.api.isEquationObjectTarget(target);
        isPortalTarget = ctx.api.isPortalLikeTarget(target);
        isSpawnTarget = ctx.api.isSpawnPointTarget(target);
      }
    }
    if (!isEquationObject && !ctx.api.canUseAbility("allowBreak")) return false;
    if (target.userData?.isMeasureEndpoint === "second") {
      ctx.api.removeMeasurementVisual(target);
      movementState.tapeMeasureSecondMarker = null;
      movementState.tapeMeasureSecondPoint = null;
      ctx.api.updateTapeMeasurePreview();
      return true;
    }
    if (!isEquationObject && !isPortalTarget && !isBreakablePlacedTarget(target)) return false;
    const breakHandler = target.userData?.onBreakTarget;
    if (typeof breakHandler === "function") {
      const handled = breakHandler({ target, scene, objects, colliders, collisionActions, useTargets }) !== false;
      if (handled) return true;
    }
    if (movementState.mountedVehicle?.object === target) ctx.api.dismountMountedVehicle({ showStatus: false });
    scene.remove(target);
    removeFromArray(objects, target);
    if (isPortalTarget) removePortalRuntime(target);
    if (isSpawnTarget) ctx.api.removeSpawnRuntimeForTarget(target);
    removeObjectRefs(target, isPortalTarget);
    returnBreakableInventoryItem(target);
    return true;
  }

  function shouldFallbackToPortal(target, isEquationObject, isPortalTarget) {
    return !isEquationObject
      && !isPortalTarget
      && (target.userData?.breakable === false || (!target.userData?.breakable && !target.userData?.placedByPlayer));
  }

  function isBreakablePlacedTarget(target) {
    if (target.userData?.breakable === false) return false;
    return target.userData?.breakable || target.userData?.placedByPlayer;
  }

  function removeFromArray(list, item) {
    if (!Array.isArray(list)) return;
    const index = list.indexOf(item);
    if (index !== -1) list.splice(index, 1);
  }

  function removePortalRuntime(target) {
    if (!Array.isArray(portals)) return;
    for (let i = portals.length - 1; i >= 0; i -= 1) {
      const ref = portals[i];
      if (ref === target.userData?.portalRef || ref?.object3d === target || ref?.objectId === target.userData?.metaWorldLayerId) portals.splice(i, 1);
    }
    delete target.userData.portalRef;
  }

  function removeObjectRefs(target, isPortalTarget) {
    const colliderRef = target.userData?.colliderRef;
    if (colliderRef) removeFromArray(colliders, colliderRef);
    const collisionActionRef = target.userData?.collisionActionRef;
    if (collisionActionRef) removeFromArray(collisionActions, collisionActionRef);
    if (isPortalTarget && Array.isArray(collisionActions)) {
      for (let i = collisionActions.length - 1; i >= 0; i -= 1) {
        const ref = collisionActions[i];
        if (ref?.object3d === target || ref === collisionActionRef) collisionActions.splice(i, 1);
      }
    }
    const useTargetRef = target.userData?.useTargetRef;
    if (useTargetRef) removeFromArray(useTargets, useTargetRef);
    if (Array.isArray(waterVolumes)) {
      for (let i = waterVolumes.length - 1; i >= 0; i -= 1) {
        const ref = waterVolumes[i];
        if (ref === target.userData?.waterVolumeRef || ref?.target === target || ref?.object3d === target) waterVolumes.splice(i, 1);
      }
      delete target.userData.waterVolumeRef;
    }
  }

  function returnBreakableInventoryItem(target) {
    const inventory = window.VRWorldContext?.inventory;
    const itemType = target.userData?.nvType;
    if (!inventory?.addItem || typeof itemType !== "string" || !RETURNABLE_ITEM_TYPES.has(itemType)) return;
    const label = itemType === ctx.FLYING_CARPET_ITEM_ID ? "Flying Carpet" : itemType.charAt(0).toUpperCase() + itemType.slice(1);
    inventory.addItem(itemType, 1, label);
    if (itemType === "object-file" && target.userData?.objectFilePath && inventory?.setSelectedObjectFile) {
      inventory.setSelectedObjectFile(target.userData.objectFilePath);
    }
    if (itemType === "image-plane" && target.userData?.imageFilePath && inventory?.setSelectedImageFile) {
      inventory.setSelectedImageFile(target.userData.imageFilePath);
    }
  }

  return installMovementApi(ctx, {
    tryBreakTargetBlock,
    shouldFallbackToPortal,
    isBreakablePlacedTarget,
    removeFromArray,
    removePortalRuntime,
    removeObjectRefs,
    returnBreakableInventoryItem
  });
}
