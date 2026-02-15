// Nodevision/public/PanelInstances/ViewPanels/GameViewDependencies/controlBindings.mjs
// This file defines default control bindings and helpers to load and normalize them.

export const defaultBindings = {
  moveForward: "w",
  moveBackward: "s",
  moveLeft: "a",
  moveRight: "d",
  jump: "space",
  pause: "escape",
  crouch: "c",
  crawl: "x",
  fly: "f",
  use: "r",
  attack: "t",
  openInventory: "0",
  rollLeft: "q",
  rollRight: "e",
  pitchUp: "arrowup",
  pitchDown: "arrowdown",
  flyUp: "space",
  flyDown: "shift"
};

export const defaultGamepadBindings = {
  moveForward: "Axis 1-",
  moveBackward: "Axis 1+",
  moveLeft: "Axis 0-",
  moveRight: "Axis 0+",
  jump: "Button 0",
  pause: "Button 9",
  fly: "Button 4",
  use: "Button 5",
  attack: "Button 5",
  openInventory: "Button 8",
  lookYaw: "Axis 2",
  lookPitch: "Axis 3",
  cycleCamera: "Button 3"
};

export function normalizeKeyName(key) {
  if (!key) return "";
  const raw = String(key);
  if (raw === " ") return "space";
  const normalized = raw.toLowerCase().trim();
  if (normalized === "spacebar" || normalized === "space") return "space";
  return normalized;
}

function normalizeGamepadBinding(binding) {
  if (typeof binding !== "string") return null;
  const trimmed = binding.trim();
  if (!trimmed) return null;

  const buttonMatch = trimmed.match(/^Button\s+(\d+)$/i);
  if (buttonMatch) {
    return { type: "button", index: Number.parseInt(buttonMatch[1], 10) };
  }

  const axisWithDirMatch = trimmed.match(/^Axis\s+(\d+)\s*([+-])$/i);
  if (axisWithDirMatch) {
    return {
      type: "axis",
      index: Number.parseInt(axisWithDirMatch[1], 10),
      direction: axisWithDirMatch[2]
    };
  }

  const axisMatch = trimmed.match(/^Axis\s+(\d+)$/i);
  if (axisMatch) {
    return {
      type: "axis",
      index: Number.parseInt(axisMatch[1], 10),
      direction: null
    };
  }

  return null;
}

function buildBindingsFromScheme(scheme) {
  const getKey = (action, fallback) => {
    const key = scheme?.[action]?.keyboard;
    return normalizeKeyName(key || fallback);
  };

  return {
    moveForward: getKey("Move Forward", defaultBindings.moveForward),
    moveBackward: getKey("Move Backward", defaultBindings.moveBackward),
    moveLeft: getKey("Move Left", defaultBindings.moveLeft),
    moveRight: getKey("Move Right", defaultBindings.moveRight),
    jump: getKey("Jump", defaultBindings.jump),
    pause: getKey("Pause", defaultBindings.pause),
    crouch: getKey("Crouch", defaultBindings.crouch),
    crawl: getKey("Crawl", defaultBindings.crawl),
    fly: getKey("Fly", defaultBindings.fly),
    use: getKey("Use", defaultBindings.use),
    attack: getKey("Attack", defaultBindings.attack),
    openInventory: getKey("Open Inventory", defaultBindings.openInventory),
    rollLeft: getKey("Roll Left", defaultBindings.rollLeft),
    rollRight: getKey("Roll Right", defaultBindings.rollRight),
    pitchUp: getKey("Pitch Up", defaultBindings.pitchUp),
    pitchDown: getKey("Pitch Down", defaultBindings.pitchDown),
    flyUp: getKey("Fly Up", defaultBindings.flyUp),
    flyDown: getKey("Fly Down", defaultBindings.flyDown),
    gamepad: {
      moveForward: normalizeGamepadBinding(scheme?.["Move Forward"]?.gamepad) || normalizeGamepadBinding(defaultGamepadBindings.moveForward),
      moveBackward: normalizeGamepadBinding(scheme?.["Move Backward"]?.gamepad) || normalizeGamepadBinding(defaultGamepadBindings.moveBackward),
      moveLeft: normalizeGamepadBinding(scheme?.["Move Left"]?.gamepad) || normalizeGamepadBinding(defaultGamepadBindings.moveLeft),
      moveRight: normalizeGamepadBinding(scheme?.["Move Right"]?.gamepad) || normalizeGamepadBinding(defaultGamepadBindings.moveRight),
      jump: normalizeGamepadBinding(scheme?.Jump?.gamepad) || normalizeGamepadBinding(defaultGamepadBindings.jump),
      pause: normalizeGamepadBinding(scheme?.Pause?.gamepad) || normalizeGamepadBinding(defaultGamepadBindings.pause),
      fly: normalizeGamepadBinding(scheme?.Fly?.gamepad) || normalizeGamepadBinding(defaultGamepadBindings.fly),
      use: normalizeGamepadBinding(scheme?.Use?.gamepad) || normalizeGamepadBinding(defaultGamepadBindings.use),
      attack: normalizeGamepadBinding(scheme?.Attack?.gamepad) || normalizeGamepadBinding(defaultGamepadBindings.attack),
      openInventory: normalizeGamepadBinding(scheme?.["Open Inventory"]?.gamepad) || normalizeGamepadBinding(defaultGamepadBindings.openInventory),
      lookYaw: normalizeGamepadBinding(scheme?.["Pointer X"]?.gamepad) || normalizeGamepadBinding(defaultGamepadBindings.lookYaw),
      lookPitch: normalizeGamepadBinding(scheme?.["Pointer Y"]?.gamepad) || normalizeGamepadBinding(defaultGamepadBindings.lookPitch),
      cycleCamera: normalizeGamepadBinding(scheme?.["Cycle Camera"]?.gamepad) || normalizeGamepadBinding(defaultGamepadBindings.cycleCamera)
    }
  };
}

export async function loadControlScheme(state) {
  if (state.controlBindings) return;
  state.controlBindings = {
    ...defaultBindings,
    gamepad: {
      moveForward: normalizeGamepadBinding(defaultGamepadBindings.moveForward),
      moveBackward: normalizeGamepadBinding(defaultGamepadBindings.moveBackward),
      moveLeft: normalizeGamepadBinding(defaultGamepadBindings.moveLeft),
      moveRight: normalizeGamepadBinding(defaultGamepadBindings.moveRight),
      jump: normalizeGamepadBinding(defaultGamepadBindings.jump),
      pause: normalizeGamepadBinding(defaultGamepadBindings.pause),
      fly: normalizeGamepadBinding(defaultGamepadBindings.fly),
      use: normalizeGamepadBinding(defaultGamepadBindings.use),
      attack: normalizeGamepadBinding(defaultGamepadBindings.attack),
      openInventory: normalizeGamepadBinding(defaultGamepadBindings.openInventory),
      lookYaw: normalizeGamepadBinding(defaultGamepadBindings.lookYaw),
      lookPitch: normalizeGamepadBinding(defaultGamepadBindings.lookPitch),
      cycleCamera: normalizeGamepadBinding(defaultGamepadBindings.cycleCamera)
    }
  };

  try {
    const res = await fetch("/UserSettings/KeyboardAndControlSchemes/GameControllerSettings.json", {
      cache: "no-store"
    });
    if (!res.ok) {
      console.warn("GameView: control scheme load failed:", res.status, res.statusText);
      return;
    }

    const scheme = await res.json();
    state.controlBindings = buildBindingsFromScheme(scheme);
  } catch (err) {
    console.warn("GameView: failed to load control scheme:", err);
  }
}
