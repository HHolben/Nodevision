// Nodevision/ApplicationSystem/tests/analysisToolbarLayoutBrowser.mjs
// This browser fixture checks the real raster analysis controls under the application's toolbar styles. Geometry assertions catch controls escaping a compact script wrapper, including after narrow-screen wrapping and panel changes.
import { createToolbar } from '/panels/createToolbar.mjs';
import { mountImageViewport } from '/PanelInstances/ViewPanels/FileViewers/ImageViewport.mjs';
import { installPngAnalysisTools } from '/RasterAnalysis/PngAnalysisTools.mjs';
import { getActiveAnalysisTools } from '/RasterAnalysis/AnalysisToolsContext.mjs';
const assert = (value, message) => { if (!value) throw new Error(message); };
const frame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
export async function setup() {
  const stylesheet = document.createElement('link'); stylesheet.rel = 'stylesheet'; stylesheet.href = '/Stylesheets/ToolbarStyles.css';
  await new Promise((resolve, reject) => { stylesheet.onload = resolve; stylesheet.onerror = reject; document.head.append(stylesheet); });
  const global = document.createElement('div'); global.id = 'global-toolbar';
  const sub = document.createElement('div'); sub.id = 'sub-toolbar'; document.body.append(global, sub);
  await createToolbar();
  const host = document.createElement('div'); host.className = 'panel'; host.style.cssText = 'height:320px;width:100%;position:relative'; document.body.append(host);
  window.activeCell = host; window.__nvActivePanelElement = host;
  const img = new Image(); img.src = '/Notebook/test.PNG'; await img.decode();
  const viewport = mountImageViewport(host, img); installPngAnalysisTools(host, viewport, 'toolbar-layout.PNG');
  getActiveAnalysisTools().toggle();
  for (let i = 0; i < 100 && !sub.querySelector('[data-png-analysis]'); i++) await new Promise(resolve => setTimeout(resolve, 10));
  const context = getActiveAnalysisTools();
  context.toggle(); await frame(); assert(!context.visible, 'hiding analysis hides its controls');
  context.toggle();
  for (let i = 0; i < 100 && !context.visible; i++) await new Promise(resolve => setTimeout(resolve, 10));
  assert(sub.querySelectorAll('[data-png-analysis]').length === 1, 'reopening keeps one set of analysis controls');
  window.checkAnalysisToolbarLayout = async () => {
    await frame();
    const buttons = [...sub.querySelectorAll('button')];
    const grayscale = buttons.find(button => button.getAttribute('aria-label') === 'Grayscale Analysis');
    const region = buttons.find(button => button.textContent === 'Region');
    assert(grayscale && region && buttons.length >= 17, 'all analysis controls present');
    const bounds = sub.getBoundingClientRect();
    for (const button of buttons) {
      const rect = button.getBoundingClientRect();
      assert(rect.top >= bounds.top && rect.bottom <= bounds.bottom && rect.left >= bounds.left && rect.right <= bounds.right,
        'analysis button outside true toolbar: ' + (button.textContent || button.title));
    }
    assert(Math.abs(region.getBoundingClientRect().top - grayscale.getBoundingClientRect().top) < 1,
      'Region must start beside Grayscale Analysis in the toolbar row');
    assert(sub.scrollWidth <= sub.clientWidth, 'toolbar must not overflow horizontally');
    assert(getActiveAnalysisTools().visible, 'analysis tools remain available after layout');
    return { width: window.innerWidth, toolbarHeight: bounds.height, buttons: buttons.length };
  };
}
