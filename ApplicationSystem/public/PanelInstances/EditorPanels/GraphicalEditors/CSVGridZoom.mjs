// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/CSVGridZoom.mjs
// This module scales a native CSV surface containing cells and range overlays without reflowing the table or changing document history on each gesture.
import { registerPanelZoomCapabilities } from '/panels/panelZoomCapabilities.mjs';
export function installCsvGridZoom(owner, wrapper, refresh) {
  const surface = wrapper.querySelector('.nv-csv-grid-surface');
  const spacer = document.createElement('div');
  spacer.style.pointerEvents = 'none'; wrapper.append(spacer);
  let zoom = 1;
  surface.style.position = 'absolute';
  const layout = () => {
    surface.style.transform = `scale(${zoom})`;
    spacer.style.width = `${surface.offsetWidth * zoom}px`;
    spacer.style.height = `${surface.offsetHeight * zoom}px`;
    refresh();
  };
  const resize = new ResizeObserver(layout); resize.observe(surface);
  const release = registerPanelZoomCapabilities(owner, {
    metadata: { geometric: { actions: ['zoom', 'set', 'reset'], unit: 'grid scale' } },
    semantic: false, fisheye: false,
    getState: mode => mode === 'geometric' ? { zoom } : null,
    geometric(command) {
      const next = command.action === 'reset' ? 1 : command.zoom ?? zoom * (command.factor || 1);
      if (!Number.isFinite(next) || next <= 0) return false;
      zoom = Math.max(.1, Math.min(8, next)); layout(); return true;
    }
  });
  layout();
  return () => { release(); resize.disconnect(); spacer.remove(); surface.style.position = 'relative'; surface.style.transform = ''; };
}
export function csvOverlayGeometry(surface, first, last) {
  const root = surface.getBoundingClientRect();
  const scaleX = root.width / surface.offsetWidth || 1, scaleY = root.height / surface.offsetHeight || 1;
  return { left: (first.left - root.left) / scaleX + surface.scrollLeft - surface.clientLeft,
    top: (first.top - root.top) / scaleY + surface.scrollTop - surface.clientTop,
    width: (last.right - first.left) / scaleX, height: (last.bottom - first.top) / scaleY };
}
