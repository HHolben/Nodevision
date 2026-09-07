// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/Abilities/ConstructAbilities/VoxelPlacementAbility.mjs
// This file defines the Voxel Placer construction ability for Game View. It creates material-tagged cube meshes and collider references without embedding voxel rules in the movement update loop.

import { setStatus } from "/StatusBar.mjs";
import { materialFileForWorldObjectMaterial } from "/MetaWorld/Materials/WorldObjectMaterialDefaults.mjs";
import { installMovementApi } from "../movementContext.mjs";

export function installVoxelPlacementAbility(ctx) {
  const { THREE, scene, objects, colliders, movementState } = ctx;

  function dominantAxisFromNormal(normal) {
    const x = Math.abs(normal.x);
    const y = Math.abs(normal.y);
    const z = Math.abs(normal.z);
    if (x >= y && x >= z) return new THREE.Vector3(Math.sign(normal.x) || 1, 0, 0);
    if (y >= x && y >= z) return new THREE.Vector3(0, Math.sign(normal.y) || 1, 0);
    return new THREE.Vector3(0, 0, Math.sign(normal.z) || 1);
  }

  function computeTargetFacePlacement(hit, normal, half) {
    const target = hit?.object || null;
    const geometry = target?.geometry || null;
    if (!target || !geometry) return null;
    if (!geometry.boundingBox && typeof geometry.computeBoundingBox === "function") geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    if (!box?.min || !box?.max) return null;
    const localNormal = normal.clone().normalize();
    if (target.matrixWorld) {
      const inverseWorld = new THREE.Matrix4().copy(target.matrixWorld).invert();
      localNormal.transformDirection(inverseWorld).normalize();
    }
    const localAxis = dominantAxisFromNormal(localNormal);
    const faceCenter = box.min.clone().add(box.max).multiplyScalar(0.5);
    if (localAxis.x > 0) faceCenter.x = box.max.x;
    else if (localAxis.x < 0) faceCenter.x = box.min.x;
    else if (localAxis.y > 0) faceCenter.y = box.max.y;
    else if (localAxis.y < 0) faceCenter.y = box.min.y;
    else if (localAxis.z > 0) faceCenter.z = box.max.z;
    else faceCenter.z = box.min.z;
    const worldCenter = faceCenter.clone();
    if (target.matrixWorld) worldCenter.applyMatrix4(target.matrixWorld);
    const worldNormal = localAxis.clone();
    if (target.matrixWorld) worldNormal.transformDirection(target.matrixWorld).normalize();
    else worldNormal.normalize();
    const offset = Math.abs(worldNormal.x) * half.x + Math.abs(worldNormal.y) * half.y + Math.abs(worldNormal.z) * half.z;
    return worldCenter.addScaledVector(worldNormal, offset);
  }

  function snapVoxelPositionToGrid(placePos, half) {
    const size = Math.max(0.05, half.x * 2);
    placePos.x = Math.round(placePos.x / size) * size;
    placePos.y = Math.round((placePos.y - half.y) / size) * size + half.y;
    placePos.z = Math.round(placePos.z / size) * size;
  }

  function computeVoxelPlacePosition(hit, normal, half, snapToGrid, options = {}) {
    const n = normal.clone().normalize();
    const snappedPos = options.faceCenterSnap ? computeTargetFacePlacement(hit, n, half) : null;
    const placePos = snappedPos || hit.point.clone().addScaledVector(n, Math.abs(n.x) * half.x + Math.abs(n.y) * half.y + Math.abs(n.z) * half.z + 0.001);
    if (snapToGrid && !snappedPos) snapVoxelPositionToGrid(placePos, half);
    if (placePos.y < half.y) placePos.y = half.y;
    return placePos;
  }

  function placementNormalFromHit(hit) {
    const normal = hit?.face?.normal?.clone?.() || new THREE.Vector3(0, 1, 0);
    if (hit?.object?.matrixWorld) normal.transformDirection(hit.object.matrixWorld).normalize();
    else normal.normalize();
    return normal;
  }

  function createVoxelColliderRef(mesh, half, materialId) {
    const position = mesh.position;
    const colliderRef = {
      type: "box",
      half: half.clone(),
      box: new THREE.Box3(
        new THREE.Vector3(position.x - half.x, position.y - half.y, position.z - half.z),
        new THREE.Vector3(position.x + half.x, position.y + half.y, position.z + half.z)
      ),
      target: mesh
    };
    if (materialId) {
      colliderRef.materialId = materialId;
      colliderRef.physicsMaterialId = materialId;
    }
    return colliderRef;
  }

  function markMeshAsVoxel(mesh, config, size, colliderEnabled) {
    const materialId = String(config.materialId || ctx.DEFAULT_WORLD_OBJECT_MATERIAL_ID);
    const materialFile = String(config.materialFile || materialFileForWorldObjectMaterial(materialId) || "");
    Object.assign(mesh.userData, {
      nvType: "box",
      isVoxel: true,
      voxel: true,
      voxelSize: size,
      voxelPlacer: {
        size,
        materialId,
        materialFile,
        materialName: config.materialName || materialId,
        matterState: config.matterState || "",
        color: config.color,
        opacity: ctx.api.normalizeVoxelOpacity(config.opacity),
        collider: colliderEnabled,
        faceCenterSnap: config.faceCenterSnap === true
      },
      physicsMaterialId: materialId,
      physicsMaterialFile: materialFile,
      materialName: config.materialName || materialId,
      MatterState: config.matterState || "",
      matterState: config.matterState || "",
      isSolid: colliderEnabled,
      physicsEnabled: colliderEnabled,
      breakable: true,
      placedByPlayer: true
    });
    ctx.api.makePlacedObjectId(mesh, "voxel");
  }

  function tryPlaceVoxel({ snapToGrid = false } = {}) {
    if (movementState.worldMode === "2d") return false;
    if (!ctx.api.canUseAbility("allowPlace")) return false;
    const hit = ctx.api.getPlacementHit();
    if (!hit) {
      setStatus("No voxel placement target.");
      return true;
    }
    const config = ctx.api.ensureVoxelPlacerConfig();
    const size = ctx.api.normalizeVoxelSize(config.size);
    const opacity = ctx.api.normalizeVoxelOpacity(config.opacity);
    const half = new THREE.Vector3(size / 2, size / 2, size / 2);
    const shape = { type: "box", half };
    const placePos = computeVoxelPlacePosition(hit, placementNormalFromHit(hit), half, snapToGrid, { faceCenterSnap: config.faceCenterSnap === true });
    const colliderEnabled = config.collider !== false;
    if (colliderEnabled && ctx.api.intersectsPlayer(placePos, shape)) {
      setStatus("Voxel would intersect the player.");
      return true;
    }
    if (colliderEnabled && ctx.api.intersectsExistingColliders(placePos, shape)) {
      setStatus("Voxel would overlap an existing collider.");
      return true;
    }
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(size, size, size),
      new THREE.MeshStandardMaterial({ color: config.color, roughness: 0.74, metalness: 0.04, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 })
    );
    mesh.position.copy(placePos);
    markMeshAsVoxel(mesh, config, size, colliderEnabled);
    scene.add(mesh);
    objects.push(mesh);
    if (colliderEnabled) {
      const colliderRef = createVoxelColliderRef(mesh, half, mesh.userData.physicsMaterialId);
      colliders.push(colliderRef);
      mesh.userData.colliderRef = colliderRef;
    }
    setStatus("Voxel placed.");
    return true;
  }

  return installMovementApi(ctx, {
    dominantAxisFromNormal,
    computeTargetFacePlacement,
    snapVoxelPositionToGrid,
    computeVoxelPlacePosition,
    placementNormalFromHit,
    createVoxelColliderRef,
    markMeshAsVoxel,
    tryPlaceVoxel
  });
}
