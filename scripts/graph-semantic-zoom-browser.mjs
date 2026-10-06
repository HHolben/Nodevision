// Nodevision/scripts/graph-semantic-zoom-browser.mjs
// This browser regression exercises real Cytoscape presentation, shared zoom routing, toolbar controls, lifecycle cleanup, and bounded graph-detail benchmarks without accessing Notebook data.
import { installGraphSemanticZoom } from '/PanelInstances/InfoPanels/GraphManagerDependencies/GraphSemanticZoom.mjs';
import { executePanelZoom, getPanelZoomState, getPanelZoomCapabilities, setPanelZoomMode } from '/panels/panelZoomCapabilities.mjs';
import { installPanelZoomShortcuts, getPanelViewportState } from '/panels/panelZoomPan.mjs';
import { appendPanelZoomModeControls } from '/ToolbarJSONfiles/panelZoomModesWidget.mjs';
const ok = (value, message) => { if (!value) throw Error(message); };
const same = (a, b, message) => ok(JSON.stringify(a) === JSON.stringify(b), message);
const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
function fixture(count = 3, density = 1) {
  const panel = document.createElement('div'); panel.className = 'panel'; panel.style.cssText = 'width:700px;height:450px;position:relative';
  const host = document.createElement('div'); host.style.cssText = 'width:650px;height:400px'; panel.append(host); document.body.append(panel);
  const surface = document.createElement('div'); surface.dataset.graphManagerSurface = ''; surface.style.cssText = 'width:650px;height:400px'; panel.replaceChildren(surface); surface.append(host);
  const elements = [];
  for (let i = 0; i < count; i++) {
    elements.push({ data: { id: `n${i}`, label: `Node ${i}` }, position: { x: (i % 100) * 30, y: Math.floor(i / 100) * 30 } });
    if (i) elements.push({ data: { id: `e${i}`, source: `n${i-1}`, target: `n${i}`, edgeLabel: `Reference ${i}` } });
  }
  for (let i=0;i<count;i++) for(let j=2;j<=density;j++) elements.push({ data: { id: `dense${i}-${j}`, source: `n${i}`, target: `n${(i+j)%count}`, edgeLabel: `Reference ${i}/${j}` } });
  const cy = cytoscape({ container: host, elements, layout: { name: 'preset', fit: false },
    style: [{ selector: 'node', style: { label: 'data(label)' } }, { selector: 'edge', style: { label: 'data(edgeLabel)', 'text-opacity': .65, 'curve-style': 'bezier', 'line-color': '#123456', width: 5, 'line-style': 'dashed' } }] });
  const dispose = installGraphSemanticZoom(host, cy);
  return { panel, host, cy, dispose };
}
try {
  const a = fixture(), b = fixture();
  window.activeCell = a.panel;
  const shortcuts = installPanelZoomShortcuts();
  const toolbar = document.createElement('div'); document.body.append(toolbar);
  const sync = appendPanelZoomModeControls(toolbar, () => window.activeCell);
  const mode = toolbar.querySelector('[aria-label="Panel zoom mode"]'), levels = toolbar.querySelector('[aria-label="Semantic detail"]');
  a.cy.$('#n1').select(); a.cy.$('#e1').select(); a.cy.$('#e2').addClass('nv-broken-link-edge');
  a.cy.zoom(1.3); a.cy.pan({ x: 31, y: 47 }); await frame();
  const snapshot = cy => structuredClone({ data: cy.elements().map(e => e.data()), positions: cy.nodes().map(n => n.position()), selected: cy.$(':selected').map(e => e.id()), zoom: cy.zoom(), pan: cy.pan(), edges: cy.edges().map(e => ({ source: e.sourceEndpoint(), target: e.targetEndpoint(), points: e.controlPoints() })), bounds: cy.nodes().map(n => n.boundingBox()), parents: cy.nodes().map(n => [n.id(), n.parent().id()]), count: [cy.nodes().length, cy.edges().length] });
  const before = snapshot(a.cy);
  let requests = 0, selectionMessages = 0;
  const originalFetch = window.fetch, originalSend = XMLHttpRequest.prototype.send;
  window.fetch = () => { requests++; throw Error('Unexpected semantic fetch'); };
  XMLHttpRequest.prototype.send = () => { requests++; throw Error('Unexpected semantic request'); };
  window.NodevisionState = { selectedFile: 'fixture.html', fileIsDirty: false };
  const stateBefore = JSON.stringify(window.NodevisionState);
  const selectionListener = () => selectionMessages++;
  window.addEventListener('nodevision-selection-changed', selectionListener);
  let fitCalls = 0, layoutCalls = 0;
  const originalFit = a.cy.fit, originalLayout = a.cy.layout;
  a.cy.fit = function(...args) { fitCalls++; return originalFit.apply(this,args); };
  a.cy.layout = function(...args) { layoutCalls++; return originalLayout.apply(this,args); };

  let layouts = 0, positionEvents = 0, dataEvents = 0;
  a.cy.on('layoutstart', () => layouts++); a.cy.on('position', () => positionEvents++); a.cy.on('data', () => dataEvents++);
  mode.value = 'semantic'; mode.dispatchEvent(new Event('change'));
  ok(!levels.hidden && levels.options.length === 2, 'two named levels exposed');
  for (let i=0; i<100; i++) {
    levels.value = i % 2 ? 'annotations' : 'structure'; levels.dispatchEvent(new Event('change'));
    same(snapshot(a.cy), before, 'geometry, camera, graph data and node/edge selection preserved');
  }
  ok(!layouts && !positionEvents && !dataEvents && !fitCalls && !layoutCalls, 'no layouts, fits, movement or data mutations');
  ok(!requests && !selectionMessages && JSON.stringify(window.NodevisionState) === stateBefore, 'no requests, dirty state or Notebook selection changes');

  const command = level => executePanelZoom(a.panel, 'semantic', { action: 'set', level });
  command('structure');
  ok(a.cy.$('#e1').style('text-opacity') === '0.65', 'selected edge retains custom opacity');
  ok(a.cy.$('#e2').style('text-opacity') === '0.65', 'broken edge retains annotation: '+a.cy.$('#e2').style('text-opacity')+' '+a.cy.$('#e2').classes());
  a.cy.$('#e1').unselect(); ok(a.cy.$('#e1').style('text-opacity') === '0', 'ordinary edge annotation suppressed');
  a.cy.$('#e1').addClass('nv-selected-link'); ok(a.cy.$('#e1').style('text-opacity') === '0.65', 'Graph Manager link selection stays readable');
  a.cy.$('#e1').removeClass('nv-selected-link');
  a.cy.add({ data: { id: 'new', source: 'n0', target: 'n2', edgeLabel: 'new detail' } });
  ok(a.cy.$('#new').style('text-opacity') === '0', 'new edges inherit structure');
  ok(a.cy.$('#n1').style('label') === 'Node 1', 'node labels unchanged');
  ok(!executePanelZoom(a.panel, 'semantic', { action: 'fit' }), 'unsupported semantic fit refused');
  ok(!executePanelZoom(a.panel, 'semantic', { action: 'set', level: 'invented' }), 'invalid level refused');
  const wheel = (host, deltaY, semantic = true) => { const event = new WheelEvent('wheel', { ctrlKey: true, altKey: semantic, deltaY, bubbles: true, cancelable: true }); host.dispatchEvent(event); return event; };
  const stateB = snapshot(b.cy);
  let dispatches = 0;
  const countDispatch = event => { if (event.detail.mode === 'semantic') dispatches++; };
  window.addEventListener('nv-panel-zoom-pan-updated', countDispatch);
  const camera = { zoom: a.cy.zoom(), pan: a.cy.pan() };
  ok(wheel(a.host, -100).defaultPrevented, 'semantic wheel claimed');
  ok(dispatches === 1, 'one accepted semantic owner');
  ok(wheel(a.host, -100).defaultPrevented && dispatches === 2, 'boundary command claimed once without geometric fallback');
  ok(getPanelZoomState(a.panel, 'semantic').level === 'annotations', 'wheel uses selected mode');
  ok(!wheel(b.host, 100).defaultPrevented, 'inactive owner not claimed');
  ok(getPanelZoomState(b.panel, 'semantic').level === 'annotations', 'other registration isolated');
  same(snapshot(b.cy), stateB, 'inactive Cytoscape camera also unchanged');
  window.activeCell = b.panel; setPanelZoomMode(b.panel, 'semantic');
  const countBefore = dispatches;
  wheel(a.host, 100); ok(dispatches === countBefore, 'ownership switch excludes A');
  wheel(b.host, 100); ok(dispatches === countBefore+1 && getPanelZoomState(b.panel, 'semantic').level === 'structure', 'ownership switch dispatches once to B');
  executePanelZoom(b.host, 'semantic', { action: 'reset' }); window.activeCell = a.panel;

  for (const [key, expected] of [['-', 'structure'], ['+', 'annotations'], ['-', 'structure'], ['0', 'annotations']]) {
    const e = new KeyboardEvent('keydown', { ctrlKey: true, altKey: true, key, bubbles: true, cancelable: true }); a.host.dispatchEvent(e);
    ok(e.defaultPrevented && getPanelZoomState(a.panel, 'semantic').level === expected, `semantic key ${key}`);
  }
  same({ zoom: a.cy.zoom(), pan: a.cy.pan() }, camera, 'semantic gestures preserve native camera');
  b.panel.hidden = true;
  ok(!executePanelZoom(b.host, 'semantic', { action: 'set', level: 'structure' }), 'hidden retained owner refuses direct commands');
  window.activeCell = b.panel; wheel(b.host, 100);
  ok(getPanelZoomState(b.host, 'semantic').level === 'annotations', 'hidden active host receives no semantic change');
  window.activeCell = a.panel;
  b.panel.hidden = false;
  window.activeCell = b.panel; wheel(b.host,100); ok(getPanelZoomState(b.host,'semantic').level === 'structure', 'reactivated retained owner works');
  window.activeCell = a.panel;
  const rawStyles = ['line-color','width','line-style'].map(key => a.cy.$('#e1').style(key));
  command('annotations'); command('structure'); command('annotations');
  same(['line-color','width','line-style'].map(key => a.cy.$('#e1').style(key)), rawStyles, 'custom edge styles survive both levels');

  setPanelZoomMode(a.panel, 'geometric');
  const scale = a.cy.zoom();
  ok(wheel(a.host, -100, false).defaultPrevented && a.cy.zoom() > scale && !a.panel.querySelector('.nv-panel-zoom-viewport'), 'native geometric camera route');
  ok(getPanelZoomState(a.panel, 'semantic').level === 'annotations', 'geometric does not change semantic level');
  command('structure'); a.dispose();
  ok(a.cy.$('#e1').style('text-opacity') === '0.65', 'cleanup restores custom annotation style');
  ok(!getPanelZoomCapabilities(a.panel).semantic, 'cleanup unregisters semantic owner');
  const removedCount = dispatches; executePanelZoom(a.host,'semantic',{action:'reset'});
  ok(dispatches === removedCount,'removed adapter receives zero semantic commands');
  b.cy.destroy(); ok(!getPanelZoomCapabilities(b.panel).semantic, 'Cytoscape destruction unregisters');
  window.removeEventListener('nv-panel-zoom-pan-updated', countDispatch);
  window.removeEventListener('nodevision-selection-changed', selectionListener);
  ok(!requests && JSON.stringify(window.NodevisionState) === stateBefore, 'all semantic interaction checks made zero source/network changes');
  window.fetch = originalFetch; XMLHttpRequest.prototype.send = originalSend;
  shortcuts.dispose(); a.cy.destroy(); a.panel.remove(); b.panel.remove(); toolbar.remove();
  console.log('NV_TEST_PROGRESS', 'production mount');
  await (await import('/scripts/graph-semantic-production.mjs')).testProductionGraph();
  const benchmarks = [];
  for (const [size,density] of [[1000,1],[1000,4],[10000,1],[10000,4]]) {
    console.log('NV_TEST_PROGRESS', 'benchmark', size, density);
    const f = fixture(size,density); await frame(); await frame(); const samples = [], visible = [], style = [];
    let layouts = 0, selectionChanges = 0, dataChanges = 0, styleTime = 0;
    f.cy.on('layoutstart', () => layouts++); f.cy.on('select unselect', () => selectionChanges++); f.cy.on('data add remove', () => dataChanges++);
    const endBatch = f.cy.endBatch;
    f.cy.endBatch = function(...args) { const start = performance.now(); const result = endBatch.apply(this,args); styleTime += performance.now()-start; return result; };
    for (let i=0;i<20;i++) {
      styleTime = 0;
      const start = performance.now(); executePanelZoom(f.host, 'semantic', { action: 'set', level: i%2 ? 'annotations' : 'structure' });
      samples.push(performance.now()-start); style.push(styleTime);
      await frame(); await frame(); visible.push(performance.now()-start);
    }
    const stats = values => { values.sort((x,y)=>x-y); return { p50Ms:+values[10].toFixed(2), p95Ms:+values[18].toFixed(2) }; };
    benchmarks.push({ nodes:size, edges:f.cy.edges().length, command:stats(samples), styleUpdate:stats(style), throughPaintOpportunity:stats(visible), layouts, selectionChanges, dataChanges });
    f.dispose(); f.cy.destroy(); f.panel.remove();
  }
  document.querySelector('#result').textContent = 'PASS: semantic levels, real graph geometry/selection/camera, toolbar, gestures, isolation, cleanup; '+JSON.stringify(benchmarks);
} catch (error) { document.querySelector('#result').textContent = 'FAIL: '+error.stack; }
