// Nodevision/public/PanelInstances/ViewPanels/GameViewDependencies/movementSteps.mjs
// This file groups movement step helpers used by the per-frame update.

export function applyDirectionalMovement({ THREE, controls, movementState, inputState, forward, right, up, speed, crawling, crouching, wouldCollide, stepHeight }) {
  if (!(inputState.moveForward || inputState.moveBackward || inputState.moveLeft || inputState.moveRight)) return;
  controls.getDirection(forward);
  if (!movementState.isFlying) forward.y = 0;
  forward.normalize();
  right.crossVectors(forward, up).normalize();

  const desiredMove = new THREE.Vector3();
  const is2D = movementState.worldMode === "2d";
  if (is2D) {
    if (inputState.moveRight) desiredMove.x += 1;
    if (inputState.moveLeft) desiredMove.x -= 1;
  } else {
    if (inputState.moveForward) desiredMove.add(forward);
    if (inputState.moveBackward) desiredMove.sub(forward);
    if (inputState.moveRight) desiredMove.add(right);
    if (inputState.moveLeft) desiredMove.sub(right);
  }
  if (desiredMove.lengthSq() === 0) return;

  const speedMultiplier = crawling ? 0.45 : crouching ? 0.7 : 1;
  desiredMove.normalize().multiplyScalar(speed * speedMultiplier);
  const object = controls.getObject();
  const nextPosition = object.position.clone().add(desiredMove);
  if (is2D && Number.isFinite(movementState.planeZ)) {
    nextPosition.z = movementState.planeZ;
  }
  if (!wouldCollide(nextPosition)) object.position.copy(nextPosition);
  else if (!movementState.isFlying) {
    const stepPosition = nextPosition.clone();
    stepPosition.y += stepHeight;
    if (is2D && Number.isFinite(movementState.planeZ)) {
      stepPosition.z = movementState.planeZ;
    }
    if (!wouldCollide(stepPosition)) {
      object.position.copy(stepPosition);
      movementState.velocityY = 0;
      movementState.isGrounded = true;
    }
  }
}

export function applyFlyingMovement({ THREE, controls, inputState, speed, wouldCollide }) {
  const verticalMove = new THREE.Vector3(0, 0, 0);
  if (inputState.flyUp) verticalMove.y += speed;
  if (inputState.flyDown) verticalMove.y -= speed;
  if (verticalMove.lengthSq() === 0) return;
  const object = controls.getObject();
  const nextPosition = object.position.clone().add(verticalMove);
  if (!wouldCollide(nextPosition)) object.position.copy(nextPosition);
}

export function applyGroundMovement({ controls, inputState, movementState, gravity, jumpSpeed, groundLevel, wouldCollide }) {
  if (inputState.jump && movementState.isGrounded && !movementState.jumpLatch) {
    movementState.velocityY = jumpSpeed;
    movementState.isGrounded = false;
    movementState.jumpLatch = true;
  }
  if (!inputState.jump) movementState.jumpLatch = false;

  movementState.velocityY -= gravity;
  const object = controls.getObject();
  const nextPosition = object.position.clone();
  nextPosition.y += movementState.velocityY;
  if (movementState.worldMode === "2d" && Number.isFinite(movementState.planeZ)) {
    nextPosition.z = movementState.planeZ;
  }

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

export function applyRollPitch({ camera, inputState }) {
  if (!(inputState.rollLeft || inputState.rollRight || inputState.pitchUp || inputState.pitchDown)) return;
  const rollSpeed = 0.03;
  const pitchSpeed = 0.02;
  if (inputState.rollLeft) camera.rotation.z += rollSpeed;
  if (inputState.rollRight) camera.rotation.z -= rollSpeed;
  if (inputState.pitchUp) camera.rotation.x += pitchSpeed;
  if (inputState.pitchDown) camera.rotation.x -= pitchSpeed;
  camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x));
}
