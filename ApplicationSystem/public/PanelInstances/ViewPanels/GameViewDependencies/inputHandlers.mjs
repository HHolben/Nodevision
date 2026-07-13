// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/inputHandlers.mjs
// This file registers keyboard handlers and tracks held input state.

import { setStatus } from "/StatusBar.mjs";

export function createInputHandlers({ getBindings, normalizeKeyName, movementState }) {
  const heldKeys = {};
  function syncMouseButtons(buttonMask) {
    if (!Number.isFinite(buttonMask)) return;
    heldKeys.mouse0 = (buttonMask & 1) !== 0;
    heldKeys.mouse1 = (buttonMask & 4) !== 0;
    heldKeys.mouse2 = (buttonMask & 2) !== 0;
  }

  function clearTransientInputs() {
    Object.keys(heldKeys).forEach((key) => {
      heldKeys[key] = false;
    });
    heldKeys.mouse0 = false;
    heldKeys.mouse1 = false;
    heldKeys.mouse2 = false;
    heldKeys.saveShortcutActive = false;
    heldKeys.standup = false;
    if (movementState) {
      movementState.saveShortcutLatch = false;
      heldKeys.saveShortcutActive = false;
      movementState.standUpLatch = false;
    }
  }

  function isVirtualWorldEditingMode() {
    return String(movementState?.playerMode || "").toLowerCase() === "creative"
      || window.NodevisionState?.currentMode === "Virtual World Editing";
  }

  function suppressMovementKey(keyName) {
    if (keyName) heldKeys[keyName] = false;
    const bindings = typeof getBindings === "function" ? getBindings() : null;
    if (bindings?.moveBackward) heldKeys[bindings.moveBackward] = false;
    heldKeys.s = false;
  }

  const onKeyDown = (e) => {
    const keyName = normalizeKeyName(e.key);
    const shortcutModifier = e.ctrlKey === true || e.metaKey === true;
    const isSaveShortcut = shortcutModifier && keyName === "s";
    const isStandUpShortcut = shortcutModifier && keyName === "arrowup";
    const isModifierCompletingStandUp = (keyName === "control" || keyName === "meta") && heldKeys.arrowup === true;

    if (isSaveShortcut && isVirtualWorldEditingMode()) {
      e.preventDefault();
      e.stopPropagation();
      suppressMovementKey(keyName);
      heldKeys.saveShortcutActive = true;
      if (!movementState.saveShortcutLatch && typeof window.saveVirtualWorldFile === "function") {
        movementState.saveShortcutLatch = true;
        setStatus("Saving virtual world...");
        Promise.resolve(window.saveVirtualWorldFile())
          .then((saved) => setStatus(saved ? "Virtual world saved." : "Virtual world save skipped."))
          .catch((err) => {
            console.error("Virtual world save shortcut failed:", err);
            setStatus("Virtual world save failed.", err?.message || "");
          });
      }
      return;
    }

    if (isStandUpShortcut || isModifierCompletingStandUp) {
      e.preventDefault();
      e.stopPropagation();
      heldKeys.arrowup = false;
      heldKeys.standup = true;
      if (keyName === "control" || keyName === "meta") heldKeys[keyName] = true;
      return;
    }

    heldKeys[keyName] = true;
  };
  const onKeyUp = (e) => {
    const keyName = normalizeKeyName(e.key);
    heldKeys[keyName] = false;
    if (keyName === "s" || keyName === "control" || keyName === "meta") {
      movementState.saveShortcutLatch = false;
      heldKeys.saveShortcutActive = false;
    }
    if (keyName === "arrowup" || keyName === "control" || keyName === "meta") {
      heldKeys.standup = false;
    }
  };
  const onMouseDown = (e) => {
    if (e.button === 0) heldKeys.mouse0 = true;
    else if (e.button === 1) heldKeys.mouse1 = true;
    else if (e.button === 2) heldKeys.mouse2 = true;
  };
  const onMouseUp = (e) => {
    if (e.button === 0) heldKeys.mouse0 = false;
    else if (e.button === 1) heldKeys.mouse1 = false;
    else if (e.button === 2) heldKeys.mouse2 = false;
  };
  const onMouseMove = (e) => syncMouseButtons(e.buttons);
  const onPointerMove = (e) => syncMouseButtons(e.buttons);
  const onPointerUp = (e) => syncMouseButtons(e.buttons);
  const onWindowBlur = () => clearTransientInputs();
  const onVisibilityChange = () => {
    if (document.visibilityState !== "visible") clearTransientInputs();
  };
  const onPointerLockChange = () => {
    if (!document.pointerLockElement) clearTransientInputs();
  };

  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("keyup", onKeyUp);
  document.addEventListener("mousedown", onMouseDown);
  document.addEventListener("mouseup", onMouseUp);
  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("pointermove", onPointerMove);
  document.addEventListener("pointerup", onPointerUp);
  document.addEventListener("visibilitychange", onVisibilityChange);
  document.addEventListener("pointerlockchange", onPointerLockChange);
  window.addEventListener("blur", onWindowBlur);

  function dispose() {
    document.removeEventListener("keydown", onKeyDown);
    document.removeEventListener("keyup", onKeyUp);
    document.removeEventListener("mousedown", onMouseDown);
    document.removeEventListener("mouseup", onMouseUp);
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", onPointerUp);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    document.removeEventListener("pointerlockchange", onPointerLockChange);
    window.removeEventListener("blur", onWindowBlur);
    clearTransientInputs();
  }

  return { heldKeys, dispose };
}
