// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/Abilities/CommandAbilities/EditorSelectionCommandAbility.mjs
// This file handles editor-selection commands for Game View. It routes grab, translate, stretch, rotate, and selected-item adjust presses after movement has been applied.

import { installMovementApi } from "../movementContext.mjs";

export function installEditorSelectionCommandAbility(ctx) {
  const { movementState } = ctx;

  function handleEditorSelectionCommands({ inputState, inEditorMode, nowMs }) {
    const grabbing = inputState.grab;
    const stretching = inputState.stretch;
    const rotating = inputState.rotate;
    if (ctx.stretchState?.dragging || ctx.rotateState?.dragging) movementState.grabLatch = true;
    const newGrabPress = grabbing && !movementState.grabLatch && !ctx.stretchState?.dragging && !ctx.rotateState?.dragging;
    if (newGrabPress && handleUseTargetClick(nowMs)) return true;
    if (newGrabPress && inEditorMode && handleEditorGrabPress(nowMs)) return true;
    if (handleAdjustPress(stretching, nowMs)) return true;
    if (handleStretchPress(stretching, inEditorMode)) return true;
    if (handleRotatePress(rotating, inEditorMode, nowMs)) return true;
    if (!rotating) movementState.rotateLatch = false;
    return false;
  }

  function handleUseTargetClick(nowMs) {
    const clickHit = ctx.api.getInspectHit();
    const clickUseRef = clickHit?.object?.userData?.useTargetRef;
    if (!clickUseRef?.actions?.length) return false;
    movementState.grabLatch = true;
    for (const action of clickUseRef.actions) ctx.api.applyCollisionAction(action);
    movementState.suppressAttackUntilMs = nowMs + 220;
    return true;
  }

  function handleEditorGrabPress(nowMs) {
    movementState.grabLatch = true;
    const lastClick = movementState.lastLeftClickMs || 0;
    const isDoubleClick = (nowMs - lastClick) <= ctx.doubleClickMs;
    movementState.lastLeftClickMs = nowMs;
    if (isDoubleClick) return handleDoubleClickGrab(nowMs);
    if (ctx.translateState?.dragging) return true;
    ctx.api.disposeTranslateState();
    const translateHit = ctx.api.getInspectHit();
    if (translateHit?.object) {
      ctx.api.createTranslateGizmo(translateHit.object);
      movementState.suppressAttackUntilMs = nowMs + 180;
      return true;
    }
    return false;
  }

  function handleDoubleClickGrab(nowMs) {
    if (ctx.translateState?.dragging) return true;
    ctx.api.disposeTranslateState();
    if (ctx.grabbedState) {
      ctx.api.releaseGrabbedObject();
      movementState.suppressAttackUntilMs = nowMs + 200;
      return true;
    }
    const grabHit = ctx.api.getInspectHit();
    if (grabHit?.object && ctx.api.startGrabFromHit(grabHit)) {
      movementState.suppressAttackUntilMs = nowMs + 200;
      return true;
    }
    return false;
  }

  function handleAdjustPress(stretching, nowMs) {
    const newAdjustPress = stretching && !movementState.selectedItemAdjustLatch;
    if (!newAdjustPress) return false;
    movementState.selectedItemAdjustLatch = true;
    if (!ctx.api.handleSelectedItemAction("adjust", { nowMs })) return false;
    movementState.stretchLatch = true;
    return true;
  }

  function handleStretchPress(stretching, inEditorMode) {
    const newStretchPress = stretching && !movementState.stretchLatch;
    if (!newStretchPress || !inEditorMode) return false;
    movementState.stretchLatch = true;
    ctx.api.disposeTranslateState();
    ctx.api.disposeRotateState();
    if (ctx.stretchState) ctx.api.disposeStretchState();
    else {
      const stretchHit = ctx.api.getInspectHit();
      if (stretchHit?.object) ctx.api.createStretchGizmo(stretchHit.object);
    }
    return false;
  }

  function handleRotatePress(rotating, inEditorMode, nowMs) {
    const newRotatePress = rotating && !movementState.rotateLatch;
    if (!newRotatePress || !inEditorMode) return false;
    const lastRightClick = movementState.lastRightClickMs || 0;
    const isDoubleRightClick = (nowMs - lastRightClick) <= ctx.doubleClickMs;
    movementState.lastRightClickMs = nowMs;
    movementState.rotateLatch = true;
    if (isDoubleRightClick) return toggleStretchFromRotate();
    ctx.api.disposeTranslateState();
    ctx.api.disposeStretchState();
    if (ctx.rotateState) ctx.api.disposeRotateState();
    else {
      const rotHit = ctx.api.getInspectHit();
      if (rotHit?.object) ctx.api.createRotateGizmo(rotHit.object);
    }
    return false;
  }

  function toggleStretchFromRotate() {
    ctx.api.disposeTranslateState();
    ctx.api.disposeRotateState();
    if (ctx.stretchState) ctx.api.disposeStretchState();
    else {
      const stretchHit = ctx.api.getInspectHit();
      if (stretchHit?.object) ctx.api.createStretchGizmo(stretchHit.object);
    }
    return true;
  }

  return installMovementApi(ctx, {
    handleEditorSelectionCommands,
    handleUseTargetClick,
    handleEditorGrabPress,
    handleDoubleClickGrab,
    handleAdjustPress,
    handleStretchPress,
    handleRotatePress,
    toggleStretchFromRotate
  });
}
