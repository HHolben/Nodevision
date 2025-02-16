function animate() {
    requestAnimationFrame(animate);
    if (!isPaused) {
      yaw += (targetYaw - yaw) * smoothingFactor;
      pitch += (targetPitch - pitch) * smoothingFactor;
      camera.rotation.set(pitch, yaw, 0);
      player.rotation.y = yaw;
      updatePlayerMovement(keys);
    }
    renderer.render(scene, camera);
  }
  
  animate();
  