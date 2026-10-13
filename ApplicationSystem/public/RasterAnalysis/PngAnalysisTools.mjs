// Nodevision/ApplicationSystem/public/RasterAnalysis/PngAnalysisTools.mjs
// This module attaches composable region and grayscale analysis to a raster viewport and opens results through the existing floating panel factory. Image-local coordinates preserve alignment under pan, rotation, and zoom, while the editing-context store preserves analysis without changing source pixels.
import { createImageAnalysisWorkerClient } from './ImageAnalysisWorkerClient.mjs';
import { installAnalysisSessionState } from './AnalysisSessionState.mjs';
import { installGrayscaleAnalysis } from './GrayscaleAnalysisSession.mjs';
import { installVectorAnalysisTools } from './VectorAnalysisTools.mjs';
import { registerAnalysisTools } from './AnalysisToolsContext.mjs';
import { updateToolbarState, showToolbarSubToolbar, hideToolbarSubToolbar } from '../panels/createToolbar.mjs';
import { paintAnalysisRegions } from './AnalysisRegionOverlay.mjs';
import { createAnalysisPolygonTool } from './AnalysisPolygonTool.mjs';
const ns = 'http://www.w3.org/2000/svg';
const defaultPanel = async (...args) => (await import('../panels/panelFactory.mjs')).createPanelDOM(...args);
export function installPngAnalysisTools(host, viewport, filename, createPanel = defaultPanel) {
  const img = viewport.image, regions = [], analysis = { regions };
  const width = () => img.naturalWidth ?? img.width;
  const height = () => img.naturalHeight ?? img.height;
  const maskId = `png-analysis-mask-${crypto.randomUUID()}`;
  let operation = 'base', drawing = false, panel = null, opening = null, disposed = false;
  const menu = document.createElement('div'), bar = document.createElement('div');
  menu.hidden = true; menu.id = `png-analysis-tools-${crypto.randomUUID()}`;
  menu.dataset.pngAnalysis = ''; bar.setAttribute('role', 'toolbar'); bar.setAttribute('aria-label', 'Image analysis');
  Object.assign(menu.style, { background: 'var(--panel-background, Canvas)', color: 'var(--panel-color, CanvasText)', padding: '0', width: '100%' });
  Object.assign(bar.style, { display: 'flex', flexWrap: 'wrap', gap: '4px' });
  const status = document.createElement('p'); status.setAttribute('role', 'status'); status.textContent = 'Select Region, then click polygon vertices.';
  status.style.margin = '4px 0 0';
  menu.append(bar, status);
  const svg = document.createElementNS(ns, 'svg'), shapes = document.createElementNS(ns, 'g');
  svg.dataset.pngAnalysisOverlay = ''; svg.setAttribute('aria-label', 'Image analysis paths'); svg.append(shapes);
  Object.assign(svg.style, { position: 'absolute', left: '50%', top: '50%', transformOrigin: 'center', pointerEvents: 'none', color: 'var(--selection-color, #0078d7)', zIndex: '1' });
  (viewport.overlayHost || host).append(svg);
  function align() {
    svg.setAttribute('viewBox', `0 0 ${width() || 1} ${height() || 1}`);
    if (viewport.alignOverlay) { viewport.alignOverlay(svg); return; }
    svg.style.width = img.style.width; svg.style.height = img.style.height; svg.style.transform = img.style.transform;
  }
  const unwatch = viewport.subscribe(align); align();
  let sourceWidth = width(), sourceHeight = height();
  const publish = value => { analysis.latest = value; analysis.render?.(value); };
  async function showPanel() {
    if (disposed || panel?.isConnected) return;
    if (opening) return opening;
    opening = (async () => {
      try {
        const created = await createPanel('PngAnalysis', `png-analysis-${crypto.randomUUID()}`, 'InfoPanel', { analysis, displayName: `Analysis: ${filename}` });
        // Mount and remove together so the factory's removal observer releases shell resources.
        if (disposed) { document.body.append(created.panel); created.panel.remove(); return; }
        panel = created.panel; document.body.append(panel); panel.__nvSetLayout?.('floating');
        Object.assign(panel.style, { left: `${Math.max(8, window.innerWidth - 440)}px`, top: '80px', width: '420px', maxWidth: 'calc(100vw - 16px)', height: '360px', maxHeight: 'calc(100vh - 96px)', boxSizing: 'border-box' });
      } catch (error) { status.textContent = `Could not open analysis: ${error.message}`; }
      finally { opening = null; }
    })();
    return opening;
  }
  const pixels = createImageAnalysisWorkerClient(img, () => ({ width: width(), height: height() }), data => {
    publish(data.result ? { result: data.result } : { message: 'Draw a region to analyze.' });
    grayscale.receive(data.layers);
  }, message => { publish({ message }); status.textContent = message; });
  const request = () => pixels.request(regions, analysis.layers);
  const grayscale = installGrayscaleAnalysis({ analysis, svg, viewport, request, showPanel });
  function calculate() {
    analysis.changed?.();
    if (regions.length) { publish({ message: 'Calculating original-pixel statistics…' }); showPanel(); }
    else publish({ message: 'Draw a region to analyze.' });
    request();
  }
  function paint() {
    paintAnalysisRegions(shapes, regions, width(), height(), maskId);
    for (const button of secondaryButtons) button.disabled = !regions.length;
  }
  function setDrawing(value) { drawing = value; svg.style.pointerEvents = value ? 'auto' : 'none'; svg.style.cursor = value ? 'crosshair' : ''; }
  const tool = createAnalysisPolygonTool(svg, points => {
    grayscale.ensureRegion();
    if (operation === 'base') regions.length = 0;
    regions.push({ operation, points }); setDrawing(false); paint(); calculate(); status.textContent = 'Region complete. Add or subtract another polygon, or select a new region.';
  }, text => { status.textContent = text; });
  function button(label, action) { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.onclick = action; bar.append(b); return b; }
  function start(mode) {
    if (!width()) { status.textContent = 'Wait for the image to load.'; return; }
    vectors.cancel(); operation = mode; tool.cancel(); setDrawing(true); host.focus({ preventScroll: true }); status.textContent = 'Click vertices; Enter or click the first vertex to close. Esc cancels.';
  }
  button('Region', () => start('base'));
  const secondaryButtons = [button('Add polygon', () => start('add')), button('Subtract polygon', () => start('subtract'))];
  button('Finish path', () => { if (drawing) tool.finish(); });
  button('Undo region', () => { vectors.cancel(); tool.cancel(); setDrawing(false); regions.pop(); paint(); calculate(); });
  button('Clear', () => { vectors.cancel(); tool.cancel(); setDrawing(false); regions.length = 0; paint(); calculate();  });
  button('Show results', showPanel); paint();
  const vectors = installVectorAnalysisTools({ host, svg, bar, status, analysis, isVisible: () => menu.isConnected && !menu.hidden && menu.getClientRects().length > 0,
    size: () => ({ width: width(), height: height() }),
    beforeStart() { tool.cancel(); setDrawing(false); },
    useRegion(geometry) {
      grayscale.ensureRegion();
      tool.cancel(); setDrawing(false); regions.length = 0;
      regions.push({ operation: 'base', geometry }); paint(); calculate();
    }
  });
  const unwatchPixels = viewport.subscribePixels?.(() => {
    if (disposed) return;
    pixels.invalidate(); grayscale.invalidate();
    if (width() !== sourceWidth || height() !== sourceHeight) {
      tool.cancel(); setDrawing(false); regions.length = 0;
      vectors.clear();
      sourceWidth = width(); sourceHeight = height(); paint();
      status.textContent = 'Canvas dimensions changed. Draw a new reference region.';
    }
    align();
    calculate();
  });
  const session = installAnalysisSessionState({ filename, viewport, analysis, vectors, paint, calculate });
  const point = event => {
    const matrix = svg.getScreenCTM(); if (!matrix) return null;
    return new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
  };
  const down = event => {
    if (!drawing || event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey) return;
    const p = point(event); if (!p) return;
    if (p.x < 0 || p.y < 0 || p.x > width() || p.y > height()) return;
    event.preventDefault(); event.stopPropagation(); host.focus({ preventScroll: true });
    const first = tool.points[0];
    if (first && tool.points.length >= 3) {
      const screen = new DOMPoint(...first).matrixTransform(svg.getScreenCTM());
      if (Math.hypot(screen.x - event.clientX, screen.y - event.clientY) <= 7) { tool.finish(); return; }
    }
    tool.place({ x: p.x, y: p.y });
  };
  const move = event => { const p = point(event); if (drawing && p) tool.move(p); };
  const key = event => {
    if (!drawing || event.ctrlKey || event.metaKey || event.altKey || event.target.closest?.('button,input,textarea')) return;
    if (event.key === 'Enter') tool.finish();
    else if (event.key === 'Backspace') tool.key('Backspace');
    else if (event.key === 'Escape') { tool.cancel(); setDrawing(false); status.textContent = 'Path cancelled.'; }
    else return;
    event.preventDefault(); event.stopPropagation();
  };
  const deactivate = () => { if (drawing) { tool.cancel(); setDrawing(false); } };
  const doubleClick = event => { if (drawing) { tool.finish(); event.preventDefault(); } };
  window.addEventListener('activePanelChanged', deactivate);
  svg.addEventListener('dblclick', doubleClick);
  const unregisterTools = registerAnalysisTools(host, {
    analysis,
    openGrayscale: () => grayscale.open(),
    id: menu.id, get visible() { return menu.isConnected && !menu.hidden && menu.getClientRects().length > 0; },
    mount(container) {
      if (disposed) return () => {};
      container.append(menu); menu.hidden = false;
      return () => {
        if (menu.parentElement !== container) return;
        menu.hidden = true; menu.remove(); vectors.cancel(); tool.cancel(); setDrawing(false);
      };
    },
    toggle() {
      if (this.visible) {
        menu.hidden = true; vectors.cancel(); tool.cancel(); setDrawing(false);
        hideToolbarSubToolbar('Analysis Tools');
      } else showToolbarSubToolbar('Analysis Tools', { force: true, toggle: false });
    }
  });
  updateToolbarState({});
  svg.addEventListener('pointerdown', down); svg.addEventListener('pointermove', move); host.addEventListener('keydown', key, true);
  return () => {
    if (disposed) return; disposed = true; session.dispose(); unregisterTools(); pixels.dispose(); grayscale.dispose(); unwatch(); unwatchPixels?.(); vectors.dispose(); tool.dispose();
    window.removeEventListener('activePanelChanged', deactivate);
    host.removeEventListener('keydown', key, true); svg.remove(); menu.remove(); panel?.remove(); analysis.render = null;
  };
}
