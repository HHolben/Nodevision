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

// --- Placement helpers ---
const placementRaycaster = new THREE.Raycaster();
const placementPointer = new THREE.Vector2();
const placementColors = [0xffb347, 0x7ad0ff, 0xa8ff95, 0xff84ff];
const placedObjects = [];
const placementCubeSize = 0.65;
const maxPlacedObjects = 40;

// --- Pointer lock ---
document.body.addEventListener("click", () => document.body.requestPointerLock());

document.addEventListener("mousemove", (event) => {
  if (document.pointerLockElement) {
    targetYaw -= event.movementX * mouseSensitivity;
    targetPitch -= event.movementY * mouseSensitivity;
    targetPitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, targetPitch));
  }
});

function getGroundPlacementHit(event) {
  if (!plane) return null;
  const rect = renderer.domElement.getBoundingClientRect();
  const clientX = event?.clientX ?? (rect.left + rect.width / 2);
  const clientY = event?.clientY ?? (rect.top + rect.height / 2);
  const normalizedX = ((clientX - rect.left) / rect.width) * 2 - 1;
  const normalizedY = -(((clientY - rect.top) / rect.height) * 2 - 1);
  placementPointer.set(normalizedX, normalizedY);
  placementRaycaster.setFromCamera(placementPointer, camera);
  const hits = placementRaycaster.intersectObject(plane, false);
  return hits[0] || null;
}

function prunePlacedObjects() {
  while (placedObjects.length > maxPlacedObjects) {
    const stale = placedObjects.shift();
    if (!stale) continue;
    stale.parent?.remove(stale);
    if (stale.geometry?.dispose) stale.geometry.dispose();
    if (stale.material?.dispose) stale.material.dispose();
  }
}

function placeObjectOnFloor(hit) {
  if (!hit) return;
  const geometry = new THREE.BoxGeometry(placementCubeSize, placementCubeSize, placementCubeSize);
  const color = placementColors[placedObjects.length % placementColors.length];
  const material = new THREE.MeshBasicMaterial({ color });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(hit.point.x, placementCubeSize / 2, hit.point.z);
  mesh.userData.isPlayerPlaced = true;
  worldGroup.add(mesh);
  placedObjects.push(mesh);
  prunePlacedObjects();
}

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

window.addEventListener("mousedown", (event) => {
  if (event.button !== 0 || isPaused) return;
  const hit = getGroundPlacementHit(event);
  if (hit) placeObjectOnFloor(hit);
});

console.info("Virtual world placement: left click the floor to drop a cube when unpaused.");

document.getElementById("resume-btn").addEventListener("click", () => {
  isPaused = false;
  document.getElementById("pause-menu").style.display = "none";
  document.body.requestPointerLock();
});
