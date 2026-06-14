// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/collisionCheck.mjs
// This file provides collision checks between the player and world colliders.

function pointWithinPlaneConstraints(eq, point, padding = 0) {
  return point.x >= Math.min(eq.xmin ?? -15, eq.xmax ?? 15) - padding
    && point.x <= Math.max(eq.xmin ?? -15, eq.xmax ?? 15) + padding
    && point.y >= Math.min(eq.ymin ?? -15, eq.ymax ?? 15) - padding
    && point.y <= Math.max(eq.ymin ?? -15, eq.ymax ?? 15) + padding
    && point.z >= Math.min(eq.zmin ?? -15, eq.zmax ?? 15) - padding
    && point.z <= Math.max(eq.zmin ?? -15, eq.zmax ?? 15) + padding;
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
    const surfaceY = collider.sampleGroundY(nextPosition.x + dx, nextPosition.z + dz);
    if (!Number.isFinite(surfaceY)) continue;
    if (surfaceY <= playerMinY + stepAllowance) continue;
    if (surfaceY < playerMaxY - headPadding) return true;
  }
  return false;
}

export function createCollisionChecker({ colliders, movementState, playerRadius }) {
  return function wouldCollide(nextPosition) {
    if (movementState?.phaseThroughObjects === true) return false;
    const playerMinY = nextPosition.y - movementState.playerHeight;
    const playerMaxY = nextPosition.y;
    for (const collider of colliders) {
      if (collider.type === "box") {
        const minX = collider.box.min.x - playerRadius;
        const maxX = collider.box.max.x + playerRadius;
        const minZ = collider.box.min.z - playerRadius;
        const maxZ = collider.box.max.z + playerRadius;
        const overlapsY = playerMaxY >= collider.box.min.y && playerMinY <= collider.box.max.y;
        if (nextPosition.x >= minX && nextPosition.x <= maxX && nextPosition.z >= minZ && nextPosition.z <= maxZ && overlapsY) return true;
      } else if (collider.type === "equation-plane") {
        if (collider.target?.visible === false) continue;
        const threshold = playerRadius + Math.max(0.02, Number(collider.thickness) || 0.2) / 2;
        const samples = [
          nextPosition,
          { x: nextPosition.x, y: playerMinY, z: nextPosition.z },
          { x: nextPosition.x, y: (playerMinY + playerMaxY) / 2, z: nextPosition.z }
        ];
        if (samples.some((point) => pointWithinPlaneConstraints(collider.equation || {}, point, threshold) && Math.abs(signedPlaneDistance(collider, point)) <= threshold)) return true;
      } else if (collider.type === "sphere") {
        const dx = nextPosition.x - collider.center.x;
        const dz = nextPosition.z - collider.center.z;
        const totalRadius = collider.radius + playerRadius;
        let dy = 0;
        if (collider.center.y < playerMinY) dy = playerMinY - collider.center.y;
        else if (collider.center.y > playerMaxY) dy = collider.center.y - playerMaxY;
        if (dx * dx + dy * dy + dz * dz <= totalRadius * totalRadius) return true;
      } else if (collider.type === "expression-heightfield") {
        if (expressionHeightfieldCutsPlayer(collider, nextPosition, movementState, playerRadius, playerMinY, playerMaxY)) return true;
      }
    }
    return false;
  };
}
