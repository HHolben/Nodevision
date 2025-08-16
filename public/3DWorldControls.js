//Nodevision/public/3DWorldControls.js
// Define the keys object with "j" for jump (instead of "space")
const keys = { w: false, a: false, s: false, d: false, j: false, q: false };
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
    targetPitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, targetPitch)); // Prevent flipping
  }
});

function animate() {
  requestAnimationFrame(animate);
  if (!isPaused) {
    // Smoothly update yaw and pitch
    yaw += (targetYaw - yaw);
    pitch += (targetPitch - pitch);
    
    // Apply yaw to the player's body (rotate left/right)
    player.rotation.y = yaw;
    
    // Apply pitch to the camera only (rotate up/down)
    camera.rotation.x = pitch;
    
    updatePlayerMovement();
  }
  renderer.render(scene, camera);
}

animate();

function togglePause() {
  isPaused = !isPaused;
  document.exitPointerLock();
  document.getElementById("pause-menu").style.display = isPaused ? "block" : "none";
}

// Single keydown handler
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    togglePause();
  } else {
    // Use lowercase for consistent key mapping
    const key = event.key.toLowerCase();
    if (key in keys) {
      // Prevent default behavior for the jump key ("j")
      if (key === "j") {
        event.preventDefault();
      }
      keys[key] = true;
    }
  }
});

// Single keyup handler
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

  // Send request to load new world
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

