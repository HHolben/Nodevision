// Nodevision/public/PanelInstances/ViewPanels/GameViewDependencies/movementUpdate.mjs
// This file wires movement state to per-frame update logic.

import { createCollisionChecker } from "./collisionCheck.mjs";
import { applyDirectionalMovement, applyFlyingMovement, applyGroundMovement, applyRollPitch } from "./movementSteps.mjs";

export function createMovementUpdater({ THREE, camera, controls, colliders, getBindings, heldKeys, movementState }) {
  const playerRadius = 0.35;
  const basePlayerHeight = 1.75;
  const crouchHeight = 1.2;
  const crawlHeight = 0.6;
  const up = new THREE.Vector3(0, 1, 0);
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const gravity = 0.012;
  const jumpSpeed = 0.28;
  const groundLevel = 0;
  const stepHeight = 0.5;

  movementState.playerHeight = basePlayerHeight;
  const wouldCollide = createCollisionChecker({ colliders, movementState, playerRadius });

  return function update() {
    if (!controls.isLocked) return;
    const speed = 0.2;
    const bindings = getBindings();
    const crouching = heldKeys[bindings.crouch];
    const crawling = heldKeys[bindings.crawl];

    if (!heldKeys[bindings.fly]) movementState.flyToggleLatch = false;
    if (!movementState.isFlying) {
      movementState.playerHeight = crawling ? crawlHeight : crouching ? crouchHeight : basePlayerHeight;
    }

    applyDirectionalMovement({
      THREE,
      controls,
      movementState,
      heldKeys,
      bindings,
      forward,
      right,
      up,
      speed,
      crawling,
      crouching,
      wouldCollide,
      stepHeight
    });

    if (movementState.isFlying) {
      applyFlyingMovement({ THREE, controls, heldKeys, bindings, speed, wouldCollide });
    } else {
      applyGroundMovement({ controls, heldKeys, bindings, movementState, gravity, jumpSpeed, groundLevel, wouldCollide });
    }

    applyRollPitch({ camera, heldKeys, bindings });
  };
}
