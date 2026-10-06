// Nodevision/ApplicationSystem/public/panels/contentPresentationZoom.mjs
// This module registers content-only geometric scale on a runtime shell outside authored content, keeping document chrome and serialization independent.
import { registerPanelZoomCapabilities } from './panelZoomCapabilities.mjs';
export function installContentPresentationZoom(owner, surface, { onZoom = () => {}, fit = null } = {}) {
  let zoom = 1;
  const previous = surface.style.zoom;
  const unregister = registerPanelZoomCapabilities(owner, {
    metadata: { geometric: { actions: ['zoom', 'set', 'reset', ...(fit ? ['fit'] : [])], unit: 'presentation scale' } },
    getState: mode => mode === 'geometric' ? { zoom } : null,
    semantic: false, fisheye: false,
    geometric(command) {
      const next = command.action === 'reset' ? 1 : command.action === 'fit' ? fit?.() : command.zoom ?? zoom * (command.factor || 1);
      if (!Number.isFinite(next) || next <= 0) return false;
      zoom = Math.max(.1, Math.min(8, next));
      surface.style.zoom = String(zoom);
      onZoom(zoom);
      return true;
    }
  });
  return () => { unregister(); surface.style.zoom = previous; };
}
