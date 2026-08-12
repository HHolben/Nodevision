// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/Abilities/ConstructAbilities/PlacementCollisionAbility.mjs
// This file defines construction-time collision checks for Game View abilities. It prevents newly placed or moved objects from intersecting the player or existing world colliders.

import { installMovementApi } from "../movementContext.mjs";

export function installPlacementCollisionAbility(ctx) {
  const { THREE, controls, colliders, movementState } = ctx;

  function intersectsPlayer(position, shape) {
    if (!shape) return false;
    const playerPos = controls.getObject().position;
    const playerMinY = playerPos.y - movementState.playerHeight;
    const playerMaxY = playerPos.y;
    if (shape.type === "box") {
      const minX = position.x - shape.half.x - ctx.playerRadius;
      const maxX = position.x + shape.half.x + ctx.playerRadius;
      const minZ = position.z - shape.half.z - ctx.playerRadius;
      const maxZ = position.z + shape.half.z + ctx.playerRadius;
      const overlapsY = playerMaxY >= (position.y - shape.half.y) && playerMinY <= (position.y + shape.half.y);
      return playerPos.x >= minX && playerPos.x <= maxX && playerPos.z >= minZ && playerPos.z <= maxZ && overlapsY;
    }
    const dx = playerPos.x - position.x;
    const dz = playerPos.z - position.z;
    const totalR = (shape.radius || 0.5) + ctx.playerRadius;
    const minY = shape.type === "cylinder" ? position.y - (shape.halfHeight || 0.5) : position.y - (shape.radius || 0.5);
    const maxY = shape.type === "cylinder" ? position.y + (shape.halfHeight || 0.5) : position.y + (shape.radius || 0.5);
    return dx * dx + dz * dz <= totalR * totalR && playerMaxY >= minY && playerMinY <= maxY;
  }

  function boxesPenetrate(a, b, overlapEpsilon) {
    const overlapX = Math.min(a.max.x, b.max.x) - Math.max(a.min.x, b.min.x);
    const overlapY = Math.min(a.max.y, b.max.y) - Math.max(a.min.y, b.min.y);
    const overlapZ = Math.min(a.max.z, b.max.z) - Math.max(a.min.z, b.min.z);
    return overlapX > overlapEpsilon && overlapY > overlapEpsilon && overlapZ > overlapEpsilon;
  }

  function shapeBox(position, shape) {
    return new THREE.Box3(
      new THREE.Vector3(position.x - shape.half.x, position.y - shape.half.y, position.z - shape.half.z),
      new THREE.Vector3(position.x + shape.half.x, position.y + shape.half.y, position.z + shape.half.z)
    );
  }

  function sphereLikeHitsBox(position, shape, box, overlapEpsilon) {
    const radius = shape.radius || 0.5;
    const x = Math.max(box.min.x, Math.min(position.x, box.max.x));
    const y = Math.max(box.min.y, Math.min(position.y, box.max.y));
    const z = Math.max(box.min.z, Math.min(position.z, box.max.z));
    const dx = position.x - x;
    const dy = position.y - y;
    const dz = position.z - z;
    const r = Math.max(0, radius - overlapEpsilon);
    return dx * dx + dy * dy + dz * dz < r * r;
  }

  function intersectsExistingColliders(position, shape, options = {}) {
    if (!shape) return false;
    const ignoreCollider = options?.ignoreCollider || null;
    const ignoreColliders = options?.ignoreColliders instanceof Set ? options.ignoreColliders : null;
    const overlapEpsilon = 0.001;
    for (const collider of colliders) {
      if (!collider || collider === ignoreCollider || ignoreColliders?.has(collider)) continue;
      if (shape.type === "box" && collider.type === "box") {
        if (boxesPenetrate(shapeBox(position, shape), collider.box, overlapEpsilon)) return true;
      } else if (collider.type === "compound") {
        if (typeof collider.update === "function") collider.update();
        for (const part of Array.isArray(collider.boxes) ? collider.boxes : []) {
          if (!part?.box) continue;
          if (shape.type === "box" && boxesPenetrate(shapeBox(position, shape), part.box, overlapEpsilon)) return true;
          if ((shape.type === "sphere" || shape.type === "cylinder") && sphereLikeHitsBox(position, shape, part.box, overlapEpsilon)) return true;
        }
      } else if (shape.type === "sphere" && collider.type === "sphere") {
        const dx = position.x - collider.center.x;
        const dy = position.y - collider.center.y;
        const dz = position.z - collider.center.z;
        const rr = Math.max(0, shape.radius + collider.radius - overlapEpsilon);
        if (dx * dx + dy * dy + dz * dz < rr * rr) return true;
      } else if (shape.type === "box" && collider.type === "sphere") {
        if (sphereLikeHitsBox(collider.center, collider, shapeBox(position, shape), overlapEpsilon)) return true;
      } else if ((shape.type === "sphere" || shape.type === "cylinder") && collider.type === "box") {
        if (sphereLikeHitsBox(position, shape, collider.box, overlapEpsilon)) return true;
      }
    }
    return false;
  }

  return installMovementApi(ctx, {
    intersectsPlayer,
    boxesPenetrate,
    shapeBox,
    sphereLikeHitsBox,
    intersectsExistingColliders
  });
}
