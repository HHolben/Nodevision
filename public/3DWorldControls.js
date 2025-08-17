//Nodevision/public/3DWorldControls.js
// Define the keys object with "j" for jump (instead of "space")
const keys = { w: false, a: false, s: false, d: false, j: false, q: false };
let isPaused = false;
let yaw = 0, pitch = 0;
const mouseSensitivity = 0.0015;
let targetYaw = 0;
let targetPitch = 0;
const smoothingFactor = 0.1; // smoothing for mouse/gamepad

// Mouse Lock for FPS Controls
document.body.addEventListener("click", () => {
  document.body.requestPointerLock();
});

document.addEventListener("mousemove", (event) => {
  if (document.pointerLockElement) {
    targetYaw -= event.movementX * mouseSensitivity;
    targetPitch -= event.movementY * mouseSensitivity;
    targetPitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, targetPitch)); // clamp
  }
});

// --- GAMEPAD SUPPORT ---
let gamepadIndex = null;

window.addEventListener("gamepadconnected", (e) => {
  console.log("Gamepad connected:", e.gamepad);
  gamepadIndex = e.gamepad.index;
});

window.addEventListener("gamepaddisconnected", (e) => {
  console.log("Gamepad disconnected:", e.gamepad);
  if (gamepadIndex === e.gamepad.index) gamepadIndex = null;
});

// Virtual movement vector from gamepad
let gpMoveX = 0, gpMoveY = 0;
let gpJump = false;

function handleGamepadInput() {
  if (gamepadIndex === null) return;

  const gp = navigator.getGamepads()[gamepadIndex];
  if (!gp) return;

  const deadzone = 0.2;

  // Left stick for movement (strafe + forward/back)
  const lx = Math.abs(gp.axes[0]) > deadzone ? gp.axes[0] : 0;
  const ly = Math.abs(gp.axes[1]) > deadzone ? gp.axes[1] : 0;
  gpMoveX = lx;   // strafe
  gpMoveY = -ly;  // forward/back (invert so up stick = forward)

  // Right stick for camera
  const rx = Math.abs(gp.axes[2]) > deadzone ? gp.axes[2] : 0;
  const ry = Math.abs(gp.axes[3]) > deadzone ? gp.axes[3] : 0;

  targetYaw -= rx * 0.04;    // tweak for sensitivity
  targetPitch -= ry * 0.04;
  targetPitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, targetPitch));

  // Button A (0) for jump
  gpJump = gp.buttons[0].pressed;

  // Button Start (9) toggles pause
  if (gp.buttons[9].pressed && !isPaused) {
    togglePause();
  }
}

function animate() {
  requestAnimationFrame(animate);
  if (!isPaused) {
    handleGamepadInput();

    // Smoothly update yaw and pitch
    yaw += (targetYaw - yaw) * smoothingFactor;
    pitch += (targetPitch - pitch) * smoothingFactor;

    player.rotation.y = yaw;     // yaw applied to body
    camera.rotation.x = pitch;   // pitch applied to camera

    // Merge keyboard + gamepad into movement
    const move = { w: keys.w, a: keys.a, s: keys.s, d: keys.d, j: keys.j };

    if (gpMoveY > 0.2) move.w = true;
    if (gpMoveY < -0.2) move.s = true;
    if (gpMoveX < -0.2) move.a = true;
    if (gpMoveX > 0.2) move.d = true;
    if (gpJump) move.j = true;

    updatePlayerMovement(move); // pass merged controls
  }
  renderer.render(scene, camera);
}

animate();

function togglePause() {
  isPaused = !isPaused;
  document.exitPointerLock();
  document.getElementById("pause-menu").style.display = isPaused ? "block" : "none";
}

// --- Keyboard handling ---
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    togglePause();
  } else {
    const key = event.key.toLowerCase();
    if (key in keys) {
      if (key === "j") event.preventDefault();
      keys[key] = true;
    }
  }
});

document.addEventListener("keyup", (event) => {
  const key = event.key.toLowerCase();
  if (key in keys) {
    keys[key] = false;
  }
});

document.getElementById("resume-btn").addEventListener("click", () => {
  isPaused = false;
  document.getElementById("pause-menu").style.display = "none";
  document.body.requestPointerLock();
});

document.getElementById("load-world-btn").addEventListener("click", () => {
  const worldPath = document.getElementById("world-url").value.trim();
  if (!worldPath) {
    alert("Please enter a valid world path.");
    return;
  }

  fetch("/api/load-world", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ worldPath })
  })
  .then(response => response.json())
  .then(data => {
    if (data.error) {
      alert("Failed to load world: " + data.error);
    } else {
      loadWorld(data.worldDefinition);
      alert("World loaded successfully!");
    }
  })
  .catch(error => console.error("Error loading world:", error));
});
