// Nodevision/ApplicationSystem/public/MetaWorld/Weather/WeatherRuntime.mjs
// This runtime owns weather simulation time and cloud resources while consuming an external paused world clock and declared atmosphere capability.
import { createCloudRenderer } from './CloudRenderer.mjs';
export function createWeatherRuntime(THREE, scene, configuration) {
  const state = structuredClone(configuration);
  const renderer = createCloudRenderer(THREE, scene, state);
  let disposed = false, time = 0;
  return { state, renderer, get time() { return time; },
    update(position, simulationTime, paused = false) {
      if (disposed || paused) return;
      time = Number.isFinite(simulationTime) ? simulationTime : time;
      renderer.update(position, time);
    },
    dispose() { if (disposed) return; disposed = true; renderer.dispose(); }
  };
}
