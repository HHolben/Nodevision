// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/Abilities/CommandAbilities/InputStateAbility.mjs
// This file builds the per-frame Game View input state from keyboard, gamepad, and text-world commands. It keeps control bindings transparent and fixes the gamepad lookup so controller input is read from the defined helper.

import { installMovementApi } from "../movementContext.mjs";

export function installInputStateAbility(ctx) {
  const { heldKeys, movementState } = ctx;

  function getPrimaryGamepad() {
    if (typeof navigator === "undefined" || typeof navigator.getGamepads !== "function") return null;
    const pads = navigator.getGamepads();
    if (!pads) return null;
    for (const pad of pads) {
      if (pad && pad.connected) return pad;
    }
    return null;
  }

  function readGamepadBinding(gp, binding) {
    if (!gp || !binding || typeof binding.index !== "number") return 0;
    if (binding.type === "button") return gp.buttons?.[binding.index]?.pressed ? 1 : 0;
    if (binding.type !== "axis") return 0;
    const raw = Number(gp.axes?.[binding.index] ?? 0);
    if (!Number.isFinite(raw)) return 0;
    if (binding.direction === "+") return raw > ctx.gamepadDeadZone ? raw : 0;
    if (binding.direction === "-") return raw < -ctx.gamepadDeadZone ? -raw : 0;
    return Math.abs(raw) > ctx.gamepadDeadZone ? raw : 0;
  }

  function readTextWorldActionInput() {
    const action = movementState?.textWorldAction;
    if (!action || typeof action !== "object") return {};
    const frames = Number(action.framesRemaining);
    if (!Number.isFinite(frames) || frames <= 0) {
      movementState.textWorldAction = null;
      return {};
    }
    action.framesRemaining = frames - 1;
    const input = action.input && typeof action.input === "object" ? action.input : {};
    if (action.framesRemaining <= 0) movementState.textWorldAction = null;
    return input;
  }

  function buildInputState(bindings) {
    const gp = getPrimaryGamepad();
    const gpBindings = bindings?.gamepad || {};
    const shortcutModifierHeld = heldKeys.control === true || heldKeys.meta === true;
    const saveShortcutHeld = heldKeys.saveShortcutActive === true;
    const forward = readGamepadBinding(gp, gpBindings.moveForward);
    const backward = readGamepadBinding(gp, gpBindings.moveBackward);
    const left = readGamepadBinding(gp, gpBindings.moveLeft);
    const rightward = readGamepadBinding(gp, gpBindings.moveRight);
    const jump = heldKeys[bindings.jump] || readGamepadBinding(gp, gpBindings.jump) > 0;
    const crouch = heldKeys[bindings.crouch];
    const jumpMode = jump && crouch ? "high" : jump && heldKeys.shift ? "hop" : "normal";
    const useBinding = String(bindings.use || "").toLowerCase();
    const attackBinding = String(bindings.attack || "").toLowerCase();
    const inspectKey = String(bindings.inspect || "").toLowerCase();
    const runKey = String(bindings.run || "e").toLowerCase();
    const standUp = heldKeys.standup === true || (shortcutModifierHeld && heldKeys.arrowup === true);
    const mergedInputState = {
      moveForward: heldKeys[bindings.moveForward] || forward > 0,
      moveBackward: !saveShortcutHeld && (heldKeys[bindings.moveBackward] || backward > 0),
      moveLeft: heldKeys[bindings.moveLeft] || left > 0,
      moveRight: heldKeys[bindings.moveRight] || rightward > 0,
      jump,
      jumpForceMultiplier: jumpMode === "high" ? 1.5 : jumpMode === "hop" ? 0.5 : 1,
      jumpMode,
      crouch,
      crawl: heldKeys[bindings.crawl],
      use: (useBinding !== "mouse0" && heldKeys[bindings.use]) || heldKeys.r || readGamepadBinding(gp, gpBindings.use) > 0 || !!gp?.buttons?.[5]?.pressed,
      grab: heldKeys.mouse0,
      stretch: heldKeys.g || (heldKeys.shift && heldKeys.s),
      rotate: heldKeys.mouse2,
      snapPlace: !!heldKeys.shift && !!(heldKeys.r || heldKeys[bindings.use]),
      attack: (!["mouse2", "mouse1", "mouse0"].includes(attackBinding) && heldKeys[bindings.attack]) || heldKeys.t || readGamepadBinding(gp, gpBindings.attack) > 0,
      inspect: heldKeys[inspectKey] || heldKeys.y || readGamepadBinding(gp, gpBindings.inspect) > 0,
      fly: heldKeys[bindings.fly] || readGamepadBinding(gp, gpBindings.fly) > 0,
      flyUp: heldKeys[bindings.flyUp] || jump,
      flyDown: heldKeys[bindings.flyDown],
      phase: heldKeys[bindings.phase] || heldKeys.v,
      run: heldKeys[runKey] || heldKeys.e || readGamepadBinding(gp, gpBindings.run) > 0,
      rollLeft: heldKeys[bindings.rollLeft],
      rollRight: heldKeys[bindings.rollRight],
      pitchUp: !standUp && heldKeys[bindings.pitchUp],
      pitchDown: heldKeys[bindings.pitchDown],
      standUp,
      lookYaw: readGamepadBinding(gp, gpBindings.lookYaw),
      lookPitch: readGamepadBinding(gp, gpBindings.lookPitch),
      cycleCamera: heldKeys[bindings.cycleCamera] || heldKeys.u || readGamepadBinding(gp, gpBindings.cycleCamera) > 0,
      pause: heldKeys[bindings.pause] || readGamepadBinding(gp, gpBindings.pause) > 0,
      openInventory: heldKeys[bindings.openInventory] || readGamepadBinding(gp, gpBindings.openInventory) > 0,
      hotbarSlot: readHotbarSlot(),
      handSwitch: heldKeys["-"] || heldKeys.minus,
      inventoryMenuUp: (!standUp && heldKeys.arrowup) || !!gp?.buttons?.[12]?.pressed,
      inventoryMenuDown: heldKeys.arrowdown || !!gp?.buttons?.[13]?.pressed,
      inventoryMenuLeft: heldKeys.arrowleft || !!gp?.buttons?.[14]?.pressed,
      inventoryMenuRight: heldKeys.arrowright || !!gp?.buttons?.[15]?.pressed,
      inventoryMenuConfirm: heldKeys.enter || readGamepadBinding(gp, gpBindings.jump) > 0
    };
    mergeTextWorldInput(mergedInputState, readTextWorldActionInput());
    return mergedInputState;
  }

  function readHotbarSlot() {
    for (let i = 1; i <= 9; i += 1) if (heldKeys[String(i)]) return i - 1;
    return null;
  }

  function mergeTextWorldInput(target, textInput) {
    Object.entries(textInput).forEach(([key, value]) => {
      if (typeof value === "boolean") target[key] = target[key] === true || value === true;
    });
    ["lookYaw", "lookPitch"].forEach((key) => {
      const value = Number(textInput[key]);
      if (Number.isFinite(value)) target[key] = (Number(target[key]) || 0) + value;
    });
    const multiplier = Number(textInput.jumpForceMultiplier);
    if (Number.isFinite(multiplier) && multiplier > 0) target.jumpForceMultiplier = multiplier;
    if (typeof textInput.jumpMode === "string" && textInput.jumpMode.trim()) target.jumpMode = textInput.jumpMode.trim();
  }

  return installMovementApi(ctx, {
    getPrimaryGamepad,
    readGamepadBinding,
    readTextWorldActionInput,
    buildInputState,
    readHotbarSlot,
    mergeTextWorldInput
  });
}
