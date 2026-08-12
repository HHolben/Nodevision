// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/Abilities/ConstructAbilities/VoxelPlacementAbility.mjs
// This file defines the Voxel Placer construction ability for Game View. It creates material-tagged cube meshes and collider references without embedding voxel rules in the movement update loop.

import { setStatus } from "/StatusBar.mjs";
import { materialFileForWorldObjectMaterial } from "/MetaWorld/Materials/WorldObjectMaterialDefaults.mjs";
import { installMovementApi } from "../movementContext.mjs";

export function installVoxelPlacementAbility(ctx) {
  const { THREE, scene, objects, colliders, movementState } = ctx;

  function computeVoxelPlacePosition(hit, normal, half, snapToGrid) {
    const n = normal.clone().normalize();
    const offset = Math.abs(n.x) * half.x + Math.abs(n.y) * half.y + Math.abs(n.z) * half.z + 0.001;
    const placePos = hit.point.clone().addScaledVector(n, offset);
    if (snapToGrid) {
      const size = Math.max(0.05, half.x * 2);
      placePos.x = Math.round(placePos.x / size) * size;
      placePos.y = Math.round((placePos.y - half.y) / size) * size + half.y;
      placePos.z = Math.round(placePos.z / size) * size;
    }
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
        collider: colliderEnabled
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
    const half = new THREE.Vector3(size / 2, size / 2, size / 2);
    const shape = { type: "box", half };
    const placePos = computeVoxelPlacePosition(hit, placementNormalFromHit(hit), half, snapToGrid);
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
      new THREE.MeshStandardMaterial({ color: config.color, roughness: 0.74, metalness: 0.04 })
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
    computeVoxelPlacePosition,
    placementNormalFromHit,
    createVoxelColliderRef,
    markMeshAsVoxel,
    tryPlaceVoxel
  });
}
