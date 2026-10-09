// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlEditorZoom.mjs
// This module separates HTML editor magnification from reading reflow using runtime presentation layers outside the authored document. Magnification preserves layout coordinates and pointer anchoring while semantic zoom changes the available reading width.
import { registerPanelZoomCapabilities } from '/panels/panelZoomCapabilities.mjs';

export function installHtmlEditorZoom(owner, viewport, content) {
  const spacer = document.createElement('div');
  const layer = document.createElement('div');
  spacer.style.cssText = 'position:relative;min-width:100%';
  layer.style.cssText = 'position:absolute;left:0;top:0;transform-origin:0 0';
  content.replaceWith(spacer); spacer.append(layer); layer.append(content);
  let geometric = 1, reading = 1, disposed = false;
  const paint = () => {
    if (disposed) return;
    layer.style.width = `${viewport.clientWidth / reading}px`;
    layer.style.zoom = String(reading);
    layer.style.transform = `scale(${geometric})`;
    spacer.style.width = `${layer.offsetWidth * reading * geometric}px`;
    spacer.style.height = `${layer.offsetHeight * reading * geometric}px`;
  };
  const command = (mode, input) => {
    const current = mode === 'geometric' ? geometric : reading;
    const next = input.action === 'reset' ? 1 : input.zoom ?? current * (input.factor || 1);
    if (!Number.isFinite(next) || next <= 0) return false;
    const rect = viewport.getBoundingClientRect();
    const x = (input.clientX ?? rect.left + viewport.clientWidth / 2) - rect.left - viewport.clientLeft;
    const y = (input.clientY ?? rect.top + viewport.clientHeight / 2) - rect.top - viewport.clientTop;
    const px = (viewport.scrollLeft + x) / geometric, py = (viewport.scrollTop + y) / geometric;
    if (mode === 'geometric') geometric = Math.max(.1, Math.min(8, next));
    else reading = Math.max(.5, Math.min(8, next));
    paint();
    if (mode === 'geometric') {
      viewport.scrollLeft = px * geometric - x;
      viewport.scrollTop = py * geometric - y;
    }
    return true;
  };
  const unregister = registerPanelZoomCapabilities(owner, {
    metadata: {
      geometric: { actions: ['zoom', 'set', 'reset'], unit: 'magnification' },
      semantic: { actions: ['zoom', 'set', 'reset'], unit: 'reading scale', continuous: true },
    },
    geometric: input => command('geometric', input),
    semantic: input => command('semantic', input), fisheye: false,
    getState: mode => ({ zoom: mode === 'semantic' ? reading : geometric }),
  });
  const observer = new ResizeObserver(paint);
  observer.observe(viewport); observer.observe(layer);
  paint();
  return () => {
    disposed = true; observer.disconnect(); unregister();
    spacer.replaceWith(content);
  };
}
