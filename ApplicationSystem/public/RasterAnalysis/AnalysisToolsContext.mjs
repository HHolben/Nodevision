// Nodevision/ApplicationSystem/public/RasterAnalysis/AnalysisToolsContext.mjs
// This registry resolves analysis controls through the existing active-panel ownership rules. Each raster surface owns its visibility state, so a View menu command cannot open another document's tools.
import { getActivePanelElement } from '../panels/panelZoomPanParts/ownership.mjs';
const contexts = new Map();
export function registerAnalysisTools(host, context) {
  contexts.set(host, context);
  return () => { if (contexts.get(host) === context) contexts.delete(host); };
}
export function getActiveAnalysisTools() {
  const active = getActivePanelElement();
  const connected = [...contexts].filter(([host]) => host.isConnected);
  if (active) return connected.find(([host]) => active === host || active.contains(host))?.[1] || null;
  const focused = connected.find(([host]) => host.contains(document.activeElement));
  return focused?.[1] || (connected.length === 1 ? connected[0][1] : null);
}
