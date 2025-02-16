const keys = { w: false, a: false, s: false, d: false, space: false, q: false };
let isPaused = false;
let yaw = 0, pitch = 0;
const mouseSensitivity = 0.0015;
let targetYaw = 0;
let targetPitch = 0;
const smoothingFactor = 0.05;

// Mouse Lock for FPS Controls
document.body.addEventListener("click", () => {
  document.body.requestPointerLock();
});

document.addEventListener("mousemove", (event) => {
  if (document.pointerLockElement) {
    targetYaw -= event.movementX * mouseSensitivity;
    targetPitch -= event.movementY * mouseSensitivity;
    targetPitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, targetPitch));
  }
});

function togglePause() {
  isPaused = !isPaused;
  document.exitPointerLock();
  document.getElementById("pause-menu").style.display = isPaused ? "block" : "none";
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") togglePause();
  if (event.key in keys) keys[event.key] = true;
});

document.addEventListener("keyup", (event) => {
  if (event.key in keys) keys[event.key] = false;
});

document.getElementById("resume-btn").addEventListener("click", () => {
  isPaused = false;
  document.getElementById("pause-menu").style.display = "none";
  document.body.requestPointerLock();
});
