// Nodevision/ApplicationSystem/public/RasterAnalysis/PolygonStatisticsWorker.mjs
// This worker retains decoded pixels and reusable masks for region and layered grayscale analysis. Region statistics are cached independently of thresholds, and transferred visualization buffers never mutate source pixels.
import { polygonStatistics } from './PolygonStatistics.mjs';
import { createAnalysisMaskEngine } from './AnalysisMaskEngine.mjs';
let pixels, evaluate, regionKey, result;
self.onmessage = ({ data }) => {
  if (data.pixels) { pixels = data.pixels; evaluate = createAnalysisMaskEngine(pixels); regionKey = undefined; }
  if (!data.regions) return;
  try {
    const key = JSON.stringify(data.regions);
    if (key !== regionKey) { result = polygonStatistics(pixels, data.regions); regionKey = key; }
    const layers = data.layers?.length ? evaluate(data.layers, data.regions, data.redraw) : [];
    self.postMessage({ id: data.id, result, layers }, layers.filter(layer => layer.rgba).map(layer => layer.rgba.buffer));
  } catch (error) { self.postMessage({ id: data.id, error: error.message }); }
};
