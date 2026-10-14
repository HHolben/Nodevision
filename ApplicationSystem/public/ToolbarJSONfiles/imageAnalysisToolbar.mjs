// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/imageAnalysisToolbar.mjs
// This standard subtoolbar widget mounts the active image's analysis controls in the shared toolbar row. It releases listeners and unfinished gestures when the toolbar is replaced or its owning panel changes.
import { getActiveAnalysisTools } from '../RasterAnalysis/AnalysisToolsContext.mjs';
export function initToolbarWidget(host) {
  if (!host) return;
  if (!host.isConnected) {
    queueMicrotask(() => { if (host.isConnected) initToolbarWidget(host); });
    return;
  }
  host.classList.add('nv-image-analysis-toolbar');
  let current = null, release = null;
  function refresh() {
    if (!host.isConnected) { dispose(); return; }
    const next = getActiveAnalysisTools();
    if (next === current) return;
    release?.(); release = null; current = next;
    host.replaceChildren(); host.hidden = !next;
    host.style.display = next ? 'contents' : 'none';
    if (next) release = next.mount(host);
  }
  function dispose() {
    release?.(); release = null; current = null;
    observer.disconnect();
    window.removeEventListener('activePanelChanged', refresh);
    window.removeEventListener('nv-analysis-tools-changed', refresh);
  }
  const observer = new MutationObserver(() => {
    if (!host.isConnected) queueMicrotask(() => { if (!host.isConnected) dispose(); });
  });
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('activePanelChanged', refresh);
  window.addEventListener('nv-analysis-tools-changed', refresh);
  refresh();
}
