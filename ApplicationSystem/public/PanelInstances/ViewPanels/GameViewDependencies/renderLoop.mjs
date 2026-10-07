// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/renderLoop.mjs
// This file runs the animation loop and renders each frame.

import { installWorldAstronomy } from './worldAstronomy.mjs';
import { installWorldWeather } from './worldWeather.mjs';

export function startRenderLoop(renderer, scene, cameraOrResolver, update) {
  let running = true;
  const weather = installWorldWeather(scene);
  const astronomy = installWorldAstronomy(scene);
  const state = window.__nodevisionGameLoopState || { active: 0, nextId: 1 };
  window.__nodevisionGameLoopState = state;
  const loopId = state.nextId++;
  state.active += 1;
  console.log(`[GameView] render loop start id=${loopId} active=${state.active}`);
  function animate() {
    if (!running) return;
    requestAnimationFrame(animate);
    astronomy.prepare();
    if (update) update();
    const activeCamera = typeof cameraOrResolver === "function"
      ? cameraOrResolver()
      : cameraOrResolver;
    astronomy.update(activeCamera);
    weather.update(activeCamera);
    if (activeCamera) renderer.render(scene, activeCamera);
  }
  animate();
  return () => {
    if (!running) return;
    running = false;
    weather.dispose();
    astronomy.dispose();
    state.active = Math.max(0, state.active - 1);
    console.log(`[GameView] render loop stop id=${loopId} active=${state.active}`);
  };
}
