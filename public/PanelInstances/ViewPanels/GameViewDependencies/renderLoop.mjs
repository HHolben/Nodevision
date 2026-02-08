// Nodevision/public/PanelInstances/ViewPanels/GameViewDependencies/renderLoop.mjs
// This file runs the animation loop and renders each frame.

export function startRenderLoop(renderer, scene, camera, update) {
  let running = true;
  function animate() {
    if (!running) return;
    requestAnimationFrame(animate);
    if (update) update();
    renderer.render(scene, camera);
  }
  animate();
  return () => { running = false; };
}
