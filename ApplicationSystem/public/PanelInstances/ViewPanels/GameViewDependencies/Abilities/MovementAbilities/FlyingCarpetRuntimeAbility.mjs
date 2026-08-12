// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/Abilities/MovementAbilities/FlyingCarpetRuntimeAbility.mjs
// This file defines flying carpet runtime helpers for Game View. It identifies carpet meshes, normalizes their size metadata, creates carpet meshes, and finds boardable carpets near the player.

import { installMovementApi } from "../movementContext.mjs";

export function installFlyingCarpetRuntimeAbility(ctx) {
  const { THREE, objects, movementState } = ctx;

  function finiteFlyingCarpetSize(value, fallback, minimum = 0.02) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(minimum, Math.abs(n)) : fallback;
  }

  function readFlyingCarpetSize(mesh = null) {
    const config = mesh?.userData?.flyingCarpet && typeof mesh.userData.flyingCarpet === "object" ? mesh.userData.flyingCarpet : {};
    const configSize = Array.isArray(config.size) ? config.size : null;
    const params = mesh?.geometry?.parameters || {};
    const sx = Math.abs(mesh?.scale?.x || 1);
    const sy = Math.abs(mesh?.scale?.y || 1);
    const sz = Math.abs(mesh?.scale?.z || 1);
    const baseWidth = Number.isFinite(Number(params.width)) ? Number(params.width) : (configSize?.[0] ?? config.width ?? ctx.FLYING_CARPET_WIDTH);
    const baseHeight = Number.isFinite(Number(params.height)) ? Number(params.height) : (configSize?.[1] ?? config.height ?? ctx.FLYING_CARPET_HEIGHT);
    const baseDepth = Number.isFinite(Number(params.depth)) ? Number(params.depth) : (configSize?.[2] ?? config.depth ?? ctx.FLYING_CARPET_DEPTH);
    return {
      width: finiteFlyingCarpetSize(baseWidth * sx, ctx.FLYING_CARPET_WIDTH, 0.2),
      height: finiteFlyingCarpetSize(baseHeight * sy, ctx.FLYING_CARPET_HEIGHT, 0.02),
      depth: finiteFlyingCarpetSize(baseDepth * sz, ctx.FLYING_CARPET_DEPTH, 0.2)
    };
  }

  function readFlyingCarpetHalfExtents(mesh = null) {
    const size = readFlyingCarpetSize(mesh);
    return new THREE.Vector3(size.width / 2, size.height / 2, size.depth / 2);
  }

  function isFlyingCarpetObject(target) {
    const data = target?.userData || {};
    const type = String(data.nvType || data.vehicleType || "").toLowerCase();
    return target?.isMesh && (type === ctx.FLYING_CARPET_ITEM_ID || data.flyingCarpet);
  }

  function ensureFlyingCarpetRuntime(mesh) {
    if (!mesh?.isMesh) return null;
    const previous = mesh.userData?.flyingCarpet && typeof mesh.userData.flyingCarpet === "object" ? mesh.userData.flyingCarpet : {};
    const size = readFlyingCarpetSize(mesh);
    Object.assign(mesh.userData, {
      nvType: ctx.FLYING_CARPET_ITEM_ID,
      isVehicle: true,
      vehicleType: ctx.FLYING_CARPET_ITEM_ID,
      mountable: true
    });
    mesh.userData.flyingCarpet = {
      ...previous,
      size: [size.width, size.height, size.depth],
      speedMultiplier: Number.isFinite(Number(previous.speedMultiplier)) ? Number(previous.speedMultiplier) : ctx.FLYING_CARPET_SPEED_MULTIPLIER,
      verticalSpeedMultiplier: Number.isFinite(Number(previous.verticalSpeedMultiplier)) ? Number(previous.verticalSpeedMultiplier) : ctx.FLYING_CARPET_VERTICAL_SPEED_MULTIPLIER,
      riderSurfaceOffset: Number.isFinite(Number(previous.riderSurfaceOffset)) ? Math.max(0, Number(previous.riderSurfaceOffset)) : 0.03
    };
    return mesh.userData.flyingCarpet;
  }

  function createFlyingCarpetMesh(size = []) {
    const width = finiteFlyingCarpetSize(size?.[0], ctx.FLYING_CARPET_WIDTH, 0.2);
    const height = finiteFlyingCarpetSize(size?.[1], ctx.FLYING_CARPET_HEIGHT, 0.02);
    const depth = finiteFlyingCarpetSize(size?.[2], ctx.FLYING_CARPET_DEPTH, 0.2);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      new THREE.MeshStandardMaterial({ color: ctx.FLYING_CARPET_COLOR, emissive: ctx.FLYING_CARPET_EMISSIVE, emissiveIntensity: 0.2, roughness: 0.78, metalness: 0.03 })
    );
    ensureFlyingCarpetRuntime(mesh);
    return mesh;
  }

  function flyingCarpetBox(mesh) {
    if (!mesh) return null;
    const colliderRef = mesh.userData?.colliderRef || null;
    if (colliderRef?.type === "box" && colliderRef.box) {
      ctx.api.updateColliderForTarget(mesh);
      return colliderRef.box;
    }
    mesh.updateWorldMatrix?.(true, false);
    const box = new THREE.Box3().setFromObject(mesh);
    return box.isEmpty?.() ? null : box;
  }

  function findBoardableFlyingCarpet(position) {
    if (!position || !Array.isArray(objects)) return null;
    const footY = position.y - movementState.playerHeight;
    const yTolerance = Math.max(0.38, Math.abs(Number(movementState.velocityY) || 0) + 0.18);
    let best = null;
    let bestDistanceSq = Infinity;
    for (const object of objects) {
      if (!isFlyingCarpetObject(object) || object.visible === false) continue;
      ensureFlyingCarpetRuntime(object);
      const box = flyingCarpetBox(object);
      if (!box) continue;
      const standingOnTop = footY >= box.max.y - 0.16 && footY <= box.max.y + yTolerance;
      const withinX = position.x >= box.min.x - 0.04 && position.x <= box.max.x + 0.04;
      const withinZ = position.z >= box.min.z - 0.04 && position.z <= box.max.z + 0.04;
      if (!standingOnTop || !withinX || !withinZ) continue;
      const distanceSq = (position.x - object.position.x) ** 2 + (position.z - object.position.z) ** 2;
      if (distanceSq < bestDistanceSq) {
        best = object;
        bestDistanceSq = distanceSq;
      }
    }
    return best;
  }

  function clampOffset(value, limit) {
    return Math.max(-limit, Math.min(limit, value));
  }

  return installMovementApi(ctx, {
    finiteFlyingCarpetSize,
    readFlyingCarpetSize,
    readFlyingCarpetHalfExtents,
    isFlyingCarpetObject,
    ensureFlyingCarpetRuntime,
    createFlyingCarpetMesh,
    flyingCarpetBox,
    findBoardableFlyingCarpet,
    clampOffset
  });
}
