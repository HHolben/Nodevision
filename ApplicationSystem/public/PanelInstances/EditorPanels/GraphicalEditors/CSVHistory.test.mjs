// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/CSVHistory.test.mjs
// This test checks immutable CSV history across typing, virtual cells, range moves, bounded undo, and branching after undo.
import assert from 'node:assert/strict';
import { createCsvHistory } from './CSVHistory.mjs';
import { setCsvCellValue, csvRenderDimensions, declaredColumnCount } from './CSVGridModel.mjs';
import { moveCsvRange } from './CSVRangeModel.mjs';

const original = Object.freeze([Object.freeze(['A', 'B']), Object.freeze(['C'])]);
let state = { rows: original, anchor: { row: 0, col: 0 }, active: { row: 0, col: 0 } };
const history = createCsvHistory({ readSnapshot: () => state, writeSnapshot: next => { state = next; }, maxEntries: 2 });
function edit(row, col, value) {
  const before = state;
  state = { ...state, rows: setCsvCellValue(state.rows, row, col, value) };
  return history.record(before);
}

assert.equal(edit(0, 0, 'A'), false);
assert.equal(history.canUndo(), false);
assert.equal(edit(0, 0, 'typed'), true);
assert.equal(state.rows[1], original[1], 'untouched rows are shared, not cloned');
assert.equal(original[0][0], 'A', 'old state is immutable');
assert.equal(edit(1, 2, ''), true, 'empty virtual field still materializes');
assert.deepEqual(state.rows[1], ['C', '', '']);
history.undo();
assert.deepEqual(state.rows[1], ['C']);
history.undo();
assert.equal(state.rows, original);
assert.equal(history.undo(), false);
history.redo();
assert.equal(state.rows[0][0], 'typed');
edit(0, 1, 'branch');
assert.equal(history.canRedo(), false);
const beforeMove = state;
state = { ...state, rows: moveCsvRange(state.rows, { top: 0, left: 0, bottom: 0, right: 1 }, { row: 2, col: 1 }) };
history.record(beforeMove);
assert.deepEqual(state.rows[2], ['', 'typed', 'branch']);
history.undo();
assert.equal(state.rows, beforeMove.rows);
history.undo();
assert.equal(history.undo(), false, 'history remains bounded');
history.clear();
assert.equal(history.canRedo(), false);

// Dimension planning must inspect row lengths without reading or copying cell values.
const unreadableCells = new Proxy(['x', 'y'], { get(target, key) {
  if (/^\d+$/.test(String(key))) throw new Error('Dimension planning read a cell');
  return Reflect.get(target, key);
} });
assert.equal(declaredColumnCount([unreadableCells]), 2);
assert.deepEqual(csvRenderDimensions([unreadableCells], { row: 8, col: 9 }), { rows: 10, cols: 11 });
console.log('CSV immutable history and dimension work bounds passed');
