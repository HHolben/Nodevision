// Exercise real GameView startup, GPU failure recovery, and lazy inspector preview.
const result = document.getElementById('result');
const ok = (value, label) => { if (!value) throw new Error(label); };
const tick = () => new Promise(resolve => setTimeout(resolve, 20));
async function until(check, label) {
  for (let i = 0; i < 100; i++) { if (check()) return; await tick(); }
  throw new Error('Timed out: ' + label);
}
const unhandled = [];
window.addEventListener('unhandledrejection', event => unhandled.push(event.reason));
window.addEventListener('error', event => unhandled.push(event.error || event.message));
try {
  window.NodevisionState = { currentMode: 'Virtual World Editing', virtualWorldMode: 'creative' };
  const { setupPanel } = await import('/PanelInstances/ViewPanels/GameView.mjs');
  const { createDefaultHtmlWorld } = await import('/MetaWorld/DefaultHtmlWorld.mjs');
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (url, options) => {
    if (String(url) === '/api/load-world') return Promise.resolve(new Response(JSON.stringify({ worldDefinition: createDefaultHtmlWorld('page.html') })));
    if (String(url).includes('GameControllerSettings.json')) return Promise.resolve(new Response('{}'));
    return nativeFetch(url, options);
  };
  const panel = document.getElementById('viewer');
  panel.className = 'panel-cell';
  panel.dataset.id = 'GameView';
  window.activeCell = panel;
  const nativeGetContext = HTMLCanvasElement.prototype.getContext;
  let deny = true;
  let rejectAntialias = false;
  const acquired = new Set();
  HTMLCanvasElement.prototype.getContext = function(type, attrs) {
    if (/webgl/.test(type)) {
      if (deny || (rejectAntialias && attrs?.antialias)) {
        this.dispatchEvent(new WebGLContextEvent('webglcontextcreationerror', { statusMessage: 'Simulated GPU startup failure' }));
        return null;
      }
      const context = nativeGetContext.call(this, type, attrs);
      if (context) acquired.add(this);
      return context;
    }
    return nativeGetContext.call(this, type, attrs);
  };
  await setupPanel(panel, { filePath: 'page.html' });
  await until(() => panel.querySelector('.gameview-startup-error'), 'failure screen');
  ok(panel.textContent.includes('3D graphics unavailable'), 'explains graphics failure');
  ok(panel.textContent.includes('Simulated GPU startup failure'), 'retains diagnostic');
  ok(!window.VRWorldContext && !panel._vrRenderer, 'failed startup has no engine');
  ok(!window.layersOpened, 'does not open layers for failed startup');
  panel.querySelector('button').click();
  await until(() => panel.querySelector('button')?.textContent === 'Retry', 'failed retry resets button');
  deny = false;
  rejectAntialias = true;
  panel.querySelector('button').click();
  await until(() => window.VRWorldContext?.objects?.length === 2 && window.layersOpened, 'retry loads real world');
  ok(!panel.querySelector('.gameview-startup-error'), 'successful retry clears error');
  ok(acquired.size === 1, 'startup allocates only the main context');
  ok(panel._vrRenderer.getContext().getContextAttributes().antialias === false, 'real context works without antialiasing');
  const { checkEquationPanel } = await import('./equation-panel-browser.mjs');
  await checkEquationPanel(panel);
  const { checkRuntimePause } = await import('./world-runtime-pause-browser.mjs');
  await checkRuntimePause(panel);
  const target = window.VRWorldContext.objects.find(o => o.userData.nvType === 'iframe');
  deny = true;
  ok(panel._vrObjectInspector.inspectTarget(target), 'inspector works when preview context fails');
  ok(document.body.textContent.includes('3D preview unavailable'), 'preview failure has local feedback');
  ok(window.VRWorldContext?.panel === panel && panel._vrRenderer, 'preview failure preserves main engine');
  deny = false;
  panel._vrObjectInspector.refreshActiveTarget();
  ok(acquired.size === 2, 'preview retries on refresh');
  const mainContext = panel._vrRenderer.getContext();
  const previewCanvas = [...acquired].find(canvas => canvas !== panel._vrRenderer.domElement);
  const previewContext = nativeGetContext.call(previewCanvas, 'webgl2');
  panel.cleanup();
  ok(mainContext.isContextLost() && previewContext.isContextLost(), 'cleanup releases both GPU contexts');
  ok(!window.VRWorldContext, 'cleanup clears global engine');
  const appendChild = panel.appendChild;
  let partialContext;
  panel.appendChild = function(child) {
    if (child.tagName !== 'CANVAS') {
      partialContext = panel._vrRenderer.getContext();
      throw new Error('Simulated failure after renderer creation');
    }
    return appendChild.call(this, child);
  };
  await setupPanel(panel, { filePath: 'page.html' });
  await until(() => panel.querySelector('.gameview-startup-error'), 'partial initialization failure');
  ok(partialContext.isContextLost() && !panel._vrRenderer && !window.VRWorldContext, 'partial startup releases context and controls');
  ok(panel.textContent.includes('Simulated failure after renderer creation'), 'non-WebGL error retains correct diagnostic');
  panel.appendChild = appendChild;
  panel.cleanup();
  deny = true;
  await setupPanel(panel, { filePath: 'page.html' });
  panel.cleanup();
  await tick();
  ok(!panel.querySelector('.gameview-startup-error') && !window.VRWorldContext, 'closed panel ignores pending startup');
  HTMLCanvasElement.prototype.getContext = nativeGetContext;
  await tick();
  ok(unhandled.length === 0, 'no uncaught errors: ' + unhandled.map(String).join('; '));
  result.textContent = 'PASS: GameView startup failure, retry, antialias fallback, lazy preview, equation tools, shared viewer/editor Escape and temporal pause, and cleanup';
} catch (error) {
  result.textContent = 'FAIL: ' + (error.stack || error);
  console.error(error);
}
