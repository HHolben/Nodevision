// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/PDF/PDFZoom.mjs
// This module coalesces native PDF page scale changes and serializes page rendering so wheel gestures cannot race canvas render tasks.
import { registerPanelZoomCapabilities, executePanelZoom } from '/panels/panelZoomCapabilities.mjs';
export function installPdfZoom(workspace, render) {
  const initial = workspace.scale;
  let desired = initial, running = false, disposed = false, frame = 0;
  async function flush() {
    frame = 0;
    if (running || disposed) return;
    running = true;
    try {
      do { workspace.scale = desired; await render(workspace); }
      while (!disposed && workspace.scale !== desired);
    } catch (error) { workspace.statusEl.textContent = `Zoom rendering failed: ${error.message}`; }
    finally { running = false; }
  }
  const release = registerPanelZoomCapabilities(workspace.root, {
    metadata: { geometric: { actions: ['zoom', 'set', 'reset'], unit: 'page scale' } },
    semantic: false, fisheye: false,
    getState: mode => mode === 'geometric' ? { zoom: desired } : null,
    geometric(command) {
      if (disposed) return false;
      const next = command.action === 'reset' ? initial : command.zoom ?? desired * (command.factor || 1);
      if (!Number.isFinite(next) || next <= 0) return false;
      desired = Math.max(.35, Math.min(3, next));
      if (!frame && !running) frame = requestAnimationFrame(flush);
      return true;
    }
  });
  workspace.zoomBy = factor => executePanelZoom(workspace.root, 'geometric', { action: 'zoom', factor });
  return () => { disposed = true; cancelAnimationFrame(frame); release(); };
}
