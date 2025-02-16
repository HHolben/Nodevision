const keys = { w: false, a: false, s: false, d: false, space: false, q: false };
let isPaused = false;
let yaw = 0, pitch = 0;
const mouseSensitivity = 0.0015;
let targetYaw = 0;
let targetPitch = 0;
const smoothingFactor = 0;

// Request pointer lock on click for FPS controls
document.body.addEventListener("click", () => {
  document.body.requestPointerLock();
});

// Update mouse movement values
document.addEventListener("mousemove", (event) => {
  if (document.pointerLockElement) {
    targetYaw -= event.movementX * mouseSensitivity;
    targetPitch -= event.movementY * mouseSensitivity;
    // Clamp pitch so the view doesn't flip
    targetPitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, targetPitch));
  }
});

// Update player movement based on keys and the player's current rotation
function updatePlayerMovement() {
  if (isPaused) return;

  const moveSpeed = 0.1;

  // Create a forward vector (pointing down the -Z axis in local space)
  const forward = new THREE.Vector3(0, 0, -1);
  // Apply the player's current yaw (rotation.y) to the forward vector
  forward.applyAxisAngle(new THREE.Vector3(0, 1, 0), player.rotation.y);

  // Create a right vector (pointing down the +X axis in local space)
  const right = new THREE.Vector3(1, 0, 0);
  // Apply the same yaw rotation to the right vector
  right.applyAxisAngle(new THREE.Vector3(0, 1, 0), player.rotation.y);

  if (keys.w) player.position.addScaledVector(forward, moveSpeed);
  if (keys.s) player.position.addScaledVector(forward, -moveSpeed);
  if (keys.a) player.position.addScaledVector(right, -moveSpeed);
  if (keys.d) player.position.addScaledVector(right, moveSpeed);
}

function animate() {
  requestAnimationFrame(animate);

  if (!isPaused) {
    // Smoothly update yaw and pitch values
    yaw += (targetYaw - yaw) * smoothingFactor;
    pitch += (targetPitch - pitch) * smoothingFactor;

    // Apply yaw to the player's body (rotate left/right)
    player.rotation.y = yaw;
    // Apply pitch to the camera only (rotate up/down)
    camera.rotation.x = pitch;

    updatePlayerMovement();
  }
  
  renderer.render(scene, camera);
}

animate();

// Pause menu and pointer lock toggle
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
