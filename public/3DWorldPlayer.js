// Create the player avatar
const playerGeometry = new THREE.BoxGeometry(1, 2, 1);
const playerMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
const player = new THREE.Mesh(playerGeometry, playerMaterial);

// Define heights
const standingHeight = 1.0;
const crouchHeight = 0.5;
let baseHeight = standingHeight;  // current base height for the player

// Set the player's initial position
player.position.y = baseHeight;
scene.add(player);

// Attach the camera to the player (first-person perspective)
player.add(camera);
// Position the camera at eye level (adjust as needed)
camera.position.set(0, 1.5, 0);

const speed = 0.1;
const jumpStrength = 0.3;  // Increased jump strength for better visibility
let velocityY = 0;
let jumpOffset = 0;
let isJumping = false;
let isCrouching = false;

// We'll now use "J" for jump instead of space.
function updatePlayerMovement() {
  if (isPaused) return;
  
  // Movement: Calculate forward and right vectors based on player's orientation
  const forward = new THREE.Vector3(0, 0, -1);
  forward.applyQuaternion(player.quaternion);
  
  const right = new THREE.Vector3(1, 0, 0);
  right.applyQuaternion(player.quaternion);
  
  if (keys.w) player.position.addScaledVector(forward, speed);
  if (keys.s) player.position.addScaledVector(forward, -speed);
  if (keys.a) player.position.addScaledVector(right, -speed);
  if (keys.d) player.position.addScaledVector(right, speed);
  
  // Jump logic using the "J" key
  if (keys.j && !isJumping && !isCrouching) {
    velocityY = jumpStrength;
    isJumping = true;
    // Optionally log for debugging:
    // console.log("Jump initiated!");
  }
  
  if (isJumping) {
    jumpOffset += velocityY;
    velocityY -= 0.02;  // Gravity effect
    if (jumpOffset <= 0) {
      jumpOffset = 0;
      velocityY = 0;
      isJumping = false;
    }
  }
  
  // Crouch logic using the "Q" key (unchanged)
  if (keys.q && !isJumping) {
    if (!isCrouching) {
      isCrouching = true;
      baseHeight = crouchHeight;
    }
  } else {
    if (isCrouching) {
      isCrouching = false;
      baseHeight = standingHeight;
    }
  }
  
  // Update the player's vertical position based on the base height and jump offset
  player.position.y = baseHeight + jumpOffset;
}
