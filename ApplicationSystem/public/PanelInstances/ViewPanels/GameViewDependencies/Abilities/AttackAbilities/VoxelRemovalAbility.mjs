// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/Abilities/AttackAbilities/VoxelRemovalAbility.mjs
// This file defines voxel-specific attack removal for Game View. It deletes voxel meshes and all runtime references while leaving the general break-target ability to handle non-voxel objects.

import { setStatus } from "/StatusBar.mjs";
import { installMovementApi } from "../movementContext.mjs";

export function installVoxelRemovalAbility(ctx) {
  const { scene, objects, colliders, collisionActions, useTargets, waterVolumes, movementState } = ctx;

  function isVoxelMesh(target) {
    return target?.isMesh && (target.userData?.isVoxel === true || target.userData?.voxel === true || target.userData?.voxelPlacer);
  }

  function removeVoxelMesh(target) {
    if (movementState.mountedVehicle?.object === target) ctx.api.dismountMountedVehicle({ showStatus: false });
    scene.remove(target);
    const objIndex = objects.indexOf(target);
    if (objIndex !== -1) objects.splice(objIndex, 1);
    const colliderRef = target.userData?.colliderRef;
    if (colliderRef) {
      const cIndex = colliders.indexOf(colliderRef);
      if (cIndex !== -1) colliders.splice(cIndex, 1);
      delete target.userData.colliderRef;
    }
    const collisionActionRef = target.userData?.collisionActionRef;
    if (collisionActionRef) {
      const idx = collisionActions.indexOf(collisionActionRef);
      if (idx !== -1) collisionActions.splice(idx, 1);
    }
    const useTargetRef = target.userData?.useTargetRef;
    if (useTargetRef) {
      const idx = useTargets.indexOf(useTargetRef);
      if (idx !== -1) useTargets.splice(idx, 1);
    }
    if (Array.isArray(waterVolumes)) {
      for (let i = waterVolumes.length - 1; i >= 0; i -= 1) {
        const ref = waterVolumes[i];
        if (ref === target.userData?.waterVolumeRef || ref?.target === target || ref?.object3d === target) waterVolumes.splice(i, 1);
      }
      delete target.userData.waterVolumeRef;
    }
    target.geometry?.dispose?.();
    if (Array.isArray(target.material)) target.material.forEach((mat) => mat?.dispose?.());
    else target.material?.dispose?.();
  }

  function tryDeleteVoxel() {
    if (movementState.worldMode === "2d") return false;
    if (!ctx.api.canUseAbility("allowBreak")) return true;
    const hit = ctx.api.getInspectHit({ includeMeasurements: false, allowInfinitePlanes: false });
    const target = hit?.object || null;
    if (!target) {
      setStatus("No voxel targeted.");
      return true;
    }
    if (!isVoxelMesh(target)) {
      setStatus("Voxel Placer only removes voxels.");
      return true;
    }
    removeVoxelMesh(target);
    setStatus("Voxel deleted.");
    return true;
  }

  return installMovementApi(ctx, {
    isVoxelMesh,
    removeVoxelMesh,
    tryDeleteVoxel
  });
}
