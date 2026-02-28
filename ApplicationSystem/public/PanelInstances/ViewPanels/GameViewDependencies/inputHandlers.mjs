// Nodevision/public/PanelInstances/ViewPanels/GameViewDependencies/inputHandlers.mjs
// This file registers keyboard handlers and tracks held input state.

export function createInputHandlers({ getBindings, normalizeKeyName, movementState }) {
  const heldKeys = {};
  function syncMouseButtons(buttonMask) {
    if (!Number.isFinite(buttonMask)) return;
    heldKeys.mouse0 = (buttonMask & 1) !== 0;
    heldKeys.mouse1 = (buttonMask & 4) !== 0;
    heldKeys.mouse2 = (buttonMask & 2) !== 0;
  }

  function clearTransientInputs() {
    heldKeys.mouse0 = false;
    heldKeys.mouse1 = false;
    heldKeys.mouse2 = false;
  }

  const onKeyDown = (e) => {
    const keyName = normalizeKeyName(e.key);
    heldKeys[keyName] = true;
  };
  const onKeyUp = (e) => { heldKeys[normalizeKeyName(e.key)] = false; };
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
