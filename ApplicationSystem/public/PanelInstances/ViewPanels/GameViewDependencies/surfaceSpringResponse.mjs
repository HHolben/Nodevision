// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/surfaceSpringResponse.mjs
// This file models flexible MetaWorld surface compression and spring-assisted player bounce responses for trampoline-like materials.

function finiteNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function flexibleSurfaceConfig(config = {}) {
  const springConstant = finiteNumber(config.springConstantNewtonsPerMeter ?? config.springConstant, 0);
  if (!Number.isFinite(springConstant) || springConstant <= 0) return null;
  const playerMassKg = Math.max(1, finiteNumber(config.playerMassKg, 80));
  return {
    springConstant,
    playerMassKg,
    compressionScale: Math.max(0.1, finiteNumber(config.surfaceCompressionScale, 30)),
    maxCompression: Math.max(0.01, finiteNumber(config.maxSurfaceCompression, 0.65)),
    minCompression: Math.max(0, finiteNumber(config.minSurfaceCompression, 0.015)),
    returnRate: Math.max(0.005, Math.min(0.4, finiteNumber(config.surfaceReturnRate, Math.sqrt(springConstant / playerMassKg) / 200)))
  };
}

export function clearFlexibleSurfaceContact(movementState) {
  movementState.flexSurfaceContact = null;
  movementState.surfaceDepressionOffset = 0;
  movementState.activeSurfaceSpringConstant = 0;
}

export function depressedPlayerY(movementState, fallbackY) {
  const contact = movementState?.flexSurfaceContact;
  if (!contact?.active) return fallbackY;
  return contact.restingPlayerY - contact.compression;
}

export function continueFlexibleSurfaceContact({ controls, inputState, movementState, jumpImpulse }) {
  const contact = movementState?.flexSurfaceContact;
  if (!contact?.active) return false;
  const object = controls.getObject();
  if (inputState.jump && !movementState.jumpLatch) {
    const springImpulse = Math.max(0, contact.springImpulse || contact.bounceSpeed || 0);
    const combinedImpulse = jumpImpulse + springImpulse;
    object.position.y = contact.restingPlayerY;
    movementState.velocityY = combinedImpulse;
    movementState.lastJumpForce = jumpImpulse;
    movementState.lastSpringJumpForce = springImpulse;
    movementState.lastCombinedJumpForce = combinedImpulse;
    movementState.lastJumpMode = inputState.jumpMode || "spring-assisted";
    movementState.isGrounded = false;
    movementState.jumpLatch = true;
    clearFlexibleSurfaceContact(movementState);
    return true;
  }
  contact.ageFrames += 1;
  contact.compression = Math.max(0, contact.compression - contact.returnRate);
  movementState.surfaceDepressionOffset = contact.compression;
  movementState.activeSurfaceSpringConstant = contact.springConstant;
  if (contact.compression <= contact.releaseThreshold) {
    object.position.y = contact.restingPlayerY;
    movementState.velocityY = contact.bounceSpeed;
    movementState.isGrounded = false;
    clearFlexibleSurfaceContact(movementState);
    return true;
  }
  object.position.y = contact.restingPlayerY - contact.compression;
  movementState.velocityY = 0;
  movementState.isGrounded = true;
  return true;
}

export function startFlexibleSurfaceContact({ movementState, config, incomingVelocityY, gravity, bounceSpeed, restingPlayerY }) {
  const flex = flexibleSurfaceConfig(config);
  if (!flex) return false;
  const acceleration = Math.abs(incomingVelocityY) + Math.max(0, finiteNumber(gravity, 0));
  let compression = flex.playerMassKg * acceleration * flex.compressionScale / flex.springConstant;
  compression = Math.min(flex.maxCompression, Math.max(flex.minCompression, compression));
  if (compression <= 0) return false;
  movementState.flexSurfaceContact = {
    active: true,
    materialId: config.materialId || "",
    materialName: config.materialName || "",
    springConstant: flex.springConstant,
    compression,
    maxCompression: compression,
    restingPlayerY,
    returnRate: flex.returnRate,
    releaseThreshold: Math.max(0.002, Math.min(0.05, flex.returnRate * 0.5)),
    bounceSpeed,
    springImpulse: bounceSpeed,
    ageFrames: 0
  };
  movementState.surfaceDepressionOffset = compression;
  movementState.lastSurfaceDepression = compression;
  movementState.lastSurfaceImpactAcceleration = acceleration;
  movementState.activeSurfaceSpringConstant = flex.springConstant;
  movementState.velocityY = 0;
  movementState.isGrounded = true;
  return true;
}
