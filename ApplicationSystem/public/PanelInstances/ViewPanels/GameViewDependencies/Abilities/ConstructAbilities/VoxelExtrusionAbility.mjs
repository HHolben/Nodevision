// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/Abilities/ConstructAbilities/VoxelExtrusionAbility.mjs
// This file defines the Voxel Extruder construction ability for Game View. It clones a targeted voxel onto the viewed face while preserving collider and material metadata.

import { setStatus } from "/StatusBar.mjs";
import { installMovementApi } from "../movementContext.mjs";

export function installVoxelExtrusionAbility(ctx) {
  const { THREE, scene, objects, colliders, movementState } = ctx;

  function voxelHalfExtentsFromMesh(target) {
    const params = target?.geometry?.parameters || {};
    const scale = target?.scale || {};
    const width = Number(params.width);
    const height = Number(params.height);
    const depth = Number(params.depth);
    const fallbackSize = ctx.api.normalizeVoxelSize(target?.userData?.voxelSize || target?.userData?.voxelPlacer?.size || 1);
    return new THREE.Vector3(
      (Number.isFinite(width) && width > 0 ? width : fallbackSize) * Math.abs(Number(scale.x) || 1) * 0.5,
      (Number.isFinite(height) && height > 0 ? height : fallbackSize) * Math.abs(Number(scale.y) || 1) * 0.5,
      (Number.isFinite(depth) && depth > 0 ? depth : fallbackSize) * Math.abs(Number(scale.z) || 1) * 0.5
    );
  }

  function cloneVoxelMaterial(target) {
    if (Array.isArray(target?.material)) return target.material.map((mat) => mat?.clone?.() || mat);
    return target?.material?.clone?.() || new THREE.MeshStandardMaterial({
      color: target?.userData?.voxelPlacer?.color || "#8ee6c1",
      roughness: 0.74,
      metalness: 0.04
    });
  }

  function cloneVoxelUserData(target) {
    const data = target?.userData || {};
    const voxel = data.voxelPlacer && typeof data.voxelPlacer === "object" ? data.voxelPlacer : {};
    const cloned = { ...data, voxelPlacer: { ...voxel } };
    delete cloned.metaWorldLayerId;
    delete cloned.tag;
    delete cloned.colliderRef;
    delete cloned.collisionActionRef;
    delete cloned.useTargetRef;
    delete cloned.waterVolumeRef;
    cloned.isVoxel = true;
    cloned.voxel = true;
    cloned.breakable = true;
    cloned.placedByPlayer = true;
    return cloned;
  }

  function dominantAxisFromNormal(normal) {
    const x = Math.abs(normal.x);
    const y = Math.abs(normal.y);
    const z = Math.abs(normal.z);
    if (x >= y && x >= z) return new THREE.Vector3(Math.sign(normal.x) || 1, 0, 0);
    if (y >= x && y >= z) return new THREE.Vector3(0, Math.sign(normal.y) || 1, 0);
    return new THREE.Vector3(0, 0, Math.sign(normal.z) || 1);
  }

  function tryExtrudeVoxel({ snapToGrid = false } = {}) {
    if (movementState.worldMode === "2d") return false;
    if (!ctx.api.canUseAbility("allowPlace")) return true;
    const hit = ctx.api.getInspectHit({ includeMeasurements: false, allowInfinitePlanes: false });
    const target = hit?.object || null;
    if (!target) {
      setStatus("No voxel targeted.");
      return true;
    }
    if (!ctx.api.isVoxelMesh(target)) {
      setStatus("Voxel Extruder only clones voxels.");
      return true;
    }
    const sourceHalf = voxelHalfExtentsFromMesh(target);
    const cloneHalf = sourceHalf.clone();
    const axis = dominantAxisFromNormal(ctx.api.placementNormalFromHit(hit));
    const placePos = target.position.clone().add(new THREE.Vector3(
      axis.x * (sourceHalf.x + cloneHalf.x),
      axis.y * (sourceHalf.y + cloneHalf.y),
      axis.z * (sourceHalf.z + cloneHalf.z)
    ));
    if (snapToGrid) snapVoxelToGrid(placePos, sourceHalf, cloneHalf);
    if (placePos.y < cloneHalf.y) placePos.y = cloneHalf.y;
    const colliderEnabled = target.userData?.colliderRef ? true : target.userData?.voxelPlacer?.collider !== false && target.userData?.isSolid === true;
    const shape = colliderEnabled ? { type: "box", half: cloneHalf } : null;
    if (shape && ctx.api.intersectsPlayer(placePos, shape)) {
      setStatus("Extruded voxel would intersect the player.");
      return true;
    }
    if (shape && ctx.api.intersectsExistingColliders(placePos, shape)) {
      setStatus("Extruded voxel would overlap an existing collider.");
      return true;
    }
    const mesh = target.clone(false);
    mesh.geometry = target.geometry?.clone?.() || new THREE.BoxGeometry(cloneHalf.x * 2, cloneHalf.y * 2, cloneHalf.z * 2);
    mesh.material = cloneVoxelMaterial(target);
    mesh.userData = cloneVoxelUserData(target);
    mesh.position.copy(placePos);
    mesh.rotation.copy(target.rotation);
    mesh.quaternion.copy(target.quaternion);
    mesh.scale.copy(target.scale);
    mesh.name = "";
    mesh.userData.isSolid = colliderEnabled;
    mesh.userData.physicsEnabled = colliderEnabled;
    if (mesh.userData.voxelPlacer) mesh.userData.voxelPlacer.collider = colliderEnabled;
    ctx.api.makePlacedObjectId(mesh, "voxel");
    scene.add(mesh);
    objects.push(mesh);
    if (colliderEnabled) {
      const colliderRef = ctx.api.createVoxelColliderRef(mesh, cloneHalf, mesh.userData.physicsMaterialId);
      colliders.push(colliderRef);
      mesh.userData.colliderRef = colliderRef;
    }
    setStatus("Voxel extruded.");
    return true;
  }

  function snapVoxelToGrid(placePos, sourceHalf, cloneHalf) {
    const grid = Math.max(0.05, Math.min(sourceHalf.x, sourceHalf.y, sourceHalf.z) * 2);
    placePos.x = Math.round(placePos.x / grid) * grid;
    placePos.y = Math.round((placePos.y - cloneHalf.y) / grid) * grid + cloneHalf.y;
    placePos.z = Math.round(placePos.z / grid) * grid;
  }

  return installMovementApi(ctx, {
    voxelHalfExtentsFromMesh,
    cloneVoxelMaterial,
    cloneVoxelUserData,
    dominantAxisFromNormal,
    tryExtrudeVoxel,
    snapVoxelToGrid
  });
}
