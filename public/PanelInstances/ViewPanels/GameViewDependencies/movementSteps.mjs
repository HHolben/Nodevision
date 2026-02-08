// Nodevision/public/PanelInstances/ViewPanels/GameViewDependencies/movementSteps.mjs
// This file groups movement step helpers used by the per-frame update.

export function applyDirectionalMovement({ THREE, controls, movementState, heldKeys, bindings, forward, right, up, speed, crawling, crouching, wouldCollide, stepHeight }) {
  if (!(heldKeys[bindings.moveForward] || heldKeys[bindings.moveBackward] || heldKeys[bindings.moveLeft] || heldKeys[bindings.moveRight])) return;
  controls.getDirection(forward);
  if (!movementState.isFlying) forward.y = 0;
  forward.normalize();
  right.crossVectors(forward, up).normalize();

  const desiredMove = new THREE.Vector3();
  if (heldKeys[bindings.moveForward]) desiredMove.add(forward);
  if (heldKeys[bindings.moveBackward]) desiredMove.sub(forward);
  if (heldKeys[bindings.moveRight]) desiredMove.add(right);
  if (heldKeys[bindings.moveLeft]) desiredMove.sub(right);
  if (desiredMove.lengthSq() === 0) return;

  const speedMultiplier = crawling ? 0.45 : crouching ? 0.7 : 1;
  desiredMove.normalize().multiplyScalar(speed * speedMultiplier);
  const object = controls.getObject();
  const nextPosition = object.position.clone().add(desiredMove);
  if (!wouldCollide(nextPosition)) object.position.copy(nextPosition);
  else if (!movementState.isFlying) {
    const stepPosition = nextPosition.clone();
    stepPosition.y += stepHeight;
    if (!wouldCollide(stepPosition)) {
      object.position.copy(stepPosition);
      movementState.velocityY = 0;
      movementState.isGrounded = true;
    }
  }
}

export function applyFlyingMovement({ THREE, controls, heldKeys, bindings, speed, wouldCollide }) {
  const verticalMove = new THREE.Vector3(0, 0, 0);
  if (heldKeys[bindings.flyUp]) verticalMove.y += speed;
  if (heldKeys[bindings.flyDown]) verticalMove.y -= speed;
  if (verticalMove.lengthSq() === 0) return;
  const object = controls.getObject();
  const nextPosition = object.position.clone().add(verticalMove);
  if (!wouldCollide(nextPosition)) object.position.copy(nextPosition);
}

export function applyGroundMovement({ controls, heldKeys, bindings, movementState, gravity, jumpSpeed, groundLevel, wouldCollide }) {
  if (heldKeys[bindings.jump] && movementState.isGrounded && !movementState.jumpLatch) {
    movementState.velocityY = jumpSpeed;
    movementState.isGrounded = false;
    movementState.jumpLatch = true;
  }
  if (!heldKeys[bindings.jump]) movementState.jumpLatch = false;

  movementState.velocityY -= gravity;
  const object = controls.getObject();
  const nextPosition = object.position.clone();
  nextPosition.y += movementState.velocityY;

  if (nextPosition.y - movementState.playerHeight <= groundLevel) {
    nextPosition.y = groundLevel + movementState.playerHeight;
    movementState.velocityY = 0;
    movementState.isGrounded = true;
  } else if (wouldCollide(nextPosition)) {
    if (movementState.velocityY < 0) movementState.isGrounded = true;
    movementState.velocityY = 0;
    nextPosition.y = object.position.y;
  } else {
    movementState.isGrounded = false;
  }
  object.position.y = nextPosition.y;
}

export function applyRollPitch({ camera, heldKeys, bindings }) {
  if (!(heldKeys[bindings.rollLeft] || heldKeys[bindings.rollRight] || heldKeys[bindings.pitchUp] || heldKeys[bindings.pitchDown])) return;
  const rollSpeed = 0.03;
  const pitchSpeed = 0.02;
  if (heldKeys[bindings.rollLeft]) camera.rotation.z += rollSpeed;
  if (heldKeys[bindings.rollRight]) camera.rotation.z -= rollSpeed;
  if (heldKeys[bindings.pitchUp]) camera.rotation.x += pitchSpeed;
  if (heldKeys[bindings.pitchDown]) camera.rotation.x -= pitchSpeed;
  camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x));
}
