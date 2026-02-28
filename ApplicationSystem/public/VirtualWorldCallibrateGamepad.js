// FILE: Nodevision/public/VirtualWorldCallibrateGamepad.js
// Purpose: TODO: Add description of module purpose

let calibrationActive = false;
let calibrationGamepadIndex = null;

// Detect gamepad connection
window.addEventListener("gamepadconnected", (e) => {
  console.log("Gamepad connected:", e.gamepad);
  if (calibrationGamepadIndex === null) {
    calibrationGamepadIndex = e.gamepad.index;
  }
});

window.addEventListener("gamepaddisconnected", (e) => {
  console.log("Gamepad disconnected:", e.gamepad);
  if (calibrationGamepadIndex === e.gamepad.index) {
    calibrationGamepadIndex = null;
  }
});

// Toggle calibration mode (you’ll later hook this into a pause menu button)
function toggleCalibration() {
  calibrationActive = !calibrationActive;
  console.log("Gamepad calibration:", calibrationActive ? "ON" : "OFF");

  if (calibrationActive) {
    runCalibrationLoop();
  }
}

// Poll and log gamepad state
function runCalibrationLoop() {
  if (!calibrationActive) return;

  const gp = navigator.getGamepads()[calibrationGamepadIndex];
  if (gp) {
    console.log("--- Gamepad State ---");
    console.log("Axes:", gp.axes.map(a => a.toFixed(2)));
    console.log("Buttons:", gp.buttons.map(b => b.pressed));
  }

  requestAnimationFrame(runCalibrationLoop);
}

// Expose toggle function globally so pause menu can call it
window.toggleGamepadCalibration = toggleCalibration;
