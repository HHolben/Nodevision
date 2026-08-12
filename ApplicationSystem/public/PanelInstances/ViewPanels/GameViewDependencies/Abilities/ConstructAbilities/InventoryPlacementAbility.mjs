// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/Abilities/ConstructAbilities/InventoryPlacementAbility.mjs
// This file defines inventory-driven construction for Game View. It places selected inventory items into the world, registers runtime metadata, and consumes placed items.

import { installMovementApi } from "../movementContext.mjs";

export function installInventoryPlacementAbility(ctx) {
  const { THREE, scene, objects, colliders, movementState, consolePanels } = ctx;

  function tryPlaceSelectedInventoryItem({ snapToGrid = false } = {}) {
    if (movementState.worldMode === "2d") return false;
    if (!ctx.api.canUseAbility("allowPlace")) return false;
    const inventory = window.VRWorldContext?.inventory;
    if (!inventory?.getSelectedItem || !inventory?.consumeSelected) return false;
    const selected = inventory.getSelectedItem();
    if (!selected || !selected.id || (Number.isFinite(selected.count) && selected.count <= 0)) return false;
    const hit = ctx.api.getPlacementHit();
    if (!hit) return false;
    if (String(selected.id || "").toLowerCase() === "console") {
      return placeConsoleFromInventory(hit, inventory, snapToGrid);
    }
    const placement = ctx.api.createPlacedMesh(selected, inventory);
    if (!placement) return false;
    const normal = hit.face?.normal?.clone?.() || ctx.raycastDirection.set(0, 1, 0);
    normal.transformDirection(hit.object.matrixWorld).normalize();
    const placePos = ctx.api.computePlacePosition(hit, normal, placement.collider, { snapToGrid });
    if (placement.collider && ctx.api.intersectsPlayer(placePos, placement.collider)) return false;
    if (placement.collider && ctx.api.intersectsExistingColliders(placePos, placement.collider)) return false;
    const mesh = placement.mesh;
    mesh.position.copy(placePos);
    Object.assign(mesh.userData, {
      isSolid: Boolean(placement.collider),
      breakable: true,
      placedByPlayer: true,
      nvType: selected.id
    });
    scene.add(mesh);
    objects.push(mesh);
    registerSpecialPlacement(mesh, selected.id);
    registerPlacementCollider(mesh, placement.collider, placePos);
    inventory.consumeSelected(1);
    return true;
  }

  function placeConsoleFromInventory(hit, inventory, snapToGrid) {
    if (consolePanels?.openPlacementPanel?.(
      hit,
      { color: "#33ccaa", collider: true, size: [0.9, 1.15, 0.7] },
      snapToGrid,
      {
        onConfirm: (config, confirmHit, gridSnap) => ctx.api.finalizeConsolePlacement(confirmHit || hit, config, gridSnap),
        onCancel: () => {}
      }
    )) return true;
    const consoleProps = ctx.api.parseConsoleProperties(inventory);
    if (!consoleProps) return false;
    consoleProps.size = [0.9, 1.15, 0.7];
    ctx.api.finalizeConsolePlacement(hit, consoleProps, snapToGrid);
    return true;
  }

  function registerSpecialPlacement(mesh, itemId) {
    const placedItemId = String(itemId || "").toLowerCase();
    if (placedItemId === "portal") ctx.api.registerPlacedPortal(mesh);
    else if (placedItemId === "spawn" || placedItemId === "spawn-point" || placedItemId === "spawnpoint") ctx.api.registerPlacedSpawn(mesh);
  }

  function registerPlacementCollider(mesh, collider, placePos) {
    if (collider?.type === "box") {
      const half = collider.half;
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
    } else if (collider?.type === "sphere" || collider?.type === "cylinder") {
      const colliderRef = { type: "sphere", center: placePos.clone(), radius: collider.radius || 0.5 };
      colliders.push(colliderRef);
      mesh.userData.colliderRef = colliderRef;
    }
  }

  return installMovementApi(ctx, {
    tryPlaceSelectedInventoryItem,
    placeConsoleFromInventory,
    registerSpecialPlacement,
    registerPlacementCollider
  });
}
