// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/PNGeditorComponents/analysisTools.mjs
// This adapter mounts the shared PNG analysis tools over the graphical editor's live canvas. It keeps regions in canvas-pixel coordinates and invalidates worker snapshots after edits without adding analysis paths to raster history or saved pixels.
import { installPngAnalysisTools } from '../../../../RasterAnalysis/PngAnalysisTools.mjs';
export function installRasterEditorAnalysis({ wrapper, canvasContainer, canvas, filePath }) {
  const controls = document.createElement('div');
  controls.style.cssText = 'flex:none;max-width:100%;position:relative;z-index:40';
  wrapper.prepend(controls);
  const previousTabIndex = wrapper.getAttribute('tabindex'); wrapper.tabIndex = 0;
  const presentations = new Set(), pixels = new Set();
  let pending = 0, disposed = false;
  const viewport = {
    image: canvas, controls, overlayHost: canvasContainer,
    subscribe(callback) { presentations.add(callback); return () => presentations.delete(callback); },
    subscribePixels(callback) { pixels.add(callback); return () => pixels.delete(callback); },
    alignOverlay(svg) {
      Object.assign(svg.style, { left: `${canvas.offsetLeft}px`, top: `${canvas.offsetTop}px`,
        width: canvas.style.width, height: canvas.style.height, transform: 'none', transformOrigin: '0 0', zIndex: '35' });
    }
  };
  const observer = new ResizeObserver(() => { for (const callback of presentations) callback(); }); observer.observe(canvas);
  const release = installPngAnalysisTools(wrapper, viewport, filePath || 'Untitled PNG');
  return {
    refresh() {
      if (disposed || pending) return;
      pending = requestAnimationFrame(() => { pending = 0; for (const callback of pixels) callback(); });
    },
    dispose() {
      if (disposed) return; disposed = true;
      cancelAnimationFrame(pending); observer.disconnect(); release(); controls.remove(); presentations.clear(); pixels.clear();
      if (previousTabIndex === null) wrapper.removeAttribute('tabindex'); else wrapper.setAttribute('tabindex', previousTabIndex);
    }
  };
}
