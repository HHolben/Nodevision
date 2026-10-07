// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/worldWeather.mjs
// This adapter gives the shared Game View environment weather ownership using its existing world definition, active atmosphere and simulation clock.
import { createWorldWeatherController } from '/MetaWorld/Weather/WorldWeatherController.mjs';
export function installWorldWeather(scene) {
  let owner = null, controller = null;
  return {
    update(camera) {
      const current = window.VRWorldContext;
      if (current?.scene === scene) owner = current;
      if (!owner || !camera) return;
      if (!controller) {
        controller = createWorldWeatherController(owner.THREE, scene, { onError: error => console.warn('Weather atmosphere unavailable:', error) });
        owner.weatherController = controller;
      }
      const world = owner.currentWorldDefinition ?? owner.state?.currentWorldDefinition ?? {};
      const environment = owner.movementState?.environment ?? world.environment ?? world.metadata?.environment ?? {};
      const time = owner.temporalController?.getTimeSeconds?.() ?? 0;
      controller.update(world, environment, camera.position, time, owner.movementState?.paused || current !== owner);
    },
    dispose() {
      controller?.dispose();
      if (owner?.weatherController === controller) delete owner.weatherController;
      controller = null; owner = null;
    }
  };
}
