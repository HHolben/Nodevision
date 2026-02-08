// Nodevision/public/PanelInstances/ViewPanels/GameViewDependencies/collisionCheck.mjs
// This file provides collision checks between the player and world colliders.

export function createCollisionChecker({ colliders, movementState, playerRadius }) {
  return function wouldCollide(nextPosition) {
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
      } else if (collider.type === "sphere") {
        const dx = nextPosition.x - collider.center.x;
        const dz = nextPosition.z - collider.center.z;
        const totalRadius = collider.radius + playerRadius;
        let dy = 0;
        if (collider.center.y < playerMinY) dy = playerMinY - collider.center.y;
        else if (collider.center.y > playerMaxY) dy = collider.center.y - playerMaxY;
        if (dx * dx + dy * dy + dz * dz <= totalRadius * totalRadius) return true;
      }
    }
    return false;
  };
}
