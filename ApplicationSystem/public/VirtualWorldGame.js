// Nodevision/public/VirtualWorldGame.js
// Purpose: TODO: Add description of module purpose

// --- Unified keys state ---
const keys = { w: false, a: false, s: false, d: false, space: false, q: false };
let isPaused = false;
let yaw = 0, pitch = 0;
const mouseSensitivity = 0.0015;
let targetYaw = 0;
let targetPitch = 0;
const smoothingFactor = 0.1; // you might increase for smoother camera

// --- Pointer lock ---
document.body.addEventListener("click", () => document.body.requestPointerLock());

document.addEventListener("mousemove", (event) => {
  if (document.pointerLockElement) {
    targetYaw -= event.movementX * mouseSensitivity;
    targetPitch -= event.movementY * mouseSensitivity;
    targetPitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, targetPitch));
  }
});

// --- Movement ---
function updatePlayerMovement() {
  if (isPaused) return;

  const moveSpeed = 0.1;

  const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), player.rotation.y);
  const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), player.rotation.y);

  if (keys.w) player.position.addScaledVector(forward, moveSpeed);
  if (keys.s) player.position.addScaledVector(forward, -moveSpeed);
  if (keys.a) player.position.addScaledVector(right, -moveSpeed);
  if (keys.d) player.position.addScaledVector(right, moveSpeed);
  if (keys.space) player.position.y += moveSpeed; // Jump (example)
  if (keys.q) player.position.y -= moveSpeed;     // Descend (example)
}

// --- Unified action handler for gamepad & keyboard ---
function handleAction(action) {
  switch (action) {
    case "Move Forward": keys.w = true; break;
    case "Move Backward": keys.s = true; break;
    case "Move Left": keys.a = true; break;
    case "Move Right": keys.d = true; break;
    case "Jump": keys.space = true; break;
    case "Pause": togglePause(); break;
    default: console.log("Unhandled action:", action);
  }
}

// --- Animate loop ---
function animate() {
  requestAnimationFrame(animate);

  if (!isPaused) {
    yaw += (targetYaw - yaw) * smoothingFactor;
    pitch += (targetPitch - pitch) * smoothingFactor;

    player.rotation.y = yaw;
    camera.rotation.x = pitch;

    updatePlayerMovement();
  }

  renderer.render(scene, camera);
}

animate();

// --- Pause menu ---
function togglePause() {
  isPaused = !isPaused;
  document.exitPointerLock();
  document.getElementById("pause-menu").style.display = isPaused ? "block" : "none";
}

// --- Keyboard fallback for direct keypresses ---
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") togglePause();
  switch (event.key.toLowerCase()) {
    case "w": keys.w = true; break;
    case "a": keys.a = true; break;
    case "s": keys.s = true; break;
    case "d": keys.d = true; break;
    case " ": keys.space = true; break;
    case "q": keys.q = true; break;
  }
});

window.addEventListener("keyup", (event) => {
  switch (event.key.toLowerCase()) {
    case "w": keys.w = false; break;
    case "a": keys.a = false; break;
    case "s": keys.s = false; break;
    case "d": keys.d = false; break;
    case " ": keys.space = false; break;
    case "q": keys.q = false; break;
  }
});

document.getElementById("resume-btn").addEventListener("click", () => {
  isPaused = false;
  document.getElementById("pause-menu").style.display = "none";
  document.body.requestPointerLock();
});
