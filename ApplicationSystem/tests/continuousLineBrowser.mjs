// Nodevision/ApplicationSystem/tests/continuousLineBrowser.mjs
// These checks exercise continuous Line drafts and persistence in the real SVG editor. The native setup exposes screen coordinates so Electron can drive mouse input through Chromium rather than dispatching synthetic pointer events.
import { assert, pointer } from './vectorDrawingBrowser.mjs';
export async function setupNativeLine() {
  const { renderEditor } = await import('/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntime.mjs');
  const host = document.createElement('div'); host.style.cssText = 'width:900px;height:650px'; document.body.prepend(host);
  const cleanup = await renderEditor('vector-test.svg', host);
  // Real workspace clicks announce activation after pointerup, even for the same cell.
  const cell = document.createElement('div'); cell.className = 'panel-cell'; cell.dataset.id = 'GraphicalEditor';
  host.before(cell); cell.append(host);
  const { setupActivePanelTracking } = await import('/panels/workspaceParts/workspaceActiveTracking.mjs');
  const { activatePanelCell } = await import('/panels/workspaceParts/workspaceActivePanels.mjs');
  setupActivePanelTracking(); activatePanelCell(cell, { announce: false });
  const ctx = window.SVGEditorContext;
  ctx.setMode('line');
  const svg = ctx.svgRoot, wrapper = host.querySelector('[tabindex]');
  const preview = () => host.querySelector('[data-nv-editor-ui="line-tool-preview-line"]');
  const key = key => wrapper.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}));
  const paths = () => new DOMParser().parseFromString(ctx.getEditorHTML(),'image/svg+xml').querySelectorAll('path');
  const points = [[100,100],[140,100],[140,140],[180,140],[180,180]];
  window.checkNativeLine = index => {
    const state = ctx.debugLineToolState();
    assert(state.active && state.pointCount === index + 1, 'native click keeps same Line active: ' + index);
    assert(preview().getAttribute('display') !== 'none', 'native hover preview visible');
    assert(Math.abs(+preview().getAttribute('x2') - 220) < 1 && Math.abs(+preview().getAttribute('y2') - 220) < 1, 'native hover endpoint: ' + preview().getAttribute('x2') + ',' + preview().getAttribute('y2'));
    assert(paths().length === 0, 'draft excluded from save');
  };
  window.finishNativeLine = () => {
    assert(!ctx.debugLineToolState().active, 'Enter completes native Line');
    assert(paths().length === 1, 'one persistent path');
    const expected = paths()[0].getAttribute('d');
    const coordinates = expected.match(/-?\d+(?:\.\d+)?/g).map(Number);
    assert(coordinates.length === 10 && coordinates.every((v,i) => Math.abs(v - points.flat()[i]) < 1) && !expected.includes('Z'), 'one open path, no hover vertex');
    assert(ctx.undo() && paths().length === 0, 'undo removes whole Line');
    assert(ctx.redo() && paths()[0].getAttribute('d') === expected, 'redo restores all vertices');
    const saved = ctx.getEditorHTML(); ctx.setEditorHTML(saved);
    assert(paths()[0].getAttribute('d') === expected, 'reload preserves path');
    ctx.setMode('line');
    pointer(svg,'pointerdown',20,20); pointer(svg,'pointerdown',40,40); key('Escape');
    assert(paths().length === 1 && !svg.querySelector('[data-nv-editor-ui="line-tool-segment"]'), 'Escape removes all draft segments');
    ctx.setMode('line'); pointer(svg,'pointerdown',20,20); pointer(svg,'pointerdown',40,40); ctx.setMode('circle');
    assert(paths().length === 2 && !ctx.debugLineToolState().active, 'tool switch preserves committed vertices');
    ctx.setMode('line'); pointer(svg,'pointerdown',60,20); pointer(svg,'pointerdown',80,40);
    pointer(svg,'pointerdown',80,40,{detail:2});
    assert(paths().length === 3 && !ctx.debugLineToolState().active, 'double-click completes once');
    ctx.setMode('line'); pointer(svg,'pointerdown',20,20); pointer(svg,'pointerdown',30,30);
    assert(ctx.undo() && !ctx.debugLineToolState().active && paths().length === 3, 'undo cancels draft without removing finished path');
    pointer(svg,'pointerdown',20,20); pointer(svg,'pointercancel',20,20);
    assert(!ctx.debugLineToolState().active, 'pointer cancellation clears SVG draft');
    const layer = ctx.createLayer('Line transform'); layer.setAttribute('transform','translate(100 80) scale(2)');
    ctx.setActiveLayer(layer.id); ctx.setMode('line');
    pointer(svg,'pointerdown',120,100); pointer(svg,'pointerdown',160,140); key('Enter');
    const local = layer.querySelector('path').getAttribute('d').match(/-?\d+(?:\.\d+)?/g).map(Number);
    assert(local.length === 4 && local.every((v,i) => Math.abs(v-[10,10,30,30][i]) < .001), 'Line respects layer transforms');
    const other = document.createElement('div'); other.className = 'panel-cell'; other.dataset.id = 'Other'; cell.after(other);
    ctx.setMode('line'); pointer(svg,'pointerdown',120,100); pointer(svg,'pointerdown',160,140);
    activatePanelCell(other, { announce: false });
    assert(!ctx.debugLineToolState().active && !svg.querySelector('[data-nv-editor-ui="line-tool-segment"]'), 'actual panel switch cancels draft');
    activatePanelCell(cell, { announce: false }); other.remove();
    cleanup(); cell.remove();
  };
  window.nativeLineCoordinates = () => [...points, [220,220]].map(([x,y]) => { const p = new DOMPoint(x,y).matrixTransform(svg.getScreenCTM()); return {x:Math.round(p.x),y:Math.round(p.y)}; });
  return true;
}
export async function checkRasterLineDraft(svg, host, artwork, click) {
  const { setupActivePanelTracking } = await import('/panels/workspaceParts/workspaceActiveTracking.mjs');
  const { activatePanelCell } = await import('/panels/workspaceParts/workspaceActivePanels.mjs');
  const cell = document.createElement('div'); cell.className = 'panel-cell'; cell.dataset.id = 'FileView';
  host.before(cell); cell.append(host); setupActivePanelTracking(); activatePanelCell(cell, { announce: false });
  const count = artwork.children.length;
  const key = key => host.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}));
  click('Line');
  for (let i=0; i<5; i++) {
    pointer(svg,'pointerdown',10+i*10,10); pointer(svg,'pointerup',10+i*10,10);
    svg.dispatchEvent(new MouseEvent('click',{bubbles:true}));
    pointer(svg,'pointermove',70,30);
    assert(artwork.children.length === count, 'raster Line does not terminate on click ' + (i+1));
    const draft = svg.lastChild.querySelector('path');
    assert(draft && draft.getAttribute('d').endsWith('L 70 30'), 'raster hover segment follows pointer');
  }
  key('Escape'); assert(!svg.lastChild.children.length && artwork.children.length === count, 'raster Escape removes draft');
  pointer(svg,'pointerdown',10,10); pointer(svg,'pointerdown',20,20); click('Circle');
  assert(!svg.lastChild.children.length && artwork.children.length === count, 'raster tool switch removes draft');
  click('Line'); pointer(svg,'pointerdown',10,10); pointer(svg,'pointerdown',20,20); key('Enter');
  assert(artwork.children.length === count+1, 'raster repeat after cancellation');
  click('Undo annotation'); assert(artwork.children.length === count, 'raster Line undo');
  click('Redo annotation'); assert(artwork.children.length === count+1, 'raster Line redo');
  click('Undo annotation');
  click('Region');
  for (const [x,y] of [[10,10],[20,10],[20,20]]) {
    pointer(svg,'pointerdown',x,y); pointer(svg,'pointerup',x,y); svg.dispatchEvent(new MouseEvent('click',{bubbles:true}));
  }
  assert(svg.children[1].children.length > 0, 'region preview survives same-panel activation');
  key('Escape');
  cell.before(host); cell.remove(); window.activeCell = host; window.__nvActivePanelElement = host;
}

export async function setupNativeRasterLine() {
  const { mountImageViewport } = await import('/PanelInstances/ViewPanels/FileViewers/ImageViewport.mjs');
  const { installPngAnalysisTools } = await import('/RasterAnalysis/PngAnalysisTools.mjs');
  const { getActiveAnalysisTools } = await import('/RasterAnalysis/AnalysisToolsContext.mjs');
  const { activatePanelCell } = await import('/panels/workspaceParts/workspaceActivePanels.mjs');
  const cell = document.createElement('div'); cell.className = 'panel-cell'; cell.dataset.id = 'FileView';
  const host = document.createElement('div'); host.className = 'panel'; host.style.cssText = 'width:700px;height:480px';
  cell.append(host); document.body.prepend(cell);
  const img = new Image(); img.src = '/Notebook/test.PNG'; await img.decode();
  const viewport = mountImageViewport(host, img);
  const dispose = installPngAnalysisTools(host, viewport, 'native-line-test.PNG', async () => ({ panel: document.createElement('div') }));
  activatePanelCell(cell, { announce: false });
  const context = getActiveAnalysisTools(), analysis = context.analysis;
  const controls = document.createElement('div'); cell.before(controls); const unmount = context.mount(controls);
  const click = label => [...controls.querySelectorAll('button')].find(button => button.textContent === label).click();
  click('Line');
  const svg = host.querySelector('[data-png-analysis-overlay]'), points = [[10,10],[30,10],[30,30],[50,30],[50,50]];
  window.nativeLineCoordinates = () => [...points,[70,70]].map(([x,y]) => {
    const p = new DOMPoint(x,y).matrixTransform(svg.getScreenCTM()); return {x:Math.round(p.x),y:Math.round(p.y)};
  });
  window.checkNativeLine = index => {
    const draft = svg.lastChild.querySelector('path');
    assert(analysis.annotations.length === 0 && draft, 'native raster release preserves draft: ' + index);
    assert((draft.getAttribute('d').match(/[ML]/g) || []).length === index + 2, 'native raster clicks accumulate vertices');
    assert(draft.getAttribute('d').endsWith('L 70 70'), 'native raster hover follows released mouse');
  };
  window.finishNativeLine = () => {
    assert(analysis.annotations.length === 1, 'native raster Enter commits one path');
    assert(JSON.stringify(analysis.annotations[0].points) === JSON.stringify(points.map(([x,y]) => ({x,y}))), 'native raster path preserves clicked vertices');
    click('Undo annotation'); assert(!analysis.annotations.length, 'native raster undo');
    click('Redo annotation'); assert(analysis.annotations.length === 1, 'native raster redo');
    const other = document.createElement('div'); other.className = 'panel-cell'; other.dataset.id = 'Other'; cell.after(other);
    click('Line'); pointer(svg,'pointerdown',10,10); pointer(svg,'pointermove',30,30); activatePanelCell(other, { announce: false });
    assert(!svg.lastChild.children.length, 'raster panel switch cancels unfinished path');
    unmount(); dispose(); host._dispose(); controls.remove(); cell.remove(); other.remove();
  };
}
