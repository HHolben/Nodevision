// Nodevision/ApplicationSystem/public/VirtualWorldGame.js
// This file defines browser-side Virtual World Game logic for the Nodevision UI. It renders interface components and handles user interactions.
console.log("[VWGame] script loaded");
window.addEventListener("error", (e) => {
  console.error("[VWGame] runtime error", e.message, e.filename, e.lineno, e.colno);
});

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

// --- Selection / grab state ---
const objectRaycaster = new THREE.Raycaster();
const objectPointer = new THREE.Vector2();
let selectedObject = null;
let grabbedObject = null;
let grabDistance = 2.5;
let draggingAxis = null;
let lastDragMouse = null;

// --- Axis gizmo (X, Y, Z) ---
const gizmoGroup = new THREE.Group();
gizmoGroup.visible = false;
const axisLength = 1.2;
const axisRadius = 0.025;
const axisDefaultColors = { x: 0xff5555, y: 0x55ff55, z: 0x5555ff };
const axisClickedColor = 0xffff00;

function makeAxisGizmo(dir, color, axisTag) {
  const group = new THREE.Group();
  group.userData.axis = axisTag;

  // Visible arrow
  const arrow = new THREE.ArrowHelper(dir, new THREE.Vector3(), axisLength, color, 0.25, 0.12);
  group.userData.arrow = arrow;
  group.add(arrow);

  // Thick, invisible collider along the axis
  const colliderLength = axisLength + 0.5;
  const colliderGeom = new THREE.CylinderGeometry(axisRadius * 6, axisRadius * 6, colliderLength, 8);
  const colliderMat = new THREE.MeshBasicMaterial({ visible: false });
  const collider = new THREE.Mesh(colliderGeom, colliderMat);
  // center along axis
  collider.position.copy(dir.clone().multiplyScalar(colliderLength / 2));
  collider.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  collider.userData.axis = axisTag;
  collider.userData.isGizmo = true;
  group.add(collider);

  // Cone collider (reuse visible cone)
  arrow.cone.userData.axis = axisTag;
  arrow.cone.userData.isGizmo = true;

  return group;
}

gizmoGroup.add(makeAxisGizmo(new THREE.Vector3(1, 0, 0), 0xff5555, "x"));
gizmoGroup.add(makeAxisGizmo(new THREE.Vector3(0, 1, 0), 0x55ff55, "y"));
gizmoGroup.add(makeAxisGizmo(new THREE.Vector3(0, 0, 1), 0x5555ff, "z"));
scene.add(gizmoGroup);

function setAxisColor(axis, color) {
  gizmoGroup.children.forEach((child) => {
    if (child.userData.axis === axis && child.userData.arrow) {
      const c = new THREE.Color(color);
      child.userData.arrow.setColor(c);
      if (child.userData.arrow.cone?.material?.color) {
        child.userData.arrow.cone.material.color.copy(c);
      }
      if (child.userData.arrow.line?.material?.color) {
        child.userData.arrow.line.material.color.copy(c);
      }
    }
  });
}

function flashAxis(axis) {
  setAxisColor(axis, axisClickedColor);
  setTimeout(() => setAxisColor(axis, axisDefaultColors[axis] || axisClickedColor), 150);
}

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

  // Keep grabbed object in front of the camera
  if (!isPaused && grabbedObject) {
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const targetPos = camera.position.clone().addScaledVector(dir, grabDistance);
    grabbedObject.position.copy(targetPos);
    grabbedObject.quaternion.copy(camera.quaternion);
  }

  // Keep gizmo centered on selected object during precision mode
  if (selectedObject && !grabbedObject && gizmoGroup.visible) {
    gizmoGroup.position.copy(selectedObject.getWorldPosition(new THREE.Vector3()));
  }

  renderer.render(scene, camera);
}

animate();

// --- Ray helpers ---
function updatePointerFromEvent(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  // When pointer-locked, clientX/Y are not meaningful; use screen center
  if (document.pointerLockElement === renderer.domElement) {
    objectPointer.set(0, 0);
  } else {
    objectPointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    objectPointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }
}

function pickObject(event) {
  updatePointerFromEvent(event);
  objectRaycaster.setFromCamera(objectPointer, camera);
  const candidates = worldGroup.children.filter(
    (o) => !o.userData.isGround && !o.userData.isPlayer
  );
  const hits = objectRaycaster.intersectObjects(candidates, true);
  if (!hits.length) return null;
  // Climb to the top-level worldGroup child for consistent selection
  let obj = hits[0].object;
  while (obj && obj.parent && obj.parent !== worldGroup) {
    obj = obj.parent;
  }
  console.log("pickObject hit", obj?.name || obj?.uuid, "at", hits[0].point);
  return obj;
}

function pickGizmo(event) {
  updatePointerFromEvent(event);
  objectRaycaster.setFromCamera(objectPointer, camera);
  const gizmoHits = objectRaycaster.intersectObject(gizmoGroup, true);
  const hit = Array.isArray(gizmoHits) ? gizmoHits.find((h) => h.object.userData.isGizmo) : null;
  if (hit) {
    console.log("Ray hit gizmo part", hit.object.userData.axis, hit.object, "at", hit.point);
  }
  return hit;
}

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
  // If clicking a gizmo, let axis drag handle it
  const gizmoHit = pickGizmo(event);
  if (gizmoHit) {
    console.log("Mousedown on gizmo collider; suppress placement.");
    event.stopPropagation();
    event.preventDefault();
    return;
  }
  // If an object is under the cursor, defer to selection/drag logic instead of spawning cubes
  const objHit = pickObject(event);
  if (objHit) {
    console.log("Mousedown left on object -> defer to click handler", objHit.name || objHit.uuid);
    return;
  }
  const hit = getGroundPlacementHit(event);
  if (hit) placeObjectOnFloor(hit);
});

// --- Selection & grab interactions ---
renderer.domElement.addEventListener("click", (event) => {
  if (isPaused || draggingAxis) return;
  // ignore gizmo clicks
  if (pickGizmo(event)) {
    console.log("Click landed on gizmo; skipping selection.");
    return;
  }
  const obj = pickObject(event);
  if (obj) {
    grabbedObject = null; // single click = precision mode
    selectedObject = obj;
    gizmoGroup.visible = true;
    gizmoGroup.position.copy(obj.getWorldPosition(new THREE.Vector3()));
    console.log("Object single left click -> precision select", obj.name || obj.uuid);
  } else {
    console.log("Click on empty/ground");
  }
});

renderer.domElement.addEventListener("dblclick", (event) => {
  if (isPaused) return;
  if (pickGizmo(event)) {
    console.log("Dblclick on gizmo; ignore grab toggle.");
    return;
  }
  const obj = pickObject(event);
  if (obj) {
    selectedObject = obj;
    grabbedObject = obj;
    gizmoGroup.visible = false;
    // compute initial grab distance
    grabDistance = camera.position.distanceTo(
      obj.getWorldPosition(new THREE.Vector3())
    );
    console.log("Object double left click -> grab", obj.name || obj.uuid, "distance", grabDistance);
  }
});

// Right-click logging for diagnostics
renderer.domElement.addEventListener("contextmenu", (event) => {
  if (isPaused) return;
  event.preventDefault();
  const gizmoHit = pickGizmo(event);
  if (gizmoHit) {
    console.log("Right click on gizmo", gizmoHit.object.userData.axis);
    return;
  }
  const obj = pickObject(event);
  if (obj) {
    console.log("Object right click", obj.name || obj.uuid);
  } else {
    console.log("Right click on empty/ground");
  }
});

renderer.domElement.addEventListener("wheel", (event) => {
  if (!grabbedObject) return;
  event.preventDefault();
  grabDistance = Math.max(0.5, grabDistance + event.deltaY * 0.01);
}, { passive: false });

renderer.domElement.addEventListener("pointerdown", (event) => {
  if (isPaused) return;
  const hit = pickGizmo(event);
  if (hit && selectedObject) {
    draggingAxis = hit.object.userData.axis;
    lastDragMouse = { x: event.clientX, y: event.clientY };
    flashAxis(draggingAxis);
    console.log("Gizmo pointerdown on axis:", draggingAxis);
    event.stopPropagation();
    event.preventDefault();
    return;
  }
});

window.addEventListener("pointerup", () => {
  draggingAxis = null;
  lastDragMouse = null;
});

window.addEventListener("pointermove", (event) => {
  if (!draggingAxis || !selectedObject || isPaused) return;
  let dx, dy;
  if (document.pointerLockElement) {
    dx = event.movementX;
    dy = event.movementY;
  } else {
    if (!lastDragMouse) {
      lastDragMouse = { x: event.clientX, y: event.clientY };
      return;
    }
    dx = event.clientX - lastDragMouse.x;
    dy = event.clientY - lastDragMouse.y;
    lastDragMouse = { x: event.clientX, y: event.clientY };
  }

  const pixelToWorld = 0.01;
  const delta = (Math.abs(dx) > Math.abs(dy) ? dx : -dy) * pixelToWorld;

  const objPos = selectedObject.position;
  if (draggingAxis === "x") objPos.x += delta;
  if (draggingAxis === "y") objPos.y += delta;
  if (draggingAxis === "z") objPos.z += delta;

  // keep gizmo aligned
  gizmoGroup.position.copy(selectedObject.getWorldPosition(new THREE.Vector3()));
});

console.info("Virtual world placement: left click the floor to drop a cube when unpaused.");

document.getElementById("resume-btn").addEventListener("click", () => {
  isPaused = false;
  document.getElementById("pause-menu").style.display = "none";
  document.body.requestPointerLock();
});
