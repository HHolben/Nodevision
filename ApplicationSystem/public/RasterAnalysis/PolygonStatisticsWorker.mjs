// Nodevision/ApplicationSystem/public/RasterAnalysis/PolygonStatisticsWorker.mjs
// This worker retains the decoded source pixels and calculates region statistics away from the interface thread. Request identifiers let the viewer ignore results from obsolete selection states.
import { polygonStatistics } from './PolygonStatistics.mjs';
let pixels;
self.onmessage = ({ data }) => {
  if (data.pixels) pixels = data.pixels;
  if (!data.regions) return;
  try { self.postMessage({ id: data.id, result: polygonStatistics(pixels, data.regions) }); }
  catch (error) { self.postMessage({ id: data.id, error: error.message }); }
};
