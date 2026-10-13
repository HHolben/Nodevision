// Nodevision/ApplicationSystem/public/RasterAnalysis/AnalysisSessionState.mjs
// This adapter preserves raster analysis configuration in the existing per-file editing context. It saves geometry and explicit layer dependencies, never pixel buffers, and restores geometry only when decoded image dimensions match.
import { getEditingContext, saveEditingContext } from '../EditorAttentionState.mjs';

export function installAnalysisSessionState({ filename, viewport, analysis, vectors, paint, calculate }) {
  const store = analysis.analysisLayers;
  let timer = 0, restored = false, restoring = false;
  const size = () => ({ width: viewport.image.naturalWidth ?? viewport.image.width, height: viewport.image.naturalHeight ?? viewport.image.height });
  function save() {
    clearTimeout(timer); timer = 0;
    if (!restored || !filename) return;
    const panels = getEditingContext(filename)?.panels || {};
    saveEditingContext(filename, { panels: { ...panels, rasterAnalysis: {
      ...size(), layers: store.layers, regions: analysis.regions, annotations: analysis.annotations
    } } });
  }
  function schedule() { if (!restoring && restored) { clearTimeout(timer); timer = setTimeout(save, 250); } }
  function restore() {
    if (restored || !size().width || !size().height) return;
    restored = true;
    const saved = getEditingContext(filename)?.panels?.rasterAnalysis;
    if (!saved || !Array.isArray(saved.layers)) return;
    restoring = true;
    if (saved.width === size().width && saved.height === size().height) {
      analysis.regions.splice(0, analysis.regions.length, ...(saved.regions || []));
      vectors.restore(saved.annotations || []);
    }
    store.restore(saved.layers); paint(); calculate(); restoring = false;
  }
  const unwatch = viewport.subscribe(restore), unsubscribe = store.subscribe(schedule);
  analysis.changed = schedule;
  window.addEventListener('pagehide', save);
  restore();
  return { schedule, dispose() { save(); unwatch(); unsubscribe(); window.removeEventListener('pagehide', save); analysis.changed = null; } };
}
