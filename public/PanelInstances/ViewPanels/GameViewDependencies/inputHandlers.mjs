// Nodevision/public/PanelInstances/ViewPanels/GameViewDependencies/inputHandlers.mjs
// This file registers keyboard handlers and tracks held input state.

export function createInputHandlers({ getBindings, normalizeKeyName, movementState }) {
  const heldKeys = {};
  const onKeyDown = (e) => {
    const keyName = normalizeKeyName(e.key);
    heldKeys[keyName] = true;
    const bindings = getBindings();
    if (keyName === bindings.fly && !movementState.flyToggleLatch) {
      movementState.isFlying = !movementState.isFlying;
      movementState.flyToggleLatch = true;
    }
  };
  const onKeyUp = (e) => { heldKeys[normalizeKeyName(e.key)] = false; };

  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("keyup", onKeyUp);

  function dispose() {
    document.removeEventListener("keydown", onKeyDown);
    document.removeEventListener("keyup", onKeyUp);
  }

  return { heldKeys, dispose };
}
