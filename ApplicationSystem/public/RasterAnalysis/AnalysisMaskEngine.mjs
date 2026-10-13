// Nodevision/ApplicationSystem/public/RasterAnalysis/AnalysisMaskEngine.mjs
// This worker-side evaluator caches luma, region coverage, and layer masks independently of visual stacking. Explicit AND inputs can reference any mask-producing layer, including other intersections, with cycle and disabled-input protection.
import { regionRow } from './PolygonStatistics.mjs';
import { cacheLuma, thresholdMask, intersectMasks, countMask, maskVisualization } from './PixelMasks.mjs';
export function createAnalysisMaskEngine(pixels) {
  let luma, eligible, regionKey, regionMask;
  const cache = new Map(), rendered = new Map();
  const counts = new WeakMap();
  const count = mask => {
    if (!mask) return null;
    if (!counts.has(mask)) counts.set(mask, countMask(mask));
    return counts.get(mask);
  };
  function getRegion(regions) {
    const key = JSON.stringify(regions); if (key === regionKey) return regionMask;
    regionKey = key; regionMask = null;
    if (!regions.length) return null;
    regionMask = new Uint8Array(pixels.width * pixels.height);
    for (let y = 0; y < pixels.height; y++) {
      const row = regionRow(regions[0], y + .5, pixels.width);
      for (const region of regions.slice(1)) {
        const next = regionRow(region, y + .5, pixels.width);
        for (let x = 0; x < row.length; x++) if (next[x]) row[x] = Number(region.operation === 'add');
      }
      regionMask.set(row, y * pixels.width);
    }
    return regionMask;
  }
  return function evaluate(layers, regions, redraw = false) {
    if (!luma) { luma = cacheLuma(pixels); eligible = count(luma.eligible); }
    if (redraw) rendered.clear();
    const outputs = new Map(), resolving = new Set();
    for (const id of rendered.keys()) if (!layers.some(layer => layer.id === id)) rendered.delete(id);
    for (const id of cache.keys()) if (!layers.some(layer => layer.id === id)) cache.delete(id);
    function resolve(id) {
      if (outputs.has(id)) return outputs.get(id);
      const layer = layers.find(item => item.id === id);
      if (!layer?.enabled || resolving.has(id)) return null;
      resolving.add(id);
      let mask = null;
      if (layer.type === 'region') mask = getRegion(regions);
      else if (layer.type === 'grayscale') {
        const key = JSON.stringify([layer.config.lower, layer.config.upper]);
        if (cache.get(id)?.key !== key) cache.set(id, { key, mask: thresholdMask(luma, layer.config.lower, layer.config.upper) });
        mask = cache.get(id).mask;
      } else if (layer.type === 'intersection') {
        const inputs = (layer.config.inputs || []).map(resolve), prior = cache.get(id);
        if (!prior || prior.inputs?.length !== inputs.length || inputs.some((input, i) => input !== prior.inputs[i])) cache.set(id, { inputs, mask: intersectMasks(inputs) });
        mask = cache.get(id).mask;
      }
      resolving.delete(id); outputs.set(id, mask); return mask;
    }
    return layers.map(layer => {
      const mask = resolve(layer.id), selected = count(mask);
      const region = layer.type === 'intersection' ? (layer.config.inputs || []).map(id => layers.find(item => item.id === id)).find(input => input?.type === 'region') : null;
      const regionCount = region ? count(resolve(region.id)) : null;
      const visualKey = JSON.stringify([layer.config.mode, layer.config.color, layer.config.opacity]);
      const previous = rendered.get(layer.id);
      const changed = mask && layer.visible && layer.type !== 'region' && (previous?.mask !== mask || previous?.key !== visualKey);
      if (changed) rendered.set(layer.id, { mask, key: visualKey });
      if (!mask) rendered.delete(layer.id);
      return { id: layer.id, count: selected, eligible, regionCount, available: mask !== null,
        percentage: selected === null || !eligible ? null : selected / eligible * 100,
        regionPercentage: selected === null || !regionCount ? null : selected / regionCount * 100,
        rgba: changed ? maskVisualization(mask, pixels, layer.config) : null };
    });
  };
}
