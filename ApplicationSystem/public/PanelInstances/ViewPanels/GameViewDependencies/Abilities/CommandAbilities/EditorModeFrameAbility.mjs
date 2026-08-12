// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/Abilities/CommandAbilities/EditorModeFrameAbility.mjs
// This file handles editor-mode frame state for Game View movement. It manages phase toggles, latches, object manipulation cleanup, player height, camera cycling, pause, and stand-up commands.

import { setStatus } from "/StatusBar.mjs";
import { applyRollPitch } from "../../movementSteps.mjs";
import { installMovementApi } from "../movementContext.mjs";

export function installEditorModeFrameAbility(ctx) {
  const { camera, controls, movementState } = ctx;

  function applyEditorModeState({ inputState, crouching, crawling, inEditorMode }) {
    if (!inEditorMode && movementState.phaseThroughObjects === true) {
      movementState.phaseThroughObjects = false;
      setStatus("Object phasing disabled outside editor mode.");
    }
    if (inEditorMode && inputState.phase && !ctx.phaseToggleLatch) {
      movementState.phaseThroughObjects = movementState.phaseThroughObjects !== true;
      ctx.phaseToggleLatch = true;
      setStatus(movementState.phaseThroughObjects ? "Object phasing on. World floor still blocks movement." : "Object phasing off.");
    } else if (!inputState.phase) ctx.phaseToggleLatch = false;
    if (!movementState.isFlying) movementState.playerHeight = crawling ? ctx.crawlHeight : crouching ? ctx.crouchHeight : ctx.basePlayerHeight;
    if (movementState.worldMode === "2d" && movementState.cameraMode === "side" && Number.isFinite(movementState.planeZ)) {
      controls.getObject().position.z = movementState.planeZ;
    }
    cleanupEditorOnlyManipulation(inEditorMode);
    if (!Number.isFinite(movementState.lastInspectMs)) movementState.lastInspectMs = 0;
  }

  function updateInputLatches(inputState, editorGravityDisabled) {
    if (editorGravityDisabled) movementState.velocityY = 0;
    if (inputState.fly && !movementState.flyToggleLatch) {
      if (ctx.api.canUseAbility("allowFly")) movementState.isFlying = !movementState.isFlying;
      movementState.flyToggleLatch = true;
    }
    if (!inputState.fly) movementState.flyToggleLatch = false;
    if (!inputState.use) {
      movementState.useLatch = false;
      movementState.lastUseActionMs = 0;
      movementState.svgToolLatch = false;
      movementState.terrainToolLatch = false;
      movementState.temporalToolLatch = false;
    }
    if (!inputState.grab) movementState.grabLatch = false;
    if (!inputState.stretch) {
      movementState.stretchLatch = false;
      movementState.selectedItemAdjustLatch = false;
    }
    if (!inputState.attack) movementState.attackLatch = false;
    if (!inputState.inspect) movementState.inspectLatch = false;
  }

  function cleanupEditorOnlyManipulation(inEditorMode) {
    if (!inEditorMode && ctx.grabbedState) ctx.api.releaseGrabbedObject();
    if (!inEditorMode && ctx.stretchState) ctx.api.disposeStretchState();
    if (ctx.stretchState && (!ctx.stretchState.target?.isMesh || !ctx.stretchState.target.parent)) ctx.api.disposeStretchState();
    if (!inEditorMode && ctx.translateState) ctx.api.disposeTranslateState();
    if (ctx.translateState && (!ctx.translateState.target?.isMesh || !ctx.translateState.target.parent)) ctx.api.disposeTranslateState();
    if (!inEditorMode && ctx.rotateState) ctx.api.disposeRotateState();
    if (ctx.rotateState && (!ctx.rotateState.target?.isMesh || !ctx.rotateState.target.parent)) ctx.api.disposeRotateState();
  }

  function handleCameraCommands(inputState) {
    if (inputState.lookYaw || inputState.lookPitch) {
      if (movementState.worldMode !== "2d" && (Math.abs(inputState.lookYaw) > 0 || Math.abs(inputState.lookPitch) > 0)) {
        ctx.api.applyMouseLikeLookDelta(inputState.lookYaw * ctx.gamepadLookMouseScale, inputState.lookPitch * ctx.gamepadLookMouseScale);
      }
    }
    if (inputState.cycleCamera && !ctx.cycleCameraLatch) {
      movementState.requestCycleCamera = true;
      ctx.cycleCameraLatch = true;
    } else if (!inputState.cycleCamera) ctx.cycleCameraLatch = false;
    if (inputState.pause && !ctx.pauseLatch) {
      controls.unlock();
      ctx.pauseLatch = true;
    } else if (!inputState.pause) ctx.pauseLatch = false;
    handleStandUpCommand(inputState);
    applyRollPitch({ camera, inputState: rollPitchInput(inputState) });
  }

  function handleStandUpCommand(inputState) {
    if (inputState.standUp && !movementState.standUpLatch) {
      if (ctx.api.canUseAbility("allowRoll") || ctx.api.canUseAbility("allowPitch")) {
        ctx.api.applyStandUpAlignment();
        setStatus("Player stood up.");
      } else setStatus("Stand up is not available in this world.");
      movementState.standUpLatch = true;
    } else if (!inputState.standUp) movementState.standUpLatch = false;
  }

  function rollPitchInput(inputState) {
    return {
      ...inputState,
      rollLeft: ctx.api.canUseAbility("allowRoll") ? inputState.rollLeft : false,
      rollRight: ctx.api.canUseAbility("allowRoll") ? inputState.rollRight : false,
      pitchUp: ctx.api.canUseAbility("allowPitch") ? inputState.pitchUp : false,
      pitchDown: ctx.api.canUseAbility("allowPitch") ? inputState.pitchDown : false
    };
  }

  return installMovementApi(ctx, {
    applyEditorModeState,
    updateInputLatches,
    cleanupEditorOnlyManipulation,
    handleCameraCommands,
    handleStandUpCommand,
    rollPitchInput
  });
}
