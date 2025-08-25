// Nodevision/public/VirtualWorldControls.js

let controlBindings = {};

// Load gamepad & keyboard bindings from server
async function loadGamepadBindings() {
  try {
    const response = await fetch('/api/load-gamepad-settings');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = await response.json();

    // If empty, provide default bindings
    controlBindings = Object.keys(json).length ? json : {
      "Move Forward": { "gamepad": "Axis 1-", "keyboard": "w" },
      "Move Backward": { "gamepad": "Axis 1+", "keyboard": "s" },
      "Move Left": { "gamepad": "Axis 0-", "keyboard": "a" },
      "Move Right": { "gamepad": "Axis 0+", "keyboard": "d" },
      "Jump": { "gamepad": "Button 0", "keyboard": " " },
      "Pause": { "gamepad": "Button 9", "keyboard": "Escape" }
    };

    console.log("Loaded unified control bindings:", controlBindings);
  } catch (err) {
    console.error("Error loading gamepad bindings:", err);
  }
}

// --- Gamepad handling ---
function checkGamepadInput() {
  const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
  if (!gamepads) return;

  const gp = gamepads[0];
  if (!gp) return;

  for (const action in controlBindings) {
    const binding = controlBindings[action];
    if (!binding || !binding.gamepad) continue;

    if (binding.gamepad.startsWith("Button")) {
      const buttonIndex = parseInt(binding.gamepad.split(" ")[1]);
      if (gp.buttons[buttonIndex]?.pressed) handleAction(action);
    } else if (binding.gamepad.startsWith("Axis")) {
      const [axisIndex, dir] = binding.gamepad.match(/Axis (\d)([+-])/).slice(1);
      const val = gp.axes[parseInt(axisIndex)];
      if ((dir === "-" && val < -0.2) || (dir === "+" && val > 0.2)) {
        handleAction(action);
      }
    }
  }
}

// --- Keyboard handling ---
const keys = {};
window.addEventListener("keydown", e => keys[e.key.toLowerCase()] = true);
window.addEventListener("keyup", e => keys[e.key.toLowerCase()] = false);

function checkKeyboardInput() {
  for (const action in controlBindings) {
    const binding = controlBindings[action];
    if (!binding || !binding.keyboard) continue;
    const key = binding.keyboard.toLowerCase();
    if (keys[key]) handleAction(action);
  }
}

// --- Action handler ---
function handleAction(action) {
  // TEMP: log for debugging
  console.log(`>>> Executing action: ${action}`);
  // TODO: integrate with player movement
}

// --- Main game loop ---
function gameLoop() {
  checkGamepadInput();
  checkKeyboardInput();
  requestAnimationFrame(gameLoop);
}

// Load bindings and start the loop
loadGamepadBindings().then(() => {
  gameLoop();
});
