// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SvgSelectionMarkers.test.mjs
// This test verifies selection-marker transitions, imported legacy cleanup, and bounded work when a large SVG changes selection.
import assert from 'node:assert/strict';
import { createSvgSelectionMarkers } from './SvgSelectionMarkers.mjs';

let scans = 0, writes = 0, reads = 0;
function element(attributes = {}, filter = '') {
  const attrs = new Map(Object.entries(attributes));
  return {
    style: { filter },
    hasAttribute(name) { reads++; return attrs.has(name); },
    getAttribute(name) { reads++; return attrs.get(name) ?? null; },
    setAttribute(name, value) { writes++; attrs.set(name, value); },
    removeAttribute(name) { writes++; attrs.delete(name); },
  };
}
const nodes = Array.from({ length: 10000 }, () => element());
nodes[10] = element({ 'data-selected': 'true' }, 'drop-shadow(0 0 2px #ff2f2f)');
nodes[20] = element({}, 'url(#authored-filter)');
const markers = createSvgSelectionMarkers(() => { scans++; return nodes; });
markers.update([nodes[0]]);
assert.equal(nodes[10].hasAttribute('data-selected'), false, 'imported marker removed');
assert.equal(nodes[10].style.filter, '', 'legacy selection filter cleared');
assert.equal(nodes[20].style.filter, 'url(#authored-filter)', 'authored filter retained');

scans = writes = reads = 0;
markers.update([nodes[1]]);
assert.equal(scans, 0, 'selection change performs no full document scan');
assert.equal(writes, 2, 'only old and new selection attributes change');
assert.equal(reads, 2, 'unrelated objects are not inspected');
writes = reads = 0;
markers.update([nodes[1], nodes[1]]);
assert.equal(writes, 0, 'same or duplicate selection does not generate mutation records');
markers.update([nodes[1], nodes[2]]);
assert.equal(writes, 1, 'additive selection writes only new member');
markers.update([]);
assert.equal(nodes[1].hasAttribute('data-selected'), false);
assert.equal(nodes[2].hasAttribute('data-selected'), false);
markers.update([nodes[3]]);
nodes[30].setAttribute('data-selected', 'true');
markers.reset();
markers.update([nodes[3]]);
assert.equal(nodes[30].hasAttribute('data-selected'), false, 'source replacement reconciles newly imported markers');
markers.dispose();
assert.equal(nodes[3].hasAttribute('data-selected'), false, 'disposal clears retained marker');
markers.update([nodes[3]]);
assert.equal(nodes[3].hasAttribute('data-selected'), false, 'disposed reconciler does no further work');
console.log('SVG selection marker correctness and work bounds passed');
