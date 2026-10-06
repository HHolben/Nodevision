// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/GraphManagerDependencies/GraphSemanticZoom.test.mjs
// These regressions use the bundled Cytoscape engine to verify semantic presentation, source and camera invariants, custom styles, refreshed edges, and adapter cleanup without a browser renderer.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { installGraphSemanticZoom } from './GraphSemanticZoom.mjs';
import { executePanelZoom, getPanelZoomState, getPanelZoomCapabilities, setPanelZoomMode, getPanelZoomMode } from '../../../panels/panelZoomCapabilities.mjs';
const vendorModule = { exports: {} };
vm.runInThisContext('(function(module,exports){' + readFileSync(new URL('../../../vendor/cytoscape/cytoscape.min.js', import.meta.url), 'utf8') + '\n})')(vendorModule, vendorModule.exports);
const cytoscape = vendorModule.exports;
const plain = value => JSON.parse(JSON.stringify(value));
function fixture() {
  const host = new EventTarget(); host.closest = () => null;
  const graph = cytoscape({ headless: true, styleEnabled: true, layout: { name: 'preset' }, elements: [
    { data: { id: 'parent' } }, { data: { id: 'a', parent: 'parent' }, position: { x: 11, y: 22 } }, { data: { id: 'b' }, position: { x: 300, y: 30 } },
    { data: { id: 'e', source: 'a', target: 'b', edgeLabel: 'reference' } }
  ], style: [{ selector: 'edge', style: { label: 'data(edgeLabel)', 'text-opacity': .6, 'line-color': '#123456', width: 7, 'line-style': 'dashed' } },
    { selector: 'edge:selected', style: { width: 9 } }, { selector: 'edge.nv-broken-link-edge', style: { 'line-color': '#ff0000' } }] });
  const dispose = installGraphSemanticZoom(host, graph);
  return { host, graph, dispose, edge: graph.$('#e'), command: level => executePanelZoom(host, 'semantic', { action: 'set', level }) };
}
const snapshot = graph => plain({ data: graph.elements().map(e => e.data()), positions: graph.nodes().map(n => n.position()), parents: graph.nodes().map(n => n.parent().id()), selected: graph.$(':selected').map(e => e.id()), zoom: graph.zoom(), pan: graph.pan() });
test('100 transitions preserve data, compounds, node/edge selection and camera without layout or writes', () => {
  const f = fixture(); f.graph.$('#a').select(); f.edge.select(); f.graph.zoom(1.7); f.graph.pan({ x: 31, y: 42 });
  const before = snapshot(f.graph); let changes = 0;
  f.graph.on('layoutstart position data add remove select unselect', () => changes++);
  f.graph.layout = f.graph.fit = () => { throw Error('Semantic transition attempted layout/fit'); };
  for (let i=0;i<100;i++) { assert.equal(f.command(i%2 ? 'annotations' : 'structure'), true); assert.deepEqual(snapshot(f.graph), before); }
  assert.equal(changes, 0); f.dispose(); f.graph.destroy();
});
test('owned opacity is reversible, exceptions react to selection/classes, refreshed edges inherit level', () => {
  const f = fixture(), style = () => ['line-color','width','line-style','label'].map(key => f.edge.style(key));
  const original = style(); f.command('structure'); assert.equal(f.edge.style('text-opacity'), '0'); assert.deepEqual(style(), original);
  f.edge.select(); assert.equal(f.edge.style('text-opacity'), '0.6'); assert.equal(f.edge.style('width'), '9px');
  f.edge.unselect(); f.edge.addClass('nv-selected-link'); assert.equal(f.edge.style('text-opacity'), '0.6');
  f.edge.removeClass('nv-selected-link'); f.edge.addClass('nv-broken-link-edge'); assert.equal(f.edge.style('text-opacity'), '0.6');
  assert.equal(f.edge.style('line-color'), 'rgb(255,0,0)'); f.edge.removeClass('nv-broken-link-edge');
  f.edge.data('edgeLabel', 'refreshed reference'); assert.equal(f.edge.style('text-opacity'), '0');
  const next = f.graph.add({ data: { id: 'new', source: 'a', target: 'b', edgeLabel: 'new' } }); assert.equal(next.style('text-opacity'), '0');
  f.graph.style().selector('edge').style({ 'line-color': '#abcdef', 'text-opacity': .8 }).update();
  f.command('annotations'); assert.equal(f.edge.style('text-opacity'), '0.8'); assert.equal(f.edge.style('line-color'), 'rgb(171,205,239)');
  f.dispose(); assert.equal(f.edge.style('text-opacity'), '0.8'); assert.equal(f.edge.data('edgeLabel'), 'refreshed reference'); f.graph.destroy();
});
test('no-op/clamped/reset commands, unsupported actions and replacement cleanup', () => {
  const f = fixture(); let styleEvents = 0; f.graph.on('style class', () => styleEvents++);
  assert.equal(f.command('annotations'), true); assert.equal(styleEvents, 0);
  assert.equal(executePanelZoom(f.host, 'semantic', { action: 'fit' }), false);
  assert.equal(f.command('invalid'), false); f.command('structure'); const changed = styleEvents;
  assert.equal(executePanelZoom(f.host, 'semantic', { action: 'zoom', factor: .5 }), true); assert.equal(styleEvents, changed);
  executePanelZoom(f.host, 'semantic', { action: 'reset' }); assert.equal(getPanelZoomState(f.host, 'semantic').level, 'annotations');
  setPanelZoomMode(f.host, 'semantic'); const replacement = installGraphSemanticZoom(f.host, f.graph);
  assert.equal(getPanelZoomMode(f.host), 'geometric'); assert.equal(f.graph.style().json().filter(r => r.selector === 'edge.nv-semantic-structure').length, 1);
  f.dispose(); assert.equal(getPanelZoomCapabilities(f.host).semantic, true); replacement(); assert.equal(getPanelZoomCapabilities(f.host).semantic, false);
  f.graph.destroy();
});
test('repeated destruction removes registration and owned presentation rules', () => {
  for (let i=0;i<5;i++) {
    const f = fixture(); f.command('structure'); f.dispose(); f.dispose();
    assert.equal(getPanelZoomCapabilities(f.host).semantic,false);
    assert.equal(f.host.__nvGraphSemanticZoom,undefined);
    assert.equal(f.graph.style().json().some(r => r.selector === 'edge.nv-semantic-structure'),false);
    assert.equal(f.edge.hasClass('nv-semantic-structure'),false);
    f.graph.destroy();
  }
});
