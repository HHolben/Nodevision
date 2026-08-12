// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/Abilities/MovementAbilities/PlayerMovementFrameAbility.mjs
// This file applies per-frame player movement for Game View. It coordinates walking, flying, swimming, mounted vehicles, gravity models, terrain ground sampling, and bounce-material response.

import { applyDirectionalMovement, applyFlyingMovement, applyGroundMovement } from "../../movementSteps.mjs";
import { installMovementApi } from "../movementContext.mjs";

export function installPlayerMovementFrameAbility(ctx) {
  const { THREE, controls, movementState, forward, right, up } = ctx;

  function applyPlayerMovementFrame({ inputState, crouching, crawling, inEditorMode, editorGravityDisabled, speed }) {
    const playerPos = controls.getObject().position;
    const mountedVehicle = ctx.api.getActiveMountedVehicle();
    let swimActive = false;
    let movementGroundLevel = ctx.groundLevel;
    ctx.api.updateGrabbedObjectFollow();
    ctx.api.updateGizmoHandleOrientations();
    if (mountedVehicle) {
      movementState.playerHeight = ctx.basePlayerHeight;
      movementState.isSwimming = false;
      movementState.walkInputBlockedByFall = false;
      ctx.api.clearRunState();
      ctx.api.updateMountedFlyingCarpet(mountedVehicle, inputState, speed);
    } else {
      const torsoPosition = playerPos.clone();
      torsoPosition.y = playerPos.y - Math.max(0.35, movementState.playerHeight * 0.45);
      const activeWaterVolume = ctx.api.getWaterVolumeAtPosition(torsoPosition);
      swimActive = Boolean(activeWaterVolume);
      movementState.isSwimming = swimActive;
      movementGroundLevel = applyUnMountedMovement({
        inputState,
        crouching,
        crawling,
        inEditorMode,
        editorGravityDisabled,
        speed,
        activeWaterVolume,
        swimActive
      });
    }
    updateExpressionGroundState({ mountedVehicle, swimActive, movementGroundLevel });
    keepPhasedPlayerAboveFloor(playerPos, movementGroundLevel);
    return { mountedVehicle, swimActive, movementGroundLevel };
  }

  function applyUnMountedMovement(frame) {
    const { inputState, crouching, crawling, inEditorMode, editorGravityDisabled, speed, activeWaterVolume, swimActive } = frame;
    const activeGravityModel = ctx.api.readActiveGravityModel();
    const flatGravityActive = activeGravityModel.mode === "flat";
    const zeroGravityWalkingDisabled = activeGravityModel.mode === "none" && !inEditorMode;
    const fallingWithoutEditorControl = flatGravityActive
      && !inEditorMode
      && !movementState.isFlying
      && !swimActive
      && movementState.isGrounded !== true
      && Number(movementState.velocityY) < 0;
    movementState.walkInputBlockedByFall = fallingWithoutEditorControl;
    const directionalWalkingAllowed = !zeroGravityWalkingDisabled && !fallingWithoutEditorControl;
    const runWalkingAllowed = directionalWalkingAllowed && !movementState.isFlying && !swimActive && (inEditorMode || movementState.isGrounded === true);
    const directionalSpeed = speed * ctx.api.runSpeedMultiplier(inputState, { crouching, crawling, walkingAllowed: runWalkingAllowed });
    if (directionalWalkingAllowed) applyDirectionalStep(inputState, directionalSpeed, crawling, crouching, swimActive);
    const movementGroundLevel = ctx.api.sampleExpressionTerrainGroundLevel(controls.getObject().position, ctx.groundLevel);
    const activeJumpForce = ctx.api.readJumpForce();
    movementState.activeJumpForce = activeJumpForce;
    applyVerticalMovement({
      inputState,
      activeGravityModel,
      activeJumpForce,
      editorGravityDisabled,
      activeWaterVolume,
      swimActive,
      speed,
      crouching,
      movementGroundLevel
    });
    return movementGroundLevel;
  }

  function applyDirectionalStep(inputState, speed, crawling, crouching, swimActive) {
    applyDirectionalMovement({
      THREE,
      controls,
      movementState,
      inputState,
      forward,
      right,
      up,
      speed,
      crawling,
      crouching,
      wouldCollide: ctx.wouldCollide,
      stepHeight: ctx.stepHeight,
      allowVerticalMovement: movementState.isFlying || swimActive
    });
  }

  function applyVerticalMovement(frame) {
    if (movementState.isFlying || frame.swimActive) {
      ctx.api.clearVectorGravityMotion();
      const buoyancyBase = Number.isFinite(movementState.playerBuoyancy) ? movementState.playerBuoyancy : 0;
      const waterScale = frame.swimActive && Number.isFinite(frame.activeWaterVolume?.buoyancyScale) ? frame.activeWaterVolume.buoyancyScale : 1;
      const swimSpeed = frame.swimActive ? frame.speed * (Number.isFinite(movementState.swimSpeedMultiplier) ? movementState.swimSpeedMultiplier : ctx.baseSwimSpeedMultiplier) : frame.speed;
      movementState.isGrounded = false;
      applyFlyingMovement({ THREE, controls, inputState: frame.inputState, speed: swimSpeed, wouldCollide: ctx.wouldCollide, buoyancy: frame.swimActive ? buoyancyBase * waterScale : 0 });
    } else if (frame.editorGravityDisabled) {
      ctx.api.clearVectorGravityMotion();
      movementState.isGrounded = false;
    } else if (frame.activeGravityModel.mode === "none") {
      ctx.api.tryZeroGravitySurfaceKick(frame.activeGravityModel, frame.inputState, frame.activeJumpForce);
      ctx.api.applyVectorGravityMovement(frame.activeGravityModel, { applyAcceleration: false });
    } else if (frame.activeGravityModel.mode === "point-mass") {
      ctx.api.applyVectorGravityMovement(frame.activeGravityModel, { applyAcceleration: true });
    } else {
      ctx.api.clearVectorGravityMotion({ preserveScalarVelocity: true });
      movementState.activeFlatGravity = frame.activeGravityModel.flatG;
      applyGroundMovement({
        controls,
        inputState: frame.inputState,
        movementState,
        gravity: frame.activeGravityModel.flatG,
        jumpSpeed: frame.activeJumpForce,
        crouching: frame.crouching,
        crouchJumpMultiplier: Number.isFinite(movementState.crouchJumpMultiplier) ? movementState.crouchJumpMultiplier : ctx.defaultCrouchJumpMultiplier,
        groundLevel: frame.movementGroundLevel,
        wouldCollide: ctx.wouldCollide,
        resolveGroundBounce: ctx.api.bounceConfigForCollider
      });
    }
  }

  function updateExpressionGroundState({ mountedVehicle, swimActive, movementGroundLevel }) {
    if (!mountedVehicle && !movementState.isFlying && !swimActive) {
      const onExpressionGround = movementState.isGrounded === true
        && movementState.pendingExpressionTerrainColliderId
        && movementGroundLevel > ctx.groundLevel + 0.001;
      movementState.activeExpressionTerrainColliderId = onExpressionGround ? movementState.pendingExpressionTerrainColliderId : null;
    }
  }

  function keepPhasedPlayerAboveFloor(playerPos, movementGroundLevel) {
    if (movementState.phaseThroughObjects !== true) return;
    const floorY = movementGroundLevel + movementState.playerHeight;
    if (playerPos.y >= floorY) return;
    playerPos.y = floorY;
    movementState.velocityY = Math.max(0, movementState.velocityY || 0);
    movementState.isGrounded = true;
  }

  return installMovementApi(ctx, {
    applyPlayerMovementFrame,
    applyUnMountedMovement,
    applyDirectionalStep,
    applyVerticalMovement,
    updateExpressionGroundState,
    keepPhasedPlayerAboveFloor
  });
}
