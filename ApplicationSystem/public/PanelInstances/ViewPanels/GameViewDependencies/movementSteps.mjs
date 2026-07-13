// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/movementSteps.mjs
// This file defines browser-side movement Steps logic for the Nodevision UI. It renders interface components and handles user interactions.

export function applyDirectionalMovement({ THREE, controls, movementState, inputState, forward, right, up, speed, crawling, crouching, wouldCollide, stepHeight, allowVerticalMovement = false }) {
  if (!(inputState.moveForward || inputState.moveBackward || inputState.moveLeft || inputState.moveRight)) return;
  const object = controls.getObject();
  controls.getDirection(forward);
  if (!allowVerticalMovement) forward.y = 0;
  if (forward.lengthSq() < 1e-8) {
    object.updateMatrixWorld?.();
    forward.setFromMatrixColumn(object.matrixWorld, 2).negate();
    if (!allowVerticalMovement) forward.y = 0;
  }
  if (forward.lengthSq() < 1e-8) forward.set(0, 0, -1);
  forward.normalize();

  if (allowVerticalMovement) {
    object.updateMatrixWorld?.();
    right.setFromMatrixColumn(object.matrixWorld, 0);
    if (right.lengthSq() < 1e-8) right.set(1, 0, 0).applyQuaternion(object.quaternion);
  } else {
    right.crossVectors(forward, up);
  }
  if (right.lengthSq() < 1e-8) right.set(1, 0, 0);
  right.normalize();

  const desiredMove = new THREE.Vector3();
  const is2D = movementState.worldMode === "2d";
  const cameraMode = movementState.cameraMode || movementState.viewMode || "first";
  const usesTopDownControls = is2D && cameraMode === "topdown";
  const usesSideControls = is2D && cameraMode === "side";
  if (usesTopDownControls) {
    if (inputState.moveRight) desiredMove.x += 1;
    if (inputState.moveLeft) desiredMove.x -= 1;
    if (inputState.moveForward) desiredMove.z -= 1;
    if (inputState.moveBackward) desiredMove.z += 1;
  } else if (usesSideControls) {
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
  const nextPosition = object.position.clone().add(desiredMove);
  if (usesSideControls && Number.isFinite(movementState.planeZ)) {
    nextPosition.z = movementState.planeZ;
  }
  if (!wouldCollide(nextPosition)) object.position.copy(nextPosition);
  else if (!movementState.isFlying) {
    const stepPosition = nextPosition.clone();
    stepPosition.y += stepHeight;
    if (usesSideControls && Number.isFinite(movementState.planeZ)) {
      stepPosition.z = movementState.planeZ;
    }
    if (!wouldCollide(stepPosition)) {
      object.position.copy(stepPosition);
      movementState.velocityY = 0;
      movementState.isGrounded = true;
    }
  }
}

export function applyFlyingMovement({ THREE, controls, inputState, speed, wouldCollide, buoyancy = 0 }) {
  const verticalMove = new THREE.Vector3(0, 0, 0);
  if (inputState.flyUp) verticalMove.y += speed;
  if (inputState.flyDown) verticalMove.y -= speed;
  if (Number.isFinite(buoyancy) && buoyancy > 0 && !inputState.flyDown) {
    verticalMove.y += buoyancy;
  }
  if (verticalMove.lengthSq() === 0) return;
  const object = controls.getObject();
  const nextPosition = object.position.clone().add(verticalMove);
  if (!wouldCollide(nextPosition)) object.position.copy(nextPosition);
}

function finiteNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function applyGroundBounce({ movementState, incomingVelocityY, resolveGroundBounce, collider = null, groundContact = false, playerFootY = null }) {
  if (!movementState || incomingVelocityY >= 0 || typeof resolveGroundBounce !== "function") return false;
  const config = resolveGroundBounce(collider, { incomingVelocityY, groundContact, playerFootY }) || null;
  if (!config) return false;
  const restitution = Math.max(0, Math.min(4, finiteNumber(config.restitution, 0)));
  const damping = Math.max(0, Math.min(2, finiteNumber(config.damping, 1)));
  const minIncomingSpeed = Math.max(0, finiteNumber(config.minIncomingSpeed, 0.08));
  if (restitution <= 0 || Math.abs(incomingVelocityY) < minIncomingSpeed) return false;
  const minBounceSpeed = Math.max(0, finiteNumber(config.minBounceSpeed, 0));
  const maxBounceSpeed = finiteNumber(config.maxBounceSpeed, Infinity);
  let bounceSpeed = Math.abs(incomingVelocityY) * restitution * damping;
  if (minBounceSpeed > 0) bounceSpeed = Math.max(minBounceSpeed, bounceSpeed);
  if (Number.isFinite(maxBounceSpeed)) bounceSpeed = Math.min(bounceSpeed, Math.max(0, maxBounceSpeed));
  if (bounceSpeed <= 0) return false;
  movementState.velocityY = bounceSpeed;
  movementState.isGrounded = false;
  movementState.lastBounceMaterialId = config.materialId || "";
  movementState.lastBounceMaterialName = config.materialName || "";
  return true;
}

export function applyGroundMovement({ controls, inputState, movementState, gravity, jumpSpeed, crouching, crouchJumpMultiplier = 1.85, groundLevel, wouldCollide, resolveGroundBounce = null }) {
  if (inputState.jump && movementState.isGrounded) {
    const jumpImpulse = crouching ? jumpSpeed * crouchJumpMultiplier : jumpSpeed;
    movementState.velocityY = jumpImpulse;
    movementState.isGrounded = false;
    movementState.jumpLatch = true;
  }
  if (!inputState.jump) movementState.jumpLatch = false;

  movementState.velocityY -= gravity;
  const incomingVelocityY = movementState.velocityY;
  const object = controls.getObject();
  const nextPosition = object.position.clone();
  nextPosition.y += movementState.velocityY;
  if (movementState.worldMode === "2d" && movementState.cameraMode === "side" && Number.isFinite(movementState.planeZ)) {
    nextPosition.z = movementState.planeZ;
  }

  const footY = nextPosition.y - movementState.playerHeight;
  const snapDistance = Number.isFinite(movementState.groundSnapDistance) ? movementState.groundSnapDistance : 0.55;
  const canSnapDown = movementState.isGrounded === true && movementState.velocityY <= 0 && footY <= groundLevel + snapDistance;

  if (footY <= groundLevel || canSnapDown) {
    nextPosition.y = groundLevel + movementState.playerHeight;
    const bounced = applyGroundBounce({
      movementState,
      incomingVelocityY,
      resolveGroundBounce,
      collider: movementState.pendingGroundCollider || null,
      groundContact: true,
      playerFootY: nextPosition.y - movementState.playerHeight
    });
    if (!bounced) {
      movementState.velocityY = 0;
      movementState.isGrounded = true;
    }
  } else if (wouldCollide(nextPosition)) {
    const hitCollider = movementState.lastCollisionCollider || null;
    if (incomingVelocityY < 0) {
      const bounced = applyGroundBounce({
        movementState,
        incomingVelocityY,
        resolveGroundBounce,
        collider: hitCollider,
        groundContact: false,
        playerFootY: object.position.y - movementState.playerHeight
      });
      if (!bounced) {
        movementState.isGrounded = true;
        movementState.velocityY = 0;
      }
    } else {
      movementState.velocityY = 0;
    }
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
