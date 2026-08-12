// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/Abilities/CommandAbilities/FramePreflightAbility.mjs
// This file defines preflight checks for the Game View movement update frame. It handles unlocked inspection, text-console focus, sound runtime updates, and STL marker refresh before locked movement proceeds.

import { installMovementApi } from "../movementContext.mjs";

export function installFramePreflightAbility(ctx) {
  const { camera, controls, getBindings, heldKeys, movementState } = ctx;

  function runFramePreflight() {
    ctx.api.ensureWheelHandler();
    const focusedElement = document.activeElement;
    const typingIntoField = focusedElement && (
      ["INPUT", "TEXTAREA", "SELECT"].includes(focusedElement.tagName)
      || focusedElement.isContentEditable === true
    );
    const unlockedBindings = typeof getBindings === "function" ? getBindings() : {};
    const unlockedInspectKey = String(unlockedBindings.inspect || "y").toLowerCase();
    const unlockedInspecting = !typingIntoField && (heldKeys?.[unlockedInspectKey] || heldKeys?.y);
    const textConsoleActive = movementState.textWorldConsoleActive === true || String(movementState.cameraMode || "").toLowerCase() === "text";
    ctx.api.updateSoundObjectRuntimes(ctx.listenerPosition());
    if (!controls.isLocked && !textConsoleActive) {
      ctx.api.updateGrabbedObjectFollow();
      ctx.api.updateGizmoHandleOrientations();
      if (unlockedInspecting && !movementState.inspectLatch) {
        movementState.inspectLatch = true;
        movementState.lastInspectMs = performance.now();
        if (ctx.api.handleInspectAction()) return { stop: true };
      } else if (!unlockedInspecting) movementState.inspectLatch = false;
      return { stop: true };
    }
    refreshStlMarkersForFrame();
    ctx.api.ensureWheelHandler();
    return { stop: false };
  }

  function refreshStlMarkersForFrame() {
    if (movementState.stlEdit) {
      if (movementState.stlNeedsMarkerRefresh) {
        ctx.api.refreshStlVertexMarkers();
        movementState.stlNeedsMarkerRefresh = false;
      }
    } else if (ctx.stlVertexMarkers.length) ctx.api.clearStlVertexMarkers();
  }

  function handleStlEditUse(using) {
    if (!movementState.stlEdit) return false;
    if (using && !movementState.stlPlaceLatch) {
      const hit = ctx.api.getInspectHit();
      const dir = new ctx.THREE.Vector3();
      camera.getWorldDirection(dir);
      const origin = controls.getObject().position.clone();
      const point = hit?.point?.clone?.() || origin.addScaledVector(dir, 2);
      ctx.api.addStlVertex(point);
      movementState.stlPlaceLatch = true;
      return true;
    }
    if (!using) movementState.stlPlaceLatch = false;
    return false;
  }

  return installMovementApi(ctx, {
    runFramePreflight,
    refreshStlMarkersForFrame,
    handleStlEditUse
  });
}
