// Nodevision/ApplicationSystem/public/RasterAnalysis/GrayscaleAnalysisSession.mjs
// This adapter owns analysis layers and pointer-transparent raster masks for one image session. It shares the image overlay's exact presentation transform while keeping analytical dependencies independent of overlay order.
import { createAnalysisLayers } from './AnalysisLayers.mjs';
import { mountAnalysisLayerControls } from './GrayscaleLayerControls.mjs';
export function installGrayscaleAnalysis({ analysis, svg, viewport, request, showPanel }) {
  const store = createAnalysisLayers(), canvases = new Map();
  analysis.layers = store.layers; analysis.layerResults = [];
  let baseZ = Number(svg.style.zIndex) || 1;
  function align() {
    // The canvas adapter may reset the SVG's z-index on each layout update.
    if (viewport.alignOverlay) { viewport.alignOverlay(svg); baseZ = Number(svg.style.zIndex) || 1; }
    if (viewport.controls) viewport.controls.style.zIndex = String(baseZ + store.layers.length + 1);
    for (const layer of store.layers) {
      const node = layer.type === 'region' ? svg.firstElementChild : canvases.get(layer.id);
      if (!node) continue;
      if (layer.type === 'region') {
        node.style.display = layer.visible && layer.enabled ? '' : 'none'; svg.style.zIndex = String(baseZ + layer.order);
      } else {
        node.style.cssText = svg.style.cssText;
        node.style.imageRendering = 'pixelated';
        node.style.pointerEvents = 'none'; node.style.zIndex = String(baseZ + layer.order);
        node.hidden = !layer.enabled || !layer.visible || !analysis.layerResults.find(item => item.id === layer.id)?.available;
      }
    }
    if (!store.layers.some(layer => layer.type === 'region')) svg.firstElementChild.style.display = 'none';
  }
  function receive(results) {
    // Canvas owns the rendered copy; do not retain full RGBA buffers in panel state.
    analysis.layerResults = results.map(({ rgba, ...result }) => result);
    for (const result of results) {
      const layer = store.layers.find(item => item.id === result.id);
      if (!layer || !result.rgba) continue;
      let canvas = canvases.get(result.id);
      if (!canvas) { canvas = document.createElement('canvas'); canvas.dataset.analysisLayer = result.id; svg.parentElement.append(canvas); canvases.set(result.id, canvas); }
      const [,, width, height] = svg.getAttribute('viewBox').split(' ').map(Number);
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
      canvas.getContext('2d').putImageData(new ImageData(result.rgba, width, height), 0, 0);
    }
    align(); analysis.renderLayers?.();
  }
  const unsubscribe = store.subscribe(kind => {
    for (const [id, canvas] of canvases) if (!store.layers.some(layer => layer.id === id)) { canvas.remove(); canvases.delete(id); }
    align();
    // Hidden masks may have changed; rendering caches avoid repainting unchanged visible layers.
    request();
    analysis.renderLayers?.();
  });
  let dimensions = svg.getAttribute('viewBox');
  const unwatch = viewport.subscribe(() => {
    align(); const next = svg.getAttribute('viewBox');
    if (next !== dimensions) { dimensions = next; if (store.layers.some(layer => layer.type === 'grayscale')) request(); }
  });
  function add() {
    let name = 'Grayscale Analysis';
    for (let n = 2; store.layers.some(layer => layer.name === name); n++) name = `Grayscale Analysis ${n}`;
    const gray = store.add('grayscale', { lower: 0, upper: 100, mode: 'highlight', color: '#ffcc00', opacity: .45 }, name);
    store.add('intersection', { inputs: [gray.id, 'regions'], mode: 'highlight', color: '#00bfff', opacity: .45 }, `${name} AND region`);
  }
  analysis.mountLayers = container => mountAnalysisLayerControls(container, analysis, store, add);
  analysis.analysisLayers = store;
  return {
    receive, align, ensureRegion: store.ensureRegion,
    open() { if (!store.layers.some(layer => layer.type === 'grayscale')) add(); showPanel(); },
    invalidate() { analysis.layerResults = []; for (const canvas of canvases.values()) canvas.remove(); canvases.clear(); analysis.renderLayers?.(); },
    dispose() { unwatch(); unsubscribe(); store.dispose(); for (const canvas of canvases.values()) canvas.remove(); canvases.clear(); analysis.renderLayers = null; analysis.mountLayers = null; }
  };
}
