// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/collisionCheck.mjs
// This file provides collision checks between the player and world colliders.

import { boxCutsPlayer, compoundCutsPlayer } from "./compoundPlayerCollision.mjs";

function pointWithinPlaneConstraints(eq, point, padding = 0) {
  if (!eq || !point) return false;
  if (eq.boundX === true && (point.x < Math.min(eq.xmin ?? -15, eq.xmax ?? 15) - padding || point.x > Math.max(eq.xmin ?? -15, eq.xmax ?? 15) + padding)) return false;
  if (eq.boundY === true && (point.y < Math.min(eq.ymin ?? -15, eq.ymax ?? 15) - padding || point.y > Math.max(eq.ymin ?? -15, eq.ymax ?? 15) + padding)) return false;
  if (eq.boundZ === true && (point.z < Math.min(eq.zmin ?? -15, eq.zmax ?? 15) - padding || point.z > Math.max(eq.zmin ?? -15, eq.zmax ?? 15) + padding)) return false;
  return true;
}

function signedPlaneDistance(collider, point) {
  const eq = collider?.equation || {};
  const a = Number.isFinite(eq.a) ? eq.a : 0;
  const b = Number.isFinite(eq.b) ? eq.b : 1;
  const c = Number.isFinite(eq.c) ? eq.c : 0;
  const d = Number.isFinite(eq.d) ? eq.d : 0;
  const len = Math.hypot(a, b, c) || 1;
  return ((a * point.x) + (b * point.y) + (c * point.z) + d) / len;
}

function expressionHeightfieldCutsPlayer(collider, nextPosition, movementState, playerRadius, playerMinY, playerMaxY) {
  if (collider.target?.visible === false || typeof collider.sampleGroundY !== "function") return false;

  const colliderId = collider.layerId || collider.target?.uuid || "expression-heightfield";
  const activeSurface = movementState?.isGrounded === true
    && movementState?.activeExpressionTerrainColliderId
    && movementState.activeExpressionTerrainColliderId === colliderId;
  if (activeSurface) return false;

  const stepAllowance = Number.isFinite(movementState?.groundSnapDistance)
    ? Math.max(0.12, movementState.groundSnapDistance)
    : 0.55;
  const headPadding = 0.04;
  const sampleRadius = Math.max(0, playerRadius * 0.65);
  const offsets = [
    [0, 0],
    [sampleRadius, 0],
    [-sampleRadius, 0],
    [0, sampleRadius],
    [0, -sampleRadius]
  ];

  for (const [dx, dz] of offsets) {
    const surfaceY = collider.sampleGroundY(nextPosition.x + dx, nextPosition.z + dz, playerMinY + stepAllowance);
    if (!Number.isFinite(surfaceY)) continue;
    if (surfaceY <= playerMinY + stepAllowance) continue;
    if (surfaceY < playerMaxY - headPadding) return true;
  }
  return false;
}

export function createCollisionChecker({ colliders, movementState, playerRadius }) {
  return function wouldCollide(nextPosition, options = {}) {
    if (movementState) movementState.lastCollisionCollider = null;
    if (movementState?.phaseThroughObjects === true) return false;
    const ignoreCollider = options?.ignoreCollider || null;
    const ignoreColliders = options?.ignoreColliders instanceof Set ? options.ignoreColliders : null;
    const hit = (collider) => {
      if (movementState) movementState.lastCollisionCollider = collider || null;
      return true;
    };
    const playerMinY = nextPosition.y - movementState.playerHeight;
    const playerMaxY = nextPosition.y;
    for (const collider of colliders) {
      if (!collider || collider === ignoreCollider || ignoreColliders?.has(collider)) continue;
      if (collider.type === "box") {
        if (boxCutsPlayer(collider.box, nextPosition, playerRadius, playerMinY, playerMaxY)) return hit(collider);
      } else if (collider.type === "compound") {
        if (compoundCutsPlayer(collider, nextPosition, playerRadius, playerMinY, playerMaxY)) return hit(collider);
      } else if (collider.type === "equation-plane") {
        if (collider.target?.visible === false) continue;
        // Horizontal infinite ground is handled by the ordinary ground sampler; a player's
        // feet touching its surface must not block every horizontal movement step.
        if (collider.target?.userData?.equationCollider?.infinite) {
          const eq = collider.equation;
          if (Math.abs(eq.b) > 0.000001) {
            const groundY = -(eq.a * nextPosition.x + eq.c * nextPosition.z + eq.d) / eq.b;
            if (groundY <= playerMinY + 0.05) continue;
          }
        }
        const threshold = playerRadius + Math.max(0.02, Number(collider.thickness) || 0.2) / 2;
        const samples = [
          nextPosition,
          { x: nextPosition.x, y: playerMinY, z: nextPosition.z },
          { x: nextPosition.x, y: (playerMinY + playerMaxY) / 2, z: nextPosition.z }
        ];
        if (samples.some((point) => pointWithinPlaneConstraints(collider.equation || {}, point, threshold) && Math.abs(signedPlaneDistance(collider, point)) <= threshold)) return hit(collider);
      } else if (collider.type === "sphere") {
        const dx = nextPosition.x - collider.center.x;
        const dz = nextPosition.z - collider.center.z;
        const totalRadius = collider.radius + playerRadius;
        let dy = 0;
        if (collider.center.y < playerMinY) dy = playerMinY - collider.center.y;
        else if (collider.center.y > playerMaxY) dy = collider.center.y - playerMaxY;
        if (dx * dx + dy * dy + dz * dz <= totalRadius * totalRadius) return hit(collider);
      } else if (collider.type === "expression-heightfield") {
        if (collider.target?.visible !== false && collider.containsPlayer && !collider.containsPlayer(nextPosition, playerRadius)) return hit(collider);
        if (collider.target?.visible !== false && collider.intersectsPlayer?.(nextPosition, playerRadius, playerMinY, playerMaxY, movementState?.isGrounded ? Math.max(0, movementState.groundSnapDistance ?? .55) : 0)) return hit(collider);
        if (expressionHeightfieldCutsPlayer(collider, nextPosition, movementState, playerRadius, playerMinY, playerMaxY)) return hit(collider);
      }
    }
    return false;
  };
}
