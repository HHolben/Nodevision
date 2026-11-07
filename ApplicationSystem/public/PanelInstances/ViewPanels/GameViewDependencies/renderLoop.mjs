// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/renderLoop.mjs
// This file runs the animation loop and renders each frame.

import { createTerrainFrameSampler } from '../../../MetaWorld/TerrainDiagnostics/Frames.mjs';
import { createVoxelEnvironmentLighting } from './voxelEnvironmentLighting.mjs';
import { installWorldAstronomy } from './worldAstronomy.mjs';
import { installWorldWeather } from './worldWeather.mjs';

export function startRenderLoop(renderer, scene, cameraOrResolver, update) {
  let running = true;
  const sampleFrame = createTerrainFrameSampler();
  const weather = installWorldWeather(scene);
  const astronomy = installWorldAstronomy(scene);
  let voxelLighting = null;
  const state = window.__nodevisionGameLoopState || { active: 0, nextId: 1 };
  window.__nodevisionGameLoopState = state;
  const loopId = state.nextId++;
  state.active += 1;
  console.log(`[GameView] render loop start id=${loopId} active=${state.active}`);
  function animate() {
    if (!running) return;
    requestAnimationFrame(animate);
    const measuring = window.NodevisionState?.fpsOverlayVisible || window.VRWorldContext?.terrainDiagnosticsEnabled;
    const start = measuring ? performance.now() : 0;
    astronomy.prepare();
    if (update) update();
    const activeCamera = typeof cameraOrResolver === "function"
      ? cameraOrResolver()
      : cameraOrResolver;
    astronomy.update(activeCamera);
    weather.update(activeCamera);
    const context = window.VRWorldContext;
    if (!voxelLighting && context?.THREE) voxelLighting = createVoxelEnvironmentLighting(context.THREE, scene);
    voxelLighting?.update(context);
    if (activeCamera) renderer.render(scene, activeCamera);
    sampleFrame(context, start, measuring ? performance.now() - start : 0, measuring);
  }
  animate();
  return () => {
    if (!running) return;
    running = false;
    weather.dispose();
    astronomy.dispose();
    voxelLighting?.dispose();
    state.active = Math.max(0, state.active - 1);
    console.log(`[GameView] render loop stop id=${loopId} active=${state.active}`);
  };
}
