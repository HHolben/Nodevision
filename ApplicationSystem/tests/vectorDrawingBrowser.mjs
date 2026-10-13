// Nodevision/ApplicationSystem/tests/vectorDrawingBrowser.mjs
// These browser regressions exercise all raster vector commands on PNG and JPEG using native-coordinate gestures. They check overlay alignment, EXIF orientation, annotation history, and the existing statistics worker.
import { checkRasterLineDraft } from './continuousLineBrowser.mjs';
import { runSvgTests } from './vectorDrawingSvgBrowser.mjs';
export function assert(value, message) { if (!value) throw new Error(message); }
export const near = (a, b) => Math.abs(a - b) < 1e-5;
export function pointer(svg, type, x, y, options = {}) {
  const p = new DOMPoint(x, y).matrixTransform(svg.getScreenCTM());
  svg.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: p.x, clientY: p.y, pointerId: 1, button: 0, ...options }));
}
export function gesture(svg, kind) {
  if (kind === 'line') {
    for (const [x,y] of [[20,20],[40,20],[40,40],[60,40],[60,60]]) { pointer(svg,'pointerdown',x,y); pointer(svg,'pointerup',x,y); }
    pointer(svg,'pointermove',70,70);
    svg.parentElement.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true})); return;
  }
  pointer(svg, 'pointerdown', 20, 20); pointer(svg, 'pointermove', 40, 30);
  if (kind === 'polygon' || kind === 'arc') {
    pointer(svg, 'pointerup', 20, 20); pointer(svg, 'pointerdown', 40, 20); pointer(svg, 'pointerup', 40, 20);
    pointer(svg, 'pointermove', 40, 40); pointer(svg, 'pointerdown', 40, 40); pointer(svg, 'pointerup', 40, 40);
    if (kind === 'polygon') svg.parentElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  } else pointer(svg, 'pointerup', 40, 30);
}
const frame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
async function until(fn) { for (let i = 0; i < 100; i++) { if (fn()) return; await new Promise(r => setTimeout(r, 20)); } throw new Error('Timed out waiting for analysis'); }
export async function run() {
  const passed = [];
  try {
    console.log('VECTOR TEST imports');
    const { renderFile: png } = await import('/PanelInstances/ViewPanels/FileViewers/ViewPNG.mjs');
    const { renderFile: jpg } = await import('/PanelInstances/ViewPanels/FileViewers/ViewJPG.mjs');
    const { installPngAnalysisTools } = await import('/RasterAnalysis/PngAnalysisTools.mjs');
    const { resolveExtension } = await import('/PanelInstances/ViewPanels/FileViewParts/GetViewPanelElement.mjs');
    const { getActiveAnalysisTools } = await import('/RasterAnalysis/AnalysisToolsContext.mjs');
    const globalToolbar = document.createElement('div'); globalToolbar.id = 'global-toolbar'; globalToolbar.style.display = 'none';
    const subToolbar = document.createElement('div'); subToolbar.id = 'sub-toolbar'; document.body.append(globalToolbar, subToolbar);
    const { createToolbar } = await import('/panels/createToolbar.mjs'); await createToolbar();
    await (await import('./analysisToolbarBrowser.mjs')).checkAnalysisToolbar();
    passed.push('Analysis Tools: shared subtoolbar, active-image ownership, no duplicates, replacement/disposal');
    const toggleAnalysis = async () => {
      const context = getActiveAnalysisTools(), opening = !context.visible;
      context.toggle(); if (opening) await until(() => context.visible);
    };
    for (const filename of ['test.PNG', 'test.JPG', 'test.jpeg', 'oriented.JPEG']) {
      console.log('VECTOR TEST ' + filename);
      const host = document.createElement('div'); host.className = 'panel'; host.style.cssText = 'width:700px;height:550px;position:relative'; document.body.append(host);
      window.__nvActivePanelElement = host;
      assert(['png', 'jpg', 'jpeg'].includes(resolveExtension(filename)), 'case-normalized dispatch');
      await (filename.endsWith('PNG') ? png : jpg)(filename, host, null, '/Notebook');
      const viewport = host.__nvImageViewport, img = viewport.image;
      await img.decode(); await frame();
      assert(getActiveAnalysisTools(), 'viewer registers analysis for ' + filename);
      if (!getActiveAnalysisTools().visible) await toggleAnalysis();
      const originalOverlay = host.querySelector('[data-png-analysis-overlay]');
      assert(originalOverlay && subToolbar.querySelector('[data-png-analysis]'), 'viewer analysis overlay present');
      assert(!host.querySelector('[data-png-analysis]'), 'analysis controls are outside the image panel');
      // Replace only analysis with an injected result panel factory to inspect worker output.
      host._dispose(); host.replaceChildren();
      const { mountImageViewport } = await import('/PanelInstances/ViewPanels/FileViewers/ImageViewport.mjs');
      const view = mountImageViewport(host, img); let analysis;
      const dispose = installPngAnalysisTools(host, view, filename, async (_name, _id, _type, vars) => { analysis = vars.analysis; return { panel: document.createElement('div') }; });
      if (!getActiveAnalysisTools().visible) await toggleAnalysis();
      const svg = host.querySelector('[data-png-analysis-overlay]');
      const click = label => { const button = [...subToolbar.querySelectorAll('button')].find(b => b.textContent === label); assert(button, label); button.click(); };
      for (const kind of ['line','circle','ellipse','arc','rectangle','polygon']) { click(kind[0].toUpperCase() + kind.slice(1)); gesture(svg, kind); }
      const artwork = svg.children[2]; assert(artwork.children.length === 6, 'all six tools committed for ' + filename);
      assert(artwork.firstChild.getAttribute('d') === 'M 20 20 L 40 20 L 40 40 L 60 40 L 60 60', 'five committed Line vertices without hover');
      checkRasterLineDraft(svg, host, artwork, click);
      click('Analyze annotation'); await until(() => analysis?.latest?.result);
      assert(analysis.annotations.length === 6, 'analysis exposes geometry');
      assert(near(analysis.measurements.area, 200), 'native polygon area');
      assert(analysis.latest.result.selected === 210, 'existing pixel-center polygon statistics');
      // The original Region/Add/Subtract workflow retains its record format and keyboard editing.
      click('Region'); pointer(svg,'pointerdown',10,10); pointer(svg,'pointerdown',30,10);
      pointer(svg,'pointerdown',35,35); host.dispatchEvent(new KeyboardEvent('keydown',{key:'Backspace',bubbles:true,cancelable:true}));
      pointer(svg,'pointermove',30,30); assert(svg.children[1].children.length > 0, 'legacy region live preview');
      pointer(svg,'pointerdown',30,30); host.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
      assert(analysis.regions[0].points.length === 3 && !analysis.regions[0].geometry, 'original region format retained');
      assert(analysis.annotations.length === 6, 'region gesture does not duplicate annotations');
      click('Add polygon'); pointer(svg,'pointerdown',1,1); host.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
      assert(analysis.regions.length === 1, 'cancel region preserves selection');
      await toggleAnalysis();
      const undoEvent = new KeyboardEvent('keydown',{key:'z',ctrlKey:true,bubbles:true,cancelable:true}); host.dispatchEvent(undoEvent);
      assert(!undoEvent.defaultPrevented, 'hidden analysis does not consume raster undo'); await toggleAnalysis();
      const coordinates = JSON.stringify(analysis.annotations);
      for (const zoom of [.5, 1, 4]) {
        view.command({ action:'set', zoom }); view.command({action:'pan',dx:31,dy:-19}); host.style.width = `${650 - zoom * 10}px`; await frame();
        const imageBox = img.getBoundingClientRect(), overlayBox = svg.getBoundingClientRect();
        assert(near(imageBox.x, overlayBox.x) && near(imageBox.width, overlayBox.width) && near(imageBox.y, overlayBox.y), 'overlay aligned at ' + zoom);
        assert(JSON.stringify(analysis.annotations) === coordinates, 'annotation coordinates unchanged');
      }
      view.state.angle = 90; view.render(); await frame();
      assert(near(img.getBoundingClientRect().width, svg.getBoundingClientRect().width), 'rotated overlay aligned');
      click('Undo annotation'); assert(analysis.annotations.length === 5, 'undo annotation'); click('Redo annotation'); assert(analysis.annotations.length === 6, 'redo annotation');
      click('Circle'); pointer(svg,'pointerdown',10,10); pointer(svg,'pointermove',15,20);
      window.dispatchEvent(new CustomEvent('activePanelChanged')); assert(!svg.lastChild.children.length, 'panel switch clears preview');
      pointer(svg,'pointerup',15,20); assert(analysis.annotations.length === 6, 'panel switch prevents commit');
      click('Freehand'); pointer(svg,'pointerdown',20,20); pointer(svg,'pointermove',23,24); pointer(svg,'pointermove',26,24);
      assert(svg.lastChild.querySelector('polyline'), 'freehand live preview'); pointer(svg,'pointerup',26,28);
      assert(analysis.annotations.length === 7 && analysis.annotations[6].kind === 'freehand', 'one freehand annotation per drag');
      assert(analysis.annotations[6].points.length === 4 && near(analysis.measurements.length,12), 'native freehand samples and length');
      const strokeCoordinates = JSON.stringify(analysis.annotations[6]);
      view.command({action:'set',zoom:4}); view.command({action:'pan',dx:20,dy:30}); host.style.height = '480px'; await frame();
      assert(JSON.stringify(analysis.annotations[6]) === strokeCoordinates, 'freehand stays in native coordinates after transforms');
      click('Undo annotation'); assert(analysis.annotations.length === 6, 'undo entire freehand stroke');
      click('Redo annotation'); assert(analysis.annotations.length === 7, 'redo entire freehand stroke');
      const regionsBefore = JSON.stringify(analysis.regions); click('Analyze annotation');
      assert(JSON.stringify(analysis.regions) === regionsBefore, 'open freehand is not treated as a closed pixel ROI');
      pointer(svg,'pointerdown',10,10); pointer(svg,'pointermove',15,20);
      host.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})); pointer(svg,'pointerup',15,20);
      assert(analysis.annotations.length === 7 && !svg.lastChild.children.length, 'Escape cancels freehand preview');
      const canvas = document.createElement('canvas'); canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      canvas.getContext('2d').drawImage(img,0,0);
      if (filename.startsWith('oriented')) {
        assert(img.naturalWidth === 80 && img.naturalHeight === 120, 'EXIF native dimensions');
        const c = canvas.getContext('2d').getImageData(30,10,1,1).data; assert(c[0] > 200 && c[2] < 50, 'oriented canvas pixels match displayed top');
      }
      if (filename.endsWith('PNG')) assert(canvas.getContext('2d').getImageData(1,1,1,1).data[3] === 0, 'PNG transparency preserved');
      assert(img.src.includes(filename), 'source URL unchanged');
      dispose(); host._dispose(); host.remove(); passed.push(filename + ': seven analysis tools, ROI worker, transforms, history, cleanup, decoding');
    }
    globalToolbar.remove(); subToolbar.remove();
    console.log('VECTOR TEST SVG');
    await runSvgTests(passed);
    return { ok: true, passed };
  } catch (error) { return { ok: false, passed, error: error.stack }; }
}
