// Nodevision/public/PanelInstances/ViewPanels/GameViewDependencies/renderLoop.mjs
// This file runs the animation loop and renders each frame.

export function startRenderLoop(renderer, scene, cameraOrResolver, update) {
  let running = true;
  function animate() {
    if (!running) return;
    requestAnimationFrame(animate);
    if (update) update();
    const activeCamera = typeof cameraOrResolver === "function"
      ? cameraOrResolver()
      : cameraOrResolver;
    if (activeCamera) renderer.render(scene, activeCamera);
  }
  animate();
  return () => { running = false; };
}
