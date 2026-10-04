// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/CSVEditorLatency.test.mjs
// This test exercises the real CSV controller with presentation stubs to verify bounded typing and selection work and preserve undo, saving, and virtual-cell behavior.
import assert from 'node:assert/strict';
import { csvRenderDimensions } from './CSVGridModel.mjs';
import { renderEditor } from './CSVeditor.mjs';

// Presentation counters measure controller calls, not browser layout or paint latency.
const element = () => ({
  style: {}, dataset: {}, classList: { remove() {} }, isConnected: true,
  setAttribute() {}, appendChild() {}, contains() { return false; }, focus() {},
});
globalThis.document = { createElement: element };
globalThis.window = { NodevisionState: { fileIsDirty: false } };
let cells = [], renders = 0, paints = 0;
globalThis.csvTest = {
  toolbarUpdates: 0,
  view: {
    render(rows, active) {
      renders++;
      const dims = csvRenderDimensions(rows, active);
      cells = Array.from({ length: dims.rows }, () => Array.from({ length: dims.cols }, element));
    },
    cellAt: (row, col) => cells[row]?.[col],
    paint() { paints++; },
  },
};
let saved;
globalThis.fetch = async (url, options) => {
  if (url === '/api/save') {
    saved = JSON.parse(options.body);
    return new Response('{}');
  }
  return new Response('A,B\nC');
};
const cleanup = await renderEditor('latency.csv', element());
const editor = window.__nvCsvEditor;
const initialRenders = renders, initialToolbarUpdates = csvTest.toolbarUpdates;
for (let i = 0; i < 10; i++) editor.input({ row: 0, col: 0 }, 'typed-' + i);
assert.equal(renders, initialRenders, 'typing does not rebuild the grid');
assert.equal(csvTest.toolbarUpdates - initialToolbarUpdates, 1, 'typing updates dirty toolbar only on the transition');
assert.equal(editor.getRows()[0][0], 'typed-9');
editor.history.undo();
assert.equal(editor.getRows()[0][0], 'typed-8');
editor.history.redo();
assert.equal(editor.getRows()[0][0], 'typed-9');
const beforeSelectionPaints = paints;
editor.select({ row: 0, col: 1 });
assert.equal(paints - beforeSelectionPaints, 1, 'selection paints once');
editor.input({ row: 1, col: 1 }, '');
assert.deepEqual(editor.getRows()[1], ['C', ''], 'virtual blank field materializes');
editor.history.undo();
assert.deepEqual(editor.getRows()[1], ['C'], 'undo restores ragged row');
await window.saveWYSIWYGFile('latency.csv');
assert.equal(saved.content, 'typed-9,B\nC');
assert.equal(window.NodevisionState.fileIsDirty, false);
const beforeNewEdit = csvTest.toolbarUpdates;
editor.input({ row: 0, col: 0 }, 'after save');
assert.equal(csvTest.toolbarUpdates, beforeNewEdit + 1, 'first edit after save refreshes dirty toolbar');
const paintsBeforeNoop = paints;
editor.input({ row: 0, col: 0 }, 'after save');
assert.equal(paints, paintsBeforeNoop, 'unchanged input does no extra paint');
cleanup();
console.log('CSV controller latency work bounds passed');
