// Create the player avatar
const playerGeometry = new THREE.BoxGeometry(1, 2, 1);
const playerMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
const player = new THREE.Mesh(playerGeometry, playerMaterial);
player.userData.isPlayer = true;

// Define heights
const standingHeight = 1.0;
const crouchHeight = 0.5;
let baseHeight = standingHeight;  // Current base height for the player

// Set the player's initial position
player.position.y = baseHeight;
scene.add(player);

// Attach the camera to the player (first-person perspective)
player.add(camera);
camera.position.set(0, 1.5, 0); // Position the camera at eye level

// Movement variables
const speed = 0.1;
const jumpStrength = 0.3;
let velocityY = 0;
let isJumping = false;
let isCrouching = false;
const gravity = 0.01; // Gravity constant

// Collision detection function.
// If options.ignoreGround is true, then objects marked as ground (userData.ground === true)
// will be ignored for this collision check.
function checkCollisions(newPosition, options = {}) {
  let collisionDetected = false;
  worldGroup.children.forEach(obj => {
    if (options.ignoreGround && obj.userData.ground) {
      return; // Skip ground objects for horizontal movement checks.
    }
    if (obj.userData.isSolid) {
      const objBB = new THREE.Box3().setFromObject(obj);
      const playerBB = new THREE.Box3().setFromObject(player);
      // Create a new bounding box for the potential new position:
      const newBB = playerBB.clone().translate(newPosition.clone().sub(player.position));
      if (newBB.intersectsBox(objBB)) {
        collisionDetected = true;
      }
    }
  });
  return collisionDetected;
}

// Player movement update function
function updatePlayerMovement() {
  if (isPaused) return;

  // ===== Horizontal Movement =====
  let horizontalMove = new THREE.Vector3();
  if (keys.w) horizontalMove.z -= speed;
  if (keys.s) horizontalMove.z += speed;
  if (keys.a) horizontalMove.x -= speed;
  if (keys.d) horizontalMove.x += speed;
  horizontalMove.applyQuaternion(player.quaternion);

  // Compute new horizontal position (x and z only)
  let newHorizontalPos = player.position.clone();
  newHorizontalPos.x += horizontalMove.x;
  newHorizontalPos.z += horizontalMove.z;

  // For horizontal movement, ignore collisions with ground objects
  if (!checkCollisions(newHorizontalPos, { ignoreGround: true })) {
    player.position.x = newHorizontalPos.x;
    player.position.z = newHorizontalPos.z;
  }

  // ===== Vertical Movement (Jump & Gravity) =====
  // Initiate jump if "J" is pressed and not already jumping
  if (keys.j && !isJumping) {
    isJumping = true;
    velocityY = jumpStrength;
  }

  // Apply gravity to vertical velocity
  velocityY -= gravity;
  let newVerticalPos = player.position.clone();
  newVerticalPos.y += velocityY;

  // For vertical movement, check collisions normally (including ground)
  if (!checkCollisions(newVerticalPos)) {
    player.position.y = newVerticalPos.y;
  } else {
    // Collision detected vertically; stop vertical motion.
    velocityY = 0;
    isJumping = false;
    // Snap player to base height if below it.
    if (player.position.y < baseHeight) {
      player.position.y = baseHeight;
    }
  }

  // ===== Crouch Logic using "Q" =====
  if (keys.q && !isJumping) {
    if (!isCrouching) {
      isCrouching = true;
      baseHeight = crouchHeight;
      player.scale.y = 0.5; // Optionally scale down the player model
    }
  } else {
    if (isCrouching) {
      isCrouching = false;
      baseHeight = standingHeight;
      player.scale.y = 1.0;
    }
  }
}
