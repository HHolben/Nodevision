// Nodevision/ApplicationSystem/public/RasterAnalysis/AnalysisLayers.mjs
// This session-owned registry separates visual order from explicit analytical dependencies. Missing or disabled inputs invalidate intersections instead of silently substituting an unrestricted mask.
import { normalizeThresholds } from './PixelMasks.mjs';
function configuration(type, config = {}) {
  if (type === 'region') return { ...config };
  const result = { mode: 'highlight', color: '#ffcc00', opacity: .45, ...config };
  if (type === 'grayscale') Object.assign(result, normalizeThresholds(config.lower, config.upper));
  if (type === 'intersection') result.inputs = Array.isArray(config.inputs) ? [...new Set(config.inputs)] : [];
  return result;
}
export function createAnalysisLayers() {
  const layers = [{ id: 'regions', type: 'region', name: 'Vector region', enabled: true, visible: true, order: 0, config: {} }];
  const listeners = new Set();
  const emit = kind => { layers.forEach((layer, order) => { layer.order = order; }); for (const listener of listeners) listener(kind); };
  return {
    layers,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    add(type, config = {}, name = type) {
      const layer = { id: crypto.randomUUID(), type, name, enabled: true, visible: type !== 'intersection', order: layers.length, config: configuration(type, config) };
      layers.splice(Math.max(0, layers.length - 1), 0, layer); emit('analysis'); return layer;
    },
    update(id, patch) {
      const layer = layers.find(item => item.id === id); if (!layer) return;
      Object.assign(layer, patch, { id: layer.id, type: layer.type, config: configuration(layer.type, { ...layer.config, ...patch.config }) });
      const keys = Object.keys(patch);
      emit(keys.every(key => ['visible', 'name'].includes(key)) ? 'visual' : 'analysis');
    },
    move(id, delta) {
      const index = layers.findIndex(layer => layer.id === id); if (index < 0) return;
      const target = Math.max(0, Math.min(layers.length - 1, index + delta));
      layers.splice(target, 0, layers.splice(index, 1)[0]); emit('visual');
    },
    remove(id) { const index = layers.findIndex(layer => layer.id === id); if (index >= 0) { layers.splice(index, 1); emit('analysis'); } },
    ensureRegion() {
      if (!layers.some(layer => layer.id === 'regions')) { layers.push({ id: 'regions', type: 'region', name: 'Vector region', enabled: true, visible: true, order: layers.length, config: {} }); emit('analysis'); }
    },
    restore(saved) {
      if (!Array.isArray(saved)) return;
      const ids = new Set();
      const valid = saved.filter(layer => layer && typeof layer.id === 'string' && !ids.has(layer.id) &&
        ['region', 'grayscale', 'intersection'].includes(layer.type) && layer.config && ids.add(layer.id));
      layers.splice(0, layers.length, ...structuredClone(valid).map(layer => ({ ...layer, config: configuration(layer.type, layer.config) }))); emit('analysis');
    },
    dispose() { listeners.clear(); layers.length = 0; }
  };
}
