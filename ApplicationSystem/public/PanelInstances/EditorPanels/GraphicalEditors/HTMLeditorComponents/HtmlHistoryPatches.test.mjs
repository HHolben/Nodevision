// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlHistoryPatches.test.mjs
// These tests verify compact text retention, atomic preimage refusal, and storage estimates independently of browser event routing.
import assert from 'node:assert/strict';
import { compactPatches, replayPatches, patchBytes } from './HtmlHistoryPatches.mjs';
const first = { data: 'ab' }, second = { data: 'unexpected' };
const patches = compactPatches([
  { kind: 'text', node: first, name: null, before: '', after: 'a' },
  { kind: 'text', node: first, name: null, before: 'a', after: 'ab' },
]);
assert.equal(patches.length, 1);
assert.equal(patches[0].before, '');
assert.equal(patches[0].after, 'ab');
replayPatches(patches, false);
assert.equal(first.data, '');
replayPatches(patches, true);
assert.equal(first.data, 'ab');
assert.throws(() => replayPatches([
  { kind: 'text', node: first, before: 'ab', after: 'changed' },
  { kind: 'text', node: second, before: 'expected', after: 'bad' },
], true), /preimage/);
assert.equal(first.data, 'ab', 'a later refusal rolls back already applied patches');
assert.equal(second.data, 'unexpected');
const longRun = compactPatches(Array.from({ length: 1000 }, (_, i) => ({ kind: 'text', node: first, name: null, before: 'a'.repeat(i), after: 'a'.repeat(i + 1) })));
assert.equal(longRun.length, 1);
assert.equal(patchBytes(longRun), 2128);
assert.equal(compactPatches([{ kind: 'text', node: first, before: 'a', after: 'a' }]).length, 0);
