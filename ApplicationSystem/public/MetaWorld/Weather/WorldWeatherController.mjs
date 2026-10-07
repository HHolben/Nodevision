// Nodevision/ApplicationSystem/public/MetaWorld/Weather/WorldWeatherController.mjs
// This environment controller reconciles world declarations and active gas materials with an asynchronous, independently owned weather runtime.
import { resolveAtmosphereWeather } from './AtmosphereWeather.mjs';
import { weatherDefinition } from './WeatherState.mjs';
import { createWeatherRuntime } from './WeatherRuntime.mjs';
export function createWorldWeatherController(THREE, scene, options = {}) {
  let runtime = null, key = '', revision = 0, disposed = false, ready = Promise.resolve();
  function reconcile(world, environment) {
    const configuration = weatherDefinition(world);
    const nextKey = JSON.stringify([environment.gasMaterialId, environment.gasMaterialFile, configuration]);
    if (nextKey === key || disposed) return;
    key = nextKey;
    const request = ++revision;
    runtime?.dispose(); runtime = null;
    if (!configuration.enabled || configuration.cloudCoverage === 0) return;
    ready = resolveAtmosphereWeather(environment, options).then(supported => {
      if (disposed || request !== revision || !supported) return;
      runtime = createWeatherRuntime(THREE, scene, configuration);
    }).catch(error => {
      if (!disposed && request === revision) options.onError?.(error);
    });
  }
  return {
    get runtime() { return runtime; }, get ready() { return ready; },
    update(world, environment, position, time, paused = false) {
      if (disposed) return;
      reconcile(world ?? {}, environment ?? {});
      runtime?.update(position, time, paused);
    },
    dispose() { if (disposed) return; disposed = true; revision++; runtime?.dispose(); runtime = null; }
  };
}
