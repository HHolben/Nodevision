// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/Abilities/ConstructAbilities/PlacementGeometryAbility.mjs
// This file defines shared placement geometry for Game View construction abilities. It computes collider extents, object placement positions, and console placement while preserving collision checks.

import { installMovementApi } from "../movementContext.mjs";

export function installPlacementGeometryAbility(ctx) {
  const { THREE, scene, objects, colliders, movementState, consolePanels } = ctx;

  async function ensureObjectFileGeometryApplier() {
    if (ctx.objectFileGeometryApplier) return ctx.objectFileGeometryApplier;
    if (!ctx.objectFileGeometryLoaderPromise) {
      ctx.objectFileGeometryLoaderPromise = import("../../objectFileLoader.mjs")
        .then((mod) => {
          ctx.objectFileGeometryApplier = mod.applyObjectFileGeometry;
          return ctx.objectFileGeometryApplier;
        })
        .catch((err) => {
          console.warn("Object file geometry loader failed to load:", err);
          ctx.objectFileGeometryLoaderPromise = null;
          ctx.objectFileGeometryApplier = null;
          return null;
        });
    }
    return ctx.objectFileGeometryLoaderPromise;
  }

  function buildConsoleMeshFromConfig(config) {
    if (!config) return null;
    const width = Number.isFinite(config.size?.[0]) ? config.size[0] : 0.9;
    const height = Number.isFinite(config.size?.[1]) ? config.size[1] : 1.15;
    const depth = Number.isFinite(config.size?.[2]) ? config.size[2] : 0.7;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      new THREE.MeshStandardMaterial({ color: config.color || "#33ccaa" })
    );
    mesh.userData.consoleProperties = {
      collider: config.collider !== false,
      color: config.color || "#33ccaa",
      objectFile: config.objectFile || "",
      linkedObject: config.linkedObject || ""
    };
    mesh.userData.nvType = "console";
    return {
      mesh,
      collider: config.collider !== false ? { type: "box", half: new THREE.Vector3(width * 0.5, height * 0.5, depth * 0.5) } : null
    };
  }

  function resolveHalfExtents(collider) {
    if (!collider) return { x: 0.5, y: 0.5, z: 0.5 };
    if (collider.type === "box" && collider.half) return { x: collider.half.x, y: collider.half.y, z: collider.half.z };
    if (collider.type === "sphere" && Number.isFinite(collider.radius)) return { x: collider.radius, y: collider.radius, z: collider.radius };
    if (collider.type === "cylinder" && Number.isFinite(collider.radius) && Number.isFinite(collider.halfHeight)) {
      return { x: collider.radius, y: collider.halfHeight, z: collider.radius };
    }
    return { x: 0.5, y: 0.5, z: 0.5 };
  }

  function computePlacePosition(hit, normal, collider, { snapToGrid = false } = {}) {
    const half = resolveHalfExtents(collider);
    const n = normal.clone().normalize();
    const offset = Math.abs(n.x) * half.x + Math.abs(n.y) * half.y + Math.abs(n.z) * half.z + 0.001;
    const placePos = hit.point.clone().addScaledVector(n, offset);
    if (snapToGrid) {
      placePos.x = Math.round(placePos.x);
      placePos.y = Math.round(placePos.y);
      placePos.z = Math.round(placePos.z);
    }
    if (placePos.y < 0.5) placePos.y = 0.5;
    return placePos;
  }

  function finalizeConsolePlacement(hit, config, snapToGrid) {
    if (!hit) return false;
    const placement = buildConsoleMeshFromConfig(config);
    if (!placement) return false;
    const normal = (hit.face?.normal?.clone?.() || ctx.raycastDirection.set(0, 1, 0)).clone();
    const hitObject = hit.object;
    if (hitObject?.matrixWorld) normal.transformDirection(hitObject.matrixWorld).normalize();
    const placePos = computePlacePosition(hit, normal, placement.collider, { snapToGrid });
    if (placement.collider && ctx.api.intersectsPlayer(placePos, placement.collider)) return false;
    if (placement.collider && ctx.api.intersectsExistingColliders(placePos, placement.collider)) return false;
    const mesh = placement.mesh;
    mesh.position.copy(placePos);
    mesh.userData.isSolid = Boolean(placement.collider);
    mesh.userData.breakable = true;
    mesh.userData.placedByPlayer = true;
    scene.add(mesh);
    objects.push(mesh);
    if (mesh.userData?.objectFilePath) {
      void (async () => {
        const applier = await ensureObjectFileGeometryApplier();
        if (applier) await applier(mesh);
      })();
    }
    if (placement.collider?.type === "box") {
      const half = placement.collider.half;
      const colliderRef = {
        type: "box",
        half: half.clone?.() || half,
        box: new THREE.Box3(
          new THREE.Vector3(placePos.x - half.x, placePos.y - half.y, placePos.z - half.z),
          new THREE.Vector3(placePos.x + half.x, placePos.y + half.y, placePos.z + half.z)
        )
      };
      colliders.push(colliderRef);
      mesh.userData.colliderRef = colliderRef;
      mesh.userData.objectFileColliderFactory?.(colliderRef);
    }
    if (consolePanels?.hasPendingPlacement?.()) consolePanels.updatePlacementTarget?.(ctx.api.getPlacementHit());
    window.VRWorldContext?.inventory?.consumeSelected?.(1);
    return true;
  }

  return installMovementApi(ctx, {
    ensureObjectFileGeometryApplier,
    buildConsoleMeshFromConfig,
    resolveHalfExtents,
    computePlacePosition,
    finalizeConsolePlacement
  });
}
