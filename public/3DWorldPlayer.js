const playerGeometry = new THREE.BoxGeometry(1, 2, 1);
const playerMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
const player = new THREE.Mesh(playerGeometry, playerMaterial);
player.position.y = 1;
scene.add(player);

const speed = 0.1;
const jumpStrength = 0.2;
let velocityY = 0;
let isJumping = false;
let isCrouching = false;

function updatePlayerMovement(keys) {
  // Convert movement direction to camera-relative motion
  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);
  direction.y = 0;
  direction.normalize();

  const right = new THREE.Vector3();
  right.crossVectors(camera.up, direction).normalize();

  if (keys.w) player.position.addScaledVector(direction, speed);
  if (keys.s) player.position.addScaledVector(direction, -speed);
  if (keys.a) player.position.addScaledVector(right, -speed);
  if (keys.d) player.position.addScaledVector(right, speed);

  // Jumping
  if (keys.space && !isJumping) {
    velocityY = jumpStrength;
    isJumping = true;
  }
  player.position.y += velocityY;
  velocityY -= 0.01;
  if (player.position.y <= 1) {
    player.position.y = 1;
    velocityY = 0;
    isJumping = false;
  }

  // Crouching
  if (keys.q) {
    if (!isCrouching) {
      player.scale.y = 0.5;
      player.position.y -= 0.5;
      isCrouching = true;
    }
  } else {
    if (isCrouching) {
      player.scale.y = 1;
      player.position.y += 0.5;
      isCrouching = false;
    }
  }

  // Camera follows player
  camera.position.set(player.position.x, player.position.y + 1.5, player.position.z);
}
