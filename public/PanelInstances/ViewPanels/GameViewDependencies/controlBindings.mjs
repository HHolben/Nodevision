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
  rollLeft: "q",
  rollRight: "e",
  pitchUp: "arrowup",
  pitchDown: "arrowdown",
  flyUp: "space",
  flyDown: "shift"
};

export function normalizeKeyName(key) {
  if (!key) return "";
  const raw = String(key);
  if (raw === " ") return "space";
  const normalized = raw.toLowerCase().trim();
  if (normalized === "spacebar" || normalized === "space") return "space";
  return normalized;
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
    rollLeft: getKey("Roll Left", defaultBindings.rollLeft),
    rollRight: getKey("Roll Right", defaultBindings.rollRight),
    pitchUp: getKey("Pitch Up", defaultBindings.pitchUp),
    pitchDown: getKey("Pitch Down", defaultBindings.pitchDown),
    flyUp: getKey("Fly Up", defaultBindings.flyUp),
    flyDown: getKey("Fly Down", defaultBindings.flyDown)
  };
}

export async function loadControlScheme(state) {
  if (state.controlBindings) return;
  state.controlBindings = { ...defaultBindings };

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
